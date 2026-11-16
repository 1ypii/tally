import styled from '@emotion/styled'
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  api,
  currencies,
  currencyOptions,
  day,
  errorText,
  fromMinor,
  isoDay,
  methodLabel,
  methodOptions,
  money,
  paymentMethods,
  priceStep,
  toMinor,
  useLoad,
  type Currency,
  type Income,
} from '../api'
import { Backdrop, Dialog, useFeedback } from '../feedback'
import { Icon } from '../icons'
import { Select } from '../select'
import { Button, Card, Empty, ErrorText, Field, Head, Page, Sub, Table } from '../ui'

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 14px;

  .full {
    grid-column: 1 / -1;
  }
`

const Drop = styled.label`
  display: grid;
  place-items: center;
  gap: 6px;
  padding: 28px;
  margin-top: 14px;
  border: 1px dashed var(--line);
  border-radius: 12px;
  color: var(--muted);
  text-align: center;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;

  &:hover {
    border-color: var(--accent);
    color: var(--text);
  }
  input {
    display: none;
  }
`

const Preview = styled.div`
  max-height: 260px;
  overflow: auto;
  margin-top: 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
`

const Summary = styled.div`
  display: flex;
  gap: 28px;
  flex-wrap: wrap;
  margin-bottom: 20px;

  span {
    color: var(--muted);
    font-size: 13px;
  }
  b {
    display: block;
    font-size: 22px;
    font-weight: 650;
    font-variant-numeric: tabular-nums;
  }
`

type Form = { source: string; reference: string; amount: string; currency: Currency; receivedOn: string; method: string; note: string }
type Row = { source: string; reference: string | null; amount: number; currency: Currency; receivedOn: string; method: string; note: string | null }

const codes = new Set(currencies.map((c) => c.code))
const methods = new Set(paymentMethods.map((m) => m.code))

function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',' || ch === ';' || ch === '\t') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      if (row.some((c) => c.trim() !== '')) rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  row.push(cell)
  if (row.some((c) => c.trim() !== '')) rows.push(row)
  return rows
}

const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function parseDate(raw: string) {
  const s = raw.trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return fmt(+m[1], +m[2], +m[3])
  m = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/)
  if (m) return s.includes('.') ? fmt(+m[3], +m[2], +m[1]) : fmt(+m[3], +m[1], +m[2])
  m = s.match(/^(\d{1,2})[\s-]+([a-z]{3})[a-z]*\.?[\s,-]+(\d{4})/i)
  if (m && months.includes(m[2].toLowerCase())) return fmt(+m[3], months.indexOf(m[2].toLowerCase()) + 1, +m[1])
  m = s.match(/^([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/i)
  if (m && months.includes(m[1].toLowerCase())) return fmt(+m[3], months.indexOf(m[1].toLowerCase()) + 1, +m[2])
  return null
}

function parseAmount(raw: string) {
  let s = raw.replace(/[^0-9.,-]/g, '')
  if (/,\d{2}$/.test(s) && !/\.\d{2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.')
  else s = s.replace(/,/g, '')
  const value = Number(s)
  return raw.includes('(') && raw.includes(')') ? -Math.abs(value) : value
}

function fmt(y: number, mo: number, d: number) {
  const date = new Date(y, mo - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null
  return isoDay(date)
}

const pickColumn = (headers: string[], names: string[]) => headers.findIndex((h) => names.includes(h.trim().toLowerCase().replace(/[^a-z]/g, '')))

const dateNames = ['date', 'receivedon', 'received', 'paidon', 'paid', 'paymentdate', 'transactiondate', 'valuedate', 'bookingdate']
const creditNames = ['credit', 'credits', 'paidin', 'moneyin', 'deposit', 'deposits', 'incoming']
const amountNames = ['amount', 'total', 'gross', 'net', 'value']

type Source = { table: string[][]; pdf: boolean; file: string }

export default function IncomePage() {
  const { data, error, reload } = useLoad<Income[]>('/income')
  const { toast, confirm } = useFeedback()
  const [form, setForm] = useState<Form | null>(null)
  const [editing, setEditing] = useState<number | null>(null)
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importCur, setImportCur] = useState<Currency>('usd')
  const [parsed, setParsed] = useState<{ rows: Row[]; skipped: string[]; moneyOut: number; file: string } | null>(null)
  const [importError, setImportError] = useState('')
  const [reading, setReading] = useState(false)
  const source = useRef<Source | null>(null)

  const year = new Date().getFullYear()
  const thisYear = (data ?? []).filter((i) => +i.receivedOn.slice(0, 4) === year)
  const totals = Object.entries(
    thisYear.reduce<Record<string, number>>((acc, i) => {
      acc[i.currency] = (acc[i.currency] ?? 0) + i.amount
      return acc
    }, {}),
  ).sort((a, b) => b[1] - a[1])

  const open = (i?: Income) => {
    setEditing(i?.id ?? null)
    setFormError('')
    setForm(
      i
        ? { source: i.source, reference: i.reference ?? '', amount: fromMinor(i.amount, i.currency), currency: i.currency, receivedOn: i.receivedOn, method: i.method, note: i.note ?? '' }
        : { source: '', reference: '', amount: '', currency: totals[0]?.[0] ?? 'usd', receivedOn: isoDay(new Date()), method: 'bank', note: '' },
    )
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!form) return
    setBusy(true)
    setFormError('')
    const body = {
      source: form.source,
      reference: form.reference || null,
      amount: toMinor(form.amount, form.currency),
      currency: form.currency,
      receivedOn: form.receivedOn,
      method: form.method,
      note: form.note || null,
    }
    try {
      if (editing) await api.put(`/income/${editing}`, body)
      else await api.post('/income', body)
      toast(editing ? 'income saved' : 'income added')
      setForm(null)
      reload()
    } catch (err) {
      setFormError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (i: Income) => {
    const ok = await confirm({ title: `delete income from ${i.source}?`, confirm: 'delete', danger: true })
    if (!ok) return
    try {
      await api.delete(`/income/${i.id}`)
      toast('income deleted')
      reload()
    } catch (err) {
      await confirm({ title: 'could not delete', body: errorText(err), confirm: 'ok' })
    }
  }

  const build = ({ table, pdf, file }: Source, fallback: Currency) => {
    if (table.length < 2) {
      setImportError('that file has no rows, it needs a header row and at least one line')
      setParsed(null)
      return
    }
    const headers = table[0]
    const col = {
      date: pickColumn(headers, dateNames),
      amount: pickColumn(headers, creditNames) >= 0 ? pickColumn(headers, creditNames) : pickColumn(headers, amountNames),
      currency: pickColumn(headers, ['currency', 'cur']),
      source: pickColumn(headers, ['source', 'client', 'from', 'customer', 'payer', 'name', 'company', 'payee', 'counterparty']),
      reference: pickColumn(headers, ['reference', 'ref', 'invoice', 'invoicenumber', 'number', 'id']),
      method: pickColumn(headers, ['method', 'paymentmethod', 'via']),
      note: pickColumn(headers, ['note', 'notes', 'description', 'memo']),
    }
    if (col.source < 0) {
      col.source = pickColumn(headers, ['description', 'details', 'narrative', 'particulars'])
      if (col.source === col.note) col.note = -1
    }
    if (col.date < 0 || col.amount < 0) {
      setImportError('could not find a date and an amount column, check the header row')
      setParsed(null)
      return
    }

    const rows: Row[] = []
    const skipped: string[] = []
    let moneyOut = 0
    const body = pdf ? table.slice(1).filter((r) => parseDate(r[col.date] ?? '')) : table.slice(1)
    body.slice(0, 500).forEach((r, i) => {
      const line = pdf ? `row ${i + 1}` : `line ${i + 2}`
      const date = parseDate(r[col.date] ?? '')
      const cur = (col.currency >= 0 ? (r[col.currency] ?? '').trim().toLowerCase() : '') || fallback
      const raw = (r[col.amount] ?? '').trim()
      const value = parseAmount(raw)
      if (!date) return skipped.push(`${line}: date not readable`)
      if (!codes.has(cur)) return skipped.push(`${line}: unknown currency ${cur}`)
      if (pdf && (!raw || value <= 0)) return moneyOut++
      if (!Number.isFinite(value) || value <= 0) return skipped.push(`${line}: amount not readable`)
      const method = col.method >= 0 ? (r[col.method] ?? '').trim().toLowerCase().replace(/\s/g, '') : ''
      rows.push({
        source: ((col.source >= 0 ? r[col.source] : '') || 'imported').trim().slice(0, 120),
        reference: col.reference >= 0 ? (r[col.reference] ?? '').trim().slice(0, 60) || null : null,
        amount: toMinor(String(value), cur),
        currency: cur,
        receivedOn: date,
        method: methods.has(method) ? method : 'other',
        note: col.note >= 0 ? (r[col.note] ?? '').trim().slice(0, 500) || null : null,
      })
    })
    if (body.length > 500) skipped.push('only the first 500 lines are imported at once')
    setImportError(rows.length ? '' : 'none of the lines could be read')
    setParsed({ rows, skipped, moneyOut, file })
  }

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const pdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (file.size > (pdf ? 10_000_000 : 2_000_000)) {
      setImportError(pdf ? 'that pdf is too big, keep it under 10 mb' : 'that file is too big, keep it under 2 mb')
      return
    }
    setParsed(null)
    setImportError('')
    if (!pdf) {
      source.current = { table: parseCsv(await file.text()), pdf: false, file: file.name }
      build(source.current, importCur)
      return
    }

    setReading(true)
    try {
      const { pdfLines, pdfTable } = await import('../pdf')
      const lines = await pdfLines(await file.arrayBuffer())
      if (!lines.length) {
        setImportError('that pdf has no text in it, scanned pdfs cant be read')
        return
      }
      const table = pdfTable(lines, (texts) => pickColumn(texts, dateNames) >= 0 && (pickColumn(texts, creditNames) >= 0 || pickColumn(texts, amountNames) >= 0))
      if (!table) {
        setImportError('could not find a table with a date and an amount column in that pdf')
        return
      }
      source.current = { table, pdf: true, file: file.name }
      build(source.current, importCur)
    } catch (err) {
      setImportError(err instanceof Error && err.name === 'PasswordException' ? 'that pdf is password protected, export it without a password' : 'that pdf could not be read')
    } finally {
      setReading(false)
    }
  }

  const runImport = async () => {
    if (!parsed?.rows.length) return
    setBusy(true)
    setImportError('')
    try {
      const r = await api.post<{ imported: number }>('/income/import', { rows: parsed.rows })
      toast(`${r.data.imported} entries imported`)
      setImporting(false)
      setParsed(null)
      reload()
    } catch (err) {
      setImportError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page>
      <Head>
        <div style={{ marginRight: 'auto' }}>
          <h1>income</h1>
          <Sub>money that came in outside tally invoices, from other platforms, old invoices or one off jobs</Sub>
        </div>
        <Button
          onClick={() => {
            setImporting(true)
            setParsed(null)
            setImportError('')
          }}
        >
          <Icon name="upload" size={15} />
          import
        </Button>
        <Button variant="primary" onClick={() => open()}>
          <Icon name="plus" />
          add income
        </Button>
      </Head>

      {totals.length > 0 && (
        <Summary>
          {totals.map(([cur, total]) => (
            <div key={cur}>
              <span>received in {year}</span>
              <b>{money(total, cur)}</b>
            </div>
          ))}
          <div>
            <span>entries</span>
            <b>{data?.length ?? 0}</b>
          </div>
        </Summary>
      )}

      {error && <ErrorText>{error}</ErrorText>}
      <Card>
        {data && data.length === 0 && (
          <Empty>
            <b>no external income yet</b>
            add a payment you got outside tally, or import a csv or pdf from your bank, paypal, upwork or a spreadsheet
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <Button onClick={() => setImporting(true)}>import</Button>
              <Button variant="primary" onClick={() => open()}>
                add income
              </Button>
            </div>
          </Empty>
        )}
        {data && data.length > 0 && (
          <Table>
            <thead>
              <tr>
                <th>date</th>
                <th>from</th>
                <th className="wide">reference</th>
                <th className="wide">method</th>
                <th className="wide">note</th>
                <th className="num">amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((i) => (
                <tr key={i.id}>
                  <td>{day(i.receivedOn)}</td>
                  <td className="strong">{i.source}</td>
                  <td className="wide" style={{ color: 'var(--muted)' }}>{i.reference}</td>
                  <td className="wide">{methodLabel(i.method)}</td>
                  <td className="wide" style={{ color: 'var(--muted)' }}>{i.note}</td>
                  <td className="num strong">{money(i.amount, i.currency)}</td>
                  <td className="num">
                    <Button variant="ghost" aria-label="edit income" onClick={() => open(i)}>
                      <Icon name="edit" size={14} />
                    </Button>
                    <Button variant="ghost" aria-label="delete income" onClick={() => remove(i)}>
                      <Icon name="trash" size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {form && (
        <Backdrop onClick={() => setForm(null)}>
          <Dialog as="form" onSubmit={save} onClick={(e) => e.stopPropagation()} style={{ width: 'min(520px, 100%)' }}>
            <h3>{editing ? 'edit income' : 'add income'}</h3>
            <FormGrid>
              <Field className="full">
                from
                <input autoFocus required maxLength={120} placeholder="client, platform or person" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
              </Field>
              <Field>
                amount
                <input type="number" required min={priceStep(form.currency)} step={priceStep(form.currency)} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </Field>
              <Field as="div">
                currency
                <Select label="currency" value={form.currency} options={currencyOptions()} onChange={(v) => setForm({ ...form, currency: v })} />
              </Field>
              <Field>
                received on
                <input type="date" required value={form.receivedOn} onChange={(e) => setForm({ ...form, receivedOn: e.target.value })} />
              </Field>
              <Field as="div">
                method
                <Select label="method" value={form.method} options={methodOptions()} onChange={(v) => setForm({ ...form, method: v })} />
              </Field>
              <Field className="full">
                reference
                <input maxLength={60} placeholder="their invoice number or order id" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
              </Field>
              <Field className="full">
                note
                <input maxLength={500} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </Field>
            </FormGrid>
            {formError && <ErrorText>{formError}</ErrorText>}
            <div className="actions">
              <Button type="button" onClick={() => setForm(null)}>
                cancel
              </Button>
              <Button variant="primary" disabled={busy}>
                {editing ? 'save' : 'add income'}
              </Button>
            </div>
          </Dialog>
        </Backdrop>
      )}

      {importing && (
        <Backdrop onClick={() => setImporting(false)}>
          <Dialog onClick={(e) => e.stopPropagation()} style={{ width: 'min(640px, 100%)' }}>
            <h3>import income</h3>
            <p style={{ color: 'var(--muted)' }}>
              a csv or a pdf statement. it needs a date and an amount column, and can also have currency, client or source, reference, method and note. on statements only money in gets imported, and scanned pdfs cant be read
            </p>
            <Field as="div" style={{ marginTop: 14, maxWidth: 260 }}>
              currency when the file has none
              <Select
                label="currency"
                value={importCur}
                options={currencyOptions()}
                onChange={(v) => {
                  setImportCur(v)
                  if (source.current) build(source.current, v)
                }}
              />
            </Field>
            <Drop>
              <Icon name="upload" size={20} />
              {reading ? 'reading the pdf' : parsed ? parsed.file : 'pick a csv or pdf file'}
              <input type="file" accept=".csv,text/csv,text/plain,.pdf,application/pdf" disabled={reading} onChange={onFile} />
            </Drop>
            {parsed && parsed.rows.length > 0 && (
              <Preview>
                <Table>
                  <thead>
                    <tr>
                      <th>date</th>
                      <th>from</th>
                      <th className="wide">reference</th>
                      <th className="num">amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, 50).map((r, i) => (
                      <tr key={i}>
                        <td>{day(r.receivedOn)}</td>
                        <td>{r.source}</td>
                        <td className="wide">{r.reference}</td>
                        <td className="num">{money(r.amount, r.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Preview>
            )}
            {parsed && (
              <Sub style={{ marginTop: 10 }}>
                {parsed.rows.length} ready to import{parsed.moneyOut > 0 && `, ${parsed.moneyOut} money out left out`}{parsed.skipped.length > 0 && `, ${parsed.skipped.length} skipped`}
              </Sub>
            )}
            {parsed?.skipped.slice(0, 5).map((s) => (
              <Sub key={s} style={{ color: 'var(--amber)' }}>
                {s}
              </Sub>
            ))}
            {importError && <ErrorText>{importError}</ErrorText>}
            <div className="actions">
              <Button type="button" onClick={() => setImporting(false)}>
                cancel
              </Button>
              <Button variant="primary" disabled={busy || !parsed?.rows.length} onClick={runImport}>
                import {parsed?.rows.length ? parsed.rows.length : ''}
              </Button>
            </div>
          </Dialog>
        </Backdrop>
      )}
    </Page>
  )
}
