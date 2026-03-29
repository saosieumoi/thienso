// src/app/(kqxs)/xsmb/[date]/page.tsx
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
//   - dynamic = 'force-static': page được tạo ON-DEMAND khi có request đầu tiên
//   - revalidate = 2592000: cache trong 30 ngày
//   - Sau khi crawl xong → gọi revalidatePath('/xsmb/[date]') để cập nhật
//   - Googlebot sẽ trigger generation khi crawl → vẫn có SEO
export const dynamic = 'force-static'
export const revalidate = 2592000 // 30 days

const PRIZE_ORDER = ['DB', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7']
const PRIZE_LABEL: Record<string, string> = {
    DB: 'Giải đặc biệt', G1: 'Giải nhất', G2: 'Giải nhì', G3: 'Giải ba',
    G4: 'Giải tư', G5: 'Giải năm', G6: 'Giải sáu', G7: 'Giải bảy',
}

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

// ── SEO ──
export async function generateMetadata(
    { params }: { params: Promise<{ date: string }> }
): Promise<Metadata> {
    const { date } = await params
    const drawDate = parseDate(date)
    if (!drawDate) return { title: 'Không tìm thấy — Thiên Số' }

    const dateVN = formatDate(drawDate, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })

    const draw = await prisma.draw.findFirst({
        where: { lotteryType: { code: 'XSMB' }, drawDate, isComplete: true },
        include: { results: { where: { prizeName: 'DB' } } },
    })

    const db = draw?.results[0]?.numbers[0] ?? ''
    const dbText = db ? ` Giải ĐB: ${db}.` : ''

    return {
        title: `XSMB ${dateVN} — Kết quả xổ số Miền Bắc — Thiên Số`,
        description: `Kết quả XSMB ngày ${dateVN}.${dbText} Bảng kết quả đầy đủ, lô tô, dò vé nhanh.`,
        openGraph: {
            title: `KQXSMB ${dateVN}${db ? ` — ĐB: ${db}` : ''} — Thiên Số`,
            description: `Tra cứu kết quả xổ số Miền Bắc ngày ${dateVN}`,
        },
        alternates: {
            canonical: `https://thienso.com/xsmb/${date}`,
        },
    }
}

// ── Fetch data ──
async function getDrawByDate(dateStr: string) {
    const drawDate = parseDate(dateStr)!

    const draw = await prisma.draw.findFirst({
        where: { lotteryType: { code: 'XSMB' }, drawDate, isComplete: true },
        include: { results: true, lotoResults: true },
    })

    if (draw?.results) {
        draw.results.sort(
            (a, b) => PRIZE_ORDER.indexOf(a.prizeName) - PRIZE_ORDER.indexOf(b.prizeName)
        )
    }

    // CRITICAL: Do NOT use Promise.all — sequential queries only (connection_limit=1)
    const prev = await prisma.draw.findFirst({
        where: { lotteryType: { code: 'XSMB' }, drawDate: { lt: drawDate }, isComplete: true },
        orderBy: { drawDate: 'desc' },
        select: { drawDate: true },
    })
    const next = await prisma.draw.findFirst({
        where: { lotteryType: { code: 'XSMB' }, drawDate: { gt: drawDate }, isComplete: true },
        orderBy: { drawDate: 'asc' },
        select: { drawDate: true },
    })

    return {
        draw,
        prevDate: prev ? formatDateForUrl(prev.drawDate) : null,
        nextDate: next ? formatDateForUrl(next.drawDate) : null,
    }
}

// ── Page ──
export default async function XSMBDatePage(
    { params }: { params: Promise<{ date: string }> }
) {
    const { date } = await params

    if (!isValidDateFormat(date)) notFound()

    const { draw, prevDate, nextDate } = await getDrawByDate(date)
    const drawDate = parseDate(date)!
    const dateVN = formatDate(drawDate, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })

    const dbResult = draw?.results.find(r => r.prizeName === 'DB')
    const dbNumber = dbResult?.numbers[0] ?? ''

    // Side column data
    const dbNumbers = dbNumber ? [{ province: 'XSMB', number: dbNumber }] : []
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
                        <Link href="/" className="hover:text-gray-700">Trang chủ</Link>
                        <span className="mx-2 text-gray-300">›</span>
                        <Link href="/xsmb" className="hover:text-gray-700">XSMB</Link>
                        <span className="mx-2 text-gray-300">›</span>
                        <span className="text-gray-800 font-medium capitalize">{dateVN}</span>
                    </nav>

                    {/* Header + nav ngày */}
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                Kết quả XSMB ngày {date}
                            </h1>
                            <p className="text-gray-500 text-sm mt-1 capitalize">{dateVN}</p>
                        </div>
                        <div className="flex gap-2 shrink-0 mt-1">
                            {prevDate && (
                                <Link
                                    href={`/xsmb/${prevDate}`}
                                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-amber-300 hover:text-amber-700 transition-colors"
                                >
                                    ← {prevDate}
                                </Link>
                            )}
                            {nextDate && (
                                <Link
                                    href={`/xsmb/${nextDate}`}
                                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-amber-300 hover:text-amber-700 transition-colors"
                                >
                                    {nextDate} →
                                </Link>
                            )}
                        </div>
                    </div>

                    {draw ? (
                        <>
                            {/* Mã ký hiệu */}
                            {draw.specialCodes?.length > 0 && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                                        Mã ký hiệu trúng Đặc Biệt
                                    </p>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {draw.specialCodes.map(code => (
                                            <span key={code} className="text-sm font-bold bg-white text-amber-800 px-3 py-1 rounded-lg border border-amber-300 shadow-sm">
                                                {code}
                                            </span>
                                        ))}
                                        <span className="text-xs text-amber-600">
                                            Vé có số {dbNumber} + mã trùng → <strong>500 triệu</strong>
                                            &nbsp;·&nbsp; Không trùng → <strong>25 triệu</strong>
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Giải ĐB */}
                            {dbNumber && (
                                <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-2xl p-6 text-center shadow-sm">
                                    <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-3">Giải Đặc Biệt</p>
                                    <p className="text-6xl font-black text-amber-700 tracking-widest">{dbNumber}</p>
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

                            {/* Bảng kết quả */}
                            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                                <div className="bg-gray-50 px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                                    <h2 className="font-semibold text-gray-800">Bảng kết quả đầy đủ</h2>
                                    <span className="text-xs text-gray-400 capitalize">{dateVN}</span>
                                </div>
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
                            </div>

                            {/* Bảng lô tô */}
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
                                                        <th key={i} className="px-1 py-2.5 text-center text-gray-400 font-medium w-10">{i}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(h => {
                                                    const tails = (draw.lotoResults![`head${h}` as keyof typeof draw.lotoResults] as number[]) || []
                                                    return (
                                                        <tr key={h} className="border-t border-gray-50">
                                                            <td className="px-4 py-2 font-bold text-gray-400 text-sm">{h}x</td>
                                                            {Array.from({ length: 10 }, (_, t) => {
                                                                const hit = tails.includes(t)
                                                                return (
                                                                    <td key={t} className="px-1 py-1.5 text-center">
                                                                        <span className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-xs font-bold ${hit ? 'bg-amber-100 text-amber-800 border border-amber-200 shadow-sm' : 'text-gray-200 bg-gray-50'}`}>
                                                                            {String(h * 10 + t).padStart(2, '0')}
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
                        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-10 text-center">
                            <div className="text-4xl mb-3">📭</div>
                            <p className="font-semibold text-gray-700 text-lg">Không có dữ liệu cho ngày này</p>
                            <p className="text-sm mt-2 text-gray-400">Ngày {date} chưa có kết quả hoặc chưa được crawl</p>
                            <Link href="/xsmb" className="inline-block mt-4 text-sm text-amber-600 hover:text-amber-700 font-medium">
                                ← Xem kết quả mới nhất
                            </Link>
                        </div>
                    )}

                    {/* JSON-LD */}
                    {draw && dbNumber && (
                        <script
                            type="application/ld+json"
                            dangerouslySetInnerHTML={{
                                __html: JSON.stringify({
                                    '@context': 'https://schema.org',
                                    '@type': 'Event',
                                    name: `Kết quả XSMB ${dateVN}`,
                                    description: `Giải đặc biệt: ${dbNumber}`,
                                    startDate: drawDate.toISOString(),
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
                    drawDate={drawDate}
                    dbNumbers={dbNumbers}
                    loganData={loganData}
                />
            </div>
        </div>
    )
}
