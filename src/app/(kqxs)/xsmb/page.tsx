// src/app/(kqxs)/xsmb/page.tsx
import { prisma } from '@/lib/prisma'
import type { Metadata } from 'next'
import SideColumn from '@/components/SideColumn'

export const revalidate = 60

// ── Helpers ───────────────────────────────────────────
const PRIZE_ORDER = ['DB', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7']
const PRIZE_LABEL: Record<string, string> = {
    DB: 'Giải đặc biệt',
    G1: 'Giải nhất',
    G2: 'Giải nhì',
    G3: 'Giải ba',
    G4: 'Giải tư',
    G5: 'Giải năm',
    G6: 'Giải sáu',
    G7: 'Giải bảy',
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
        title: `XSMB hôm nay ${dateStr} — Kết quả xổ số Miền Bắc — Thiên Số`,
        description: `Kết quả XSMB hôm nay ${dateStr}. Bảng kết quả đầy đủ, mã ký hiệu trúng thưởng, bảng lô tô. Cập nhật ngay sau 18:15.`,
        openGraph: {
            title: `KQXSMB hôm nay ${dateStr} — Thiên Số`,
            description: 'Kết quả xổ số Miền Bắc nhanh nhất, đầy đủ nhất',
        },
    }
}

// ── Fetch data ────────────────────────────────────────
async function getXSMBData() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [draw, history] = await Promise.all([
        prisma.draw.findFirst({
            where: {
                lotteryType: { code: 'XSMB' },
                drawDate: { gte: today },
            },
            orderBy: { drawDate: 'desc' },
            include: {
                results: true,
                lotoResults: true,
            },
        }),
        prisma.draw.findMany({
            where: {
                lotteryType: { code: 'XSMB' },
                isComplete: true,
            },
            orderBy: { drawDate: 'desc' },
            take: 7,
            include: {
                results: {
                    where: { prizeName: { in: ['DB', 'G1', 'G7'] } },
                },
            },
        }),
    ])

    // Sort giải đúng thứ tự ĐB → G7
    if (draw?.results) {
        draw.results.sort(
            (a, b) => PRIZE_ORDER.indexOf(a.prizeName) - PRIZE_ORDER.indexOf(b.prizeName)
        )
    }

    return { draw, history }
}

// ── Page ─────────────────────────────────────────────
export default async function XSMBPage() {
    const { draw, history } = await getXSMBData()

    const dateStr = formatDate(new Date(), {
        weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
    })

    const dbResult = draw?.results.find(r => r.prizeName === 'DB')
    const dbNumber = dbResult?.numbers[0] ?? ''

    // Side column data
    const dbNumbers = dbNumber ? [{ province: 'XSMB', number: dbNumber }] : []
    // Mock lô gan data (in real app, this would come from StatCache)
    const loganData = [
        { num: '72', days: 38, isHot: false },
        { num: '13', days: 32, isHot: false },
        { num: '89', days: 28, isHot: false },
        { num: '04', days: 24, isHot: false },
        { num: '61', days: 21, isHot: false },
        { num: '67', days: 18, isHot: false },
        { num: '36', days: 4, isHot: true },
        { num: '25', days: 3, isHot: true },
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
                        <span className="text-gray-800 font-medium">XSMB</span>
                    </nav>

                    {/* Header */}
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                Kết quả XSMB hôm nay
                            </h1>
                            <p className="text-gray-500 text-sm mt-1 capitalize">{dateStr}</p>
                        </div>
                        {draw && (
                            <span className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full mt-1 ${draw.isComplete
                                ? 'bg-green-100 text-green-700'
                                : 'bg-blue-100 text-blue-700 animate-pulse'
                                }`}>
                                {draw.isComplete ? '✓ Đã có kết quả' : '⦿ Đang quay...'}
                            </span>
                        )}
                    </div>

                    {draw ? (
                        <>
                            {/* ── Mã ký hiệu đặc biệt ── */}
                            <div className={`rounded-xl border p-4 ${draw.specialCodes?.length > 0
                                ? 'bg-amber-50 border-amber-200'
                                : 'bg-gray-50 border-gray-200'
                                }`}>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                                    Mã ký hiệu trúng Đặc Biệt
                                </p>
                                {draw.specialCodes?.length > 0 ? (
                                    <div className="flex flex-wrap items-center gap-2">
                                        {draw.specialCodes.map(code => (
                                            <span
                                                key={code}
                                                className="text-sm font-bold bg-white text-amber-800 px-3 py-1 rounded-lg border border-amber-300 shadow-sm"
                                            >
                                                {code}
                                            </span>
                                        ))}
                                        <span className="text-xs text-amber-600 mt-0.5">
                                            Vé có số {dbNumber} + mã trùng → <strong>500 triệu</strong>
                                            &nbsp;·&nbsp; Không trùng mã → <strong>25 triệu</strong>
                                        </span>
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-400 italic">
                                        Chưa có dữ liệu mã ký hiệu cho kỳ này
                                    </p>
                                )}
                            </div>

                            {/* ── Giải đặc biệt nổi bật ── */}
                            {dbNumber && (
                                <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-2xl p-6 text-center shadow-sm">
                                    <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-3">
                                        Giải Đặc Biệt
                                    </p>
                                    <p className="text-6xl font-black text-amber-700 tracking-widest">
                                        {dbNumber}
                                    </p>
                                    <div className="flex justify-center gap-8 mt-4 text-sm">
                                        <div className="text-center">
                                            <span className="block text-xs text-gray-400 mb-1">Đầu số</span>
                                            <span className="text-xl font-bold text-amber-600">{dbNumber.slice(0, 2)}</span>
                                        </div>
                                        <div className="w-px bg-amber-200" />
                                        <div className="text-center">
                                            <span className="block text-xs text-gray-400 mb-1">Đuôi số</span>
                                            <span className="text-xl font-bold text-emerald-600">{dbNumber.slice(-2)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── Bảng kết quả đầy đủ ── */}
                            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                                <div className="bg-gray-50 px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                                    <h2 className="font-semibold text-gray-800">Bảng kết quả đầy đủ</h2>
                                    <span className="text-xs text-gray-400">
                                        {formatDate(draw.drawDate, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                    </span>
                                </div>
                                <table className="w-full">
                                    <tbody>
                                        {draw.results
                                            .filter(r => r.prizeName !== 'DB')
                                            .map(result => (
                                                <tr
                                                    key={result.id}
                                                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50"
                                                >
                                                    <td className="py-3 px-5 text-sm font-medium text-gray-500 w-28 whitespace-nowrap">
                                                        {PRIZE_LABEL[result.prizeName] ?? result.prizeName}
                                                    </td>
                                                    <td className="py-3 px-5">
                                                        <div className="flex flex-wrap gap-2">
                                                            {result.numbers.map((num, i) => (
                                                                <span
                                                                    key={i}
                                                                    className="inline-block font-bold text-sm text-gray-800 bg-gray-100 hover:bg-amber-50 hover:text-amber-800 px-3 py-1.5 rounded-lg transition-colors cursor-default"
                                                                >
                                                                    {num}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* ── Bảng lô tô ── */}
                            {draw.lotoResults && (
                                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                                    <div className="bg-gray-50 px-5 py-3 border-b border-gray-100">
                                        <h2 className="font-semibold text-gray-800">Bảng lô tô XSMB</h2>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-gray-50 border-b border-gray-100">
                                                    <th className="px-4 py-2.5 text-left text-gray-400 font-medium w-14">Đầu</th>
                                                    {Array.from({ length: 10 }, (_, i) => (
                                                        <th key={i} className="px-1 py-2.5 text-center text-gray-400 font-medium w-10">
                                                            {i}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(head => {
                                                    type HeadKey =
                                                        | 'head0' | 'head1' | 'head2' | 'head3' | 'head4'
                                                        | 'head5' | 'head6' | 'head7' | 'head8' | 'head9'

                                                    const key = `head${head}` as HeadKey
                                                    const tails = draw.lotoResults?.[key] ?? []

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
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-10 text-center">
                            <div className="text-4xl mb-3">⏳</div>
                            <p className="font-semibold text-blue-800 text-lg">Kết quả hôm nay chưa có</p>
                            <p className="text-sm mt-2 text-blue-500">
                                XSMB quay lúc 18:15 — trang tự cập nhật sau khi có kết quả
                            </p>
                        </div>
                    )}

                    {/* ── Lịch sử 7 kỳ ── */}
                    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="bg-gray-50 px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="font-semibold text-gray-800">Lịch sử 7 kỳ gần nhất</h2>
                            <a href="/xsmb/lich-su" className="text-xs text-amber-600 hover:text-amber-700 font-medium">
                                Xem thêm →
                            </a>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                                        <th className="px-5 py-2.5 text-left font-medium">Ngày</th>
                                        <th className="px-5 py-2.5 text-left font-medium">Giải đặc biệt</th>
                                        <th className="px-5 py-2.5 text-left font-medium">Đầu · Đuôi</th>
                                        <th className="px-5 py-2.5 text-left font-medium">Giải nhất</th>
                                        <th className="px-5 py-2.5 text-left font-medium">Giải bảy</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map(h => {
                                        const db = h.results.find(r => r.prizeName === 'DB')
                                        const g1 = h.results.find(r => r.prizeName === 'G1')
                                        const g7 = h.results.find(r => r.prizeName === 'G7')
                                        const dbNum = db?.numbers[0] ?? '—'
                                        const tail = dbNum !== '—' ? dbNum.slice(-2) : '—'
                                        const head = dbNum !== '—' ? dbNum.slice(0, 2) : '—'
                                        return (
                                            <tr key={h.id} className="border-t border-gray-50 hover:bg-amber-50/40 transition-colors">
                                                <td className="px-5 py-3 text-gray-600 whitespace-nowrap">
                                                    {formatDate(h.drawDate, { weekday: 'short', day: '2-digit', month: '2-digit' })}
                                                </td>
                                                <td className="px-5 py-3 font-bold text-amber-700 text-base tracking-wide">
                                                    {dbNum}
                                                </td>
                                                <td className="px-5 py-3">
                                                    <span className="font-semibold text-amber-600">{head}</span>
                                                    <span className="text-gray-300 mx-1.5">·</span>
                                                    <span className="font-semibold text-emerald-600">{tail}</span>
                                                </td>
                                                <td className="px-5 py-3 text-gray-600 font-medium">{g1?.numbers[0] ?? '—'}</td>
                                                <td className="px-5 py-3 text-gray-500">{g7?.numbers.join(' · ') ?? '—'}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* JSON-Ld */}
                    {draw && dbNumber && (
                        <script
                            type="application/ld+json"
                            dangerouslySetInnerHTML={{
                                __html: JSON.stringify({
                                    '@context': 'https://schema.org',
                                    '@type': 'Event',
                                    name: `Kết quả XSMB ${dateStr}`,
                                    description: `Giải đặc biệt: ${dbNumber}`,
                                    startDate: draw.drawDate,
                                    location: { '@type': 'Place', name: 'Hà Nội, Việt Nam' },
                                    organizer: { '@type': 'Organization', name: 'Công ty TNHH MTV XSKT Miền Bắc' },
                                })
                            }}
                        />
                    )}
                </main>

                {/* Side Column */}
                <SideColumn
                    region="xsmb"
                    regionLabel="XSMB"
                    drawDate={draw?.drawDate}
                    dbNumbers={dbNumbers}
                    loganData={loganData}
                />
            </div>
        </div>
    )
}
