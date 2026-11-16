import styled from '@emotion/styled'
import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { api, errorText, type User } from '../api'
import { useAuth } from '../auth'
import { Icon } from '../icons'
import { Button, ErrorText, Field, Tag, rise } from '../ui'

const Wrap = styled.div`
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  min-height: 100vh;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`

const Pitch = styled.section`
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 28px;
  padding: 56px clamp(24px, 6vw, 88px);
  background: transparent;
  border-right: 1px solid var(--line);

  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 700;
    font-size: 18px;
  }
  h1 {
    font-size: clamp(28px, 3.4vw, 40px);
    line-height: 1.15;
    letter-spacing: -0.02em;
    font-weight: 700;
    max-width: 520px;
  }
  ul {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 12px;
    color: var(--muted);
  }
  li {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  li svg {
    color: var(--green);
    flex: none;
  }
  .tags {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  @media (max-width: 900px) {
    padding: 32px 20px;
    border-right: 0;
    border-bottom: 1px solid var(--line);
    ul,
    .tags {
      display: none;
    }
  }
`

const Form = styled.form`
  align-self: center;
  justify-self: center;
  width: min(380px, 100%);
  padding: 40px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: ${rise} 0.3s ease-out;

  h2 {
    font-size: 22px;
    font-weight: 650;
  }
  .switch {
    display: grid;
    grid-template-columns: 1fr 1fr;
    padding: 4px;
    border-radius: 10px;
    border: 1px solid var(--line);
  }
  .switch button {
    height: 32px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    cursor: pointer;
    color: var(--muted);
    font-weight: 500;
    transition: background 0.18s ease, color 0.18s ease;
  }
  .switch button.on {
    background: var(--hover);
    color: var(--text);
    box-shadow: var(--shadow);
  }
  .or {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--muted);
    font-size: 12px;
  }
  .or::before,
  .or::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--line);
  }
`

export default function Login() {
  const { user, setUser } = useAuth()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  const run = async (path: string, body?: object) => {
    setBusy(true)
    setError('')
    try {
      const r = await api.post<User>(path, body)
      setUser(r.data)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    run(mode === 'in' ? '/login' : '/register', { email: email.trim().toLowerCase(), password })
  }

  return (
    <Wrap>
      <Pitch>
        <div className="brand">tally</div>
        <h1>send invoices, chase what is overdue, see what got paid</h1>
        <ul>
          <li>
            <Icon name="check" />
            keep every client with their own rate and currency
          </li>
          <li>
            <Icon name="check" />
            build invoices line by line with live totals
          </li>
          <li>
            <Icon name="check" />
            track drafts sent overdue and paid in one place
          </li>
          <li>
            <Icon name="check" />
            record every payment and expense and see your net per month
          </li>
          <li>
            <Icon name="check" />
            print a clean invoice when the client needs one
          </li>
        </ul>
        <div className="tags">
          <Tag>usd</Tag>
          <Tag>eur</Tag>
          <Tag>gbp</Tag>
          <Tag>jpy</Tag>
          <Tag>kzt</Tag>
          <Tag>robux</Tag>
          <Tag>50 more</Tag>
        </div>
      </Pitch>

      <Form onSubmit={submit}>
        <h2>{mode === 'in' ? 'welcome back' : 'create your account'}</h2>
      <div className="switch">
          <button type="button" className={mode === 'in' ? 'on' : ''} onClick={() => setMode('in')}>
            sign in
          </button>
          <button type="button" className={mode === 'up' ? 'on' : ''} onClick={() => setMode('up')}>
            create account
          </button>
        </div>
        <Field>
          email
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field>
          password
          <input
            type="password"
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            required
            minLength={mode === 'up' ? 10 : undefined}
            placeholder={mode === 'up' ? 'at least 10 characters' : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error && <ErrorText>{error}</ErrorText>}
        <Button variant="primary" disabled={busy}>
          {mode === 'in' ? 'sign in' : 'create account'}
        </Button>

        <div className="or">or</div>
        <Button type="button" disabled={busy} onClick={() => run('/demo')}>
          try it with a demo account
        </Button>
      </Form>
    </Wrap>
  )
}
