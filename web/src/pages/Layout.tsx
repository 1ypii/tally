import styled from '@emotion/styled'
import { Suspense, useState } from 'react'
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router'
import { api } from '../api'
import { useAuth } from '../auth'
import { Icon } from '../icons'
import { applyTheme, currentTheme, type Theme } from '../ui'

const Shell = styled.div`
  display: grid;
  grid-template-columns: 232px 1fr;
  min-height: 100vh;

  @media (max-width: 860px) {
    grid-template-columns: 1fr;
  }
  @media print {
    display: block;
  }
`

const Side = styled.aside`
  border-right: 1px solid var(--line);

  .inner {
    position: sticky;
    top: 0;
    height: 100vh;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 20px 14px;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 10px 20px;
    font-weight: 700;
    font-size: 17px;
    letter-spacing: -0.01em;
  }
  .link {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 8px;
    color: var(--muted);
    font-weight: 500;
    transition: color 0.15s ease, background 0.15s ease;
  }
  .link:hover {
    color: var(--text);
    background: var(--raised);
  }
  .link.active {
    color: var(--text);
    background: var(--field);
  }
  .new {
    margin: 14px 0 0;
    justify-content: center;
    background: var(--accent);
    color: var(--on-accent);
  }
  .new:hover,
  .new.active {
    background: var(--accent);
    color: var(--on-accent);
    opacity: 0.9;
  }
  .foot {
    margin-top: auto;
    padding: 12px 10px 0;
    border-top: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .theme {
    display: flex;
    gap: 2px;
    padding: 3px;
    border: 1px solid var(--line);
    border-radius: 9px;
  }
  .theme button {
    flex: 1;
    height: 26px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--muted);
    font-size: 12px;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }
  .theme button.on {
    background: var(--hover);
    color: var(--text);
  }
  .who {
    font-size: 13px;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .demo {
    font-size: 12px;
    color: var(--amber);
  }
  .out {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    border: 0;
    background: none;
    cursor: pointer;
    color: var(--muted);
    transition: color 0.15s ease;
  }
  .out:hover {
    color: var(--text);
  }

  @media (max-width: 860px) {
    border-right: 0;
    border-bottom: 1px solid var(--line);

    .inner {
      position: static;
      height: auto;
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
      padding: 10px 12px;
    }

    .brand {
      padding: 0 8px 0 4px;
    }
    .who,
    .demo,
    .theme {
      display: none;
    }
    .new {
      margin: 0;
    }
    .foot {
      margin: 0 0 0 auto;
      padding: 0;
      border: 0;
    }
  }
`

export default function Layout() {
  const { user, ready, setUser } = useAuth()
  const navigate = useNavigate()

  const [theme, setTheme] = useState<Theme>(currentTheme)
  const pickTheme = (t: Theme) => {
    applyTheme(t)
    setTheme(t)
  }

  if (!ready) return null
  if (!user) return <Navigate to="/login" replace />

  const signOut = async () => {
    await api.post('/logout').catch(() => {})
    setUser(null)
    navigate('/login')
  }

  return (
    <Shell>
      <Side className="no-print">
        <div className="inner">
        <NavLink to="/" className="brand">
          tally
        </NavLink>
        <NavLink to="/" end className="link">
          <Icon name="home" />
          overview
        </NavLink>
        <NavLink to="/invoices" className="link">
          <Icon name="file" />
          invoices
        </NavLink>
        <NavLink to="/clients" className="link">
          <Icon name="users" />
          clients
        </NavLink>
        <NavLink to="/income" className="link">
          <Icon name="income" />
          income
        </NavLink>
        <NavLink to="/books" className="link">
          <Icon name="book" />
          books
        </NavLink>
        <NavLink to="/settings" className="link">
          <Icon name="gear" />
          settings
        </NavLink>
        <NavLink to="/invoices/new" className="link new">
          <Icon name="plus" />
          new invoice
        </NavLink>
        <div className="foot">
          <div className="theme" role="group" aria-label="theme">
            {(['system', 'light', 'dark'] as Theme[]).map((t) => (
              <button key={t} className={theme === t ? 'on' : ''} onClick={() => pickTheme(t)}>
                {t}
              </button>
            ))}
          </div>
          <span className="who">{user.demo ? 'demo account' : user.email}</span>
          {user.demo && <span className="demo">wiped after a day</span>}
          <button className="out" onClick={signOut}>
            <Icon name="out" />
            sign out
          </button>
        </div>
        </div>
      </Side>
      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
    </Shell>
  )
}
