'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export type AuthUser = {
  id: number
  name: string
  email: string
  role: 'sales' | 'manager'
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')

    if (!storedToken || !storedUser) {
      router.push('/login')
      return
    }

    try {
      setToken(storedToken)
      setUser(JSON.parse(storedUser))
    } catch {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      router.push('/login')
    } finally {
      setIsLoading(false)
    }
  }, [router])

  function logout() {
    fetch('/api/v1/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).finally(() => {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      router.push('/login')
    })
  }

  function authFetch(url: string, options?: RequestInit) {
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options?.headers,
      },
    })
  }

  return { user, token, isLoading, logout, authFetch }
}
