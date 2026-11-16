import styled from '@emotion/styled'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { day, money, useLoad, type Client, type Currency, type InvoiceRow, type Summary } from '../api'
import { MonthChart } from '../charts'
import { Icon } from '../icons'
import { Button, Card, Empty, ErrorText, Grid, Head, Page, Pill, Sub, Table, ClientCell, ClientLogo } from '../ui'

const Stat = styled(Card)`
  span {
    color: var(--muted);
    font-size: 13px;
  }
  b {
    display: block;
    margin-top: 6px;
    font-size: 26px;
    font-weight: 650;
    letter-spacing: -0.01em;
    font-variant-numeric: tabular-nums;
  }
  small {
    color: var(--muted);
  }
`

const Steps = styled.ol`
  list-style: none;
  padding: 0;
  display: grid;
  gap: 10px;
  margin-top: 16px;

  li {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: transparent;
  }
  .n {
    width: 14px;
    text-align: center;
    color: var(--muted);
    font-size: 13px;
    font-weight: 650;
    font-variant-numeric: tabular-nums;
  }
  .done .n {
    color: var(--green);
  }
  .done span:not(.n) {
    color: var(--muted);
    text-decoration: line-through;
  }
  a {
    margin-left: auto;
    color: var(--accent);
    font-weight: 500;
  }
`

const monthLabel = (ym: string) =>
  new Date(ym + '-01T00:00:00').toLocaleDateString('en-US', { month: 'short' }).toLowerCase()

export default function Overview() {
  const summary = useLoad<Summary>('/invoices/summary')
  const loaded = useLoad<InvoiceRow[]>('/invoices')
  const invoices = { ...loaded, data: loaded.data?.filter((i) => i.kind === 'invoice') ?? null }
  const clients = useLoad<Client[]>('/clients')
  const navigate = useNavigate()
  const [picked, setPicked] = useState<Currency | null>(null)

  const s = summary.data
  const codes = s ? (Object.keys(s.currencies) as Currency[]) : []
  const cur = picked && codes.includes(picked) ? picked : codes[0]
  const c = cur && s ? s.currencies[cur] : undefined

  const hasClient = (clients.data?.length ?? 0) > 0
  const hasInvoice = (invoices.data?.length ?? 0) > 0
  const hasSent = invoices.data?.some((i) => i.status !== 'draft') ?? false
  const fresh = clients.data && invoices.data && !hasSent

  return (
    <Page>
      <Head>
        <div style={{ marginRight: 'auto' }}>
          <h1>overview</h1>
          <Sub>where your money is right now</Sub>
        </div>
        {codes.length > 1 &&
          codes.map((code) => (
            <Button key={code} variant={code === cur ? 'primary' : undefined} onClick={() => setPicked(code)}>
              {code === 'rbx' ? 'robux' : code}
            </Button>
          ))}
      </Head>

      {summary.error && <ErrorText>{summary.error}</ErrorText>}

      {fresh && (
        <Card style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16 }}>get started</h2>
          <Sub>three steps and your first invoice is out</Sub>
          <Steps>
            <li className={hasClient ? 'done' : ''}>
              <span className="n">1</span>
              <span>add a client with their rate and currency</span>
              {!hasClient && <Link to="/clients">add client</Link>}
            </li>
            <li className={hasInvoice ? 'done' : ''}>
              <span className="n">2</span>
              <span>create an invoice for them</span>
              {hasClient && !hasInvoice && <Link to="/invoices/new">new invoice</Link>}
            </li>
            <li>
              <span className="n">3</span>
              <span>mark it sent and track it until it is paid</span>
              {hasInvoice && <Link to="/invoices">open invoices</Link>}
            </li>
          </Steps>
        </Card>
      )}

      {s && c && cur && (
        <>
          <Grid min={150} style={{ marginBottom: 20 }}>
            <Stat>
              <span>outstanding</span>
              <b>{money(c.outstanding, cur)}</b>
            </Stat>
            <Stat>
              <span>overdue</span>
              <b style={{ color: c.overdue > 0 ? 'var(--red)' : undefined }}>{money(c.overdue, cur)}</b>
              <small>{c.overdueCount === 1 ? '1 invoice' : `${c.overdueCount} invoices`}</small>
            </Stat>
            <Stat>
              <span>paid last 30 days</span>
              <b style={{ color: c.paid30 > 0 ? 'var(--green)' : undefined }}>{money(c.paid30, cur)}</b>
            </Stat>
            <Stat>
              <span>drafts</span>
              <b>{s.drafts}</b>
            </Stat>
          </Grid>

          <Card style={{ marginBottom: 20 }}>
            <Head style={{ marginBottom: 0 }}>
              <h2>paid per month</h2>
              <Sub>{cur === 'rbx' ? 'robux' : cur}</Sub>
            </Head>
            <div style={{ marginTop: 14 }}>
              <MonthChart
                labels={s.months.map(monthLabel)}
                cur={cur}
                height={230}
                series={[{ name: 'paid', color: 'var(--s1)', values: c.paidByMonth, kind: 'bar' }]}
              />
            </div>
          </Card>
        </>
      )}

      <Card>
        <Head style={{ marginBottom: 12 }}>
          <h2>recent invoices</h2>
          {hasInvoice && <Link to="/invoices" style={{ color: 'var(--accent)', fontWeight: 500 }}>see all</Link>}
        </Head>
        {invoices.error && <ErrorText>{invoices.error}</ErrorText>}
        {invoices.data && !hasInvoice && (
          <Empty>
            <b>no invoices yet</b>
            your invoices will show up here
            <div>
              <Button variant="primary" onClick={() => navigate(hasClient ? '/invoices/new' : '/clients')}>
                <Icon name="plus" />
                {hasClient ? 'new invoice' : 'add a client first'}
              </Button>
            </div>
          </Empty>
        )}
        {hasInvoice && (
          <Table>
            <thead>
              <tr>
                <th>number</th>
                <th>client</th>
                <th className="wide">due</th>
                <th>status</th>
                <th className="num">total</th>
              </tr>
            </thead>
            <tbody>
              {invoices.data!.slice(0, 6).map((inv) => (
                <tr key={inv.id} className="link" onClick={() => navigate(`/invoices/${inv.id}`)}>
                  <td className="strong">{inv.number}</td>
                  <td>
                    <ClientCell>
                      <ClientLogo name={inv.client.name} website={inv.client.website} size={24} />
                      {inv.client.name}
                    </ClientCell>
                  </td>
                  <td className="wide">{day(inv.dueOn)}</td>
                  <td>
                    <Pill status={inv.status}>{inv.status}</Pill>
                  </td>
                  <td className="num strong">{money(inv.total, inv.currency)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </Page>
  )
}
