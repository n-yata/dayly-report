'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'

type DailyReport = {
  id: number
  report_date: string
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  visit_count: number
  user: { id: number; name: string }
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

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('ja-JP')
}

function getDefaultDateRange() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
  return { from, to }
}

export default function DailyReportsPage() {
  const { user, isLoading, authFetch } = useAuth()
  const router = useRouter()
  const [reports, setReports] = useState<DailyReport[]>([])
  const [isFetching, setIsFetching] = useState(false)
  const { from: defaultFrom, to: defaultTo } = getDefaultDateRange()
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)

  async function fetchReports() {
    if (!user) return
    setIsFetching(true)
    try {
      const params = new URLSearchParams({ from, to })
      const res = await authFetch(`/api/v1/daily-reports?${params}`)
      if (res.ok) {
        const data = await res.json()
        setReports(data.data)
      }
    } finally {
      setIsFetching(false)
    }
  }

  useEffect(() => {
    if (!isLoading && user) {
      fetchReports()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user])

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">読み込み中...</div>
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">日報一覧</h2>
        {user?.role === 'sales' && (
          <Button asChild>
            <Link href="/daily-reports/new">+ 新規作成</Link>
          </Button>
        )}
      </div>

      <div className="mb-4 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">期間:</label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-40"
          />
          <span className="text-gray-400">〜</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          <Button variant="outline" size="sm" onClick={fetchReports} disabled={isFetching}>
            絞り込み
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>報告日</TableHead>
              <TableHead>担当者</TableHead>
              <TableHead>訪問件数</TableHead>
              <TableHead>ステータス</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-gray-500">
                  日報がありません
                </TableCell>
              </TableRow>
            ) : (
              reports.map((report) => (
                <TableRow
                  key={report.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => router.push(`/daily-reports/${report.id}`)}
                >
                  <TableCell>{formatDate(report.report_date)}</TableCell>
                  <TableCell>{report.user.name}</TableCell>
                  <TableCell>{report.visit_count}件</TableCell>
                  <TableCell>
                    <Badge variant={statusVariants[report.status]}>
                      {statusLabels[report.status]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
