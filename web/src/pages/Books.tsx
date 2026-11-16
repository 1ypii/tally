import styled from '@emotion/styled'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import {
  api,
  currencyOptions,
  decimalsOf,
  day,
  errorText,
  fromMinor,
  isoDay,
  methodLabel,
  money,
  priceStep,
  shortName,
  toMinor,
  useLoad,
  type Category,
  type Currency,
  type Expense,
  type Income,
  type LedgerPayment,
  type Settings,
} from '../api'
import { AreaChart, Donut, Legend, MonthChart } from '../charts'
import { Backdrop, Dialog, useFeedback } from '../feedback'
import { Icon } from '../icons'
import { Select } from '../select'
import { Button, Card, Empty, ErrorText, Field, Head, Page, Sub, Table, Tag } from '../ui'

const Controls = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;

  > div:not(.seg) {
    width: 120px;
  }
`

const Seg = styled.div`
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: 10px;

  button {
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
  button.on {
    background: var(--hover);
    color: var(--text);
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
    font-size: 26px;
    font-weight: 650;
    letter-spacing: -0.01em;
    font-variant-numeric: tabular-nums;
  }
  small {
    color: var(--muted);
  }
`

const Two = styled.div<{ cols?: string }>`
  display: grid;
  grid-template-columns: ${(p) => p.cols ?? '1fr 1fr'};
  gap: 20px;
  margin-bottom: 20px;

  @media (max-width: 1100px) {
    grid-template-columns: 1fr;
  }
`

const Bars = styled.div`
  display: grid;
  gap: 14px;

  .row {
    display: grid;
    gap: 6px;
  }
  .row div:first-of-type {
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }
  .row small {
    color: var(--muted);
    margin-left: 6px;
  }
  .row b {
    font-variant-numeric: tabular-nums;
  }
  .track {
    height: 8px;
    border-radius: 6px;
    background: var(--field);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    border-radius: 6px;
    background: var(--s1);
    transition: width 0.45s cubic-bezier(0.2, 0.7, 0.2, 1);
  }
`

const Mini = styled.div`
  .mini {
    border: 0;
    background: none;
    padding: 0;
    color: var(--muted);
    cursor: pointer;
    font-size: 13px;
    transition: color 0.15s ease;
  }
  .mini:hover {
    color: var(--text);
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

const CatList = styled.div`
  display: grid;
  gap: 6px;
  margin-top: 14px;
  max-height: 320px;
  overflow-y: auto;

  .row {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .row input {
    flex: 1;
    min-width: 0;
    height: 34px;
    padding: 0 10px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    color: var(--text);
    transition: border-color 0.15s ease;
  }
  .row input:hover,
  .row input:focus {
    border-color: var(--line);
    outline: none;
  }
`

type ExpenseForm = { description: string; amount: string; currency: Currency; spentOn: string; categoryId: string }

type Entry = {
  key: string
  date: string
  label: string
  ref: string | null
  method: string
  amount: number
  currency: Currency
  invoiceId: number | null
}

const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function csvCell(value: string | number) {
  let s = String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function download(name: string, rows: (string | number)[][]) {
  const text = rows.map((r) => r.map(csvCell).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export default function Books() {
  const payments = useLoad<LedgerPayment[]>('/payments')
  const incomes = useLoad<Income[]>('/income')
  const expenses = useLoad<Expense[]>('/expenses')
  const categories = useLoad<Category[]>('/categories')
  const settings = useLoad<Settings>('/profile')
  const [rates, setRates] = useState<{ rates: Record<string, number>; robuxValue: number | null; updated: number } | null>(null)
  const [home, setHome] = useState(false)
  const [ratesError, setRatesError] = useState('')
  const { toast, confirm } = useFeedback()
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const [picked, setPicked] = useState<Currency | null>(null)
  const [view, setView] = useState<'bars' | 'lines'>('bars')
  const [tab, setTab] = useState<'income' | 'expenses'>('income')
  const [form, setForm] = useState<ExpenseForm | null>(null)
  const [editing, setEditing] = useState<number | null>(null)
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [managing, setManaging] = useState(false)
  const [newCat, setNewCat] = useState('')
  const [catError, setCatError] = useState('')

  const homeCur = settings.data?.homeCurrency ?? 'usd'

  const toHome = (amount: number, from: Currency): number | null => {
    if (from === homeCur) return amount
    if (!rates) return null
    let usd: number
    if (from === 'rbx') {
      if (!rates.robuxValue) return null
      usd = (amount * rates.robuxValue) / 1e6
    } else {
      const r = rates.rates[from]
      if (!r) return null
      usd = amount / 10 ** decimalsOf(from) / r
    }
    const target = homeCur === 'usd' ? 1 : rates.rates[homeCur]
    if (!target) return null
    return Math.round(usd * target * 10 ** decimalsOf(homeCur))
  }

  const toggleHome = async () => {
    if (home) {
      setHome(false)
      return
    }
    setRatesError('')
    try {
      if (!rates) setRates((await api.get('/rates')).data)
      setHome(true)
    } catch (err) {
      setRatesError(errorText(err))
    }
  }

  const rawEntries: Entry[] = [
    ...(payments.data ?? []).map((p) => ({
      key: 'p' + p.id,
      date: p.paidOn,
      label: p.client.name,
      ref: p.invoice.number,
      method: p.method,
      amount: p.amount,
      currency: p.currency,
      invoiceId: p.invoice.id,
    })),
    ...(incomes.data ?? []).map((i) => ({
      key: 'i' + i.id,
      date: i.receivedOn,
      label: i.source,
      ref: i.reference,
      method: i.method,
      amount: i.amount,
      currency: i.currency,
      invoiceId: null,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date))
  let skipped = 0
  const entries: Entry[] = home
    ? rawEntries.flatMap((e) => {
        const amount = toHome(e.amount, e.currency)
        if (amount === null) {
          skipped++
          return []
        }
        return [{ ...e, amount, currency: homeCur }]
      })
    : rawEntries
  const allExpenses: Expense[] = home
    ? (expenses.data ?? []).flatMap((e) => {
        const amount = toHome(e.amount, e.currency)
        if (amount === null) {
          skipped++
          return []
        }
        return [{ ...e, amount, currency: homeCur }]
      })
    : (expenses.data ?? [])

  const counts = new Map<Currency, number>()
  for (const e of entries) counts.set(e.currency, (counts.get(e.currency) ?? 0) + 2)
  for (const e of allExpenses) counts.set(e.currency, (counts.get(e.currency) ?? 0) + 1)
  const used = [...counts.keys()].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
  const cur = home ? homeCur : picked && used.includes(picked) ? picked : (used[0] ?? 'usd')
  const years = [...new Set([thisYear, ...entries.map((e) => +e.date.slice(0, 4)), ...allExpenses.map((e) => +e.spentOn.slice(0, 4))])].sort((a, b) => b - a)

  const yearEntries = entries.filter((e) => e.currency === cur && +e.date.slice(0, 4) === year)
  const yearExpenses = allExpenses.filter((e) => e.currency === cur && +e.spentOn.slice(0, 4) === year)

  const months = monthNames.map((name, i) => {
    const income = yearEntries.filter((e) => +e.date.slice(5, 7) === i + 1).reduce((s, e) => s + e.amount, 0)
    const spent = yearExpenses.filter((e) => +e.spentOn.slice(5, 7) === i + 1).reduce((s, e) => s + e.amount, 0)
    return { name, income, spent, net: income - spent }
  })
  const lastMonth = year === thisYear ? new Date().getMonth() : 11
  const running = months.slice(0, lastMonth + 1).reduce<number[]>((acc, m) => [...acc, (acc[acc.length - 1] ?? 0) + m.net], [])
  const income = months.reduce((s, m) => s + m.income, 0)
  const spent = months.reduce((s, m) => s + m.spent, 0)
  const best = months.reduce((a, b) => (b.income > a.income ? b : a), months[0])

  const bySource = Object.values(
    yearEntries.reduce<Record<string, { name: string; total: number; count: number }>>((acc, e) => {
      const key = e.label.toLowerCase()
      acc[key] ??= { name: e.label, total: 0, count: 0 }
      acc[key].total += e.amount
      acc[key].count++
      return acc
    }, {}),
  ).sort((a, b) => b.total - a.total)

  const byCategory = Object.entries(
    yearExpenses.reduce<Record<string, number>>((acc, e) => {
      const k = e.category?.name ?? 'uncategorized'
      acc[k] = (acc[k] ?? 0) + e.amount
      return acc
    }, {}),
  ).map(([label, value]) => ({ label, value }))

  const catOptions = [{ value: '', label: 'no category' }, ...(categories.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))]

  const openExpense = (e?: Expense) => {
    setEditing(e?.id ?? null)
    setFormError('')
    setForm(
      e
        ? { description: e.description, amount: fromMinor(e.amount, e.currency), currency: e.currency, spentOn: e.spentOn, categoryId: e.category ? String(e.category.id) : '' }
        : { description: '', amount: '', currency: cur, spentOn: isoDay(new Date()), categoryId: String(categories.data?.[0]?.id ?? '') },
    )
  }

  const saveExpense = async (ev: FormEvent) => {
    ev.preventDefault()
    if (!form) return
    setBusy(true)
    setFormError('')
    const body = {
      description: form.description,
      amount: toMinor(form.amount, form.currency),
      currency: form.currency,
      spentOn: form.spentOn,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
    }
    try {
      if (editing) await api.put(`/expenses/${editing}`, body)
      else await api.post('/expenses', body)
      toast(editing ? 'expense saved' : 'expense added')
      setForm(null)
      setTab('expenses')
      expenses.reload()
    } catch (err) {
      setFormError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const attachReceipt = async (e: Expense, file: File | undefined) => {
    if (!file) return
    if (file.size > 5_000_000) {
      await confirm({ title: 'that file is too big', body: 'receipts can be up to 5 mb', confirm: 'ok' })
      return
    }
    const body = new FormData()
    body.append('file', file)
    try {
      await api.post(`/expenses/${e.id}/receipt`, body)
      toast('receipt attached')
    } catch (err) {
      await confirm({ title: 'could not attach', body: errorText(err), confirm: 'ok' })
    }
  }

  const removeReceipt = async (e: Expense) => {
    const ok = await confirm({ title: 'remove the receipt?', confirm: 'remove', danger: true })
    if (!ok) return
    try {
      await api.delete(`/expenses/${e.id}/receipt`)
      toast('receipt removed')
    } catch (err) {
      await confirm({ title: 'could not remove', body: errorText(err), confirm: 'ok' })
    }
  }

  const removeExpense = async (e: Expense) => {
    const ok = await confirm({ title: `delete ${e.description}?`, confirm: 'delete', danger: true })
    if (!ok) return
    try {
      await api.delete(`/expenses/${e.id}`)
      toast('expense deleted')
      expenses.reload()
    } catch (err) {
      await confirm({ title: 'could not delete', body: errorText(err), confirm: 'ok' })
    }
  }

  const addCategory = async (ev: FormEvent) => {
    ev.preventDefault()
    setCatError('')
    try {
      await api.post('/categories', { name: newCat })
      setNewCat('')
      categories.reload()
    } catch (err) {
      setCatError(errorText(err))
    }
  }

  const renameCategory = async (c: Category, name: string) => {
    if (!name.trim() || name.trim().toLowerCase() === c.name) return
    setCatError('')
    try {
      await api.put(`/categories/${c.id}`, { name })
      categories.reload()
      expenses.reload()
      toast('category renamed')
    } catch (err) {
      setCatError(errorText(err))
      categories.reload()
    }
  }

  const deleteCategory = async (c: Category) => {
    const ok = await confirm({ title: `delete ${c.name}?`, body: 'expenses in it stay, they just lose the category', confirm: 'delete', danger: true })
    if (!ok) return
    try {
      await api.delete(`/categories/${c.id}`)
      categories.reload()
      expenses.reload()
    } catch (err) {
      setCatError(errorText(err))
    }
  }

  const exportCsv = () => {
    if (tab === 'income') {
      download(`tally-income-${year}-${cur}.csv`, [
        ['date', 'from', 'reference', 'method', 'amount', 'currency'],
        ...yearEntries.map((e) => [e.date, e.label, e.ref ?? '', methodLabel(e.method), fromMinor(e.amount, cur), cur]),
      ])
    } else {
      download(`tally-expenses-${year}-${cur}.csv`, [
        ['date', 'description', 'category', 'amount', 'currency'],
        ...yearExpenses.map((e) => [e.spentOn, e.description, e.category?.name ?? '', fromMinor(e.amount, cur), cur]),
      ])
    }
  }

  const error = payments.error || expenses.error || incomes.error
  const loaded = payments.data && expenses.data && incomes.data

  return (
    <Page>
      <Mini>
      <Head>
        <div style={{ marginRight: 'auto' }}>
          <h1>books</h1>
          <Sub>what came in, what went out, what you kept</Sub>
        </div>
        <Controls>
          <Select label="year" value={String(year)} options={years.map((y) => ({ value: String(y), label: String(y) }))} onChange={(v) => setYear(+v)} />
          {used.length > 1 && !home && <Select label="currency" value={cur} options={used.map((c) => ({ value: c, label: shortName(c) }))} onChange={setPicked} />}
          <Button onClick={toggleHome}>{home ? 'show original currencies' : `everything in ${shortName(homeCur)}`}</Button>
          <Button onClick={() => setManaging(true)}>categories</Button>
          <Button variant="primary" onClick={() => openExpense()}>
            <Icon name="plus" />
            add expense
          </Button>
        </Controls>
      </Head>

      {error && <ErrorText>{error}</ErrorText>}
      {ratesError && <ErrorText>{ratesError}</ErrorText>}
      {home && rates && (
        <Sub style={{ marginBottom: 16 }}>
          everything converted to {shortName(homeCur)} at today's rates from{' '}
          <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
            exchangerate-api
          </a>
          , updated {day(new Date(rates.updated * 1000).toISOString())}
          {skipped > 0 && `. ${skipped} ${skipped === 1 ? 'entry was' : 'entries were'} left out because they have no rate, robux needs a value in settings`}
        </Sub>
      )}

      {loaded && (
        <>
          <Stats>
            <Stat>
              <span>income {year}</span>
              <b>{money(income, cur)}</b>
              <small>{yearEntries.length === 1 ? '1 payment' : `${yearEntries.length} payments`}</small>
            </Stat>
            <Stat>
              <span>expenses {year}</span>
              <b>{money(spent, cur)}</b>
              <small>{yearExpenses.length === 1 ? '1 expense' : `${yearExpenses.length} expenses`}</small>
            </Stat>
            <Stat>
              <span>net {year}</span>
              <b style={{ color: income - spent < 0 ? 'var(--red)' : undefined }}>{money(income - spent, cur)}</b>
              <small>{income > 0 ? `${Math.round(((income - spent) / income) * 100)}% kept` : 'nothing in yet'}</small>
            </Stat>
            <Stat>
              <span>best month</span>
              <b>{best.income > 0 ? best.name : 'none yet'}</b>
              <small>{best.income > 0 ? money(best.income, cur) : 'record income to start'}</small>
            </Stat>
          </Stats>

          <Two cols="2fr 1fr">
            <Card>
              <Head style={{ marginBottom: 10 }}>
                <h2>income and expenses</h2>
                <Seg className="seg">
                  <button className={view === 'bars' ? 'on' : ''} onClick={() => setView('bars')}>
                    bars
                  </button>
                  <button className={view === 'lines' ? 'on' : ''} onClick={() => setView('lines')}>
                    lines
                  </button>
                </Seg>
              </Head>
              <Legend
                items={[
                  { name: 'income', color: 'var(--s1)', line: view === 'lines' },
                  { name: 'expenses', color: 'var(--s2)', line: view === 'lines' },
                  { name: 'net', color: 'var(--s3)', line: true },
                ]}
              />
              <MonthChart
                labels={monthNames}
                cur={cur}
                series={[
                  { name: 'income', color: 'var(--s1)', values: months.map((m) => m.income), kind: view === 'bars' ? 'bar' : 'line' },
                  { name: 'expenses', color: 'var(--s2)', values: months.map((m) => m.spent), kind: view === 'bars' ? 'bar' : 'line' },
                  { name: 'net', color: 'var(--s3)', values: months.map((m) => m.net), kind: 'line' },
                ]}
              />
            </Card>
            <Card>
              <Head style={{ marginBottom: 6 }}>
                <h2>running net</h2>
                <Tag>{shortName(cur)}</Tag>
              </Head>
              <Sub style={{ marginBottom: 14 }}>what you have kept so far this year</Sub>
              <AreaChart labels={monthNames.slice(0, lastMonth + 1)} values={running} cur={cur} color="var(--s1)" name="kept so far" height={250} />
            </Card>
          </Two>

          <Two>
            <Card>
              <Head style={{ marginBottom: 16 }}>
                <h2>spending by category</h2>
              </Head>
              {byCategory.length === 0 ? <Sub>no expenses in {year}</Sub> : <Donut items={byCategory} cur={cur} centerLabel={`spent in ${year}`} />}
            </Card>
            <Card>
              <Head style={{ marginBottom: 16 }}>
                <h2>income by source</h2>
              </Head>
              {bySource.length === 0 && <Sub>no income in {year}</Sub>}
              <Bars>
                {bySource.slice(0, 8).map((c) => (
                  <div className="row" key={c.name}>
                    <div>
                      <span>
                        {c.name}
                        <small>{c.count === 1 ? '1 payment' : `${c.count} payments`}</small>
                      </span>
                      <b>{money(c.total, cur)}</b>
                    </div>
                    <div className="track">
                      <div className="fill" style={{ width: `${(c.total / income) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </Bars>
            </Card>
          </Two>

          <Two cols="1fr 2fr">
            <Card>
              <Head style={{ marginBottom: 8 }}>
                <h2>by month</h2>
              </Head>
              <Table>
                <thead>
                  <tr>
                    <th>month</th>
                    <th className="num">in</th>
                    <th className="num">out</th>
                    <th className="num">net</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((m) => (
                    <tr key={m.name} style={{ color: m.income === 0 && m.spent === 0 ? 'var(--muted)' : undefined }}>
                      <td>{m.name}</td>
                      <td className="num">{money(m.income, cur)}</td>
                      <td className="num">{money(m.spent, cur)}</td>
                      <td className="num strong" style={{ color: m.net < 0 ? 'var(--red)' : m.net > 0 ? 'var(--green)' : undefined }}>
                        {money(m.net, cur)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>

            <Card>
              <Head style={{ marginBottom: 12 }}>
                <Seg className="seg" style={{ marginRight: 'auto' }}>
                  <button className={tab === 'income' ? 'on' : ''} onClick={() => setTab('income')}>
                    income
                  </button>
                  <button className={tab === 'expenses' ? 'on' : ''} onClick={() => setTab('expenses')}>
                    expenses
                  </button>
                </Seg>
                <Button onClick={exportCsv} disabled={tab === 'income' ? yearEntries.length === 0 : yearExpenses.length === 0}>
                  export csv
                </Button>
              </Head>

              {tab === 'income' && yearEntries.length === 0 && (
                <Empty>
                  <b>no income in {year}</b>
                  record payments on invoices, or add and import income on the income page
                  <div>
                    <Link to="/income" style={{ color: 'var(--accent)', fontWeight: 500 }}>
                      go to income
                    </Link>
                  </div>
                </Empty>
              )}
              {tab === 'income' && yearEntries.length > 0 && (
                <Table>
                  <thead>
                    <tr>
                      <th>date</th>
                      <th>from</th>
                      <th className="wide">reference</th>
                      <th className="wide">method</th>
                      <th className="num">amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearEntries.map((e) => (
                      <tr key={e.key}>
                        <td>{day(e.date)}</td>
                        <td>{e.label}</td>
                        <td className="wide">
                          {e.invoiceId ? (
                            <Link to={`/invoices/${e.invoiceId}`} style={{ color: 'var(--accent)', fontWeight: 500 }}>
                              {e.ref}
                            </Link>
                          ) : (
                            <span style={{ color: 'var(--muted)' }}>{e.ref ?? 'external'}</span>
                          )}
                        </td>
                        <td className="wide">{methodLabel(e.method)}</td>
                        <td className="num strong">{money(e.amount, e.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}

              {tab === 'expenses' && yearExpenses.length === 0 && (
                <Empty>
                  <b>no expenses in {year}</b>
                  log software, hosting, assets and anything else you pay for
                  <div>
                    <Button variant="primary" onClick={() => openExpense()}>
                      <Icon name="plus" />
                      add expense
                    </Button>
                  </div>
                </Empty>
              )}
              {tab === 'expenses' && yearExpenses.length > 0 && (
                <Table>
                  <thead>
                    <tr>
                      <th>date</th>
                      <th>description</th>
                      <th className="wide">category</th>
                      <th className="wide">receipt</th>
                      <th className="num">amount</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {yearExpenses.map((e) => (
                      <tr key={e.id}>
                        <td>{day(e.spentOn)}</td>
                        <td>{e.description}</td>
                        <td className="wide">{e.category ? <Tag>{e.category.name}</Tag> : <span style={{ color: 'var(--muted)' }}>none</span>}</td>
                        <td className="wide">
                          {e.receipt ? (
                            <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                              <a href={`/api/expenses/${e.id}/receipt`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontWeight: 500 }}>
                                {e.receipt.mime === 'application/pdf' ? 'pdf' : 'view'}
                              </a>
                              <button type="button" className="mini" onClick={() => removeReceipt(e)}>
                                remove
                              </button>
                            </span>
                          ) : (
                            <label className="mini">
                              attach
                              <input type="file" hidden accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(ev) => attachReceipt(e, ev.target.files?.[0])} />
                            </label>
                          )}
                        </td>
                        <td className="num strong">{money(e.amount, e.currency)}</td>
                        <td className="num">
                          <Button variant="ghost" aria-label="edit expense" onClick={() => openExpense(e)}>
                            <Icon name="edit" size={14} />
                          </Button>
                          <Button variant="ghost" aria-label="delete expense" onClick={() => removeExpense(e)}>
                            <Icon name="trash" size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          </Two>
        </>
      )}

      {form && (
        <Backdrop onClick={() => setForm(null)}>
          <Dialog as="form" onSubmit={saveExpense} onClick={(e) => e.stopPropagation()} style={{ width: 'min(500px, 100%)' }}>
            <h3>{editing ? 'edit expense' : 'add expense'}</h3>
            <FormGrid>
              <Field className="full">
                description
                <input autoFocus required maxLength={200} placeholder="what you paid for" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
              <Field>
                amount
                <input
                  type="number"
                  required
                  min={priceStep(form.currency)}
                  step={priceStep(form.currency)}
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </Field>
              <Field as="div">
                currency
                <Select label="currency" value={form.currency} options={currencyOptions()} onChange={(v) => setForm({ ...form, currency: v })} />
              </Field>
              <Field>
                date
                <input type="date" required value={form.spentOn} onChange={(e) => setForm({ ...form, spentOn: e.target.value })} />
              </Field>
              <Field as="div">
                category
                <Select label="category" value={form.categoryId} options={catOptions} onChange={(v) => setForm({ ...form, categoryId: v })} />
              </Field>
            </FormGrid>
            {formError && <ErrorText>{formError}</ErrorText>}
            <div className="actions">
              <Button type="button" onClick={() => setForm(null)}>
                cancel
              </Button>
              <Button variant="primary" disabled={busy}>
                {editing ? 'save expense' : 'add expense'}
              </Button>
            </div>
          </Dialog>
        </Backdrop>
      )}

      {managing && (
        <Backdrop onClick={() => setManaging(false)}>
          <Dialog onClick={(e) => e.stopPropagation()} style={{ width: 'min(440px, 100%)' }}>
            <h3>expense categories</h3>
            <p style={{ color: 'var(--muted)' }}>click a name to rename it</p>
            <CatList>
              {(categories.data ?? []).map((c) => (
                <div className="row" key={c.id + c.name}>
                  <input
                    defaultValue={c.name}
                    maxLength={40}
                    aria-label={`rename ${c.name}`}
                    onBlur={(e) => renameCategory(c, e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  />
                  <Button variant="ghost" aria-label={`delete ${c.name}`} onClick={() => deleteCategory(c)}>
                    <Icon name="trash" size={14} />
                  </Button>
                </div>
              ))}
            </CatList>
            <form onSubmit={addCategory} style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <Field style={{ flex: 1 }}>
                <input placeholder="new category" required maxLength={40} value={newCat} onChange={(e) => setNewCat(e.target.value)} />
              </Field>
              <Button variant="primary">add</Button>
            </form>
            {catError && <ErrorText>{catError}</ErrorText>}
            <div className="actions">
              <Button type="button" onClick={() => setManaging(false)}>
                done
              </Button>
            </div>
          </Dialog>
        </Backdrop>
      )}
      </Mini>
    </Page>
  )
}
