// src/app/vietlott/[date]/page.tsx
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import SideColumn from '@/components/SideColumn'

// KHÔNG có generateStaticParams — nếu có, Next.js sẽ pre-render TẤT CẢ
// pages tại build time, gây DB connection pool exhaustion (connection_limit=1).
// Ngay cả 7 pages cũng timeout vì Next.js pre-render SONG SONG và generateMetadata
// cũng query DB, tạo ra nhiều concurrent connections.
//
// Thay vào đó:
//   - dynamic = 'force-dynamic': ngăn prerender tại build time
//   - revalidate = 86400: cache trong 24 giờ
//   - Sau khi crawl xong → gọi revalidatePath('/vietlott/[date]') để cập nhật
//   - Googlebot sẽ trigger generation khi crawl → vẫn có SEO
export const dynamic = 'force-dynamic'
export const revalidate = 86400 // 24 hours

function formatDate(d: Date | string, opts?: Intl.DateTimeFormatOptions) {
    return new Date(d).toLocaleDateString('vi-VN', opts)
}

// Validate and parse DD-MM-YYYY format
function parseDate(dateStr: string): Date | null {
    const match = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/)
    if (!match) return null
    const [, d, m, y] = match.map(Number)
    const date = new Date(Date.UTC(y, m - 1, d))
    if (isNaN(date.getTime())) return null
    return date
}

// Format date to DD-MM-YYYY for URL
function formatDateForUrl(date: Date): string {
    const d = date.getDate().toString().padStart(2, '0')
    const m = (date.getMonth() + 1).toString().padStart(2, '0')
    const y = date.getFullYear()
    return `${d}-${m}-${y}`
}

function isValidDateFormat(dateStr: string): boolean {
    return /^\d{2}-\d{2}-\d{4}$/.test(dateStr) && parseDate(dateStr) !== null
}

const GAME_CONFIG = {
    MEGA645: { name: 'Mega 6/45', icon: '🔴', color: 'text-red-700', border: 'border-red-200', bg: 'from-red-50 to-rose-50', badge: 'bg-red-100 text-red-700', ballCls: 'bg-white border-red-200 text-red-800' },
    POWER655: { name: 'Power 6/55', icon: '🔵', color: 'text-blue-700', border: 'border-blue-200', bg: 'from-blue-50 to-indigo-50', badge: 'bg-blue-100 text-blue-700', ballCls: 'bg-white border-blue-200 text-blue-800' },
    MAX3D: { name: 'Max 3D', icon: '🟢', color: 'text-green-700', border: 'border-green-200', bg: 'from-green-50 to-emerald-50', badge: 'bg-green-100 text-green-700', ballCls: 'bg-white border-green-200 text-green-800' },
    MAX3DPRO: { name: 'Max 3D Pro', icon: '🟣', color: 'text-purple-700', border: 'border-purple-200', bg: 'from-purple-50 to-violet-50', badge: 'bg-purple-100 text-purple-700', ballCls: 'bg-white border-purple-200 text-purple-800' },
} as const

const PRIZE_LABEL: Record<string, string> = {
    VL1: 'Đặc biệt', VL2: 'Giải nhất', VL3: 'Giải nhì', VL4: 'Giải ba', VL5: 'Giải khác',
}

function Ball({ num, cls }: { num: string | number; cls: string }) {
    return (
        <span className={`inline-flex items-center justify-center w-12 h-12 rounded-full font-bold border-2 shadow-sm ${cls}`}>
            {String(num).padStart(2, '0')}
        </span>
    )
}

// ── SEO ──
export async function generateMetadata(
    { params }: { params: Promise<{ date: string }> }
): Promise<Metadata> {
    const { date } = await params
    const drawDate = parseDate(date)
    if (!drawDate) return { title: 'Không tìm thấy — Thiên Số' }

    const dateVN = formatDate(drawDate, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })

    const mega = await prisma.draw.findFirst({
        where: { lotteryType: { code: 'MEGA645' }, drawDate, isComplete: true },
        select: { results: { where: { prizeName: 'VL1' }, select: { numbers: true } } },
    })
    const megaNumbers = mega?.results[0]?.numbers ?? []

    return {
        title: `Kết quả Vietlott ${dateVN} — Thiên Số`,
        description: `Kết quả Vietlott ngày ${dateVN}. Mega 6/45, Power 6/55, Max 3D, Max 3D Pro.`,
        openGraph: {
            title: `Kết quả Vietlott ${dateVN} — Thiên Số`,
            description: `Tra cứu kết quả Vietlott ngày ${dateVN}`,
        },
        alternates: {
            canonical: `https://thienso.com/vietlott/${date}`,
        },
    }
}

// ── Fetch data ──
async function getDrawByDate(dateStr: string) {
    const drawDate = parseDate(dateStr)!

    // CRITICAL: Do NOT use Promise.all — sequential queries only (connection_limit=1)
    const mega = await prisma.draw.findFirst({
        where: { lotteryType: { code: 'MEGA645' }, drawDate, isComplete: true },
        include: { results: { orderBy: { prizeName: 'asc' } }, vietlottPrizes: true },
    })

    const power = await prisma.draw.findFirst({
        where: { lotteryType: { code: 'POWER655' }, drawDate, isComplete: true },
        include: { results: { orderBy: { prizeName: 'asc' } }, vietlottPrizes: true },
    })

    const max3d = await prisma.draw.findFirst({
        where: { lotteryType: { code: 'MAX3D' }, drawDate, isComplete: true },
        include: { results: { orderBy: { prizeName: 'asc' } }, vietlottPrizes: true },
    })

    const max3dpro = await prisma.draw.findFirst({
        where: { lotteryType: { code: 'MAX3DPRO' }, drawDate, isComplete: true },
        include: { results: { orderBy: { prizeName: 'asc' } }, vietlottPrizes: true },
    })

    const prev = await prisma.draw.findFirst({
        where: { lotteryType: { code: 'MEGA645' }, drawDate: { lt: drawDate }, isComplete: true },
        orderBy: { drawDate: 'desc' },
        select: { drawDate: true },
    })
    const next = await prisma.draw.findFirst({
        where: { lotteryType: { code: 'MEGA645' }, drawDate: { gt: drawDate }, isComplete: true },
        orderBy: { drawDate: 'asc' },
        select: { drawDate: true },
    })

    return {
        mega,
        power,
        max3d,
        max3dpro,
        prevDate: prev ? formatDateForUrl(prev.drawDate) : null,
        nextDate: next ? formatDateForUrl(next.drawDate) : null,
    }
}

// ── Game Card for date page ──
function GameCard({ gameCode, draw }: { gameCode: keyof typeof GAME_CONFIG; draw: Awaited<ReturnType<typeof getDrawByDate>>['mega'] }) {
    const cfg = GAME_CONFIG[gameCode]
    const mainResult = draw?.results[0]
    const jackpotPrize = draw?.vietlottPrizes?.find(p => p.name.toLowerCase().includes('jackpot'))

    return (
        <div className={`bg-gradient-to-br ${cfg.bg} border-2 ${cfg.border} rounded-2xl overflow-hidden shadow-sm`}>
            <div className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-xl">{cfg.icon}</span>
                    <h3 className={`font-bold ${cfg.color}`}>{cfg.name}</h3>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${cfg.badge}`}>
                    Kỳ #{draw?.drawNumber ?? '—'}
                </span>
            </div>

            {draw ? (
                <>
                    {jackpotPrize && (
                        <div className="px-5 pb-3">
                            <p className="text-xs text-gray-500 mb-0.5">Jackpot:</p>
                            <p className={`text-xl font-black ${cfg.color}`}>{jackpotPrize.value}đ</p>
                        </div>
                    )}

                    <div className="px-5 pb-5">
                        {mainResult && (
                            <div className="flex flex-wrap gap-2">
                                {mainResult.numbers.map((n, i) => (
                                    <Ball key={i} num={n} cls={cfg.ballCls} />
                                ))}
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="px-5 pb-4 text-center">
                    <p className="text-sm text-gray-400 italic">Chưa có kết quả</p>
                </div>
            )}
        </div>
    )
}

// ── Page ──
export default async function VietlottDatePage(
    { params }: { params: Promise<{ date: string }> }
) {
    const { date } = await params

    if (!isValidDateFormat(date)) notFound()

    const { mega, power, max3d, max3dpro, prevDate, nextDate } = await getDrawByDate(date)
    const drawDate = parseDate(date)!
    const dateVN = formatDate(drawDate, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })

    const megaJackpot = mega?.vietlottPrizes?.find(p => p.name.toLowerCase().includes('jackpot'))?.value ?? null
    const powerJackpot = power?.vietlottPrizes?.find(p => p.name.toLowerCase().includes('jackpot'))?.value ?? null

    // Filter max3d/max3dpro results to only VL* prizes
    const max3dFiltered = max3d ? { ...max3d, results: max3d.results.filter(r => String(r.prizeName).startsWith('VL')) } : null
    const max3dproFiltered = max3dpro ? { ...max3dpro, results: max3dpro.results.filter(r => String(r.prizeName).startsWith('VL')) } : null

    // Filter mega/power to specific prizes for display
    const megaFiltered = mega ? { ...mega, results: mega.results.filter(r => ['VL1', 'VL2', 'VL3', 'VL4', 'VL5'].includes(String(r.prizeName))) } : null
    const powerFiltered = power ? { ...power, results: power.results.filter(r => ['JP1', 'JP2'].includes(String(r.prizeName))) } : null

    return (
        <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex gap-6">
                {/* Main content */}
                <main className="flex-1 space-y-5 min-w-0">

                    {/* Breadcrumb */}
                    <nav className="text-sm text-gray-500">
                        <Link href="/" className="hover:text-gray-700">Trang chủ</Link>
                        <span className="mx-2 text-gray-300">›</span>
                        <Link href="/vietlott" className="hover:text-gray-700">Vietlott</Link>
                        <span className="mx-2 text-gray-300">›</span>
                        <span className="text-gray-800 font-medium">{dateVN}</span>
                    </nav>

                    {/* Header + nav ngày */}
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                Kết quả Vietlott ngày {date}
                            </h1>
                            <p className="text-gray-500 text-sm mt-1 capitalize">{dateVN}</p>
                        </div>
                        <div className="flex gap-2 shrink-0 mt-1">
                            {prevDate && (
                                <Link
                                    href={`/vietlott/${prevDate}`}
                                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-700 transition-colors"
                                >
                                    ← {prevDate}
                                </Link>
                            )}
                            {nextDate && (
                                <Link
                                    href={`/vietlott/${nextDate}`}
                                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-700 transition-colors"
                                >
                                    {nextDate} →
                                </Link>
                            )}
                        </div>
                    </div>

                    {/* Mega 6/45 & Power 6/55 */}
                    <section className="space-y-3">
                        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Xổ số chọn số</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <GameCard gameCode="MEGA645" draw={megaFiltered} />
                            <GameCard gameCode="POWER655" draw={powerFiltered} />
                        </div>
                    </section>

                    {/* Max 3D & Max 3D Pro */}
                    <section className="space-y-3">
                        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Xổ số 3 chữ số</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <GameCard gameCode="MAX3D" draw={max3dFiltered} />
                            <GameCard gameCode="MAX3DPRO" draw={max3dproFiltered} />
                        </div>
                    </section>

                    {/* JSON-LD */}
                    <script
                        type="application/ld+json"
                        dangerouslySetInnerHTML={{
                            __html: JSON.stringify({
                                '@context': 'https://schema.org',
                                '@type': 'WebPage',
                                name: `Kết quả Vietlott ${dateVN} — Thiên Số`,
                                url: `https://thienso.com/vietlott/${date}`,
                            })
                        }}
                    />
                </main>

                {/* Side Column */}
                <SideColumn
                    region="vietlott"
                    regionLabel="Vietlott"
                    jackpotData={{
                        mega: megaJackpot,
                        power: powerJackpot,
                    }}
                />
            </div>
        </div>
    )
}
