import styled from '@emotion/styled'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { day, money, useLoad, type InvoiceRow, type Kind, type Status } from '../api'
import { Icon } from '../icons'
import { Button, Card, Empty, ErrorText, Head, Page, Pill, Sub, Table, ClientCell, ClientLogo } from '../ui'

const Bar = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 14px;

  .tabs {
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: 10px;
    border: 1px solid var(--line);
    overflow-x: auto;
  }
  .tabs button {
    display: flex;
    gap: 6px;
    align-items: center;
    height: 30px;
    padding: 0 12px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font-weight: 500;
    transition: background 0.15s ease, color 0.15s ease;
  }
  .tabs button.on {
    background: var(--hover);
    color: var(--text);
  }
  .tabs small {
    font-size: 11.5px;
    opacity: 0.7;
  }
  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
    padding: 0 12px;
    height: 36px;
    min-width: 220px;
    border: 1px solid var(--line);
    border-radius: 8px;
    color: var(--muted);
  }
  .search input {
    border: 0;
    outline: none;
    background: transparent;
    width: 100%;
  }

  @media (max-width: 760px) {
    .search {
      margin-left: 0;
      width: 100%;
    }
  }
`

const Marks = styled.span`
  display: inline-flex;
  gap: 6px;
  margin-left: 8px;

  i {
    font-style: normal;
    font-size: 11.5px;
    font-weight: 500;
    color: var(--muted);
  }
  i.notice {
    color: var(--green);
  }
`

const invoiceFilters: (Status | 'all')[] = ['all', 'draft', 'sent', 'overdue', 'paid']
const quoteFilters: (Status | 'all')[] = ['all', 'draft', 'sent', 'accepted', 'declined']

export default function Invoices() {
  const { data, error } = useLoad<InvoiceRow[]>('/invoices')
  const [params, setParams] = useSearchParams()
  const kind: Kind = params.get('kind') === 'quote' ? 'quote' : 'invoice'
  const [filter, setFilter] = useState<Status | 'all'>('all')
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  const ofKind = data?.filter((inv) => inv.kind === kind) ?? []
  const q = query.trim().toLowerCase()
  const rows = ofKind.filter(
    (inv) => (filter === 'all' || inv.status === filter) && (!q || inv.number.toLowerCase().includes(q) || inv.client.name.toLowerCase().includes(q)),
  )
  const count = (f: Status | 'all') => ofKind.filter((inv) => f === 'all' || inv.status === f).length
  const filters = kind === 'quote' ? quoteFilters : invoiceFilters
  const quotes = data?.filter((i) => i.kind === 'quote').length ?? 0

  const switchKind = (k: Kind) => {
    setFilter('all')
    setParams(k === 'quote' ? { kind: 'quote' } : {})
  }

  return (
    <Page>
      <Head>
        <div style={{ marginRight: 'auto' }}>
          <h1>{kind === 'quote' ? 'quotes' : 'invoices'}</h1>
          <Sub>{kind === 'quote' ? 'estimates you send before the work, turn them into invoices when accepted' : 'everything you have billed'}</Sub>
        </div>
        <Button onClick={() => navigate('/invoices/new?kind=quote')}>
          <Icon name="plus" />
          new quote
        </Button>
        <Button variant="primary" onClick={() => navigate('/invoices/new')}>
          <Icon name="plus" />
          new invoice
        </Button>
      </Head>
      <Card>
        <Bar>
          <div className="tabs">
            <button className={kind === 'invoice' ? 'on' : ''} onClick={() => switchKind('invoice')}>
              invoices
            </button>
            <button className={kind === 'quote' ? 'on' : ''} onClick={() => switchKind('quote')}>
              quotes
              <small>{quotes}</small>
            </button>
          </div>
          <div className="tabs">
            {filters.map((f) => (
              <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
                {f}
                <small>{count(f)}</small>
              </button>
            ))}
          </div>
          <label className="search">
            <Icon name="search" />
            <input placeholder="search number or client" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
        </Bar>
        {error && <ErrorText>{error}</ErrorText>}
        {data && rows.length === 0 && (
          <Empty>
            <b>{ofKind.length === 0 ? `no ${kind}s yet` : 'nothing matches'}</b>
            {ofKind.length === 0 ? `create your first ${kind} and it shows up here` : 'try another filter or search'}
          </Empty>
        )}
        {rows.length > 0 && (
          <Table>
            <thead>
              <tr>
                <th>number</th>
                <th>client</th>
                <th className="wide">issued</th>
                <th className="wide">{kind === 'quote' ? 'valid until' : 'due'}</th>
                <th>status</th>
                <th className="num">total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => (
                <tr key={inv.id} className="link" onClick={() => navigate(`/invoices/${inv.id}`)}>
                  <td className="strong">
                    {inv.number}
                    <Marks>
                      {inv.repeatEvery && <i title={`repeats ${inv.repeatEvery}`}>{inv.repeatEvery}</i>}
                      {inv.viewed && <i>seen</i>}
                      {inv.notice && <i className="notice">says paid</i>}
                    </Marks>
                  </td>
                  <td>
                    <ClientCell>
                      <ClientLogo name={inv.client.name} website={inv.client.website} size={24} />
                      {inv.client.name}
                    </ClientCell>
                  </td>
                  <td className="wide">{day(inv.issuedOn)}</td>
                  <td className="wide">{day(inv.dueOn)}</td>
                  <td>
                    <Pill status={inv.status}>{inv.status}</Pill>
                  </td>
                  <td className="num strong">
                    {money(inv.total, inv.currency)}
                    {inv.paid > 0 && inv.balance > 0 && (
                      <div style={{ fontWeight: 400, fontSize: 12, color: 'var(--muted)' }}>{money(inv.balance, inv.currency)} left</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </Page>
  )
}
