'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  customer_id: string
  visit_time: string
  purpose: string
  case_product: string
  next_action: string
}

export default function NewDailyReportPage() {
  const { user, isLoading, authFetch } = useAuth()
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])
  const [problem, setProblem] = useState('')
  const [plan, setPlan] = useState('')
  const [visitRecords, setVisitRecords] = useState<VisitRecordRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isLoading && user) {
      if (user.role !== 'sales') {
        router.push('/daily-reports')
        return
      }
      fetchCustomers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user])

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
      // バリデーション
      if (status === 'submitted' && visitRecords.length === 0) {
        setError('提出するには訪問記録が1件以上必要です')
        return
      }

      if (status === 'submitted') {
        for (const vr of visitRecords) {
          if (!vr.customer_id || !vr.visit_time || !vr.purpose) {
            setError('訪問記録の必須項目（顧客・時刻・目的）を入力してください')
            return
          }
        }
      }

      const body = {
        report_date: reportDate,
        problem: problem || null,
        plan: plan || null,
        visit_records: visitRecords.map((vr) => ({
          customer_id: parseInt(vr.customer_id),
          visit_time: vr.visit_time,
          purpose: vr.purpose,
          case_product: vr.case_product || null,
          next_action: vr.next_action || null,
        })),
      }

      const res = await authFetch('/api/v1/daily-reports', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error?.message ?? '保存に失敗しました')
        return
      }

      // 提出する場合は別途submitエンドポイントを呼ぶ
      if (status === 'submitted') {
        const submitRes = await authFetch(`/api/v1/daily-reports/${data.data.id}/submit`, {
          method: 'POST',
        })
        if (!submitRes.ok) {
          const submitData = await submitRes.json()
          setError(submitData.error?.message ?? '提出に失敗しました')
          return
        }
      }

      router.push('/daily-reports')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">読み込み中...</div>
  }

  return (
    <div className="max-w-4xl">
      <h2 className="mb-6 text-2xl font-bold">日報作成</h2>

      <div className="mb-6">
        <Label htmlFor="reportDate">報告日</Label>
        <Input
          id="reportDate"
          type="date"
          value={reportDate}
          onChange={(e) => setReportDate(e.target.value)}
          className="mt-1 w-48"
        />
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
          placeholder="今日の課題や相談事項を入力..."
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
          placeholder="明日の予定を入力..."
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
