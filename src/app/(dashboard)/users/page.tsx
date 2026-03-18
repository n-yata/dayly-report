'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

type User = {
  id: number
  name: string
  email: string
  role: 'sales' | 'manager'
  created_at: string
}

type UserForm = {
  name: string
  email: string
  password: string
  role: 'sales' | 'manager'
}

const emptyForm: UserForm = {
  name: '',
  email: '',
  password: '',
  role: 'sales',
}

export default function UsersPage() {
  const { user: currentUser, isLoading, authFetch } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [form, setForm] = useState<UserForm>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isLoading && currentUser) {
      if (currentUser.role !== 'manager') {
        router.push('/daily-reports')
        return
      }
      fetchUsers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, currentUser])

  async function fetchUsers() {
    const res = await authFetch('/api/v1/users')
    if (res.ok) {
      const data = await res.json()
      setUsers(data.data)
    }
  }

  function openCreate() {
    setEditingUser(null)
    setForm(emptyForm)
    setFormError(null)
    setIsDialogOpen(true)
  }

  function openEdit(user: User) {
    setEditingUser(user)
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
    })
    setFormError(null)
    setIsDialogOpen(true)
  }

  async function handleSave() {
    setFormError(null)
    setIsSubmitting(true)

    try {
      let res
      if (editingUser) {
        const body: {
          name?: string
          email?: string
          role?: string
          password?: string
        } = {
          name: form.name,
          email: form.email,
          role: form.role,
        }
        if (form.password) body.password = form.password

        res = await authFetch(`/api/v1/users/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      } else {
        res = await authFetch('/api/v1/users', {
          method: 'POST',
          body: JSON.stringify(form),
        })
      }

      if (!res.ok) {
        const data = await res.json()
        setFormError(data.error?.message ?? '保存に失敗しました')
        return
      }

      setIsDialogOpen(false)
      fetchUsers()
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">読み込み中...</div>
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">ユーザーマスタ</h2>
        <Button onClick={openCreate}>+ 新規登録</Button>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>氏名</TableHead>
              <TableHead>メールアドレス</TableHead>
              <TableHead>ロール</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-gray-500">
                  ユーザーが登録されていません
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === 'manager' ? 'default' : 'secondary'}>
                      {u.role === 'manager' ? 'マネージャー' : '営業'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => openEdit(u)}>
                      編集
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? 'ユーザー編集' : 'ユーザー登録'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>氏名 *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>メールアドレス *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>{editingUser ? 'パスワード（変更する場合のみ入力）' : 'パスワード *'}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>ロール *</Label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as 'sales' | 'manager' })}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="sales">営業</option>
                <option value="manager">マネージャー</option>
              </select>
            </div>
            {formError && <p className="text-sm text-red-500">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSave} disabled={isSubmitting}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
