'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

export function Navigation() {
  const pathname = usePathname()
  const { user } = useAuth()

  const navItems = [
    { href: '/daily-reports', label: '日報一覧', roles: ['sales', 'manager'] },
    { href: '/approvals', label: '承認一覧', roles: ['manager'] },
    { href: '/customers', label: '顧客マスタ', roles: ['manager'] },
    { href: '/users', label: 'ユーザーマスタ', roles: ['manager'] },
  ]

  if (!user) return null

  return (
    <nav className="border-b bg-gray-50 px-6">
      <div className="flex gap-6">
        {navItems
          .filter((item) => item.roles.includes(user.role))
          .map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'border-b-2 py-3 text-sm font-medium transition-colors',
                pathname.startsWith(item.href)
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              )}
            >
              {item.label}
            </Link>
          ))}
      </div>
    </nav>
  )
}
