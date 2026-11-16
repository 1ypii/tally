import { keyframes } from '@emotion/react'
import styled from '@emotion/styled'
import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from './icons'
import { Button } from './ui'

type Ask = { title: string; body?: string; confirm: string; danger?: boolean }

type Feedback = {
  toast: (text: string) => void
  confirm: (ask: Ask) => Promise<boolean>
}

const FeedbackContext = createContext<Feedback | null>(null)

const slide = keyframes`
  from { opacity: 0; transform: translateY(10px) scale(0.98); }
`

const fadeIn = keyframes`
  from { opacity: 0; }
`

const Toasts = styled.div`
  position: fixed;
  right: 20px;
  bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 30;

  div {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 10px;
    background: var(--text);
    color: var(--bg);
    font-weight: 500;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
    animation: ${slide} 0.22s ease-out;
  }
`

export const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.45);
  animation: ${fadeIn} 0.15s ease-out;
`

export const Dialog = styled.div`
  width: min(440px, 100%);
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 22px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
  animation: ${slide} 0.2s ease-out;

  h3 {
    font-size: 17px;
    font-weight: 650;
    margin-bottom: 6px;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 20px;
  }
`

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([])
  const [ask, setAsk] = useState<Ask | null>(null)
  const resolver = useRef<((ok: boolean) => void) | null>(null)
  const nextId = useRef(0)
  const timers = useRef<number[]>([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const toast = useCallback((text: string) => {
    const id = ++nextId.current
    setToasts((t) => [...t, { id, text }])
    timers.current.push(window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600))
  }, [])

  const confirm = useCallback((next: Ask) => {
    setAsk(next)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const close = (ok: boolean) => {
    resolver.current?.(ok)
    resolver.current = null
    setAsk(null)
  }

  return (
    <FeedbackContext value={{ toast, confirm }}>
      {children}
      <Toasts className="no-print">
        {toasts.map((t) => (
          <div key={t.id}>
            <Icon name="check" />
            {t.text}
          </div>
        ))}
      </Toasts>
      {ask && (
        <Backdrop onClick={() => close(false)} onKeyDown={(e) => e.key === 'Escape' && close(false)}>
          <Dialog role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>{ask.title}</h3>
            {ask.body && <p style={{ color: 'var(--muted)' }}>{ask.body}</p>}
            <div className="actions">
              <Button autoFocus onClick={() => close(false)}>
                cancel
              </Button>
              <Button variant={ask.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
                {ask.confirm}
              </Button>
            </div>
          </Dialog>
        </Backdrop>
      )}
    </FeedbackContext>
  )
}

export function useFeedback() {
  const ctx = use(FeedbackContext)
  if (!ctx) throw new Error('useFeedback needs FeedbackProvider')
  return ctx
}
