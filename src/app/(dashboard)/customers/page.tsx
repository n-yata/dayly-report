'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

type Customer = {
  id: number
  company_name: string
  contact_name: string
  phone: string | null
  email: string | null
  address: string | null
}

type CustomerForm = {
  company_name: string
  contact_name: string
  phone: string
  email: string
  address: string
}

const emptyForm: CustomerForm = {
  company_name: '',
  contact_name: '',
  phone: '',
  email: '',
  address: '',
}

export default function CustomersPage() {
  const { user, isLoading, authFetch } = useAuth()
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [form, setForm] = useState<CustomerForm>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isLoading && user) {
      if (user.role !== 'manager') {
        router.push('/daily-reports')
        return
      }
      fetchCustomers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user])

  async function fetchCustomers() {
    const params = search ? `?q=${encodeURIComponent(search)}` : ''
    const res = await authFetch(`/api/v1/customers${params}`)
    if (res.ok) {
      const data = await res.json()
      setCustomers(data.data)
    }
  }

  function openCreate() {
    setEditingCustomer(null)
    setForm(emptyForm)
    setFormError(null)
    setIsDialogOpen(true)
  }

  function openEdit(customer: Customer) {
    setEditingCustomer(customer)
    setForm({
      company_name: customer.company_name,
      contact_name: customer.contact_name,
      phone: customer.phone ?? '',
      email: customer.email ?? '',
      address: customer.address ?? '',
    })
    setFormError(null)
    setIsDialogOpen(true)
  }

  async function handleSave() {
    setFormError(null)
    setIsSubmitting(true)

    try {
      const body = {
        company_name: form.company_name,
        contact_name: form.contact_name,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
      }

      let res
      if (editingCustomer) {
        res = await authFetch(`/api/v1/customers/${editingCustomer.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      } else {
        res = await authFetch('/api/v1/customers', {
          method: 'POST',
          body: JSON.stringify(body),
        })
      }

      if (!res.ok) {
        const data = await res.json()
        setFormError(data.error?.message ?? '保存に失敗しました')
        return
      }

      setIsDialogOpen(false)
      fetchCustomers()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('この顧客を削除しますか？')) return
    await authFetch(`/api/v1/customers/${id}`, { method: 'DELETE' })
    fetchCustomers()
  }

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">読み込み中...</div>
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">顧客マスタ</h2>
        <Button onClick={openCreate}>+ 新規登録</Button>
      </div>

      <div className="mb-4 flex gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="会社名・担当者名で検索"
          className="max-w-xs"
        />
        <Button variant="outline" onClick={fetchCustomers}>
          検索
        </Button>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>会社名</TableHead>
              <TableHead>担当者名</TableHead>
              <TableHead>電話番号</TableHead>
              <TableHead>メール</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-gray-500">
                  顧客が登録されていません
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>{customer.company_name}</TableCell>
                  <TableCell>{customer.contact_name}</TableCell>
                  <TableCell>{customer.phone ?? '-'}</TableCell>
                  <TableCell>{customer.email ?? '-'}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(customer)}>
                        編集
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(customer.id)}
                      >
                        削除
                      </Button>
                    </div>
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
            <DialogTitle>{editingCustomer ? '顧客編集' : '顧客登録'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>会社名 *</Label>
              <Input
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>担当者名 *</Label>
              <Input
                value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>電話番号</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>メールアドレス</Label>
              <Input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>住所</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="mt-1"
              />
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
