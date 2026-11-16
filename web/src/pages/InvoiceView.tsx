import styled from '@emotion/styled'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  api,
  day,
  errorText,
  fromMinor,
  isoDay,
  methodLabel,
  methodOptions,
  money,
  priceStep,
  repeatOptions,
  toMinor,
  useLoad,
  daysBetween,
  type Invoice,
} from '../api'
import { Backdrop, Dialog, useFeedback } from '../feedback'
import { Icon } from '../icons'
import { Select } from '../select'
import { Button, LinkButton, Card, ErrorText, Field, Head, Page, Pill, Sub } from '../ui'
import InvoicePaper from './InvoicePaper'

const Layout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 20px;
  align-items: start;

  .side {
    display: grid;
    gap: 16px;
    position: sticky;
    top: 24px;
  }
  @media (max-width: 1150px) {
    grid-template-columns: 1fr;
    .side {
      position: static;
    }
  }
  @media print {
    display: block;
  }
`

const Banner = styled.div`
  display: flex;
  gap: 14px;
  align-items: center;
  flex-wrap: wrap;
  padding: 14px 16px;
  margin-bottom: 20px;
  border: 1px solid color-mix(in srgb, var(--green) 50%, var(--line));
  border-radius: 12px;

  div {
    margin-right: auto;
  }
  b {
    display: block;
    color: var(--green);
  }
  span {
    color: var(--muted);
  }
`

const Money = styled.div`
  display: grid;
  gap: 8px;

  .row {
    display: flex;
    justify-content: space-between;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .row b {
    color: var(--text);
    font-weight: 500;
  }
  .due {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding-top: 10px;
    border-top: 1px solid var(--line);
  }
  .due b {
    font-size: 26px;
    font-weight: 650;
    font-variant-numeric: tabular-nums;
  }
  .meter {
    height: 6px;
    border-radius: 6px;
    background: var(--field);
    overflow: hidden;
  }
  .meter div {
    height: 100%;
    background: var(--green);
    border-radius: 6px;
    transition: width 0.5s cubic-bezier(0.2, 0.7, 0.2, 1);
  }
`

const Actions = styled.div`
  display: grid;
  gap: 8px;
  margin-top: 16px;

  button {
    width: 100%;
  }
`

const PayList = styled.div`
  display: grid;
  gap: 2px;
  margin-top: 8px;

  .p {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 8px;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid var(--line);
  }
  .p:last-of-type {
    border-bottom: 0;
  }
  .p small {
    display: block;
    color: var(--muted);
  }
  .p b {
    font-variant-numeric: tabular-nums;
  }
`

const PayGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 14px;

  .full {
    grid-column: 1 / -1;
  }
`

const Choices = styled.div`
  display: grid;
  gap: 8px;
  margin-top: 14px;

  label {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-radius: 10px;
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease;
  }
  label:hover {
    background: var(--raised);
  }
  label.on {
    border-color: var(--accent);
  }
  input {
    margin-top: 3px;
    accent-color: var(--accent);
  }
  b {
    display: block;
    font-weight: 600;
  }
  span span {
    color: var(--muted);
    font-size: 13px;
  }
`

const ShareRow = styled.div`
  display: grid;
  gap: 8px;
  margin-top: 12px;

  input {
    width: 100%;
    min-width: 0;
    height: 36px;
    padding: 0 11px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    font-family: ui-monospace, monospace;
    font-size: 12px;
  }
  .btns {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
`

type PayForm = { amount: string; paidOn: string; method: string; note: string }
type SendChoice = 'mark' | 'mail' | 'link'

const shareUrl = (token: string) => `${window.location.origin}/i/${token}`

export default function InvoiceView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast, confirm } = useFeedback()
  const { data: inv, error, setData, reload } = useLoad<Invoice>(`/invoices/${id}`)
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pay, setPay] = useState<PayForm | null>(null)
  const [payError, setPayError] = useState('')
  const [send, setSend] = useState<SendChoice | null>(null)

  if (error) {
    return (
      <Page>
        <ErrorText>{error}</ErrorText>
      </Page>
    )
  }
  if (!inv) return null

  const quote = inv.kind === 'quote'
  const open = !quote && (inv.status === 'sent' || inv.status === 'overdue')
  const draft = inv.status === 'draft'
  const today = isoDay(new Date())
  const late = inv.status === 'overdue' ? daysBetween(inv.dueOn, today) : 0
  const paidShare = inv.total > 0 ? Math.min(100, (inv.paid / inv.total) * 100) : 0

  const call = async (path: string, done: string, method: 'post' | 'delete' = 'post') => {
    setBusy(true)
    setActionError('')
    try {
      const r = method === 'post' ? await api.post<Invoice>(path) : await api.delete<Invoice>(path)
      setData(r.data)
      toast(done)
    } catch (e) {
      setActionError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const mail = (link: string | null) => {
    const amount = money(inv.paid > 0 ? inv.balance : inv.total, inv.currency)
    const from = inv.sender?.businessName
    const body = [
      `hi ${inv.client.name},`,
      '',
      quote ? `here is quote ${inv.number} for ${amount}, valid until ${day(inv.dueOn)}.` : `here is invoice ${inv.number} for ${amount}, due ${day(inv.dueOn)}.`,
      ...(link ? ['', `you can view it here: ${link}`] : []),
      ...(!quote && inv.payLink ? ['', `you can pay here: ${inv.payLink}`] : []),
      ...(!quote && inv.sender?.paymentDetails ? ['', 'how to pay:', inv.sender.paymentDetails] : []),
      '',
      'thanks',
      ...(from ? [from] : []),
    ].join('\n')
    const to = inv.client.email ? encodeURIComponent(inv.client.email) : ''
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(`${inv.kind} ${inv.number}`)}&body=${encodeURIComponent(body)}`
  }

  const runSend = async () => {
    if (!send) return
    setBusy(true)
    setActionError('')
    try {
      let current = inv
      if (current.status === 'draft') current = (await api.post<Invoice>(`/invoices/${inv.id}/send`)).data
      if (send === 'link' && !current.shareToken) current = (await api.post<Invoice>(`/invoices/${inv.id}/share`)).data
      setData(current)
      setSend(null)
      if (send === 'mail') mail(null)
      if (send === 'link') mail(shareUrl(current.shareToken!))
      toast(draft ? `${inv.number} marked sent` : 'email opened')
    } catch (e) {
      setActionError(errorText(e))
      setSend(null)
    } finally {
      setBusy(false)
    }
  }

  const duplicate = async () => {
    setBusy(true)
    try {
      const r = await api.post<Invoice>(`/invoices/${inv.id}/duplicate`)
      toast(`${r.data.number} created as a copy`)
      navigate(`/invoices/${r.data.id}`)
    } catch (e) {
      setActionError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const convert = async () => {
    setBusy(true)
    try {
      const r = await api.post<Invoice>(`/invoices/${inv.id}/convert`)
      toast(`${r.data.number} made from ${inv.number}`)
      navigate(`/invoices/${r.data.id}`)
    } catch (e) {
      setActionError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const setRepeat = async (every: string) => {
    setBusy(true)
    try {
      const r = await api.put<Invoice>(`/invoices/${inv.id}/repeat`, { every: every || null })
      setData(r.data)
      toast(every ? 'repeat set, new drafts show up on their own' : 'repeat turned off')
    } catch (e) {
      setActionError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const remind = async () => {
    const amount = money(inv.balance, inv.currency)
    const body = [
      `hi ${inv.client.name},`,
      '',
      late > 0
        ? `just a friendly reminder that invoice ${inv.number} for ${amount} was due on ${day(inv.dueOn)}, ${late === 1 ? '1 day' : `${late} days`} ago.`
        : `just a friendly reminder that invoice ${inv.number} for ${amount} is due on ${day(inv.dueOn)}.`,
      ...(inv.shareToken ? ['', `you can view it here: ${shareUrl(inv.shareToken)}`] : []),
      ...(inv.payLink ? ['', `you can pay here: ${inv.payLink}`] : []),
      ...(inv.sender?.paymentDetails ? ['', 'how to pay:', inv.sender.paymentDetails] : []),
      '',
      'thanks',
      ...(inv.sender?.businessName ? [inv.sender.businessName] : []),
    ].join('\n')
    const to = inv.client.email ? encodeURIComponent(inv.client.email) : ''
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(`reminder for invoice ${inv.number}`)}&body=${encodeURIComponent(body)}`
    call(`/invoices/${inv.id}/remind`, 'reminder opened in your email')
  }

  const unsend = async () => {
    const ok = await confirm({ title: 'move back to draft?', body: 'you can edit it again, and any share link stops working', confirm: 'back to draft' })
    if (ok) call(`/invoices/${inv.id}/unsend`, `${inv.number} is a draft again`)
  }

  const unpay = async () => {
    const ok = await confirm({ title: 'mark as not paid?', body: 'all payments recorded on this invoice are removed', confirm: 'mark not paid', danger: true })
    if (ok) call(`/invoices/${inv.id}/unpay`, `${inv.number} marked not paid`)
  }

  const share = async (fresh: boolean) => {
    if (fresh) {
      const ok = await confirm({ title: 'make a new link?', body: 'the old link stops working right away', confirm: 'new link' })
      if (!ok) return
    }
    call(`/invoices/${inv.id}/share`, fresh ? 'new link made' : 'share link made')
  }

  const unshare = async () => {
    const ok = await confirm({ title: 'turn off the link?', body: 'anyone with it will not be able to open the invoice', confirm: 'turn off', danger: true })
    if (ok) call(`/invoices/${inv.id}/share`, 'link turned off', 'delete')
  }

  const copy = async () => {
    if (!inv.shareToken) return
    try {
      await navigator.clipboard.writeText(shareUrl(inv.shareToken))
      toast('link copied')
    } catch {
      setActionError('could not copy, select the link and copy it by hand')
    }
  }

  const record = async (e: FormEvent) => {
    e.preventDefault()
    if (!pay) return
    setBusy(true)
    setPayError('')
    try {
      const r = await api.post<Invoice>(`/invoices/${inv.id}/payments`, {
        amount: toMinor(pay.amount, inv.currency),
        paidOn: pay.paidOn,
        method: pay.method,
        note: pay.note || null,
      })
      setData(r.data)
      setPay(null)
      toast(r.data.status === 'paid' ? `${inv.number} is fully paid` : 'payment recorded')
    } catch (err) {
      setPayError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const removePayment = async (paymentId: number) => {
    const ok = await confirm({ title: 'remove this payment?', body: 'the invoice goes back to unpaid if it no longer adds up', confirm: 'remove', danger: true })
    if (!ok) return
    try {
      await api.delete(`/payments/${paymentId}`)
      toast('payment removed')
      reload()
    } catch (e) {
      setActionError(errorText(e))
    }
  }

  const remove = async () => {
    const ok = await confirm({ title: `delete ${inv.number}?`, body: 'drafts are gone for good once deleted', confirm: 'delete', danger: true })
    if (!ok) return
    try {
      await api.delete(`/invoices/${inv.id}`)
      toast(`${inv.number} deleted`)
      navigate('/invoices')
    } catch (e) {
      setActionError(errorText(e))
    }
  }

  const choices: { key: SendChoice; title: string; text: string }[] = [
    ...(draft ? [{ key: 'mark' as const, title: 'just mark it sent', text: 'you send it yourself however you like' }] : []),
    { key: 'mail', title: 'email from my mail app', text: inv.client.email ? `opens your email to ${inv.client.email} with a summary` : 'opens your email with a summary, add the address yourself' },
    { key: 'link', title: 'email with a link', text: 'same email plus a private link where the client can view and print the invoice' },
  ]

  return (
    <Page>
      <Head className="no-print">
        <div style={{ marginRight: 'auto' }}>
          <Link to="/invoices" style={{ color: 'var(--muted)', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <Icon name="back" size={14} />
            invoices
          </Link>
          <h1 style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
            {inv.number}
            <Pill status={inv.status}>{inv.status}</Pill>
          </h1>
        </div>
        <Button disabled={busy} onClick={duplicate}>
          duplicate
        </Button>
        {draft && (
          <>
            <Button variant="ghost" onClick={remove} aria-label="delete draft">
              <Icon name="trash" size={15} />
            </Button>
            <Button onClick={() => navigate(`/invoices/${inv.id}/edit`)}>
              <Icon name="edit" size={15} />
              edit
            </Button>
          </>
        )}
        <LinkButton href={`/api/invoices/${inv.id}/pdf`}>
          <Icon name="file" size={15} />
          pdf
        </LinkButton>
        <Button onClick={() => window.print()}>
          <Icon name="print" size={15} />
          print
        </Button>
      </Head>
      {actionError && <ErrorText className="no-print">{actionError}</ErrorText>}

      {inv.notice && (
        <Banner className="no-print">
          <div>
            <b>{inv.client.name} says they sent the payment</b>
            <span>
              {day(inv.notice.at)}
              {inv.notice.reference ? `, reference ${inv.notice.reference}` : ''}
              {inv.notice.note ? `, "${inv.notice.note}"` : ''}. check your account, then record it
            </span>
          </div>
          {open && (
            <Button
              variant="primary"
              onClick={() => {
                setPayError('')
                setPay({ amount: fromMinor(inv.balance, inv.currency), paidOn: today, method: 'bank', note: inv.notice?.reference ?? '' })
              }}
            >
              record payment
            </Button>
          )}
          <Button onClick={() => call(`/invoices/${inv.id}/notice`, 'dismissed', 'delete')}>dismiss</Button>
        </Banner>
      )}

      {quote && inv.convertedTo && (
        <Banner className="no-print">
          <div>
            <b>this quote became an invoice</b>
            <span>everything was copied over, edit and send it from there</span>
          </div>
          <Button variant="primary" onClick={() => navigate(`/invoices/${inv.convertedTo}`)}>
            open the invoice
          </Button>
        </Banner>
      )}

      <Layout>
        <InvoicePaper inv={inv} logoSrc="/api/logo" />

        <div className="side no-print">
          <Card>
            <Money>
              <div className="row">
                <span>total</span>
                <b>{money(inv.total, inv.currency)}</b>
              </div>
              <div className="row">
                <span>paid</span>
                <b>{money(inv.paid, inv.currency)}</b>
              </div>
              {!draft && (
                <div className="meter" aria-hidden="true">
                  <div style={{ width: `${paidShare}%` }} />
                </div>
              )}
              <div className="due">
                <span>{quote ? 'quote total' : inv.status === 'paid' ? 'paid in full' : 'still owed'}</span>
                <b>{money(quote ? inv.total : inv.balance, inv.currency)}</b>
              </div>
              <Sub>
                {quote ? `valid until ${day(inv.dueOn)}` : late > 0 ? `${late === 1 ? '1 day' : `${late} days`} overdue` : `due ${day(inv.dueOn)}`}
                {inv.remindedAt ? `, reminded ${day(inv.remindedAt)}` : ''}
              </Sub>
            </Money>
            <Actions>
              {draft && (
                <Button variant="primary" disabled={busy} onClick={() => setSend('mark')}>
                  <Icon name="send" size={15} />
                  send
                </Button>
              )}
              {open && (
                <Button
                  variant="primary"
                  onClick={() => {
                    setPayError('')
                    setPay({ amount: fromMinor(inv.balance, inv.currency), paidOn: isoDay(new Date()), method: 'bank', note: '' })
                  }}
                >
                  <Icon name="check" size={15} />
                  record payment
                </Button>
              )}
              {open && (
                <Button disabled={busy} onClick={remind}>
                  send reminder
                </Button>
              )}
              {quote && !inv.convertedTo && (inv.status === 'sent' || inv.status === 'accepted') && (
                <Button variant="primary" disabled={busy} onClick={convert}>
                  turn into invoice
                </Button>
              )}
              {!draft && (
                <Button disabled={busy} onClick={() => setSend('mail')}>
                  <Icon name="send" size={15} />
                  email
                </Button>
              )}
              {(open || (quote && inv.status === 'sent')) && inv.paid === 0 && (
                <Button disabled={busy} onClick={unsend}>
                  <Icon name="undo" size={15} />
                  back to draft
                </Button>
              )}
              {!quote && !draft && inv.paid > 0 && (
                <Button variant="danger" disabled={busy} onClick={unpay}>
                  <Icon name="undo" size={15} />
                  mark not paid
                </Button>
              )}
            </Actions>
          </Card>

          {!quote && (
            <Card>
              <h2 style={{ fontSize: 15, marginBottom: 10 }}>repeat</h2>
              <Select label="repeat" value={inv.repeatEvery ?? ''} options={repeatOptions} onChange={setRepeat} />
              <Sub style={{ marginTop: 8 }}>
                {inv.repeatEvery && inv.nextRepeatOn
                  ? `next copy shows up as a draft on ${day(inv.nextRepeatOn)}`
                  : 'for retainers, a new draft copy gets made on schedule'}
              </Sub>
            </Card>
          )}

          {!draft && (
            <Card>
              <h2 style={{ fontSize: 15 }}>share link</h2>
              <Sub style={{ marginTop: 4 }}>
                {inv.views.first
                  ? `opened ${inv.views.count === 1 ? 'once' : `${inv.views.count} times`}, first on ${day(inv.views.first)}`
                  : inv.shareToken
                    ? 'not opened yet'
                    : ''}
              </Sub>
              {inv.shareToken ? (
                <>
                  <Sub>anyone with this link can view and print it, nothing else</Sub>
                  <ShareRow>
                    <input readOnly value={shareUrl(inv.shareToken)} onFocus={(e) => e.currentTarget.select()} aria-label="share link" />
                    <div className="btns">
                      <Button onClick={copy}>copy</Button>
                      <Button onClick={() => share(true)}>new link</Button>
                      <Button variant="danger" onClick={unshare}>
                        turn off
                      </Button>
                    </div>
                  </ShareRow>
                </>
              ) : (
                <>
                  <Sub>optional, a private link the client can open without an account</Sub>
                  <ShareRow>
                    <div className="btns">
                      <Button onClick={() => share(false)}>make share link</Button>
                    </div>
                  </ShareRow>
                </>
              )}
            </Card>
          )}

          {inv.payments.length > 0 && (
            <Card>
              <h2 style={{ fontSize: 15 }}>payments</h2>
              <PayList>
                {inv.payments.map((p) => (
                  <div className="p" key={p.id}>
                    <span>
                      {day(p.paidOn)}
                      <small>
                        {methodLabel(p.method)}
                        {p.note ? `, ${p.note}` : ''}
                      </small>
                    </span>
                    <b>{money(p.amount, inv.currency)}</b>
                    <Button variant="ghost" aria-label="remove payment" onClick={() => removePayment(p.id)}>
                      <Icon name="trash" size={14} />
                    </Button>
                  </div>
                ))}
              </PayList>
            </Card>
          )}

          {!inv.showSender && (
            <Sub>
              your details are hidden on this invoice.{' '}
              {draft && (
                <Link to={`/invoices/${inv.id}/edit`} style={{ color: 'var(--accent)' }}>
                  turn them on
                </Link>
              )}
            </Sub>
          )}
          {inv.showSender && !inv.sender?.businessName && (
            <Sub>
              add your name, location and how to pay in{' '}
              <Link to="/settings" style={{ color: 'var(--accent)' }}>
                my details
              </Link>{' '}
              so they show on the invoice
            </Sub>
          )}
        </div>
      </Layout>

      {send && (
        <Backdrop onClick={() => setSend(null)}>
          <Dialog role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{ width: 'min(480px, 100%)' }}>
            <h3>{draft ? `send ${inv.number}` : `email ${inv.number}`}</h3>
            <p style={{ color: 'var(--muted)' }}>{draft ? 'pick how it goes out, it gets marked sent either way' : 'nothing is sent by tally, it opens your own email'}</p>
            <Choices>
              {choices.map((c) => (
                <label key={c.key} className={send === c.key ? 'on' : ''}>
                  <input type="radio" name="send" checked={send === c.key} onChange={() => setSend(c.key)} />
                  <span>
                    <b>{c.title}</b>
                    <span>{c.text}</span>
                  </span>
                </label>
              ))}
            </Choices>
            <div className="actions">
              <Button type="button" onClick={() => setSend(null)}>
                cancel
              </Button>
              <Button variant="primary" disabled={busy} onClick={runSend}>
                {send === 'mark' ? 'mark sent' : 'open email'}
              </Button>
            </div>
          </Dialog>
        </Backdrop>
      )}

      {pay && (
        <Backdrop onClick={() => setPay(null)}>
          <Dialog as="form" onSubmit={record} onClick={(e) => e.stopPropagation()} style={{ width: 'min(480px, 100%)' }}>
            <h3>record payment</h3>
            <p style={{ color: 'var(--muted)' }}>
              {money(inv.balance, inv.currency)} still owed on {inv.number}
            </p>
            <PayGrid>
              <Field>
                amount
                <input autoFocus type="number" required min={priceStep(inv.currency)} step={priceStep(inv.currency)} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
              </Field>
              <Field>
                paid on
                <input type="date" required max={isoDay(new Date())} value={pay.paidOn} onChange={(e) => setPay({ ...pay, paidOn: e.target.value })} />
              </Field>
              <Field as="div" className="full">
                method
                <Select label="method" value={pay.method} options={methodOptions()} onChange={(v) => setPay({ ...pay, method: v })} />
              </Field>
              <Field className="full">
                note
                <input maxLength={500} placeholder="reference, transaction id, anything" value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} />
              </Field>
            </PayGrid>
            {payError && <ErrorText>{payError}</ErrorText>}
            <div className="actions">
              <Button type="button" onClick={() => setPay(null)}>
                cancel
              </Button>
              <Button variant="primary" disabled={busy}>
                record payment
              </Button>
            </div>
          </Dialog>
        </Backdrop>
      )}
    </Page>
  )
}
