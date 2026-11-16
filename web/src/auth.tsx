import { isAxiosError } from 'axios'
import { createContext, use, useEffect, useState, type ReactNode } from 'react'
import { api, clearStore, invalidateSoon, preload, refreshAll, type User } from './api'

type Auth = {
  user: User | null
  ready: boolean
  setUser: (user: User | null) => void
}

const AuthContext = createContext<Auth | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    api
      .get<User | null>('/me')
      .then((r) => setUser(r.data))
      .catch(() => setUser(null))
      .finally(() => setReady(true))

    const id = api.interceptors.response.use(
      (res) => {
        const method = res.config.method ?? 'get'
        const url = res.config.url ?? ''
        if (method !== 'get' && !url.startsWith('/shared/') && url !== '/logout') invalidateSoon()
        return res
      },
      (err) => {
        if (isAxiosError(err) && err.response?.status === 401 && err.config?.url !== '/login') {
          setUser(null)
        }
        return Promise.reject(err)
      },
    )
    return () => api.interceptors.response.eject(id)
  }, [])

  useEffect(() => {
    if (user) preload()
    else clearStore()
  }, [user])

  useEffect(() => {
    if (!user) return
    let last: number | null = null

    const check = async () => {
      if (document.hidden) return
      try {
        const r = await api.get<{ version: number }>('/changes')
        if (last !== null && r.data.version !== last) refreshAll()
        last = r.data.version
      } catch {
        return
      }
    }

    check()
    const timer = window.setInterval(check, 15000)
    const onShow = () => {
      if (!document.hidden) check()
    }
    document.addEventListener('visibilitychange', onShow)
    window.addEventListener('focus', onShow)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onShow)
      window.removeEventListener('focus', onShow)
    }
  }, [user])

  return <AuthContext value={{ user, ready, setUser }}>{children}</AuthContext>
}

export function useAuth() {
  const ctx = use(AuthContext)
  if (!ctx) throw new Error('useAuth needs AuthProvider')
  return ctx
}
