// src/app/(kqxs)/xsmn/page.tsx
import { prisma } from '@/lib/prisma'
import type { Metadata } from 'next'
import SideColumn from '@/components/SideColumn'

// Prevent build-time pre-rendering to avoid DB connection pool exhaustion
// (connection_limit=1 on Supabase cannot handle concurrent Prisma queries at build time)
export const dynamic = 'force-dynamic'
export const revalidate = 60

const PRIZE_ORDER = ['DB', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7']
const PRIZE_LABEL: Record<string, string> = {
    DB: 'Giải đặc biệt', G1: 'Giải nhất', G2: 'Giải nhì', G3: 'Giải ba',
    G4: 'Giải tư', G5: 'Giải năm', G6: 'Giải sáu', G7: 'Giải bảy',
}

function formatDate(d: Date | string, opts?: Intl.DateTimeFormatOptions) {
    return new Date(d).toLocaleDateString('vi-VN', opts)
}

// ── SEO ──────────────────────────────────────────────
export async function generateMetadata(): Promise<Metadata> {
    const dateStr = formatDate(new Date(), {
        weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
    })
    return {
        title: `XSMN hôm nay ${dateStr} — Kết quả xổ số Miền Nam — Thiên Số`,
        description: `Kết quả XSMN hôm nay ${dateStr}. Đầy đủ các đài: Đồng Nai, Cần Thơ, Sóc Trăng... Bảng lô tô, dò vé nhanh. Cập nhật ngay sau 16:30.`,
        openGraph: {
            title: `KQXSMN hôm nay ${dateStr} — Thiên Số`,
            description: 'Kết quả xổ số Miền Nam nhanh nhất, đầy đủ nhất',
        },
    }
}

// ── Fetch data ────────────────────────────────────────
async function getXSMNData() {
    const draws = await prisma.draw.findMany({
        where: {
            lotteryType: { code: 'XSMN' },
            isComplete: true,
        },
        orderBy: { drawDate: 'desc' },
        take: 3,
        include: {
            results: true,
            lotoResults: true,
            province: true,
        },
    })

    const history = await prisma.draw.findMany({
        where: {
            lotteryType: { code: 'XSMN' },
            isComplete: true,
        },
        orderBy: { drawDate: 'desc' },
        take: 21,
        include: {
            results: { where: { prizeName: { in: ['DB', 'G1', 'G7'] } } },
            province: true,
        },
    })

    draws.forEach(draw => {
        draw.results.sort(
            (a, b) => PRIZE_ORDER.indexOf(a.prizeName) - PRIZE_ORDER.indexOf(b.prizeName)
        )
    })

    const latestDate = draws[0]?.drawDate ?? null
    const todayDraws = latestDate
        ? draws.filter(d =>
            new Date(d.drawDate).toDateString() === new Date(latestDate).toDateString()
        )
        : []

    return { draws: todayDraws, history, latestDate }
}

// ── Loto table component ──────────────────────────────
function LotoTable({ lotoResults }: { lotoResults: any }) {
    if (!lotoResults) return null
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-4 py-2.5 text-left text-gray-400 font-medium w-14">Đầu</th>
                        {Array.from({ length: 10 }, (_, i) => (
                            <th key={i} className="px-1 py-2.5 text-center text-gray-400 font-medium w-10">{i}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(head => {
                        const tails = (lotoResults[`head${head}`] as number[]) || []
                        return (
                            <tr key={head} className="border-t border-gray-50">
                                <td className="px-4 py-2 font-bold text-gray-400 text-sm">{head}x</td>
                                {Array.from({ length: 10 }, (_, tail) => {
                                    const num = head * 10 + tail
                                    const hit = tails.includes(tail)
                                    return (
                                        <td key={tail} className="px-1 py-1.5 text-center">
                                            <span className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-xs font-bold ${hit
                                                    ? 'bg-amber-100 text-amber-800 border border-amber-200 shadow-sm'
                                                    : 'text-gray-200 bg-gray-50'
                                                }`}>
                                                {String(num).padStart(2, '0')}
                                            </span>
                                        </td>
                                    )
                                })}
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

// ── Page ─────────────────────────────────────────────
export default async function XSMNPage() {
    const { draws, history, latestDate } = await getXSMNData()

    const dateStr = latestDate
        ? formatDate(latestDate, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
        : formatDate(new Date(), { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })

    const isToday = latestDate
        ? new Date(latestDate).toDateString() === new Date().toDateString()
        : false

    // Side column data
    const dbNumbers = draws.map(d => ({
        province: d.province?.shortName ?? d.province?.name ?? 'Đài',
        number: d.results.find(r => r.prizeName === 'DB')?.numbers[0] ?? '—'
    }))

    const loganData = [
        { num: '42', days: 28, isHot: false },
        { num: '15', days: 24, isHot: false },
        { num: '88', days: 21, isHot: false },
        { num: '06', days: 18, isHot: false },
        { num: '29', days: 15, isHot: true },
        { num: '53', days: 12, isHot: true },
        { num: '81', days: 8, isHot: true },
        { num: '94', days: 5, isHot: true },
    ]

    return (
        <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex gap-6">
                {/* Main content */}
                <main className="flex-1 space-y-5 min-w-0">

                    {/* Breadcrumb */}
                    <nav className="text-sm text-gray-500">
                        <a href="/" className="hover:text-gray-700">Trang chủ</a>
                        <span className="mx-2 text-gray-300">›</span>
                        <span className="text-gray-800 font-medium">XSMN</span>
                    </nav>

                    {/* Header */}
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                Kết quả XSMN {isToday ? 'hôm nay' : 'gần nhất'}
                            </h1>
                            <p className="text-gray-500 text-sm mt-1 capitalize">{dateStr}</p>
                        </div>
                        {draws.length > 0 && (
                            <span className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full mt-1 bg-green-100 text-green-700">
                                ✓ Đã có kết quả
                            </span>
                        )}
                    </div>

                    {draws.length > 0 ? (
                        <>
                            {/* ── Giải ĐB tất cả đài ── */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {draws.map(draw => {
                                    const dbNumber = draw.results.find(r => r.prizeName === 'DB')?.numbers[0] ?? ''
                                    return (
                                        <div key={draw.id} className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-2xl p-5 text-center shadow-sm">
                                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
                                                {draw.province?.name ?? 'Đài'}
                                            </p>
                                            <p className="text-4xl font-black text-amber-700 tracking-widest my-2">
                                                {dbNumber || '—'}
                                            </p>
                                            {dbNumber && (
                                                <div className="flex justify-center gap-4 text-xs text-gray-500">
                                                    <span>Đầu: <strong className="text-amber-600">{dbNumber.slice(0, 2)}</strong></span>
                                                    <span>Đuôi: <strong className="text-emerald-600">{dbNumber.slice(-2)}</strong></span>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>

                            {/* ── Bảng kết quả từng đài ── */}
                            {draws.map(draw => {
                                const dbNumber = draw.results.find(r => r.prizeName === 'DB')?.numbers[0] ?? ''
                                return (
                                    <div key={draw.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                                        {/* Header đài */}
                                        <div className="bg-gray-50 px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                                            <div>
                                                <h2 className="font-semibold text-gray-800">{draw.province?.name ?? 'Đài'}</h2>
                                                <p className="text-xs text-gray-400 mt-0.5">
                                                    {formatDate(draw.drawDate, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                </p>
                                            </div>
                                            {dbNumber && (
                                                <span className="text-sm font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-lg border border-amber-200">
                                                    ĐB: {dbNumber}
                                                </span>
                                            )}
                                        </div>

                                        {/* Bảng giải */}
                                        <table className="w-full">
                                            <tbody>
                                                {draw.results
                                                    .filter(r => r.prizeName !== 'DB')
                                                    .map(result => (
                                                        <tr key={result.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                                                            <td className="py-3 px-5 text-sm font-medium text-gray-500 w-28 whitespace-nowrap">
                                                                {PRIZE_LABEL[result.prizeName] ?? result.prizeName}
                                                            </td>
                                                            <td className="py-3 px-5">
                                                                <div className="flex flex-wrap gap-2">
                                                                    {result.numbers.map((num, i) => (
                                                                        <span key={i} className="inline-block font-bold text-sm text-gray-800 bg-gray-100 hover:bg-amber-50 hover:text-amber-800 px-3 py-1.5 rounded-lg transition-colors cursor-default">
                                                                            {num}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                            </tbody>
                                        </table>

                                        {/* Bảng lô tô */}
                                        {draw.lotoResults && (
                                            <div className="border-t border-gray-100">
                                                <div className="bg-gray-50 px-5 py-2.5 border-b border-gray-100">
                                                    <h3 className="text-sm font-semibold text-gray-700">Bảng lô tô — {draw.province?.name}</h3>
                                                </div>
                                                <LotoTable lotoResults={draw.lotoResults} />
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </>
                    ) : (
                        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-10 text-center">
                            <div className="text-4xl mb-3">⏳</div>
                            <p className="font-semibold text-blue-800 text-lg">Kết quả hôm nay chưa có</p>
                            <p className="text-sm mt-2 text-blue-500">
                                XSMN quay lúc 16:30 — trang tự cập nhật sau khi có kết quả
                            </p>
                        </div>
                    )}

                    {/* ── Lịch sử 7 kỳ ── */}
                    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="bg-gray-50 px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="font-semibold text-gray-800">Lịch sử gần nhất</h2>
                            <a href="/xsmn/lich-su" className="text-xs text-amber-600 hover:text-amber-700 font-medium">
                                Xem thêm →
                            </a>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                                        <th className="px-5 py-2.5 text-left font-medium">Ngày</th>
                                        <th className="px-5 py-2.5 text-left font-medium">Đài</th>
                                        <th className="px-5 py-2.5 text-left font-medium">Giải đặc biệt</th>
                                        <th className="px-5 py-2.5 text-left font-medium">Đầu · Đuôi</th>
                                        <th className="px-5 py-2.5 text-left font-medium">Giải bảy</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map(h => {
                                        const db = h.results.find(r => r.prizeName === 'DB')
                                        const g7 = h.results.find(r => r.prizeName === 'G7')
                                        const dbNum = db?.numbers[0] ?? '—'
                                        const tail = dbNum !== '—' ? dbNum.slice(-2) : '—'
                                        const head = dbNum !== '—' ? dbNum.slice(0, 2) : '—'
                                        return (
                                            <tr key={h.id} className="border-t border-gray-50 hover:bg-amber-50/40 transition-colors">
                                                <td className="px-5 py-3 text-gray-600 whitespace-nowrap">
                                                    {formatDate(h.drawDate, { weekday: 'short', day: '2-digit', month: '2-digit' })}
                                                </td>
                                                <td className="px-5 py-3 text-gray-600 font-medium">
                                                    {h.province?.name ?? '—'}
                                                </td>
                                                <td className="px-5 py-3 font-bold text-amber-700 text-base tracking-wide">
                                                    {dbNum}
                                                </td>
                                                <td className="px-5 py-3">
                                                    <span className="font-semibold text-amber-600">{head}</span>
                                                    <span className="text-gray-300 mx-1.5">·</span>
                                                    <span className="font-semibold text-emerald-600">{tail}</span>
                                                </td>
                                                <td className="px-5 py-3 text-gray-500">{g7?.numbers.join(' · ') ?? '—'}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* JSON-Ld */}
                    {draws.length > 0 && (
                        <script
                            type="application/ld+json"
                            dangerouslySetInnerHTML={{
                                __html: JSON.stringify({
                                    '@context': 'https://schema.org',
                                    '@type': 'Event',
                                    name: `Kết quả XSMN ${dateStr}`,
                                    description: draws.map(d => `${d.province?.name}: ${d.results.find(r => r.prizeName === 'DB')?.numbers[0] ?? ''}`).join(', '),
                                    startDate: latestDate,
                                    location: { '@type': 'Place', name: 'Miền Nam, Việt Nam' },
                                    organizer: { '@type': 'Organization', name: 'Công ty XSKT Miền Nam' },
                                })
                            }}
                        />
                    )}
                </main>

                {/* Side Column */}
                <SideColumn
                    region="xsmn"
                    regionLabel="XSMN"
                    drawDate={latestDate}
                    dbNumbers={dbNumbers}
                    loganData={loganData}
                />
            </div>
        </div>
    )
}
