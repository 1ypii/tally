import styled from '@emotion/styled'
import { day, money, type Kind, type Line, type Profile, type Status } from '../api'
import { ClientLogo } from '../ui'

export type PaperInvoice = {
  kind?: Kind
  number: string
  subtotal?: number
  discount?: number
  tax?: number
  taxRate?: number
  taxLabel?: string | null
  status: Status
  client: { name: string; website: string | null; email?: string | null; location?: string | null; taxId?: string | null; phone?: string | null }
  sender?: Profile | null
  logo?: boolean
  issuedOn: string
  dueOn: string
  sentAt?: string | null
  paidAt: string | null
  currency: string
  total: number
  paid: number
  balance: number
  notes: string | null
  lines: Line[]
}

const Paper = styled.article`
  background: #ffffff;
  min-width: 0;
  color: #1b1b1f;
  border-radius: 14px;
  padding: 48px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 12px 40px rgba(0, 0, 0, 0.08);

  .top {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    flex-wrap: wrap;
    padding-bottom: 28px;
    border-bottom: 1px solid #ececec;
  }
  .mylogo {
    display: block;
    max-height: 64px;
    max-width: 200px;
    margin-bottom: 14px;
    object-fit: contain;
  }
  .title {
    font-size: 30px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .num {
    color: #75757d;
    margin-top: 2px;
  }
  .meta {
    display: grid;
    grid-template-columns: auto auto;
    gap: 4px 20px;
    font-size: 13.5px;
    align-content: start;
  }
  .meta span:nth-of-type(odd) {
    color: #75757d;
  }
  .parties {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    padding: 24px 0;
  }
  .bill {
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }
  .parties a {
    color: #4f6bed;
  }
  .parties p {
    white-space: pre-wrap;
  }
  .soft {
    color: #75757d;
  }
  .pay {
    margin-top: 24px;
    padding: 16px;
    border: 1px solid #ececec;
    border-radius: 10px;
    white-space: pre-wrap;
  }
  .label {
    font-size: 12px;
    color: #75757d;
    margin-bottom: 4px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th {
    text-align: left;
    font-size: 12px;
    font-weight: 500;
    color: #75757d;
    padding: 10px 0;
    border-bottom: 1px solid #ececec;
  }
  td {
    padding: 14px 0;
    border-bottom: 1px solid #f2f2f2;
  }
  .r {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .sums {
    display: grid;
    justify-content: end;
    gap: 6px;
    padding-top: 20px;
  }
  .sums div {
    display: flex;
    justify-content: space-between;
    gap: 48px;
    font-variant-numeric: tabular-nums;
  }
  .sums .muted {
    color: #75757d;
  }
  .sums .big {
    align-items: baseline;
    margin-top: 4px;
  }
  .sums .big b {
    font-size: 26px;
  }
  .notes {
    margin-top: 32px;
    padding: 16px;
    border-radius: 10px;
    background: #f7f7f6;
    white-space: pre-wrap;
  }

  @media (max-width: 760px) {
    padding: 24px 18px;
    .title {
      font-size: 24px;
    }
    .parties {
      grid-template-columns: 1fr;
    }
  }
  @media print {
    box-shadow: none;
    padding: 0;
    max-width: none;
  }
`

export default function InvoicePaper({ inv, logoSrc }: { inv: PaperInvoice; logoSrc?: string }) {
  const quote = inv.kind === 'quote'
  const adjusted = (inv.discount ?? 0) > 0 || (inv.taxRate ?? 0) > 0

  return (
    <Paper>
      <div className="top">
        <div>
          {inv.logo && logoSrc && <img className="mylogo" src={logoSrc} alt="" />}
          <div className="title">{quote ? 'quote' : 'invoice'}</div>
          <div className="num">{inv.number}</div>
        </div>
        <div className="meta">
          <span>issued</span>
          <span>{day(inv.issuedOn)}</span>
          <span>{quote ? 'valid until' : 'due'}</span>
          <span>{day(inv.dueOn)}</span>
          {inv.sentAt && (
            <>
              <span>sent</span>
              <span>{day(inv.sentAt)}</span>
            </>
          )}
          {inv.paidAt && (
            <>
              <span>paid</span>
              <span>{day(inv.paidAt)}</span>
            </>
          )}
        </div>
      </div>

      <div className="parties">
        <div className="bill">
          <ClientLogo name={inv.client.name} website={inv.client.website} size={46} />
          <div>
            <div className="label">{quote ? 'prepared for' : 'billed to'}</div>
            <b>{inv.client.name}</b>
            {inv.client.location && <p>{inv.client.location}</p>}
            {inv.client.website && (
              <div>
                <a href={`https://${inv.client.website}`} target="_blank" rel="noopener noreferrer">
                  {inv.client.website}
                </a>
              </div>
            )}
            {inv.client.email && <div className="soft">{inv.client.email}</div>}
            {inv.client.phone && <div className="soft">{inv.client.phone}</div>}
            {inv.client.taxId && <div className="soft">tax id {inv.client.taxId}</div>}
          </div>
        </div>
        {inv.sender && (inv.sender.businessName || inv.sender.location || inv.sender.contactEmail) && (
          <div>
            <div className="label">from</div>
            <b>{inv.sender.businessName}</b>
            {inv.sender.location && <p>{inv.sender.location}</p>}
            {inv.sender.contactEmail && <div className="soft">{inv.sender.contactEmail}</div>}
            {inv.sender.website && <div className="soft">{inv.sender.website}</div>}
            {inv.sender.taxId && <div className="soft">tax id {inv.sender.taxId}</div>}
          </div>
        )}
      </div>

      <table>
        <thead>
          <tr>
            <th>description</th>
            <th className="r">hours</th>
            <th className="r">rate</th>
            <th className="r">amount</th>
          </tr>
        </thead>
        <tbody>
          {inv.lines.map((l, i) => (
            <tr key={i}>
              <td>{l.description}</td>
              <td className="r">{l.fixed ? 'fixed' : l.quantity}</td>
              <td className="r">{l.fixed ? '' : money(l.unitPrice, inv.currency)}</td>
              <td className="r">{money(l.amount, inv.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="sums">
        {adjusted && (
          <>
            <div className="muted">
              <span>subtotal</span>
              <span>{money(inv.subtotal ?? 0, inv.currency)}</span>
            </div>
            {(inv.discount ?? 0) > 0 && (
              <div className="muted">
                <span>discount</span>
                <span>-{money(inv.discount ?? 0, inv.currency)}</span>
              </div>
            )}
            {(inv.taxRate ?? 0) > 0 && (
              <div className="muted">
                <span>
                  {inv.taxLabel || 'tax'} {(inv.taxRate ?? 0) / 100}%
                </span>
                <span>{money(inv.tax ?? 0, inv.currency)}</span>
              </div>
            )}
          </>
        )}
        {inv.paid > 0 && (
          <>
            <div className="muted">
              <span>total</span>
              <span>{money(inv.total, inv.currency)}</span>
            </div>
            <div className="muted">
              <span>paid</span>
              <span>{money(inv.paid, inv.currency)}</span>
            </div>
          </>
        )}
        <div className="big">
          <span>{quote ? 'total' : inv.paid > 0 ? 'balance due' : 'total due'}</span>
          <b>{money(inv.paid > 0 ? inv.balance : inv.total, inv.currency)}</b>
        </div>
      </div>

      {inv.sender?.paymentDetails && !quote && inv.status !== 'paid' && (
        <div className="pay">
          <div className="label">how to pay</div>
          {inv.sender.paymentDetails}
        </div>
      )}

      {inv.notes && (
        <div className="notes">
          <div className="label">notes</div>
          {inv.notes}
        </div>
      )}
    </Paper>
  )
}
