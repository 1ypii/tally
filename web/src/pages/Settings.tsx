import styled from '@emotion/styled'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { api, currencyOptions, errorText, useLoad, type Settings as SettingsData } from '../api'
import { useAuth } from '../auth'
import { Backdrop, Dialog, useFeedback } from '../feedback'
import { Select } from '../select'
import { Button, Card, ErrorText, Field, Head, Page, Sub } from '../ui'

const Layout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 20px;
  align-items: start;

  .stack {
    display: grid;
    gap: 20px;
  }
  @media (max-width: 1000px) {
    grid-template-columns: 1fr;
  }
`

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-top: 14px;

  .full {
    grid-column: 1 / -1;
  }
  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`

const PreviewBox = styled.div`
  padding: 22px;
  border-radius: 12px;
  background: #ffffff;
  color: #1b1b1f;
  min-height: 160px;

  .label {
    font-size: 12px;
    color: #75757d;
    margin-bottom: 4px;
  }
  p {
    white-space: pre-wrap;
    margin-top: 2px;
  }
  .muted {
    color: #75757d;
  }
  .pay {
    margin-top: 16px;
    padding-top: 14px;
    border-top: 1px solid #ececec;
  }
  .btn {
    display: inline-block;
    margin-top: 10px;
    padding: 7px 14px;
    border-radius: 8px;
    background: #4f6bed;
    color: #fff;
    font-weight: 600;
  }
`

const LogoRow = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  margin: 14px 0 8px;

  img {
    max-height: 64px;
    max-width: 200px;
    padding: 8px;
    border-radius: 10px;
    background: #ffffff;
    border: 1px solid var(--line);
    object-fit: contain;
  }
  .empty {
    padding: 18px 22px;
    border: 1px dashed var(--line);
    border-radius: 10px;
    color: var(--muted);
  }
  .pick {
    display: inline-flex;
    align-items: center;
    height: 36px;
    padding: 0 14px;
    border: 1px solid var(--line);
    border-radius: 8px;
    cursor: pointer;
    font-weight: 500;
    transition: background 0.15s ease;
  }
  .pick:hover {
    background: var(--hover);
  }
  .pick input {
    display: none;
  }
`

const Danger = styled(Card)`
  border-color: color-mix(in srgb, var(--red) 40%, var(--line));
`

type Form = {
  businessName: string
  contactEmail: string
  location: string
  taxId: string
  website: string
  paymentDetails: string
  invoicePrefix: string
  quotePrefix: string
  homeCurrency: string
  robuxPer1000: string
  payLink: string
}

const empty: Form = {
  businessName: '',
  contactEmail: '',
  location: '',
  taxId: '',
  website: '',
  paymentDetails: '',
  invoicePrefix: 'INV-',
  quotePrefix: 'Q-',
  homeCurrency: 'usd',
  robuxPer1000: '',
  payLink: '',
}

export default function Settings() {
  const { data, error } = useLoad<SettingsData>('/profile')
  const { user, setUser } = useAuth()
  const { toast } = useFeedback()
  const navigate = useNavigate()
  const [form, setForm] = useState<Form>(empty)
  const [saveError, setSaveError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pw, setPw] = useState({ current: '', next: '' })
  const [pwError, setPwError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deletePw, setDeletePw] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [logoBust, setLogoBust] = useState(0)
  const [logoError, setLogoError] = useState('')

  useEffect(() => {
    if (!data) return
    setForm({
      businessName: data.businessName ?? '',
      contactEmail: data.contactEmail ?? '',
      location: data.location ?? '',
      taxId: data.taxId ?? '',
      website: data.website ?? '',
      paymentDetails: data.paymentDetails ?? '',
      invoicePrefix: data.invoicePrefix,
      quotePrefix: data.quotePrefix,
      homeCurrency: data.homeCurrency,
      robuxPer1000: data.robuxValue ? String(data.robuxValue / 1000) : '',
      payLink: data.payLink ?? '',
    })
  }, [data])

  const set = (key: keyof Form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value })

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setSaveError('')
    try {
      const clean = (v: string) => v.trim() || null
      const r = await api.put<SettingsData>('/profile', {
        businessName: clean(form.businessName),
        contactEmail: clean(form.contactEmail),
        location: clean(form.location),
        taxId: clean(form.taxId),
        website: clean(form.website),
        paymentDetails: clean(form.paymentDetails),
        invoicePrefix: form.invoicePrefix.trim(),
        quotePrefix: form.quotePrefix.trim(),
        homeCurrency: form.homeCurrency,
        robuxValue: form.robuxPer1000 ? Math.round(Number(form.robuxPer1000) * 1000) : null,
        payLink: clean(form.payLink),
      })
      setForm((f) => ({ ...f, website: r.data.website ?? '' }))
      toast('settings saved')
    } catch (err) {
      setSaveError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const changePassword = async (e: FormEvent) => {
    e.preventDefault()
    setPwError('')
    try {
      await api.post('/account/password', { current: pw.current, password: pw.next })
      setPw({ current: '', next: '' })
      toast('password changed, other devices were signed out')
    } catch (err) {
      setPwError(errorText(err))
    }
  }

  const uploadLogo = async (file: File | undefined) => {
    if (!file) return
    setLogoError('')
    if (file.size > 5_000_000) {
      setLogoError('files can be up to 5 mb')
      return
    }
    const body = new FormData()
    body.append('file', file)
    try {
      await api.post('/logo', body)
      setLogoBust(Date.now())
      toast('logo saved')
    } catch (err) {
      setLogoError(errorText(err))
    }
  }

  const removeLogo = async () => {
    try {
      await api.delete('/logo')
      toast('logo removed')
    } catch (err) {
      setLogoError(errorText(err))
    }
  }

  const exportData = async () => {
    try {
      const r = await api.get('/account/export', { responseType: 'blob' })
      const url = URL.createObjectURL(r.data)
      const a = document.createElement('a')
      a.href = url
      a.download = 'tally-export.json'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setSaveError(errorText(err))
    }
  }

  const deleteAccount = async (e: FormEvent) => {
    e.preventDefault()
    setDeleteError('')
    try {
      await api.delete('/account', { data: { password: deletePw } })
      setUser(null)
      navigate('/login')
    } catch (err) {
      setDeleteError(errorText(err))
    }
  }

  const filled = [form.businessName, form.location, form.contactEmail, form.website, form.taxId, form.paymentDetails].some((v) => v.trim())

  return (
    <Page>
      <Head>
        <div style={{ marginRight: 'auto' }}>
          <h1>settings</h1>
          <Sub>your details on invoices, numbering, money and your account</Sub>
        </div>
      </Head>
      {error && <ErrorText>{error}</ErrorText>}
      <Layout>
        <form className="stack" onSubmit={save}>
          <Card>
            <h2 style={{ fontSize: 16 }}>my details</h2>
            <Sub>shows in the from part of invoices, you can turn it off per invoice</Sub>
            <FormGrid>
              <Field className="full">
                name or business name
                <input maxLength={120} placeholder="what clients see the invoice is from" value={form.businessName} onChange={set('businessName')} />
              </Field>
              <Field>
                contact email
                <input type="email" maxLength={180} value={form.contactEmail} onChange={set('contactEmail')} />
              </Field>
              <Field>
                website
                <input maxLength={300} placeholder="you.com" value={form.website} onChange={set('website')} />
              </Field>
              <Field className="full">
                location or address
                <textarea rows={2} maxLength={300} placeholder="city, country, or a full address if clients need it" value={form.location} onChange={set('location')} />
              </Field>
              <Field>
                tax id
                <input maxLength={60} placeholder="vat, ein, iin, anything" value={form.taxId} onChange={set('taxId')} />
              </Field>
              <div />
              <Field className="full">
                how to pay you
                <textarea
                  rows={3}
                  maxLength={600}
                  placeholder="bank details, paypal or wise email, crypto address, roblox group, anything the client needs to pay"
                  value={form.paymentDetails}
                  onChange={set('paymentDetails')}
                />
              </Field>
            </FormGrid>
          </Card>

          <Card>
            <h2 style={{ fontSize: 16 }}>my logo</h2>
            <Sub>shows at the top of invoices and pdfs, you can turn it off per invoice</Sub>
            <LogoRow>
              {data?.hasLogo ? <img src={`/api/logo?v=${logoBust}`} alt="your logo" /> : <div className="empty">no logo yet</div>}
              <label className="pick">
                {data?.hasLogo ? 'replace logo' : 'upload logo'}
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => uploadLogo(e.target.files?.[0])} />
              </label>
              {data?.hasLogo && (
                <Button type="button" variant="ghost" onClick={removeLogo}>
                  remove
                </Button>
              )}
            </LogoRow>
            <Sub>png, jpg or webp, a transparent png looks best</Sub>
            {logoError && <ErrorText>{logoError}</ErrorText>}
          </Card>

          <Card>
            <h2 style={{ fontSize: 16 }}>numbers and money</h2>
            <FormGrid>
              <Field>
                invoice number prefix
                <input maxLength={16} value={form.invoicePrefix} onChange={set('invoicePrefix')} />
                <small>next looks like {form.invoicePrefix}0001</small>
              </Field>
              <Field>
                quote number prefix
                <input maxLength={16} value={form.quotePrefix} onChange={set('quotePrefix')} />
                <small>next looks like {form.quotePrefix}0001</small>
              </Field>
              <Field as="div">
                home currency
                <Select label="home currency" value={form.homeCurrency} options={currencyOptions().filter((c) => c.value !== 'rbx')} onChange={(v) => setForm({ ...form, homeCurrency: v })} />
                <small>books can show every total converted into this</small>
              </Field>
              <Field>
                what 1000 robux are worth in usd
                <input type="number" min="0" step="0.01" placeholder="leave empty to skip robux" value={form.robuxPer1000} onChange={set('robuxPer1000')} />
                <small>robux has no exchange rate, so you set it, like your devex rate</small>
              </Field>
              <Field className="full">
                pay link
                <input maxLength={300} placeholder="https://paypal.me/you or a wise or stripe payment link" value={form.payLink} onChange={set('payLink')} />
                <small>shows as a pay button on shared invoices</small>
              </Field>
            </FormGrid>
          </Card>

          {saveError && <ErrorText>{saveError}</ErrorText>}
          <div>
            <Button variant="primary" disabled={busy}>
              save settings
            </Button>
          </div>
        </form>

        <div className="stack">
          <div>
            <Sub style={{ marginBottom: 10 }}>how your details show on an invoice</Sub>
            <PreviewBox>
              {filled ? (
                <>
                  <div className="label">from</div>
                  <b>{form.businessName || 'your name'}</b>
                  {form.location && <p>{form.location}</p>}
                  {form.contactEmail && <p className="muted">{form.contactEmail}</p>}
                  {form.website && <p className="muted">{form.website}</p>}
                  {form.taxId && <p className="muted">tax id {form.taxId}</p>}
                  {(form.paymentDetails || form.payLink) && (
                    <div className="pay">
                      <div className="label">how to pay</div>
                      {form.paymentDetails && <p>{form.paymentDetails}</p>}
                      {form.payLink && <span className="btn">pay now</span>}
                    </div>
                  )}
                </>
              ) : (
                <p className="muted">fill in your details and they show up here</p>
              )}
            </PreviewBox>
          </div>

          {!user?.demo && (
            <Card as="form" onSubmit={changePassword}>
              <h2 style={{ fontSize: 16 }}>change password</h2>
              <Sub>signs out every other device</Sub>
              <FormGrid>
                <Field className="full">
                  current password
                  <input type="password" autoComplete="current-password" required value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
                </Field>
                <Field className="full">
                  new password
                  <input type="password" autoComplete="new-password" required minLength={10} placeholder="at least 10 characters" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
                </Field>
              </FormGrid>
              {pwError && <ErrorText>{pwError}</ErrorText>}
              <div style={{ marginTop: 14 }}>
                <Button>change password</Button>
              </div>
            </Card>
          )}

          <Card>
            <h2 style={{ fontSize: 16 }}>your data</h2>
            <Sub>download everything as a json file, clients, invoices, payments, income and expenses</Sub>
            <div style={{ marginTop: 14 }}>
              <Button onClick={exportData}>export my data</Button>
            </div>
          </Card>

          <Danger>
            <h2 style={{ fontSize: 16 }}>delete account</h2>
            <Sub>removes your account and everything in it for good</Sub>
            <div style={{ marginTop: 14 }}>
              <Button
                variant="danger"
                onClick={() => {
                  setDeleting(true)
                  setDeletePw('')
                  setDeleteError('')
                }}
              >
                delete my account
              </Button>
            </div>
          </Danger>
        </div>
      </Layout>

      {deleting && (
        <Backdrop onClick={() => setDeleting(false)}>
          <Dialog as="form" onSubmit={deleteAccount} onClick={(e) => e.stopPropagation()}>
            <h3>delete your account?</h3>
            <p style={{ color: 'var(--muted)' }}>every client, invoice, payment, expense and setting is removed. this cannot be undone, export your data first if you want a copy</p>
            {!user?.demo && (
              <Field style={{ marginTop: 14 }}>
                type your password to confirm
                <input type="password" autoComplete="current-password" required autoFocus value={deletePw} onChange={(e) => setDeletePw(e.target.value)} />
              </Field>
            )}
            {deleteError && <ErrorText>{deleteError}</ErrorText>}
            <div className="actions">
              <Button type="button" onClick={() => setDeleting(false)}>
                cancel
              </Button>
              <Button variant="danger">delete everything</Button>
            </div>
          </Dialog>
        </Backdrop>
      )}
    </Page>
  )
}

