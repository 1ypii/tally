import { keyframes } from '@emotion/react'
import styled from '@emotion/styled'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Icon } from './icons'

export type Option = { value: string; label: string; hint?: string }

const pop = keyframes`
  from { opacity: 0; transform: translateY(-4px) scale(0.98); }
`

const Wrap = styled.div`
  position: relative;
  min-width: 0;

  > button {
    width: 100%;
    height: 38px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 10px 0 11px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: transparent;
    color: var(--text);
    font-size: 14px;
    text-align: left;
    cursor: pointer;
    transition: border-color 0.15s ease;
  }
  > button:hover,
  &.open > button {
    border-color: color-mix(in srgb, var(--accent) 60%, var(--line));
  }
  > button span {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  > button .ph {
    color: var(--muted);
  }
  > button svg {
    flex: none;
    color: var(--muted);
    transition: transform 0.18s ease;
  }
  &.open > button svg {
    transform: rotate(180deg);
  }
`

const Menu = styled.div<{ up: boolean }>`
  position: absolute;
  left: 0;
  right: 0;
  ${(p) => (p.up ? 'bottom: calc(100% + 6px);' : 'top: calc(100% + 6px);')}
  z-index: 40;
  min-width: 180px;
  padding: 6px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22);
  animation: ${pop} 0.14s ease-out;
  transform-origin: ${(p) => (p.up ? 'bottom' : 'top')};

  input {
    width: 100%;
    height: 32px;
    margin-bottom: 6px;
    padding: 0 10px;
    border: 1px solid var(--line);
    border-radius: 7px;
    background: transparent;
    color: var(--text);
    outline: none;
  }
  input:focus {
    border-color: var(--accent);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 240px;
    overflow-y: auto;
  }
  li {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    padding: 7px 10px;
    border-radius: 7px;
    cursor: pointer;
    color: var(--text);
    transition: background 0.1s ease;
  }
  li.active {
    background: var(--hover);
  }
  li.on {
    color: var(--accent);
    font-weight: 600;
  }
  li small {
    color: var(--muted);
    font-weight: 400;
  }
  .none {
    padding: 10px;
    color: var(--muted);
  }
`

type Props = {
  value: string
  options: Option[]
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  searchable?: boolean
}

export function Select({ value, options, onChange, placeholder = 'pick one', label, searchable }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [up, setUp] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const id = useId()

  const search = searchable ?? options.length > 8
  const q = query.trim().toLowerCase()
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)) : options
  const current = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  useEffect(() => {
    if (!open) return
    list.current?.querySelector<HTMLElement>('li.active')?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const show = () => {
    const rect = button.current?.getBoundingClientRect()
    setUp(!!rect && window.innerHeight - rect.bottom < 300 && rect.top > 300)
    setQuery('')
    setActive(Math.max(0, options.findIndex((o) => o.value === value)))
    setOpen(true)
  }

  const pick = (o: Option) => {
    onChange(o.value)
    setOpen(false)
    button.current?.focus()
  }

  const onKey = (e: KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        show()
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
      button.current?.focus()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, shown.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (shown[active]) pick(shown[active])
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <Wrap ref={wrap} className={open ? 'open' : ''} onKeyDown={onKey}>
      <button
        ref={button}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={() => (open ? setOpen(false) : show())}
      >
        <span className={current ? '' : 'ph'}>{current?.label ?? placeholder}</span>
        <Icon name="chevron" size={15} />
      </button>
      {open && (
        <Menu up={up}>
          {search && (
            <input
              autoFocus
              placeholder="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
              }}
            />
          )}
          <ul ref={list} id={id} role="listbox" tabIndex={-1}>
            {shown.map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                className={[i === active ? 'active' : '', o.value === value ? 'on' : ''].join(' ')}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o)}
              >
                {o.label}
                {o.hint && <small>{o.hint}</small>}
              </li>
            ))}
          </ul>
          {shown.length === 0 && <div className="none">nothing matches</div>}
        </Menu>
      )}
    </Wrap>
  )
}

const SwitchWrap = styled.button<{ on: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--text);
  cursor: pointer;
  text-align: left;

  .track {
    position: relative;
    flex: none;
    width: 36px;
    height: 20px;
    border-radius: 999px;
    border: 1px solid ${(p) => (p.on ? 'var(--accent)' : 'var(--line)')};
    background: ${(p) => (p.on ? 'var(--accent)' : 'transparent')};
    transition: background 0.18s ease, border-color 0.18s ease;
  }
  .knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: ${(p) => (p.on ? 'var(--on-accent)' : 'var(--muted)')};
    transform: translateX(${(p) => (p.on ? '16px' : '0')});
    transition: transform 0.2s cubic-bezier(0.3, 0.7, 0.3, 1), background 0.18s ease;
  }
  small {
    display: block;
    color: var(--muted);
  }
`

export function Switch({ on, onChange, children }: { on: boolean; onChange: (on: boolean) => void; children: ReactNode }) {
  return (
    <SwitchWrap type="button" role="switch" aria-checked={on} on={on} onClick={() => onChange(!on)}>
      <span className="track">
        <span className="knob" />
      </span>
      <span>{children}</span>
    </SwitchWrap>
  )
}
