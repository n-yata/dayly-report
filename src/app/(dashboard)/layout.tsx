import { Header } from '@/components/Header'
import { Navigation } from '@/components/Navigation'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <Navigation />
      <main className="container mx-auto px-6 py-6">{children}</main>
    </div>
  )
}
