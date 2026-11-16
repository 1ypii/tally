import axios, { isAxiosError } from 'axios'
import { useCallback, useEffect, useSyncExternalStore } from 'react'

export const api = axios.create({
  baseURL: '/api',
  headers: { Accept: 'application/json' },
})

export type User = { email: string | null; demo: boolean }

export type Currency = string

const codes = [
  'usd', 'eur', 'gbp', 'jpy', 'cny', 'inr', 'cad', 'aud', 'nzd', 'chf',
  'sek', 'nok', 'dkk', 'pln', 'czk', 'huf', 'ron', 'bgn', 'try', 'uah',
  'kzt', 'rub', 'byn', 'gel', 'amd', 'azn', 'uzs', 'kgs', 'aed', 'sar',
  'qar', 'kwd', 'bhd', 'omr', 'ils', 'egp', 'zar', 'ngn', 'kes', 'mad',
  'brl', 'mxn', 'ars', 'clp', 'cop', 'pen', 'sgd', 'hkd', 'twd', 'krw',
  'thb', 'vnd', 'idr', 'myr', 'php', 'pkr', 'bdt', 'rbx',
]

const names = new Intl.DisplayNames(['en'], { type: 'currency' })

export const currencies = codes.map((code) => ({
  code,
  label: code === 'rbx' ? 'rbx robux' : `${code} ${names.of(code.toUpperCase())?.toLowerCase() ?? ''}`,
}))

export const shortName = (cur: Currency) => (cur === 'rbx' ? 'robux' : cur)

const decimalCache = new Map<Currency, number>()

export function decimalsOf(cur: Currency) {
  if (cur === 'rbx') return 0
  let d = decimalCache.get(cur)
  if (d === undefined) {
    d = new Intl.NumberFormat('en-US', { style: 'currency', currency: cur.toUpperCase() }).resolvedOptions().maximumFractionDigits ?? 2
    decimalCache.set(cur, d)
  }
  return d
}

export const paymentMethods: { code: string; label: string }[] = [
  { code: 'bank', label: 'bank transfer' },
  { code: 'paypal', label: 'paypal' },
  { code: 'wise', label: 'wise' },
  { code: 'payoneer', label: 'payoneer' },
  { code: 'stripe', label: 'stripe' },
  { code: 'card', label: 'card' },
  { code: 'crypto', label: 'crypto' },
  { code: 'cash', label: 'cash' },
  { code: 'robloxgroup', label: 'roblox group payout' },
  { code: 'devex', label: 'devex' },
  { code: 'other', label: 'other' },
]

export const methodLabel = (code: string) => paymentMethods.find((m) => m.code === code)?.label ?? code

export const currencyOptions = () => currencies.map((c) => ({ value: c.code, label: c.label }))

export const methodOptions = () => paymentMethods.map((m) => ({ value: m.code, label: m.label }))

export type Category = { id: number; name: string }

export type Income = {
  id: number
  source: string
  reference: string | null
  amount: number
  currency: Currency
  receivedOn: string
  method: string
  note: string | null
}

export type Profile = {
  businessName: string | null
  contactEmail: string | null
  location: string | null
  taxId: string | null
  website: string | null
  paymentDetails: string | null
}

export type Settings = Profile & {
  invoicePrefix: string
  quotePrefix: string
  homeCurrency: Currency
  robuxValue: number | null
  payLink: string | null
  hasLogo: boolean
}

export const termOptions = [0, 7, 14, 30, 45, 60, 90].map((d) => ({ value: String(d), label: d === 0 ? 'due on receipt' : `net ${d}`, hint: d === 0 ? '' : `${d} days` }))

export const repeatOptions = [
  { value: '', label: 'does not repeat' },
  { value: 'weekly', label: 'every week' },
  { value: 'monthly', label: 'every month' },
  { value: 'quarterly', label: 'every 3 months' },
  { value: 'yearly', label: 'every year' },
]

export const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b.slice(0, 10) + 'T00:00:00').getTime() - new Date(a.slice(0, 10) + 'T00:00:00').getTime()) / 864e5)

export type Payment = {
  id: number
  amount: number
  paidOn: string
  method: string
  note: string | null
}

export type LedgerPayment = Payment & {
  currency: Currency
  invoice: { id: number; number: string }
  client: { id: number; name: string }
}

export type Expense = {
  id: number
  description: string
  amount: number
  currency: Currency
  spentOn: string
  category: Category | null
  receipt: { mime: string; size: number } | null
}

export type Client = {
  id: number
  name: string
  email: string | null
  website: string | null
  location: string | null
  taxId: string | null
  phone: string | null
  termsDays: number
  rate: number
  currency: Currency
}

export type Status = 'draft' | 'sent' | 'overdue' | 'paid' | 'accepted' | 'declined'

export type Kind = 'invoice' | 'quote'

export type InvoiceRow = {
  id: number
  kind: Kind
  number: string
  status: Status
  client: { id: number; name: string; website: string | null }
  issuedOn: string
  dueOn: string
  currency: Currency
  total: number
  paid: number
  balance: number
  sentAt: string | null
  paidAt: string | null
  repeatEvery: string | null
  viewed: boolean
  notice: boolean
}

export type Line = {
  description: string
  quantity: number
  unitPrice: number
  amount: number
  fixed: boolean
}

export type Invoice = Omit<InvoiceRow, 'client' | 'notice'> & {
  client: {
    id: number
    name: string
    email: string | null
    website: string | null
    location: string | null
    taxId: string | null
    phone: string | null
    termsDays: number
  }
  notes: string | null
  subtotal: number
  discount: number
  discountKind: 'percent' | 'amount' | null
  discountValue: number
  tax: number
  taxRate: number
  taxLabel: string | null
  payLink: string | null
  nextRepeatOn: string | null
  remindedAt: string | null
  views: { first: string | null; last: string | null; count: number }
  notice: { at: string; reference: string | null; note: string | null } | null
  convertedTo: number | null
  lines: Line[]
  payments: Payment[]
  shareToken: string | null
  showSender: boolean
  showLogo: boolean
  logo: boolean
  sender: Profile | null
}

export type CurrencySummary = {
  outstanding: number
  overdue: number
  overdueCount: number
  paid30: number
  paidByMonth: number[]
}

export type Summary = {
  drafts: number
  months: string[]
  currencies: Record<Currency, CurrencySummary>
}

const formatters = new Map<Currency, Intl.NumberFormat>()

export function money(minor: number, cur: Currency) {
  if (cur === 'rbx') return 'R$ ' + minor.toLocaleString('en-US')
  let f = formatters.get(cur)
  if (!f) {
    f = new Intl.NumberFormat('en-US', { style: 'currency', currency: cur.toUpperCase(), currencyDisplay: 'narrowSymbol' })
    formatters.set(cur, f)
  }
  return f.format(minor / 10 ** decimalsOf(cur))
}

export const toMinor = (value: string, cur: Currency) => Math.round(Number(value || 0) * 10 ** decimalsOf(cur))

export const fromMinor = (minor: number, cur: Currency) => String(minor / 10 ** decimalsOf(cur))

export const priceStep = (cur: Currency) => (decimalsOf(cur) === 0 ? '1' : '0.01')

export const lineAmount = (quantity: string, price: string, cur: Currency) => {
  const hundredths = Math.round(Number(quantity || 0) * 100)
  return Math.floor((hundredths * toMinor(price, cur) + 50) / 100)
}

export const day = (iso: string) =>
  new Date(iso.slice(0, 10) + 'T00:00:00')
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    .toLowerCase()

export const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function errorText(err: unknown): string {
  if (isAxiosError(err)) {
    const data = err.response?.data
    if (data?.error) return data.error
    if (data?.violations?.length) {
      const v = data.violations[0]
      const m = String(v.propertyPath).match(/^lines\[(\d+)\]\.(\w+)/)
      const where = m ? `line ${Number(m[1]) + 1} ${m[2]}` : v.propertyPath
      return `${where}: ${v.title}`.toLowerCase()
    }
    if (err.response?.status === 429) return 'too many requests, try again in a bit'
    if (err.response?.status === 404) return 'not found'
  }
  return 'something went wrong, try again'
}

type Entry = { data: unknown; error: string }

const keep = new Set(['/invoices', '/invoices/summary', '/clients', '/payments', '/income', '/expenses', '/categories', '/profile'])

const store = new Map<string, Entry>()
const listeners = new Map<string, Set<() => void>>()
const inflight = new Map<string, Promise<void>>()

function notify(url: string) {
  listeners.get(url)?.forEach((fn) => fn())
}

export function fetchKey(url: string) {
  const running = inflight.get(url)
  if (running) return running
  const job = api
    .get(url)
    .then((r) => {
      store.set(url, { data: r.data, error: '' })
    })
    .catch((e) => {
      const prev = store.get(url)
      store.set(url, { data: prev?.data ?? null, error: errorText(e) })
    })
    .finally(() => {
      inflight.delete(url)
      notify(url)
    })
  inflight.set(url, job)
  return job
}

export function prefetch(urls: string[]) {
  urls.forEach((u) => {
    if (!store.has(u)) fetchKey(u)
  })
}

export function refreshAll() {
  for (const url of [...store.keys()]) {
    const watched = (listeners.get(url)?.size ?? 0) > 0
    if (watched || keep.has(url)) fetchKey(url)
    else store.delete(url)
  }
}

export function clearStore() {
  store.clear()
}

export const preload = () => prefetch([...keep])

export function useLoad<T>(url: string) {
  const subscribe = useCallback(
    (fn: () => void) => {
      let set = listeners.get(url)
      if (!set) {
        set = new Set()
        listeners.set(url, set)
      }
      set.add(fn)
      return () => {
        set.delete(fn)
      }
    },
    [url],
  )
  const entry = useSyncExternalStore(subscribe, () => store.get(url))

  useEffect(() => {
    if (!store.has(url)) fetchKey(url)
  }, [url])

  const setData = useCallback(
    (data: T) => {
      store.set(url, { data, error: '' })
      notify(url)
    },
    [url],
  )

  return {
    data: (entry?.data ?? null) as T | null,
    error: entry?.error ?? '',
    setData,
    reload: () => fetchKey(url),
  }
}

let timer: number | undefined
export function invalidateSoon() {
  window.clearTimeout(timer)
  timer = window.setTimeout(refreshAll, 250)
}
