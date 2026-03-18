import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const HASH_ROUNDS = 10

async function main() {
  console.log('🌱 Seeding database...')

  // ── Users ─────────────────────────────────────────────────────────────────

  const password = await bcrypt.hash('password123', HASH_ROUNDS)

  const tanaka = await prisma.user.upsert({
    where: { email: 'tanaka@example.com' },
    update: { password },
    create: {
      name: '田中 太郎',
      email: 'tanaka@example.com',
      password,
      role: Role.sales,
    },
  })

  const sato = await prisma.user.upsert({
    where: { email: 'sato@example.com' },
    update: { password },
    create: {
      name: '佐藤 花子',
      email: 'sato@example.com',
      password,
      role: Role.sales,
    },
  })

  const yamada = await prisma.user.upsert({
    where: { email: 'yamada@example.com' },
    update: { password },
    create: {
      name: '山田 部長',
      email: 'yamada@example.com',
      password,
      role: Role.manager,
    },
  })

  console.log(`  ✓ Users: ${tanaka.name}, ${sato.name}, ${yamada.name}`)

  // ── Customers ─────────────────────────────────────────────────────────────

  const customerA = await prisma.customer.upsert({
    where: { id: 1 },
    update: {},
    create: {
      companyName: '株式会社A',
      contactName: '鈴木 一郎',
      phone: '03-1234-5678',
      email: 'suzuki@company-a.com',
      address: '東京都千代田区丸の内1-1-1',
    },
  })

  const customerB = await prisma.customer.upsert({
    where: { id: 2 },
    update: {},
    create: {
      companyName: '有限会社B',
      contactName: '高橋 次郎',
      phone: '03-2345-6789',
      email: 'takahashi@company-b.com',
      address: '東京都新宿区西新宿2-2-2',
    },
  })

  const customerC = await prisma.customer.upsert({
    where: { id: 3 },
    update: {},
    create: {
      companyName: '株式会社C',
      contactName: '伊藤 三郎',
      phone: '06-3456-7890',
      email: 'ito@company-c.com',
      address: '大阪府大阪市北区梅田3-3-3',
    },
  })

  console.log(
    `  ✓ Customers: ${customerA.companyName}, ${customerB.companyName}, ${customerC.companyName}`
  )

  console.log('✅ Seeding complete!')
  console.log('')
  console.log('  Accounts (password: password123):')
  console.log(`    sales   : ${tanaka.email}`)
  console.log(`    sales   : ${sato.email}`)
  console.log(`    manager : ${yamada.email}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
