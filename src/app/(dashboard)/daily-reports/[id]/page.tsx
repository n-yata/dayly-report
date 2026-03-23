'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type VisitRecord = {
  id: number
  customer_id: number
  customer_name: string
  visit_time: string
  purpose: string
  case_product: string | null
  next_action: string | null
}

type Comment = {
  id: number
  targetType: 'problem' | 'plan'
  content: string
  user: { id: number; name: string }
  createdAt: string
}

type DailyReport = {
  id: number
  report_date: string
  problem: string | null
  plan: string | null
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  approved_by: { id: number; name: string } | null
  approved_at: string | null
  user: { id: number; name: string }
  visit_records: VisitRecord[]
}

const statusLabels: Record<string, string> = {
  draft: '下書き',
  submitted: '提出済',
  approved: '承認済',
  rejected: '差し戻し',
}

const statusVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  submitted: 'default',
  approved: 'secondary',
  rejected: 'destructive',
}

export default function DailyReportDetailPage() {
  const { user, isLoading, authFetch } = useAuth()
  const params = useParams()
  const router = useRouter()
  const reportId = params.id as string

  const [report, setReport] = useState<DailyReport | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [problemComment, setProblemComment] = useState('')
  const [planComment, setPlanComment] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function fetchReport() {
    const res = await authFetch(`/api/v1/daily-reports/${reportId}`)
    if (!res.ok) {
      router.push('/daily-reports')
      return
    }
    const data = await res.json()
    setReport(data.data)
  }

  async function fetchComments() {
    const res = await authFetch(`/api/v1/daily-reports/${reportId}/comments`)
    if (res.ok) {
      const data = await res.json()
      setComments(data.data)
    }
  }

  useEffect(() => {
    if (!isLoading && user) {
      fetchReport()
      fetchComments()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user, reportId])

  async function handleApprove() {
    const res = await authFetch(`/api/v1/daily-reports/${reportId}/approve`, { method: 'POST' })
    if (res.ok) fetchReport()
    else {
      const data = await res.json()
      setError(data.error?.message)
    }
  }

  async function handleReject() {
    const res = await authFetch(`/api/v1/daily-reports/${reportId}/reject`, { method: 'POST' })
    if (res.ok) fetchReport()
    else {
      const data = await res.json()
      setError(data.error?.message)
    }
  }

  async function postComment(targetType: 'problem' | 'plan', content: string) {
    if (!content.trim()) return
    const res = await authFetch(`/api/v1/daily-reports/${reportId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ target_type: targetType, content }),
    })
    if (res.ok) {
      if (targetType === 'problem') setProblemComment('')
      else setPlanComment('')
      fetchComments()
    }
  }

  if (isLoading || !report) {
    return <div className="p-8 text-center text-gray-500">読み込み中...</div>
  }

  const canEdit =
    user?.id === report.user.id && (report.status === 'draft' || report.status === 'rejected')

  const canApproveReject = user?.role === 'manager' && report.status === 'submitted'

  const problemComments = comments.filter((c) => c.targetType === 'problem')
  const planComments = comments.filter((c) => c.targetType === 'plan')

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center gap-4">
        <h2 className="text-2xl font-bold">
          日報詳細 - {new Date(report.report_date).toLocaleDateString('ja-JP')}
        </h2>
        <span className="text-gray-600">{report.user.name}</span>
        <Badge variant={statusVariants[report.status]}>{statusLabels[report.status]}</Badge>
        {canEdit && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/daily-reports/${report.id}/edit`}>編集</Link>
          </Button>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      {/* 訪問記録 */}
      <section className="mb-8">
        <h3 className="mb-3 font-semibold text-gray-700">訪問記録</h3>
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>顧客</TableHead>
                <TableHead>時刻</TableHead>
                <TableHead>訪問目的</TableHead>
                <TableHead>案件・商品</TableHead>
                <TableHead>次回アクション</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.visit_records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-4 text-center text-gray-400">
                    訪問記録がありません
                  </TableCell>
                </TableRow>
              ) : (
                report.visit_records.map((vr) => (
                  <TableRow key={vr.id}>
                    <TableCell>{vr.customer_name}</TableCell>
                    <TableCell>{vr.visit_time}</TableCell>
                    <TableCell>{vr.purpose}</TableCell>
                    <TableCell>{vr.case_product ?? '-'}</TableCell>
                    <TableCell>{vr.next_action ?? '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Problem */}
      <section className="mb-8">
        <h3 className="mb-2 font-semibold text-gray-700">Problem（課題・相談）</h3>
        <div className="mb-3 min-h-16 rounded-md border bg-white p-4 text-sm whitespace-pre-wrap">
          {report.problem || <span className="text-gray-400">なし</span>}
        </div>
        <div className="mb-3 space-y-2">
          {problemComments.map((c) => (
            <div key={c.id} className="rounded-md border bg-gray-50 p-3 text-sm">
              <div className="mb-1 text-xs text-gray-500">
                {c.user.name} ({new Date(c.createdAt).toLocaleString('ja-JP')})
              </div>
              {c.content}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Textarea
            value={problemComment}
            onChange={(e) => setProblemComment(e.target.value)}
            placeholder="コメントを入力..."
            rows={2}
            className="flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            className="self-end"
            onClick={() => postComment('problem', problemComment)}
          >
            送信
          </Button>
        </div>
      </section>

      {/* Plan */}
      <section className="mb-8">
        <h3 className="mb-2 font-semibold text-gray-700">Plan（明日やること）</h3>
        <div className="mb-3 min-h-16 rounded-md border bg-white p-4 text-sm whitespace-pre-wrap">
          {report.plan || <span className="text-gray-400">なし</span>}
        </div>
        <div className="mb-3 space-y-2">
          {planComments.map((c) => (
            <div key={c.id} className="rounded-md border bg-gray-50 p-3 text-sm">
              <div className="mb-1 text-xs text-gray-500">
                {c.user.name} ({new Date(c.createdAt).toLocaleString('ja-JP')})
              </div>
              {c.content}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Textarea
            value={planComment}
            onChange={(e) => setPlanComment(e.target.value)}
            placeholder="コメントを入力..."
            rows={2}
            className="flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            className="self-end"
            onClick={() => postComment('plan', planComment)}
          >
            送信
          </Button>
        </div>
      </section>

      {/* 承認フロー */}
      {canApproveReject && (
        <section className="mb-8 border-t pt-6">
          <h3 className="mb-3 font-semibold text-gray-700">承認</h3>
          <div className="flex gap-3">
            <Button onClick={handleApprove}>承認する</Button>
            <Button variant="destructive" onClick={handleReject}>
              差し戻す
            </Button>
          </div>
        </section>
      )}

      {report.approved_by && (
        <p className="text-sm text-gray-500">
          承認者: {report.approved_by.name} (
          {report.approved_at ? new Date(report.approved_at).toLocaleString('ja-JP') : ''})
        </p>
      )}
    </div>
  )
}
