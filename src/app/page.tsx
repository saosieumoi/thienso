import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import type { Metadata } from 'next'
import SideColumn from '@/components/SideColumn'

// Prevent build-time pre-rendering to avoid DB connection pool exhaustion
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Thiên Số — Kết quả xổ số Việt Nam',
  description: 'Kết quả xổ số Miền Bắc, Miền Nam, Miền Trung và Vietlott nhanh nhất. Cập nhật ngay sau mỗi kỳ quay.',
}

// ── Helpers ───────────────────────────────────────
function formatDate(d: Date | string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(d).toLocaleDateString('vi-VN', opts)
}

function formatDateForUrl(date: Date): string {
  const d = date.getDate().toString().padStart(2, '0')
  const m = (date.getMonth() + 1).toString().padStart(2, '0')
  const y = date.getFullYear()
  return `${d}-${m}-${y}`
}

function parseDate(dateStr: string): Date | null {
  const match = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (!match) return null
  const [, d, m, y] = match.map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  if (isNaN(date.getTime())) return null
  return date
}

// ── Data fetchers ───────────────────────────────────
async function getHomeData(dateStr?: string) {
  const targetDate = dateStr ? parseDate(dateStr) : null
  const isSpecificDate = !!targetDate

  // If no specific date, show latest results
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  try {
    // XSMB - query by date if specified, otherwise latest
    const xsmb = isSpecificDate
      ? await prisma.draw.findFirst({
          where: {
            lotteryType: { code: 'XSMB' },
            drawDate: { gte: targetDate!, lt: new Date(targetDate!.getTime() + 86400000) },
            isComplete: true,
          },
          select: {
            id: true,
            drawDate: true,
            results: {
              where: { prizeName: 'DB' },
              select: { prizeName: true, numbers: true },
            },
          },
        })
      : await prisma.draw.findFirst({
          where: { lotteryType: { code: 'XSMB' }, isComplete: true },
          orderBy: { drawDate: 'desc' },
          select: {
            id: true,
            drawDate: true,
            results: {
              where: { prizeName: 'DB' },
              select: { prizeName: true, numbers: true },
            },
          },
        })

    // XSMN
    const xsmn = isSpecificDate
      ? await prisma.draw.findMany({
          where: {
            lotteryType: { code: 'XSMN' },
            drawDate: { gte: targetDate!, lt: new Date(targetDate!.getTime() + 86400000) },
            isComplete: true,
          },
          select: {
            id: true,
            drawDate: true,
            results: { where: { prizeName: 'DB' }, select: { prizeName: true, numbers: true } },
            province: { select: { name: true, shortName: true } },
          },
        })
      : await prisma.draw.findMany({
          where: { lotteryType: { code: 'XSMN' }, isComplete: true },
          orderBy: { drawDate: 'desc' },
          take: 3,
          select: {
            id: true,
            drawDate: true,
            results: { where: { prizeName: 'DB' }, select: { prizeName: true, numbers: true } },
            province: { select: { name: true, shortName: true } },
          },
        })

    // XSMT
    const xsmt = isSpecificDate
      ? await prisma.draw.findMany({
          where: {
            lotteryType: { code: 'XSMT' },
            drawDate: { gte: targetDate!, lt: new Date(targetDate!.getTime() + 86400000) },
            isComplete: true,
          },
          select: {
            id: true,
            drawDate: true,
            results: { where: { prizeName: 'DB' }, select: { prizeName: true, numbers: true } },
            province: { select: { name: true, shortName: true } },
          },
        })
      : await prisma.draw.findMany({
          where: { lotteryType: { code: 'XSMT' }, isComplete: true },
          orderBy: { drawDate: 'desc' },
          take: 3,
          select: {
            id: true,
            drawDate: true,
            results: { where: { prizeName: 'DB' }, select: { prizeName: true, numbers: true } },
            province: { select: { name: true, shortName: true } },
          },
        })

    // Mega 6/45 - always latest
    const mega = await prisma.draw.findFirst({
      where: { lotteryType: { code: 'MEGA645' }, isComplete: true },
      orderBy: { drawDate: 'desc' },
      select: {
        id: true,
        drawDate: true,
        drawNumber: true,
        results: { where: { prizeName: 'VL1' }, select: { prizeName: true, numbers: true } },
        vietlottPrizes: {
          where: { name: { contains: 'Jackpot', mode: 'insensitive' } },
          select: { name: true, value: true },
        },
      },
    })

    // Power 6/55 - always latest
    const power = await prisma.draw.findFirst({
      where: { lotteryType: { code: 'POWER655' }, isComplete: true },
      orderBy: { drawDate: 'desc' },
      select: {
        id: true,
        drawDate: true,
        drawNumber: true,
        results: { where: { prizeName: 'JP1' }, select: { prizeName: true, numbers: true } },
        vietlottPrizes: {
          where: { name: { contains: 'Jackpot 1', mode: 'insensitive' } },
          select: { name: true, value: true },
        },
      },
    })

    // Max 3D - always latest
    const max3d = await prisma.draw.findFirst({
      where: { lotteryType: { code: 'MAX3D' }, isComplete: true },
      orderBy: { drawDate: 'desc' },
      select: {
        id: true,
        drawDate: true,
        drawNumber: true,
        results: { where: { prizeName: 'VL1' }, select: { prizeName: true, numbers: true } },
        vietlottPrizes: { select: { name: true, value: true } },
      },
    })

    // Max 3D Pro - always latest
    const max3dpro = await prisma.draw.findFirst({
      where: { lotteryType: { code: 'MAX3DPRO' }, isComplete: true },
      orderBy: { drawDate: 'desc' },
      select: {
        id: true,
        drawDate: true,
        drawNumber: true,
        results: { where: { prizeName: 'VL1' }, select: { prizeName: true, numbers: true } },
        vietlottPrizes: { select: { name: true, value: true } },
      },
    })

    return { xsmb, xsmn, xsmt, mega, power, max3d, max3dpro }
  } catch (error) {
    console.error('[HomePage] DB error:', error)
    return { xsmb: null, xsmn: [], xsmt: [], mega: null, power: null, max3d: null, max3dpro: null }
  }
}

// ── Traditional Lottery Card ─────────────────────────
function LotteryCard({
  badge,
  badgeColor,
  title,
  subtitle,
  dbNumber,
  provinces,
  isLive
}: {
  badge: string
  badgeColor: string
  title: string
  subtitle: string
  dbNumber?: string | null
  provinces?: Array<{ name: string; dbNumber: string }>
  isLive?: boolean
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className={`h-1.5 ${badgeColor}`} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold text-white mb-2 ${badgeColor}`}>
              {badge}
            </span>
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500">{subtitle}</p>
          </div>
          {isLive !== undefined && (
            <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${
              isLive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {isLive ? '✓ Đã quay' : 'Chưa quay'}
            </span>
          )}
        </div>

        {dbNumber && (
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-4 text-center mb-4 border border-amber-100">
            <p className="text-xs text-gray-500 mb-1">Giải Đặc Biệt</p>
            <p className="text-3xl font-black text-amber-700 tracking-widest">{dbNumber}</p>
            <div className="flex justify-center gap-4 mt-2 text-xs text-gray-500">
              <span>Đầu: <strong className="text-amber-600">{dbNumber.slice(0, 2)}</strong></span>
              <span>Đuôi: <strong className="text-emerald-600">{dbNumber.slice(-2)}</strong></span>
            </div>
          </div>
        )}

        {provinces && provinces.length > 0 && (
          <div className="grid grid-cols-1 gap-2 mb-4">
            {provinces.map((p, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-sm text-gray-600">{p.name}</span>
                <span className="font-bold text-amber-700">{p.dbNumber}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Vietlott Card ────────────────────────────────────
function VietlottCard({
  href,
  name,
  icon,
  color,
  bgColor,
  numbers,
  jackpot,
  prizeLabel = 'Jackpot',
  subPrize,
  drawNumber,
  drawDate,
}: {
  href: string
  name: string
  icon: string
  color: string
  bgColor: string
  numbers: string[]
  jackpot?: string | null
  prizeLabel?: string
  subPrize?: { label: string; value: string }
  drawNumber?: number | null
  drawDate?: Date | null
}) {
  return (
    <Link
      href={href}
      className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
    >
      <div className={`h-1.5 ${bgColor}`} />
      <div className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">{icon}</span>
          <div>
            <h3 className={`font-bold ${color}`}>{name}</h3>
            {drawNumber && <p className="text-xs text-gray-400">Kỳ #{drawNumber}</p>}
          </div>
        </div>

        {numbers.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {numbers.map((n, i) => (
              <span
                key={i}
                className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold border-2 ${color.replace('text-', 'border-').replace('700', '200')} ${color.replace('text-', 'bg-').replace('700', '50')} ${color}`}
              >
                {n}
              </span>
            ))}
          </div>
        )}

        {jackpot && (
          <div className="bg-gray-50 rounded-lg px-3 py-2 mb-3">
            <p className="text-xs text-gray-500">{prizeLabel}</p>
            <p className={`font-black ${color}`}>{jackpot}đ</p>
          </div>
        )}

        {subPrize && (
          <div className="bg-amber-50 rounded-lg px-3 py-2 mb-3 border border-amber-100">
            <p className="text-xs text-amber-600">{subPrize.label}</p>
            <p className="font-black text-amber-700">{subPrize.value}đ</p>
          </div>
        )}

        {drawDate && (
          <p className="text-xs text-gray-400">
            {formatDate(drawDate, { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </p>
        )}
      </div>
    </Link>
  )
}

// ── Page ─────────────────────────────────────────────
interface PageProps {
  searchParams: Promise<{ date?: string }>
}

export default async function HomePage({ searchParams }: PageProps) {
  const { date: dateStr } = await searchParams
  const { xsmb, xsmn, xsmt, mega, power, max3d, max3dpro } = await getHomeData(dateStr)

  const isSpecificDate = !!dateStr && dateStr.length > 0
  const displayDate = isSpecificDate ? (parseDate(dateStr!) ?? new Date()) : new Date()
  const displayDateVN = formatDate(displayDate, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })

  // Get latest date for XSMN/XSMT grouping
  const xsmnDate = xsmn[0]?.drawDate
  const xsmtDate = xsmt[0]?.drawDate

  // Extract DB numbers
  const xsmbDb = xsmb?.results.find(r => r.prizeName === 'DB')?.numbers[0] ?? null
  const xsmnProvinces = xsmn
    .filter(d => !xsmnDate || new Date(d.drawDate).toDateString() === new Date(xsmnDate).toDateString())
    .map(d => ({
      name: d.province?.shortName ?? d.province?.name ?? 'Đài',
      dbNumber: d.results[0]?.numbers[0] ?? '—',
    }))
  const xsmtProvinces = xsmt
    .filter(d => !xsmtDate || new Date(d.drawDate).toDateString() === new Date(xsmtDate).toDateString())
    .map(d => ({
      name: d.province?.shortName ?? d.province?.name ?? 'Đài',
      dbNumber: d.results[0]?.numbers[0] ?? '—',
    }))

  // Vietlott data
  const megaNumbers = mega?.results[0]?.numbers ?? []
  const powerNumbers = power?.results[0]?.numbers ?? []
  const megaJackpot = mega?.vietlottPrizes[0]?.value ?? null
  const powerJackpot = power?.vietlottPrizes[0]?.value ?? null
  const max3dNumbers = max3d?.results[0]?.numbers ?? []
  const max3dproNumbers = max3dpro?.results[0]?.numbers ?? []

  return (
    <div className="min-h-screen">

      {/* ── Hero Section ── */}
      <section className="bg-gradient-to-b from-[#0B0E14] to-[#1a1f2e] text-white py-16 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight" style={{ fontFamily: 'var(--font-playfair)' }}>
            Kết quả <span className="text-[#C9A84C]">Xổ Số</span> Việt Nam
          </h1>
          <p className="text-white/70 text-lg max-w-2xl mx-auto">
            {isSpecificDate
              ? `Kết quả xổ số ngày ${displayDateVN}`
              : 'Cập nhật nhanh và chính xác kết quả XSMB, XSMN, XSMT và Vietlott ngay sau mỗi kỳ quay.'}
          </p>
        </div>
      </section>

      {/* ── Date Selector Bar ── */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-4 py-3">
            <span className="text-sm font-medium text-gray-600">Ngày xem:</span>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {Array.from({ length: 7 }, (_, i) => {
                const d = new Date()
                d.setDate(d.getDate() - i)
                const dStr = formatDateForUrl(d)
                const isActive = dateStr === dStr || (!dateStr && i === 0)
                return (
                  <Link
                    key={i}
                    href={i === 0 ? '/' : `/?date=${dStr}`}
                    className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-[#C9A84C] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {i === 0 ? 'Hôm nay' : formatDate(d, { day: '2-digit', month: '2-digit' })}
                  </Link>
                )
              })}
            </div>
            {isSpecificDate && (
              <Link
                href="/"
                className="shrink-0 text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
              >
                ← Hôm nay
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex gap-6">
          <div className="flex-1 space-y-8 min-w-0">

            {/* ── Traditional Lottery ── */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-xl font-bold text-gray-900">Kết quả xổ số truyền thống</h2>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <LotteryCard
                  badge="XSMB"
                  badgeColor="bg-[#C9A84C]"
                  title="Miền Bắc"
                  subtitle={xsmb?.drawDate ? formatDate(xsmb.drawDate, { day: '2-digit', month: '2-digit' }) : 'Chưa có kết quả'}
                  dbNumber={xsmbDb}
                  isLive={!!xsmbDb}
                />
                <LotteryCard
                  badge="XSMN"
                  badgeColor="bg-[#2A6B5C]"
                  title="Miền Nam"
                  subtitle={xsmnDate ? formatDate(xsmnDate, { day: '2-digit', month: '2-digit' }) : 'Chưa có kết quả'}
                  provinces={xsmnProvinces.length > 0 ? xsmnProvinces : undefined}
                  isLive={xsmnProvinces.length > 0}
                />
                <LotteryCard
                  badge="XSMT"
                  badgeColor="bg-[#2A6B5C]"
                  title="Miền Trung"
                  subtitle={xsmtDate ? formatDate(xsmtDate, { day: '2-digit', month: '2-digit' }) : 'Chưa có kết quả'}
                  provinces={xsmtProvinces.length > 0 ? xsmtProvinces : undefined}
                  isLive={xsmtProvinces.length > 0}
                />
              </div>
            </section>

            {/* ── Traditional Lottery Links ── */}
            <section className="flex flex-wrap gap-3">
              <Link href="/xsmb" className="px-4 py-2 bg-[#C9A84C]/10 text-[#C9A84C] rounded-lg text-sm font-semibold hover:bg-[#C9A84C]/20 transition-colors">
                XSMB Chi tiết →
              </Link>
              <Link href="/xsmn" className="px-4 py-2 bg-[#2A6B5C]/10 text-[#2A6B5C] rounded-lg text-sm font-semibold hover:bg-[#2A6B5C]/20 transition-colors">
                XSMN Chi tiết →
              </Link>
              <Link href="/xsmt" className="px-4 py-2 bg-[#2A6B5C]/10 text-[#2A6B5C] rounded-lg text-sm font-semibold hover:bg-[#2A6B5C]/20 transition-colors">
                XSMT Chi tiết →
              </Link>
            </section>

            {/* ── Vietlott ── */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-xl font-bold text-gray-900">Kết quả Vietlott</h2>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <VietlottCard
                  href="/vietlott"
                  name="Mega 6/45"
                  icon="🔴"
                  color="text-red-700"
                  bgColor="bg-red-500"
                  numbers={megaNumbers}
                  jackpot={megaJackpot}
                  drawNumber={mega?.drawNumber ?? undefined}
                  drawDate={mega?.drawDate ?? undefined}
                />
                <VietlottCard
                  href="/vietlott"
                  name="Power 6/55"
                  icon="🔵"
                  color="text-blue-700"
                  bgColor="bg-blue-500"
                  numbers={powerNumbers}
                  jackpot={powerJackpot}
                  drawNumber={power?.drawNumber ?? undefined}
                  drawDate={power?.drawDate ?? undefined}
                />
                <VietlottCard
                  href="/vietlott"
                  name="Max 3D"
                  icon="🟢"
                  color="text-green-700"
                  bgColor="bg-green-500"
                  numbers={max3dNumbers}
                  jackpot="1.000.000"
                  prizeLabel="Giải Nhất"
                  subPrize={{ label: 'Max 3D+ — Giải Đặc Biệt', value: '1.000.000.000' }}
                  drawNumber={max3d?.drawNumber ?? undefined}
                  drawDate={max3d?.drawDate ?? undefined}
                />
                <VietlottCard
                  href="/vietlott"
                  name="Max 3D Pro"
                  icon="🟣"
                  color="text-purple-700"
                  bgColor="bg-purple-500"
                  numbers={max3dproNumbers}
                  jackpot="2.000.000.000"
                  prizeLabel="Giải Đặc Biệt"
                  drawNumber={max3dpro?.drawNumber ?? undefined}
                  drawDate={max3dpro?.drawDate ?? undefined}
                />
              </div>
            </section>

          </div>

          {/* Side Column */}
          <SideColumn
            region="home"
            regionLabel="Tổng hợp"
            drawDate={xsmb?.drawDate ?? displayDate}
            dbNumbers={[
              ...(xsmbDb ? [{ province: 'XSMB', number: xsmbDb }] : []),
              ...xsmnProvinces.map(p => ({ province: p.name, number: p.dbNumber })),
              ...xsmtProvinces.map(p => ({ province: p.name, number: p.dbNumber })),
            ]}
            jackpotData={{
              mega: megaJackpot,
              power: powerJackpot
            }}
          />
        </div>
      </div>
    </div>
  )
}
