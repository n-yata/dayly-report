'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type DailyReport = {
  id: number
  report_date: string
  visit_count: number
  user: { id: number; name: string }
}

export default function ApprovalsPage() {
  const { user, isLoading, authFetch } = useAuth()
  const router = useRouter()
  const [reports, setReports] = useState<DailyReport[]>([])
  const [isFetching, setIsFetching] = useState(false)

  useEffect(() => {
    if (!isLoading && user) {
      if (user.role !== 'manager') {
        router.push('/daily-reports')
        return
      }
      fetchSubmittedReports()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user])

  async function fetchSubmittedReports() {
    setIsFetching(true)
    try {
      const res = await authFetch('/api/v1/daily-reports?status=submitted')
      if (res.ok) {
        const data = await res.json()
        setReports(data.data)
      }
    } finally {
      setIsFetching(false)
    }
  }

  if (isLoading || isFetching) {
    return <div className="p-8 text-center text-gray-500">読み込み中...</div>
  }

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">承認待ち一覧</h2>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>報告日</TableHead>
              <TableHead>担当者</TableHead>
              <TableHead>訪問件数</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-gray-500">
                  承認待ちの日報がありません
                </TableCell>
              </TableRow>
            ) : (
              reports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell>{new Date(report.report_date).toLocaleDateString('ja-JP')}</TableCell>
                  <TableCell>{report.user.name}</TableCell>
                  <TableCell>{report.visit_count}件</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/daily-reports/${report.id}`)}
                    >
                      詳細
                    </Button>
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
