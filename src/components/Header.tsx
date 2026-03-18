'use client'

import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export function Header() {
  const { user, logout } = useAuth()

  return (
    <header className="flex items-center justify-between border-b bg-white px-6 py-3 shadow-sm">
      <h1 className="text-lg font-semibold text-gray-800">営業日報システム</h1>
      {user && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">{user.name}</span>
          <Badge variant={user.role === 'manager' ? 'default' : 'secondary'}>
            {user.role === 'manager' ? 'マネージャー' : '営業'}
          </Badge>
          <Button variant="outline" size="sm" onClick={logout}>
            ログアウト
          </Button>
        </div>
      )}
    </header>
  )
}
