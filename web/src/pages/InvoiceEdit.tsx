import styled from '@emotion/styled'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import {
  api,
  currencyOptions,
  errorText,
  fromMinor,
  isoDay,
  lineAmount,
  money,
  priceStep,
  shortName,
  toMinor,
  useLoad,
  type Client,
  type Currency,
  type Invoice,
  type Kind,
  type Settings,
} from '../api'
import { useFeedback } from '../feedback'
import { Select, Switch } from '../select'
import { Icon } from '../icons'
import { Button, Card, Empty, ErrorText, Field, Head, Page, Sub } from '../ui'

type LineForm = { description: string; quantity: string; price: string; fixed: boolean }

const amountOf = (l: LineForm, cur: Currency) => (l.fixed ? toMinor(l.price, cur) : lineAmount(l.quantity, l.price, cur))

type Form = {
  clientId: string
  currency: Currency
  issuedOn: string
  dueOn: string
  notes: string
  showSender: boolean
  showLogo: boolean
  taxRate: string
  taxLabel: string
  discountKind: 'percent' | 'amount'
  discountValue: string
  lines: LineForm[]
}

const plusDays = (iso: string, days: number) => {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return isoDay(d)
}

const Layout = styled.div`
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 20px;
  align-items: start;

  .side {
    position: sticky;
    top: 24px;
  }
  @media (max-width: 1000px) {
    grid-template-columns: 1fr;
    .side {
      position: static;
    }
  }
`

const Row = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;

  @media (max-width: 760px) {
    grid-template-columns: 1fr 1fr;
  }
`

const Lines = styled.div`
  display: grid;
  gap: 10px;
  margin: 22px 0 14px;

  .line {
    display: grid;
    grid-template-columns: 1fr 120px 90px 130px 110px 36px;
    gap: 10px;
    align-items: end;
    padding: 12px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: transparent;
  }
  .amount {
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .drop {
    width: 36px;
    padding: 0;
  }
  .gap {
    height: 38px;
  }

  @media (max-width: 760px) {
    .line {
      grid-template-columns: 1fr 1fr;
    }
    .line > :first-of-type {
      grid-column: 1 / -1;
    }
    .gap {
      display: none;
    }
    .amount {
      justify-content: flex-start;
    }
  }
`

const Adjust = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px solid var(--line);

  @media (max-width: 760px) {
    grid-template-columns: 1fr 1fr;
  }
`

const Totals = styled.div`
  display: grid;
  gap: 10px;

  .row {
    display: flex;
    justify-content: space-between;
    color: var(--muted);
  }
  .total {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding-top: 12px;
    border-top: 1px solid var(--line);
    font-weight: 650;
  }
  .total b {
    font-size: 24px;
    font-variant-numeric: tabular-nums;
  }
`

function fresh(): Form {
  const due = new Date()
  due.setDate(due.getDate() + 14)
  return {
    clientId: '',
    currency: 'usd',
    issuedOn: isoDay(new Date()),
    dueOn: isoDay(due),
    notes: '',
    showSender: true,
    showLogo: true,
    taxRate: '',
    taxLabel: '',
    discountKind: 'percent',
    discountValue: '',
    lines: [{ description: '', quantity: '1', price: '', fixed: false }],
  }
}

export default function InvoiceEdit() {
  const { id } = useParams()
  const [search] = useSearchParams()
  const [kind, setKind] = useState<Kind>(search.get('kind') === 'quote' ? 'quote' : 'invoice')
  const navigate = useNavigate()
  const { toast } = useFeedback()
  const clients = useLoad<Client[]>('/clients')
  const settings = useLoad<Settings>('/profile')
  const [form, setForm] = useState<Form | null>(id ? null : fresh())
  const [locked, setLocked] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!id) return
    let live = true
    api
      .get<Invoice>(`/invoices/${id}`)
      .then((r) => {
        if (!live) return
        const inv = r.data
        setLocked(inv.status !== 'draft')
        setKind(inv.kind)
        setForm({
          clientId: String(inv.client.id),
          currency: inv.currency,
          issuedOn: inv.issuedOn,
          dueOn: inv.dueOn,
          notes: inv.notes ?? '',
          showSender: inv.showSender,
          showLogo: inv.showLogo,
          taxRate: inv.taxRate ? String(inv.taxRate / 100) : '',
          taxLabel: inv.taxLabel ?? '',
          discountKind: inv.discountKind ?? 'percent',
          discountValue: inv.discountKind === 'amount' ? fromMinor(inv.discountValue, inv.currency) : inv.discountValue ? String(inv.discountValue / 100) : '',
          lines: inv.lines.map((l) => ({
            description: l.description,
            quantity: String(l.quantity),
            price: fromMinor(l.unitPrice, inv.currency),
            fixed: l.fixed,
          })),
        })
      })
      .catch((e) => live && setError(errorText(e)))
    return () => {
      live = false
    }
  }, [id])

  const preset = search.get('client')
  useEffect(() => {
    if (id || !preset || !clients.data) return
    const next = clients.data.find((c) => String(c.id) === preset)
    if (!next) return
    const price = next.rate > 0 ? fromMinor(next.rate, next.currency) : ''
    setForm((f) =>
      f && f.clientId === ''
        ? {
            ...f,
            clientId: preset,
            currency: next.currency,
            dueOn: plusDays(f.issuedOn, next.termsDays),
            lines: f.lines.map((l) => (!l.fixed && l.price === '' ? { ...l, price } : l)),
          }
        : f,
    )
  }, [id, preset, clients.data])

  if (!form) {
    return <Page>{error && <ErrorText>{error}</ErrorText>}</Page>
  }

  if (locked) {
    return (
      <Page>
        <Card>
          <Empty>
            <b>this was already sent</b>
            only drafts can be edited, move it back to draft first
          </Empty>
        </Card>
      </Page>
    )
  }

  if (clients.data && clients.data.length === 0) {
    return (
      <Page>
        <Card>
          <Empty>
            <b>you need a client first</b>
            invoices are always billed to a client
            <div>
              <Button variant="primary" onClick={() => navigate('/clients')}>
                <Icon name="plus" />
                add a client
              </Button>
            </div>
          </Empty>
        </Card>
      </Page>
    )
  }

  const client = clients.data?.find((c) => String(c.id) === form.clientId)

  const pickClient = (value: string) => {
    const next = clients.data?.find((c) => String(c.id) === value)
    if (!next) {
      setForm({ ...form, clientId: value })
      return
    }
    const price = next.rate > 0 ? fromMinor(next.rate, next.currency) : ''
    setForm({
      ...form,
      clientId: value,
      currency: next.currency,
      dueOn: plusDays(form.issuedOn, next.termsDays),
      lines: form.lines.map((l) => (!l.fixed && (l.price === '' || form.currency !== next.currency) ? { ...l, price } : l)),
    })
  }

  const setLine = (i: number, key: 'description' | 'quantity' | 'price', value: string) => {
    setForm({ ...form, lines: form.lines.map((l, j) => (j === i ? { ...l, [key]: value } : l)) })
  }

  const clientRate = () => (client && client.currency === form.currency && client.rate > 0 ? fromMinor(client.rate, client.currency) : '')

  const addLine = (fixed: boolean) => {
    setForm({ ...form, lines: [...form.lines, { description: '', quantity: '1', price: fixed ? '' : clientRate(), fixed }] })
  }

  const setLineKind = (i: number, fixed: boolean) => {
    setForm({
      ...form,
      lines: form.lines.map((l, j) => (j === i ? { ...l, fixed, price: fixed ? '' : clientRate(), quantity: '1' } : l)),
    })
  }

  const hours = form.lines.reduce((sum, l) => sum + (l.fixed ? 0 : Number(l.quantity || 0)), 0)
  const subtotal = form.lines.reduce((sum, l) => sum + amountOf(l, form.currency), 0)
  const discountBp = Math.round(Number(form.discountValue || 0) * 100)
  const discount = Math.min(
    subtotal,
    form.discountKind === 'percent' ? Math.floor((subtotal * Math.min(discountBp, 10000) + 5000) / 10000) : toMinor(form.discountValue, form.currency),
  )
  const taxBp = Math.round(Number(form.taxRate || 0) * 100)
  const tax = Math.floor(((subtotal - discount) * taxBp + 5000) / 10000)
  const total = subtotal - discount + tax

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const body = {
      clientId: Number(form.clientId),
      currency: form.currency,
      issuedOn: form.issuedOn,
      dueOn: form.dueOn,
      notes: form.notes || null,
      showSender: form.showSender,
      showLogo: form.showLogo,
      kind,
      taxRate: taxBp,
      taxLabel: form.taxLabel || null,
      discountKind: Number(form.discountValue || 0) > 0 ? form.discountKind : null,
      discountValue: form.discountKind === 'percent' ? discountBp : toMinor(form.discountValue, form.currency),
      lines: form.lines.map((l) => ({
        description: l.description,
        fixed: l.fixed,
        quantity: l.fixed ? 1 : Number(l.quantity || 0),
        unitPrice: toMinor(l.price, form.currency),
      })),
    }
    try {
      const r = id ? await api.put<Invoice>(`/invoices/${id}`, body) : await api.post<Invoice>('/invoices', body)
      toast(id ? 'draft saved' : `${r.data.number} created`)
      navigate(`/invoices/${r.data.id}`)
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <Page>
      <Head>
        <div style={{ marginRight: 'auto' }}>
          <Link to={id ? `/invoices/${id}` : '/invoices'} style={{ color: 'var(--muted)', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <Icon name="back" size={14} />
            back
          </Link>
          <h1>{id ? `edit ${kind}` : `new ${kind}`}</h1>
        </div>
      </Head>
      <form onSubmit={save}>
        <Layout>
          <Card>
            <Row>
              <Field as="div">
                client
                <Select
                  label="client"
                  placeholder="pick a client"
                  value={form.clientId}
                  options={(clients.data ?? []).map((c) => ({ value: String(c.id), label: c.name, hint: shortName(c.currency) }))}
                  onChange={pickClient}
                />
              </Field>
              <Field as="div">
                currency
                <Select label="currency" value={form.currency} options={currencyOptions()} onChange={(v) => setForm({ ...form, currency: v })} />
              </Field>
              <Field>
                issued
                <input type="date" required value={form.issuedOn} onChange={(e) => setForm({ ...form, issuedOn: e.target.value })} />
              </Field>
              <Field>
                {kind === 'quote' ? 'valid until' : 'due'}
                <input type="date" required value={form.dueOn} onChange={(e) => setForm({ ...form, dueOn: e.target.value })} />
              </Field>
            </Row>

            <Lines>
              {form.lines.map((l, i) => (
                <div className="line" key={i}>
                  <Field>
                    description
                    <input required maxLength={200} placeholder="what you did" value={l.description} onChange={(e) => setLine(i, 'description', e.target.value)} />
                  </Field>
                  <Field as="div">
                    type
                    <Select
                      label="line type"
                      value={l.fixed ? 'fixed' : 'hourly'}
                      options={[
                        { value: 'hourly', label: 'hourly' },
                        { value: 'fixed', label: 'fixed price' },
                      ]}
                      onChange={(v) => setLineKind(i, v === 'fixed')}
                    />
                  </Field>
                  {l.fixed ? (
                    <div className="gap" />
                  ) : (
                    <Field>
                      hours
                      <input type="number" required min="0.01" step="0.01" value={l.quantity} onChange={(e) => setLine(i, 'quantity', e.target.value)} />
                    </Field>
                  )}
                  <Field>
                    {l.fixed ? 'amount' : 'rate'}
                    <input type="number" required min="0" step={priceStep(form.currency)} value={l.price} onChange={(e) => setLine(i, 'price', e.target.value)} />
                  </Field>
                  <div className="amount">{money(amountOf(l, form.currency), form.currency)}</div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="drop"
                    aria-label="remove line"
                    disabled={form.lines.length === 1}
                    onClick={() => setForm({ ...form, lines: form.lines.filter((_, j) => j !== i) })}
                  >
                    <Icon name="x" size={14} />
                  </Button>
                </div>
              ))}
            </Lines>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button type="button" onClick={() => addLine(false)} disabled={form.lines.length >= 50}>
                <Icon name="plus" size={14} />
                hourly line
              </Button>
              <Button type="button" onClick={() => addLine(true)} disabled={form.lines.length >= 50}>
                <Icon name="plus" size={14} />
                fixed price
              </Button>
            </div>

            <Adjust>
              <Field>
                discount
                <input type="number" min="0" step="0.01" placeholder="0" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} />
              </Field>
              <Field as="div">
                discount type
                <Select
                  label="discount type"
                  value={form.discountKind}
                  options={[
                    { value: 'percent', label: 'percent' },
                    { value: 'amount', label: `fixed ${shortName(form.currency)}` },
                  ]}
                  onChange={(v) => setForm({ ...form, discountKind: v as 'percent' | 'amount' })}
                />
              </Field>
              <Field>
                tax %
                <input type="number" min="0" max="100" step="0.01" placeholder="0" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} />
              </Field>
              <Field>
                tax name
                <input maxLength={20} placeholder="vat, gst, sales tax" value={form.taxLabel} onChange={(e) => setForm({ ...form, taxLabel: e.target.value })} />
              </Field>
            </Adjust>

            <div style={{ marginTop: 22, display: 'grid', gap: 14 }}>
              {settings.data?.hasLogo ? (
                <Switch on={form.showLogo} onChange={(on) => setForm({ ...form, showLogo: on })}>
                  show my logo on this {kind}
                  <small>the logo you uploaded in settings</small>
                </Switch>
              ) : (
                <Sub>
                  want your logo on invoices? add one in{' '}
                  <Link to="/settings" style={{ color: 'var(--accent)' }}>
                    settings
                  </Link>
                </Sub>
              )}
              <Switch on={form.showSender} onChange={(on) => setForm({ ...form, showSender: on })}>
                show my details on this invoice
                <small>
                  your name, location, tax id and how to pay, from{' '}
                  <Link to="/settings" style={{ color: 'var(--accent)' }}>
                    my details
                  </Link>
                </small>
              </Switch>
            </div>

            <Field style={{ marginTop: 22 }}>
              notes
              <textarea rows={3} maxLength={2000} placeholder="payment details, thanks, anything the client should read" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </Card>

          <Card className="side">
            <Totals>
              <h2 style={{ fontSize: 15 }}>summary</h2>
              <div className="row">
                <span>client</span>
                <span>{client?.name ?? 'none yet'}</span>
              </div>
              <div className="row">
                <span>lines</span>
                <span>{form.lines.length}</span>
              </div>
              <div className="row">
                <span>hours</span>
                <span>{Math.round(hours * 100) / 100}</span>
              </div>
              <div className="row">
                <span>subtotal</span>
                <span>{money(subtotal, form.currency)}</span>
              </div>
              {discount > 0 && (
                <div className="row">
                  <span>discount</span>
                  <span>-{money(discount, form.currency)}</span>
                </div>
              )}
              {tax > 0 && (
                <div className="row">
                  <span>{form.taxLabel || 'tax'} {form.taxRate}%</span>
                  <span>{money(tax, form.currency)}</span>
                </div>
              )}
              <div className="total">
                <span>total</span>
                <b>{money(total, form.currency)}</b>
              </div>
              <Sub>{client && client.termsDays > 0 ? `${client.name} pays net ${client.termsDays}, ` : ''}saves as a draft, you can send it after</Sub>
              {error && <ErrorText>{error}</ErrorText>}
              <Button variant="primary" disabled={busy}>
                <Icon name="check" size={15} />
                save draft
              </Button>
            </Totals>
          </Card>
        </Layout>
      </form>
    </Page>
  )
}
