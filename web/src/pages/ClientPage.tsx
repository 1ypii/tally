import styled from '@emotion/styled'
import { Link, useNavigate, useParams } from 'react-router'
import { daysBetween, day, money, shortName, useLoad, type Client, type InvoiceRow } from '../api'
import { MonthChart } from '../charts'
import { Icon } from '../icons'
import { Button, Card, ClientLogo, Empty, ErrorText, Head, Page, Pill, Sub, Table, Tag } from '../ui'

const Top = styled.div`
  display: flex;
  gap: 16px;
  align-items: center;
  margin-right: auto;

  h1 {
    margin: 0;
  }
  .meta {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 6px;
    color: var(--muted);
  }
`

const Stats = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 20px;

  @media (max-width: 1100px) {
    grid-template-columns: repeat(2, 1fr);
  }
`

const Stat = styled(Card)`
  span {
    color: var(--muted);
    font-size: 13px;
  }
  b {
    display: block;
    margin-top: 6px;
    font-size: 24px;
    font-weight: 650;
    font-variant-numeric: tabular-nums;
  }
  small {
    color: var(--muted);
  }
`

const Two = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 20px;
  margin-bottom: 20px;

  @media (max-width: 1100px) {
    grid-template-columns: 1fr;
  }
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 10px 18px;
    margin: 0;
  }
  dt {
    color: var(--muted);
  }
  dd {
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
`

const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

export default function ClientPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const clients = useLoad<Client[]>('/clients')
  const invoices = useLoad<InvoiceRow[]>('/invoices')

  const client = clients.data?.find((c) => String(c.id) === id)
  if (clients.data && !client) {
    return (
      <Page>
        <ErrorText>that client does not exist</ErrorText>
      </Page>
    )
  }
  if (!client || !invoices.data) {
    return <Page>{(clients.error || invoices.error) && <ErrorText>{clients.error || invoices.error}</ErrorText>}</Page>
  }

  const mine = invoices.data.filter((i) => i.client.id === client.id)
  const bills = mine.filter((i) => i.kind === 'invoice')
  const cur = client.currency
  const sent = bills.filter((i) => i.status !== 'draft' && i.currency === cur)
  const billed = sent.reduce((s, i) => s + i.total, 0)
  const paid = sent.reduce((s, i) => s + i.paid, 0)
  const owed = sent.filter((i) => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.balance, 0)
  const settled = sent.filter((i) => i.status === 'paid' && i.sentAt && i.paidAt)
  const avgDays = settled.length ? Math.round(settled.reduce((s, i) => s + Math.max(0, daysBetween(i.sentAt!, i.paidAt!)), 0) / settled.length) : null
  const onTime = settled.length ? Math.round((settled.filter((i) => i.paidAt!.slice(0, 10) <= i.dueOn).length / settled.length) * 100) : null
  const overdue = sent.filter((i) => i.status === 'overdue').length
  const otherCurrencies = [...new Set(bills.filter((i) => i.currency !== cur && i.status !== 'draft').map((i) => i.currency))]

  const year = new Date().getFullYear()
  const byMonth = monthNames.map((_, m) => sent.filter((i) => +i.issuedOn.slice(0, 4) === year && +i.issuedOn.slice(5, 7) === m + 1).reduce((s, i) => s + i.total, 0))

  return (
    <Page>
      <Link to="/clients" style={{ color: 'var(--muted)', display: 'inline-flex', gap: 6, alignItems: 'center', marginBottom: 10 }}>
        <Icon name="back" size={14} />
        clients
      </Link>
      <Head>
        <Top>
          <ClientLogo name={client.name} website={client.website} size={52} />
          <div>
            <h1>{client.name}</h1>
            <div className="meta">
              <Tag>{shortName(cur)}</Tag>
              <Tag>{client.termsDays === 0 ? 'due on receipt' : `net ${client.termsDays}`}</Tag>
              {client.rate > 0 && <Tag>{money(client.rate, cur)} per hour</Tag>}
            </div>
          </div>
        </Top>
        <Button onClick={() => navigate(`/invoices/new?kind=quote&client=${client.id}`)}>new quote</Button>
        <Button variant="primary" onClick={() => navigate(`/invoices/new?client=${client.id}`)}>
          <Icon name="plus" />
          new invoice for them
        </Button>
      </Head>

      <Stats>
        <Stat>
          <span>billed in total</span>
          <b>{money(billed, cur)}</b>
          <small>{sent.length === 1 ? '1 invoice' : `${sent.length} invoices`}</small>
        </Stat>
        <Stat>
          <span>paid</span>
          <b style={{ color: paid > 0 ? 'var(--green)' : undefined }}>{money(paid, cur)}</b>
          <small>{billed > 0 ? `${Math.round((paid / billed) * 100)}% of billed` : 'nothing billed yet'}</small>
        </Stat>
        <Stat>
          <span>still owed</span>
          <b style={{ color: overdue > 0 ? 'var(--red)' : undefined }}>{money(owed, cur)}</b>
          <small>{overdue > 0 ? `${overdue} overdue` : 'nothing overdue'}</small>
        </Stat>
        <Stat>
          <span>usually pays in</span>
          <b>{avgDays === null ? 'no data' : avgDays === 0 ? 'same day' : `${avgDays} ${avgDays === 1 ? 'day' : 'days'}`}</b>
          <small>{onTime === null ? 'shows up after a paid invoice' : `${onTime}% paid on time`}</small>
        </Stat>
      </Stats>

      <Two>
        <Card>
          <Head style={{ marginBottom: 10 }}>
            <h2>billed per month in {year}</h2>
          </Head>
          <MonthChart labels={monthNames} cur={cur} height={220} series={[{ name: 'billed', color: 'var(--s1)', values: byMonth, kind: 'bar' }]} />
        </Card>
        <Card>
          <Head style={{ marginBottom: 14 }}>
            <h2>details</h2>
          </Head>
          <dl>
            {client.website && (
              <>
                <dt>website</dt>
                <dd>
                  <a href={`https://${client.website}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                    {client.website}
                  </a>
                </dd>
              </>
            )}
            {client.email && (
              <>
                <dt>email</dt>
                <dd>{client.email}</dd>
              </>
            )}
            {client.phone && (
              <>
                <dt>phone</dt>
                <dd>{client.phone}</dd>
              </>
            )}
            {client.location && (
              <>
                <dt>location</dt>
                <dd>{client.location}</dd>
              </>
            )}
            {client.taxId && (
              <>
                <dt>tax id</dt>
                <dd>{client.taxId}</dd>
              </>
            )}
            <dt>terms</dt>
            <dd>{client.termsDays === 0 ? 'due on receipt' : `pays within ${client.termsDays} days`}</dd>
          </dl>
          {otherCurrencies.length > 0 && <Sub style={{ marginTop: 14 }}>totals above only count {shortName(cur)}, they also have invoices in {otherCurrencies.map(shortName).join(', ')}</Sub>}
        </Card>
      </Two>

      <Card>
        <Head style={{ marginBottom: 12 }}>
          <h2>history</h2>
        </Head>
        {mine.length === 0 ? (
          <Empty>
            <b>nothing with {client.name} yet</b>
            invoices and quotes for them show up here
          </Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>number</th>
                <th className="wide">issued</th>
                <th className="wide">paid</th>
                <th>status</th>
                <th className="num">total</th>
              </tr>
            </thead>
            <tbody>
              {mine.map((i) => (
                <tr key={i.id} className="link" onClick={() => navigate(`/invoices/${i.id}`)}>
                  <td className="strong">
                    {i.number}
                    {i.kind === 'quote' && <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: 8 }}>quote</span>}
                  </td>
                  <td className="wide">{day(i.issuedOn)}</td>
                  <td className="wide">{i.paidAt ? day(i.paidAt) : ''}</td>
                  <td>
                    <Pill status={i.status}>{i.status}</Pill>
                  </td>
                  <td className="num strong">{money(i.total, i.currency)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </Page>
  )
}
