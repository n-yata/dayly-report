'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

type Customer = {
  id: number
  company_name: string
}

type VisitRecordRow = {
  id?: number
  customer_id: string
  visit_time: string
  purpose: string
  case_product: string
  next_action: string
}

export default function EditDailyReportPage() {
  const { user, isLoading, authFetch } = useAuth()
  const params = useParams()
  const router = useRouter()
  const reportId = params.id as string

  const [customers, setCustomers] = useState<Customer[]>([])
  const [reportDate, setReportDate] = useState('')
  const [problem, setProblem] = useState('')
  const [plan, setPlan] = useState('')
  const [visitRecords, setVisitRecords] = useState<VisitRecordRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isFetching, setIsFetching] = useState(true)

  useEffect(() => {
    if (!isLoading && user) {
      Promise.all([fetchReport(), fetchCustomers()]).finally(() => setIsFetching(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user])

  async function fetchReport() {
    const res = await authFetch(`/api/v1/daily-reports/${reportId}`)
    if (!res.ok) {
      router.push('/daily-reports')
      return
    }
    const data = await res.json()
    const report = data.data
    setReportDate(report.report_date)
    setProblem(report.problem ?? '')
    setPlan(report.plan ?? '')
    setVisitRecords(
      report.visit_records.map(
        (vr: {
          id: number
          customer_id: number
          visit_time: string
          purpose: string
          case_product: string | null
          next_action: string | null
        }) => ({
          id: vr.id,
          customer_id: String(vr.customer_id),
          visit_time: vr.visit_time,
          purpose: vr.purpose,
          case_product: vr.case_product ?? '',
          next_action: vr.next_action ?? '',
        })
      )
    )
  }

  async function fetchCustomers() {
    const res = await authFetch('/api/v1/customers')
    if (res.ok) {
      const data = await res.json()
      setCustomers(data.data)
    }
  }

  function addVisitRecord() {
    setVisitRecords([
      ...visitRecords,
      { customer_id: '', visit_time: '', purpose: '', case_product: '', next_action: '' },
    ])
  }

  function removeVisitRecord(index: number) {
    setVisitRecords(visitRecords.filter((_, i) => i !== index))
  }

  function updateVisitRecord(index: number, field: keyof VisitRecordRow, value: string) {
    const updated = [...visitRecords]
    updated[index] = { ...updated[index], [field]: value }
    setVisitRecords(updated)
  }

  async function handleSave(status: 'draft' | 'submitted') {
    setError(null)
    setIsSubmitting(true)

    try {
      if (status === 'submitted' && visitRecords.length === 0) {
        setError('提出するには訪問記録が1件以上必要です')
        return
      }

      // 日報の problem/plan を更新
      const updateRes = await authFetch(`/api/v1/daily-reports/${reportId}`, {
        method: 'PUT',
        body: JSON.stringify({
          problem: problem || null,
          plan: plan || null,
        }),
      })

      if (!updateRes.ok) {
        const data = await updateRes.json()
        setError(data.error?.message ?? '保存に失敗しました')
        return
      }

      // 訪問記録を同期（新規追加のみ対応 - 既存は削除・再追加）
      // まず既存を全削除
      for (const vr of visitRecords.filter((vr) => vr.id)) {
        await authFetch(`/api/v1/visit-records/${vr.id}`, { method: 'DELETE' })
      }

      // 新規追加
      for (const vr of visitRecords) {
        if (!vr.customer_id || !vr.visit_time || !vr.purpose) continue
        await authFetch(`/api/v1/daily-reports/${reportId}/visit-records`, {
          method: 'POST',
          body: JSON.stringify({
            customer_id: parseInt(vr.customer_id),
            visit_time: vr.visit_time,
            purpose: vr.purpose,
            case_product: vr.case_product || null,
            next_action: vr.next_action || null,
          }),
        })
      }

      if (status === 'submitted') {
        const submitRes = await authFetch(`/api/v1/daily-reports/${reportId}/submit`, {
          method: 'POST',
        })
        if (!submitRes.ok) {
          const data = await submitRes.json()
          setError(data.error?.message ?? '提出に失敗しました')
          return
        }
      }

      router.push('/daily-reports')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading || isFetching) {
    return <div className="p-8 text-center text-gray-500">読み込み中...</div>
  }

  return (
    <div className="max-w-4xl">
      <h2 className="mb-6 text-2xl font-bold">日報編集</h2>

      <div className="mb-6">
        <Label>報告日</Label>
        <div className="mt-1 text-gray-700">
          {reportDate ? new Date(reportDate).toLocaleDateString('ja-JP') : ''}
        </div>
      </div>

      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold">訪問記録</h3>
          <Button type="button" variant="outline" size="sm" onClick={addVisitRecord}>
            + 追加
          </Button>
        </div>
        {visitRecords.length === 0 ? (
          <p className="rounded-md border py-4 text-center text-sm text-gray-400">
            訪問記録がありません
          </p>
        ) : (
          <div className="space-y-3">
            {visitRecords.map((vr, index) => (
              <div key={index} className="rounded-md border bg-white p-4">
                <div className="grid grid-cols-5 gap-3">
                  <div>
                    <Label className="text-xs">顧客</Label>
                    <select
                      value={vr.customer_id}
                      onChange={(e) => updateVisitRecord(index, 'customer_id', e.target.value)}
                      className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
                    >
                      <option value="">選択...</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.company_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">時刻</Label>
                    <Input
                      type="time"
                      value={vr.visit_time}
                      onChange={(e) => updateVisitRecord(index, 'visit_time', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">訪問目的</Label>
                    <Input
                      value={vr.purpose}
                      onChange={(e) => updateVisitRecord(index, 'purpose', e.target.value)}
                      placeholder="目的・内容"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">案件・商品</Label>
                    <Input
                      value={vr.case_product}
                      onChange={(e) => updateVisitRecord(index, 'case_product', e.target.value)}
                      placeholder="任意"
                      className="mt-1"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">次回アクション</Label>
                      <Input
                        value={vr.next_action}
                        onChange={(e) => updateVisitRecord(index, 'next_action', e.target.value)}
                        placeholder="任意"
                        className="mt-1"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeVisitRecord(index)}
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-6">
        <Label htmlFor="problem">Problem（課題・相談）</Label>
        <Textarea
          id="problem"
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          rows={4}
          className="mt-1"
        />
      </div>

      <div className="mb-6">
        <Label htmlFor="plan">Plan（明日やること）</Label>
        <Textarea
          id="plan"
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          rows={4}
          className="mt-1"
        />
      </div>

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => handleSave('draft')}
          disabled={isSubmitting}
        >
          下書き保存
        </Button>
        <Button type="button" onClick={() => handleSave('submitted')} disabled={isSubmitting}>
          提出する
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          キャンセル
        </Button>
      </div>
    </div>
  )
}
