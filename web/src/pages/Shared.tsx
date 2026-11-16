import styled from '@emotion/styled'
import { useState, type FormEvent } from 'react'
import { useParams } from 'react-router'
import { api, day, errorText, methodLabel, money, useLoad } from '../api'
import { Icon } from '../icons'
import { Button, LinkButton, Card, Empty, ErrorText, Field, Pill, Sub } from '../ui'
import InvoicePaper, { type PaperInvoice } from './InvoicePaper'

type SharedInvoice = PaperInvoice & {
  payLink: string | null
  payments: { paidOn: string; amount: number; method: string }[]
  noticeSent: boolean
}

const Wrap = styled.main`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 20px;
  align-items: start;
  padding: 32px 40px 64px;

  .side {
    display: grid;
    gap: 16px;
    position: sticky;
    top: 24px;
  }
  .foot {
    color: var(--muted);
    font-size: 12.5px;
  }
  @media (max-width: 1050px) {
    grid-template-columns: 1fr;
    padding: 20px 16px 48px;
    .side {
      position: static;
    }
  }
  @media print {
    display: block;
    padding: 0;
  }
`

const Due = styled.div`
  display: grid;
  gap: 4px;

  span {
    color: var(--muted);
  }
  b {
    font-size: 30px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
`

const PayRow = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--line);
  font-variant-numeric: tabular-nums;

  &:last-of-type {
    border-bottom: 0;
  }
  small {
    display: block;
    color: var(--muted);
  }
`

const PayLinkButton = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 40px;
  border-radius: 9px;
  background: var(--accent);
  color: var(--on-accent);
  font-weight: 600;
  transition: opacity 0.15s ease;

  &:hover {
    opacity: 0.9;
  }
`

export default function Shared() {
  const { token } = useParams()
  const path = `/shared/${encodeURIComponent(token ?? '')}`
  const { data: inv, error, setData } = useLoad<SharedInvoice>(path)
  const [noticeOpen, setNoticeOpen] = useState(false)
  const [ref, setRef] = useState('')
  const [note, setNote] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)

  if (error) {
    return (
      <Wrap style={{ display: 'block', maxWidth: 760, margin: '0 auto' }}>
        <Card>
          <Empty>
            <b>this link does not work</b>
            it may have been turned off or replaced, ask whoever sent it for a new one
          </Empty>
        </Card>
      </Wrap>
    )
  }
  if (!inv) return null

  const quote = inv.kind === 'quote'
  const open = !quote && (inv.status === 'sent' || inv.status === 'overdue')

  const sendNotice = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setActionError('')
    try {
      const r = await api.post<SharedInvoice>(`${path}/notice`, { reference: ref || null, note: note || null })
      setData(r.data)
      setNoticeOpen(false)
    } catch (err) {
      setActionError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const answer = async (accepted: boolean) => {
    setBusy(true)
    setActionError('')
    try {
      const r = await api.post<SharedInvoice>(`${path}/answer`, { accepted })
      setData(r.data)
    } catch (err) {
      setActionError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Wrap>
      <InvoicePaper inv={inv} logoSrc={`/api${path}/logo`} />

      <div className="side no-print">
        <Card>
          <Due>
            {quote ? (
              <>
                <span>quote total</span>
                <b>{money(inv.total, inv.currency)}</b>
                <span>valid until {day(inv.dueOn)}</span>
              </>
            ) : inv.status === 'paid' ? (
              <>
                <span>paid in full</span>
                <b style={{ color: 'var(--green)' }}>{money(inv.total, inv.currency)}</b>
              </>
            ) : (
              <>
                <span>amount due</span>
                <b>{money(inv.balance, inv.currency)}</b>
                <span>
                  due {day(inv.dueOn)} {inv.status === 'overdue' && <Pill status="overdue">overdue</Pill>}
                </span>
              </>
            )}
          </Due>

          <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
            {open && inv.payLink && (
              <PayLinkButton href={inv.payLink} target="_blank" rel="noopener noreferrer nofollow">
                pay now
              </PayLinkButton>
            )}
            {open && !inv.noticeSent && !noticeOpen && <Button onClick={() => setNoticeOpen(true)}>i have sent the payment</Button>}
            {open && inv.noticeSent && <Sub style={{ color: 'var(--green)' }}>thanks, they were told you sent the payment</Sub>}
            {quote && inv.status === 'sent' && (
              <>
                <Button variant="primary" disabled={busy} onClick={() => answer(true)}>
                  accept quote
                </Button>
                <Button disabled={busy} onClick={() => answer(false)}>
                  decline
                </Button>
              </>
            )}
            {quote && inv.status === 'accepted' && <Sub style={{ color: 'var(--green)' }}>you accepted this quote</Sub>}
            {quote && inv.status === 'declined' && <Sub>you declined this quote</Sub>}
            <LinkButton href={`/api${path}/pdf`}>
              <Icon name="file" size={15} />
              download pdf
            </LinkButton>
            <Button onClick={() => window.print()}>
              <Icon name="print" size={15} />
              print
            </Button>
          </div>

          {noticeOpen && (
            <form onSubmit={sendNotice} style={{ display: 'grid', gap: 10, marginTop: 16 }}>
              <Field>
                payment reference
                <input maxLength={120} placeholder="transaction id, optional" value={ref} onChange={(e) => setRef(e.target.value)} />
              </Field>
              <Field>
                note
                <input maxLength={300} placeholder="optional" value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button type="button" onClick={() => setNoticeOpen(false)}>
                  cancel
                </Button>
                <Button variant="primary" disabled={busy}>
                  let them know
                </Button>
              </div>
            </form>
          )}
          {actionError && <ErrorText>{actionError}</ErrorText>}
        </Card>

        {inv.payments.length > 0 && (
          <Card>
            <h2 style={{ fontSize: 15, marginBottom: 6 }}>payments received</h2>
            {inv.payments.map((p, i) => (
              <PayRow key={i}>
                <span>
                  {day(p.paidOn)}
                  <small>{methodLabel(p.method)}</small>
                </span>
                <b>{money(p.amount, inv.currency)}</b>
              </PayRow>
            ))}
          </Card>
        )}

        <p className="foot">made with tally</p>
      </div>
    </Wrap>
  )
}
