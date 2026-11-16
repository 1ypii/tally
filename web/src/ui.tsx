import { Global, css, keyframes } from '@emotion/react'
import styled from '@emotion/styled'
import { useState } from 'react'
import type { Status } from './api'

export const rise = keyframes`
  from { opacity: 0; transform: translateY(6px); }
`

const darkVars = `
  --bg: #0f1012;
  --panel: #17181b;
  --raised: #1c1d21;
  --field: #202125;
  --hover: #27282d;
  --line: #26272c;
  --text: #ececee;
  --muted: #8b8b94;
  --accent: #7b8ff5;
  --accent-soft: #1f2442;
  --on-accent: #0f1012;
  --red: #ec8478;
  --green: #77c497;
  --amber: #e2b45a;
  --shadow: none;
  --s1: #3987e5;
  --s2: #d95926;
  --s3: #199e70;
  --s4: #c98500;
  --s5: #d55181;
  --s6: #0ca30c;
  --s7: #9085e9;
  --s8: #e66767;
  color-scheme: dark;
`

export type Theme = 'system' | 'light' | 'dark'

export function currentTheme(): Theme {
  try {
    const t = localStorage.getItem('theme')
    return t === 'light' || t === 'dark' ? t : 'system'
  } catch {
    return 'system'
  }
}

export function applyTheme(theme: Theme = currentTheme()) {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', theme)
  try {
    if (theme === 'system') localStorage.removeItem('theme')
    else localStorage.setItem('theme', theme)
  } catch {
    return
  }
}

export const GlobalStyle = () => (
  <Global
    styles={css`
      :root {
        --bg: #f5f5f3;
        --panel: #ffffff;
        --raised: #fafaf9;
        --field: #f0f0ee;
        --hover: #e9e9e6;
        --line: #e4e4e0;
        --text: #18181b;
        --muted: #6e6e76;
        --accent: #4f6bed;
        --accent-soft: #e8ecfd;
        --on-accent: #ffffff;
        --red: #c0392b;
        --green: #2e7d4f;
        --amber: #a16207;
        --shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        --s1: #2a78d6;
        --s2: #eb6834;
        --s3: #1baf7a;
        --s4: #eda100;
        --s5: #e87ba4;
        --s6: #008300;
        --s7: #6250d6;
        --s8: #e34948;
        color-scheme: light;
      }
      @media (prefers-color-scheme: dark) {
        :root:not([data-theme='light']) {
          ${darkVars}
        }
      }
      :root[data-theme='dark'] {
        ${darkVars}
      }
      html {
        transition: background 0.2s ease;
      }
      * {
        box-sizing: border-box;
        margin: 0;
      }
      body {
        background: var(--bg);
        color: var(--text);
        font: 14px/1.5 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      a {
        color: inherit;
        text-decoration: none;
      }
      button,
      input,
      select,
      textarea {
        font: inherit;
        color: inherit;
      }
      ::selection {
        background: var(--accent-soft);
      }
      @media print {
        body {
          background: #fff;
        }
        .no-print {
          display: none !important;
        }
      }
    `}
  />
)

export const Page = styled.main`
  padding: 32px 40px 64px;
  min-width: 0;
  animation: ${rise} 0.25s ease-out;

  @media (max-width: 760px) {
    padding: 20px 16px 48px;
  }
`

export const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 24px;

  h1 {
    font-size: 24px;
    font-weight: 650;
    letter-spacing: -0.01em;
    margin-right: auto;
  }
  h2 {
    font-size: 15px;
    font-weight: 600;
    margin-right: auto;
  }
`

export const Sub = styled.p`
  color: var(--muted);
  margin-top: 2px;
`

export const Card = styled.section`
  background: transparent;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 20px;
  min-width: 0;
`

export const Button = styled.button<{ variant?: 'primary' | 'ghost' | 'danger' }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 36px;
  padding: 0 14px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  white-space: nowrap;
  border: 1px solid ${(p) => (p.variant === 'primary' ? 'var(--accent)' : 'var(--line)')};
  background: ${(p) => (p.variant === 'primary' ? 'var(--accent)' : 'transparent')};
  color: ${(p) => (p.variant === 'primary' ? 'var(--on-accent)' : p.variant === 'danger' ? 'var(--red)' : 'var(--text)')};
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease, opacity 0.15s ease;

  &:hover {
    background: ${(p) => (p.variant === 'primary' ? 'var(--accent)' : 'var(--hover)')};
    opacity: ${(p) => (p.variant === 'primary' ? 0.9 : 1)};
  }
  &:active {
    transform: scale(0.98);
  }
  &:disabled {
    opacity: 0.5;
    cursor: default;
    transform: none;
  }
`

export const LinkButton = Button.withComponent('a')

export const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--muted);
  min-width: 0;

  input,
  select,
  textarea {
    width: 100%;
    min-width: 0;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: transparent;
    padding: 8px 11px;
    font-size: 14px;
    font-weight: 400;
    color: var(--text);
    transition: border-color 0.15s ease, background 0.15s ease;
  }
  input,
  select {
    height: 38px;
  }
  textarea {
    resize: vertical;
  }
  input:focus,
  select:focus,
  textarea:focus {
    outline: none;
    border-color: var(--accent);
  }
`

export const Grid = styled.div<{ min?: number }>`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(${(p) => p.min ?? 180}px, 1fr));
  gap: 14px;
`

export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;

  th {
    text-align: left;
    font-weight: 500;
    font-size: 12px;
    color: var(--muted);
    padding: 0 14px 10px;
    border-bottom: 1px solid var(--line);
  }
  td {
    padding: 13px 14px;
    border-bottom: 1px solid var(--line);
  }
  tbody tr:last-of-type td {
    border-bottom: 0;
  }
  td:first-of-type {
    white-space: nowrap;
  }
  tbody tr {
    transition: background 0.12s ease;
  }
  tbody tr.link {
    cursor: pointer;
  }
  tbody tr.link:hover {
    background: var(--raised);
  }
  .num {
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .strong {
    font-weight: 600;
  }

  @media (max-width: 760px) {
    .wide {
      display: none;
    }
    td,
    th {
      padding-left: 8px;
      padding-right: 8px;
    }
  }
`

export const Muted = styled.p`
  color: var(--muted);
`

export const ErrorText = styled.p`
  color: var(--red);
  margin: 10px 0;
`

const statusColor: Record<Status, string> = {
  draft: 'var(--muted)',
  sent: 'var(--amber)',
  overdue: 'var(--red)',
  paid: 'var(--green)',
  accepted: 'var(--green)',
  declined: 'var(--red)',
}

export const Pill = styled.span<{ status: Status }>`
  font-size: 13px;
  font-weight: 600;
  color: ${(p) => statusColor[p.status]};
`

export const Tag = styled.span`
  display: inline-block;
  padding: 1px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 550;
  color: var(--muted);
  border: 1px solid var(--line);
`

export const Empty = styled.div`
  text-align: center;
  padding: 48px 20px;
  color: var(--muted);

  b {
    display: block;
    color: var(--text);
    font-size: 16px;
    margin-bottom: 4px;
  }
  button {
    margin-top: 16px;
  }
`

export const Avatar = styled.span`
  display: inline-grid;
  place-items: center;
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  font-weight: 650;
  font-size: 13px;
  background: var(--accent-soft);
  color: var(--accent);
`

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

const LogoImg = styled.img`
  flex: none;
  object-fit: contain;
  background: #ffffff;
  border: 1px solid var(--line);
`

export function ClientLogo({ website, size = 36 }: { name?: string; website: string | null; size?: number }) {
  const [failed, setFailed] = useState(false)

  if (!website || failed) return null

  return (
    <LogoImg
      src={`https://icons.duckduckgo.com/ip3/${encodeURIComponent(website)}.ico`}
      alt=""
      width={size}
      height={size}
      style={{ padding: Math.round(size * 0.14), borderRadius: Math.round(size * 0.28) }}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      onLoad={(e) => e.currentTarget.naturalWidth < 2 && setFailed(true)}
    />
  )
}

export const ClientCell = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 10px;
`
