import styled from '@emotion/styled'
import { useState, type FormEvent } from 'react'
import { api, currencyOptions, termOptions, errorText, fromMinor, money, priceStep, toMinor, useLoad, type Client, type Currency } from '../api'
import { Link, useNavigate } from 'react-router'
import { Backdrop, Dialog, useFeedback } from '../feedback'
import { Select } from '../select'
import { Icon } from '../icons'
import { Button, Card, ClientLogo, Empty, ErrorText, Field, Grid, Head, Page, Sub, Tag } from '../ui'

type Form = { name: string; email: string; website: string; location: string; taxId: string; phone: string; rate: string; currency: Currency; termsDays: string }

const empty: Form = { name: '', email: '', website: '', location: '', taxId: '', phone: '', rate: '', currency: 'usd', termsDays: '14' }

const ClientCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: 14px;
  transition: border-color 0.15s ease, transform 0.15s ease;

  &:hover {
    border-color: color-mix(in srgb, var(--accent) 40%, var(--line));
  }
  .top {
    display: flex;
    gap: 12px;
    align-items: center;
    min-width: 0;
  }
  .top div {
    min-width: 0;
  }
  .top b,
  .top p {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .top p {
    color: var(--muted);
    font-size: 13px;
  }
  .rate {
    font-size: 20px;
    font-weight: 650;
    font-variant-numeric: tabular-nums;
  }
  .rate small {
    font-size: 13px;
    font-weight: 400;
    color: var(--muted);
  }
  .actions {
    display: flex;
    gap: 6px;
    margin-top: auto;
  }
`

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 14px;

  .full {
    grid-column: 1 / -1;
  }
`

export default function Clients() {
  const { data, error, reload } = useLoad<Client[]>('/clients')
  const { toast, confirm } = useFeedback()
  const navigate = useNavigate()
  const [form, setForm] = useState<Form | null>(null)
  const [editing, setEditing] = useState<number | null>(null)
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  const open = (c?: Client) => {
    setEditing(c?.id ?? null)
    setForm(
      c
        ? {
            name: c.name,
            email: c.email ?? '',
            website: c.website ?? '',
            location: c.location ?? '',
            taxId: c.taxId ?? '',
            phone: c.phone ?? '',
            rate: c.rate ? fromMinor(c.rate, c.currency) : '',
            currency: c.currency,
            termsDays: String(c.termsDays),
          }
        : empty,
    )
    setFormError('')
  }

  const close = () => {
    setForm(null)
    setEditing(null)
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!form) return
    setBusy(true)
    setFormError('')
    const body = {
      name: form.name,
      email: form.email.trim() || null,
      website: form.website.trim() || null,
      location: form.location.trim() || null,
      taxId: form.taxId.trim() || null,
      phone: form.phone.trim() || null,
      rate: toMinor(form.rate, form.currency),
      currency: form.currency,
      termsDays: Number(form.termsDays),
    }
    try {
      if (editing) await api.put(`/clients/${editing}`, body)
      else await api.post('/clients', body)
      toast(editing ? 'client saved' : 'client added')
      close()
      reload()
    } catch (err) {
      setFormError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (c: Client) => {
    const ok = await confirm({ title: `delete ${c.name}?`, body: 'this cannot be undone', confirm: 'delete', danger: true })
    if (!ok) return
    try {
      await api.delete(`/clients/${c.id}`)
      toast('client deleted')
      reload()
    } catch (err) {
      await confirm({ title: 'could not delete', body: errorText(err), confirm: 'ok' })
    }
  }

  return (
    <Page>
      <Head>
        <div style={{ marginRight: 'auto' }}>
          <h1>clients</h1>
          <Sub>who you work for and what you charge them</Sub>
        </div>
        <Button variant="primary" onClick={() => open()}>
          <Icon name="plus" />
          add client
        </Button>
      </Head>

      {error && <ErrorText>{error}</ErrorText>}
      {data && data.length === 0 && (
        <Card>
          <Empty>
            <b>no clients yet</b>
            add a company you work for, with their website, currency and rate
            <div>
              <Button variant="primary" onClick={() => open()}>
                <Icon name="plus" />
                add your first client
              </Button>
            </div>
          </Empty>
        </Card>
      )}
      {data && data.length > 0 && (
        <Grid min={250}>
          {data.map((c) => (
            <ClientCard key={c.id}>
              <div className="top">
                <ClientLogo name={c.name} website={c.website} size={40} />
                <div>
                  <b>
                    <Link to={`/clients/${c.id}`}>{c.name}</Link>
                  </b>
                  <p>
                    {c.website ? (
                      <a href={`https://${c.website}`} target="_blank" rel="noopener noreferrer">
                        {c.website}
                      </a>
                    ) : (
                      c.email || 'no details'
                    )}
                  </p>
                </div>
              </div>
              <div className="rate">
                {c.rate > 0 ? (
                  <>
                    {money(c.rate, c.currency)} <small>per hour</small>
                  </>
                ) : (
                  <small>fixed price work</small>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Tag>{c.currency === 'rbx' ? 'robux' : c.currency}</Tag>
                <Tag>{c.termsDays === 0 ? 'due on receipt' : `net ${c.termsDays}`}</Tag>
              </div>
              <div className="actions">
                <Button onClick={() => navigate(`/clients/${c.id}`)}>open</Button>
                <Button onClick={() => open(c)}>
                  <Icon name="edit" size={14} />
                  edit
                </Button>
                <Button variant="ghost" onClick={() => remove(c)}>
                  <Icon name="trash" size={14} />
                </Button>
              </div>
            </ClientCard>
          ))}
        </Grid>
      )}

      {form && (
        <Backdrop onClick={close}>
          <Dialog as="form" onSubmit={save} onClick={(e) => e.stopPropagation()} style={{ width: 'min(520px, 100%)' }}>
            <h3>{editing ? 'edit client' : 'add client'}</h3>
            <FormGrid>
              <Field className="full">
                company name
                <input autoFocus required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field>
                company website
                <input maxLength={300} placeholder="acme.com" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
              </Field>
              <Field>
                email
                <input type="email" maxLength={180} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
              <Field className="full">
                location or address
                <input maxLength={300} placeholder="city, country, or full address" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </Field>
              <Field>
                tax id
                <input maxLength={60} value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
              </Field>
              <Field>
                phone
                <input maxLength={40} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field as="div">
                currency
                <Select label="currency" value={form.currency} options={currencyOptions()} onChange={(v) => setForm({ ...form, currency: v })} />
              </Field>
              <Field as="div">
                payment terms
                <Select label="payment terms" value={form.termsDays} options={termOptions} onChange={(v) => setForm({ ...form, termsDays: v })} />
              </Field>
              <Field>
                hourly rate
                <input
                  placeholder="leave empty for fixed price"
                  type="number"
                  min="0"
                  step={priceStep(form.currency)}
                  value={form.rate}
                  onChange={(e) => setForm({ ...form, rate: e.target.value })}
                />
              </Field>
            </FormGrid>
            {formError && <ErrorText>{formError}</ErrorText>}
            <div className="actions">
              <Button type="button" onClick={close}>
                cancel
              </Button>
              <Button variant="primary" disabled={busy}>
                {editing ? 'save client' : 'add client'}
              </Button>
            </div>
          </Dialog>
        </Backdrop>
      )}
    </Page>
  )
}
