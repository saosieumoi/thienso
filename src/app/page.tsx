import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import type { Metadata } from 'next'
import SideColumn from '@/components/SideColumn'

export const metadata: Metadata = {
  title: 'Thiên Số — Kết quả xổ số Việt Nam',
  description: 'Kết quả xổ số Miền Bắc, Miền Nam, Miền Trung và Vietlott nhanh nhất. Cập nhật ngay sau kỳ quay.',
}

// Prevent build-time pre-rendering to avoid DB connection pool exhaustion
export const dynamic = 'force-dynamic'
export const revalidate = 60

// ── Data fetchers ───────────────────────────────────
// CRITICAL: Do NOT use Promise.all with connection_limit=1 on Supabase.
// All queries must run SEQUENTIALLY to avoid connection pool timeout.
async function getHomeData() {
  // XSMB latest
  const xsmb = await prisma.draw.findFirst({
    where: { lotteryType: { code: 'XSMB' }, isComplete: true },
    orderBy: { drawDate: 'desc' },
    include: {
      results: { orderBy: { prizeName: 'asc' } },
      lotoResults: true,
    },
  })

  // XSMN latest (all provinces)
  const xsmn = await prisma.draw.findMany({
    where: { lotteryType: { code: 'XSMN' }, isComplete: true },
    orderBy: { drawDate: 'desc' },
    take: 3,
    include: {
      results: { where: { prizeName: 'DB' } },
      province: true,
    },
  })

  // XSMT latest (all provinces)
  const xsmt = await prisma.draw.findMany({
    where: { lotteryType: { code: 'XSMT' }, isComplete: true },
    orderBy: { drawDate: 'desc' },
    take: 3,
    include: {
      results: { where: { prizeName: 'DB' } },
      province: true,
    },
  })

  // Mega 6/45 latest
  const mega = await prisma.draw.findFirst({
    where: { lotteryType: { code: 'MEGA645' }, isComplete: true },
    orderBy: { drawDate: 'desc' },
    include: {
      results: { where: { prizeName: 'VL1' } },
      vietlottPrizes: { where: { name: { contains: 'Jackpot 1', mode: 'insensitive' } } },
    },
  })

  // Power 6/55 latest
  const power = await prisma.draw.findFirst({
    where: { lotteryType: { code: 'POWER655' }, isComplete: true },
    orderBy: { drawDate: 'desc' },
    include: {
      results: { where: { prizeName: 'JP1' } },
      vietlottPrizes: { where: { name: { contains: 'Jackpot 1', mode: 'insensitive' } } },
    },
  })

  return { xsmb, xsmn, xsmt, mega, power }
}

function formatDate(d: Date | string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(d).toLocaleDateString('vi-VN', opts)
}

// ── Hero lottery card ────────────────────────────────
function LotteryRegionCard({
  href,
  badge,
  badgeColor,
  title,
  subtitle,
  dbNumber,
  provinces,
  isLive
}: {
  href: string
  badge: string
  badgeColor: string
  title: string
  subtitle: string
  dbNumber?: string | null
  provinces?: Array<{ name: string; dbNumber: string }>
  isLive?: boolean
}) {
  return (
    <Link
      href={href}
      className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
    >
      {/* Top accent bar */}
      <div className={`h-1.5 ${badgeColor}`} />

      <div className="p-5">
        {/* Header */}
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
              isLive
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-500'
            }`}>
              {isLive ? '✓ Đã quay' : 'Chưa quay'}
            </span>
          )}
        </div>

        {/* DB numbers */}
        {dbNumber && (
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-4 text-center mb-4 border border-amber-100">
            <p className="text-xs text-gray-500 mb-1">Giải Đặc Biệt</p>
            <p className="text-3xl font-black text-amber-700 tracking-widest">
              {dbNumber}
            </p>
            {dbNumber && (
              <div className="flex justify-center gap-4 mt-2 text-xs text-gray-500">
                <span>Đầu: <strong className="text-amber-600">{dbNumber.slice(0, 2)}</strong></span>
                <span>Đuôi: <strong className="text-emerald-600">{dbNumber.slice(-2)}</strong></span>
              </div>
            )}
          </div>
        )}

        {/* Multiple provinces */}
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

        {/* CTA */}
        <div className="flex items-center justify-end text-sm font-semibold text-[#C9A84C] group-hover:text-[#0B0E14] transition-colors">
          Xem chi tiết
          <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  )
}

// ── Vietlott game card ────────────────────────────────
function VietlottCard({
  href,
  name,
  icon,
  color,
  bgColor,
  numbers,
  jackpot,
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
            {drawNumber && (
              <p className="text-xs text-gray-400">Kỳ #{drawNumber}</p>
            )}
          </div>
        </div>

        {/* Numbers */}
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

        {/* Jackpot */}
        {jackpot && (
          <div className="bg-gray-50 rounded-lg px-3 py-2 mb-3">
            <p className="text-xs text-gray-500">Jackpot</p>
            <p className={`font-black ${color}`}>{jackpot}đ</p>
          </div>
        )}

        {/* Date */}
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
export default async function HomePage() {
  const { xsmb, xsmn, xsmt, mega, power } = await getHomeData()

  // Get latest date for each region
  const xsmbDate = xsmb?.drawDate
  const xsmnDate = xsmn[0]?.drawDate
  const xsmtDate = xsmt[0]?.drawDate

  const today = new Date()
  const isToday = (d: Date | undefined) => d?.toDateString() === today.toDateString()

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

  return (
    <div className="min-h-screen">

      {/* ── Hero Section ── */}
      <section className="bg-gradient-to-b from-[#0B0E14] to-[#1a1f2e] text-white py-16 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight" style={{ fontFamily: 'var(--font-playfair)' }}>
            Kết quả <span className="text-[#C9A84C]">Xổ Số</span> Việt Nam
          </h1>
          <p className="text-white/70 text-lg max-w-2xl mx-auto">
            Cập nhật nhanh và chính xác kết quả XSMB, XSMN, XSMT và Vietlott ngay sau mỗi kỳ quay.
          </p>
        </div>
      </section>

      {/* ── Main Content ── */}
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="flex gap-6">
          <div className="flex-1 space-y-10 min-w-0">

        {/* ── Traditional Lottery ── */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-xl font-bold text-gray-900">Kết quả xổ số truyền thống</h2>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* XSMB */}
            <LotteryRegionCard
              href="/xsmb"
              badge="XSMB"
              badgeColor="bg-[#C9A84C]"
              title="Miền Bắc"
              subtitle={xsmbDate ? `Ngày ${formatDate(xsmbDate, { day: '2-digit', month: '2-digit' })}` : 'Chưa có kết quả'}
              dbNumber={xsmbDb}
              isLive={!!xsmbDb}
            />

            {/* XSMN */}
            <LotteryRegionCard
              href="/xsmn"
              badge="XSMN"
              badgeColor="bg-[#2A6B5C]"
              title="Miền Nam"
              subtitle={xsmnDate ? `Ngày ${formatDate(xsmnDate, { day: '2-digit', month: '2-digit' })}` : 'Chưa có kết quả'}
              provinces={xsmnProvinces.length > 0 ? xsmnProvinces : undefined}
              isLive={xsmnProvinces.length > 0}
            />

            {/* XSMT */}
            <LotteryRegionCard
              href="/xsmt"
              badge="XSMT"
              badgeColor="bg-[#2A6B5C]"
              title="Miền Trung"
              subtitle={xsmtDate ? `Ngày ${formatDate(xsmtDate, { day: '2-digit', month: '2-digit' })}` : 'Chưa có kết quả'}
              provinces={xsmtProvinces.length > 0 ? xsmtProvinces : undefined}
              isLive={xsmtProvinces.length > 0}
            />
          </div>
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
              numbers={[]}
            />
            <VietlottCard
              href="/vietlott"
              name="Max 3D Pro"
              icon="🟣"
              color="text-purple-700"
              bgColor="bg-purple-500"
              numbers={[]}
            />
          </div>
        </section>

        {/* ── Quick Links ── */}
        <section className="bg-gradient-to-r from-[#0B0E14] via-[#1a1f2e] to-[#0B0E14] rounded-2xl p-8 text-white">
          <h2 className="text-lg font-bold mb-6 text-center">Thông tin các đài xổ số</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/xsmb" className="bg-white/5 hover:bg-white/10 rounded-xl p-4 text-center transition-colors">
              <p className="font-bold text-[#E8C97A]">XSMB</p>
              <p className="text-xs text-white/60 mt-1">Miền Bắc</p>
              <p className="text-[10px] text-white/40 mt-1">Quay lúc 18:15</p>
            </Link>
            <Link href="/xsmn" className="bg-white/5 hover:bg-white/10 rounded-xl p-4 text-center transition-colors">
              <p className="font-bold text-[#3D9B82]">XSMN</p>
              <p className="text-xs text-white/60 mt-1">Miền Nam</p>
              <p className="text-[10px] text-white/40 mt-1">Quay lúc 16:30</p>
            </Link>
            <Link href="/xsmt" className="bg-white/5 hover:bg-white/10 rounded-xl p-4 text-center transition-colors">
              <p className="font-bold text-[#3D9B82]">XSMT</p>
              <p className="text-xs text-white/60 mt-1">Miền Trung</p>
              <p className="text-[10px] text-white/40 mt-1">Quay lúc 17:15</p>
            </Link>
            <Link href="/vietlott" className="bg-white/5 hover:bg-white/10 rounded-xl p-4 text-center transition-colors">
              <p className="font-bold text-red-400">Vietlott</p>
              <p className="text-xs text-white/60 mt-1">Mega & Power</p>
              <p className="text-[10px] text-white/40 mt-1">Theo lịch quay</p>
            </Link>
          </div>
        </section>
          </div>

          {/* Side Column */}
          <SideColumn
            region="xsmb"
            regionLabel="XSMB"
            drawDate={xsmbDate}
            dbNumbers={xsmbDb ? [{ province: 'XSMB', number: xsmbDb }] : []}
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
