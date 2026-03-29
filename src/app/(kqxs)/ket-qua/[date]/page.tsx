// src/app/(kqxs)/ket-qua/[date]/page.tsx
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import SideColumn from '@/components/SideColumn'

// On-demand rendering — pages are generated on first request and cached via ISR
export const dynamic = 'force-dynamic'

const PRIZE_ORDER = ['DB', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7']
const PRIZE_LABEL: Record<string, string> = {
    DB: 'Đặc biệt', G1: 'Nhất', G2: 'Nhì', G3: 'Ba',
    G4: 'Tư', G5: 'Năm', G6: 'Sáu', G7: 'Bảy',
}

function formatDate(d: Date | string, opts?: Intl.DateTimeFormatOptions) {
    return new Date(d).toLocaleDateString('vi-VN', opts)
}

function parseDate(dateStr: string): Date | null {
    const match = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/)
    if (!match) return null
    const [, d, m, y] = match.map(Number)
    const date = new Date(Date.UTC(y, m - 1, d))
    if (isNaN(date.getTime())) return null
    return date
}

function formatDateForUrl(date: Date): string {
    const d = date.getDate().toString().padStart(2, '0')
    const m = (date.getMonth() + 1).toString().padStart(2, '0')
    const y = date.getFullYear()
    return `${d}-${m}-${y}`
}

function isValidDateFormat(dateStr: string): boolean {
    return /^\d{2}-\d{2}-\d{4}$/.test(dateStr) && parseDate(dateStr) !== null
}

// ── SEO ──────────────────────────────────────────────
export async function generateMetadata(
    { params }: { params: Promise<{ date: string }> }
): Promise<Metadata> {
    const { date } = await params
    const drawDate = parseDate(date)
    if (!drawDate) return { title: 'Không tìm thấy — Thiên Số' }

    const dateVN = formatDate(drawDate, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })

    return {
        title: `Kết quả xổ số ngày ${date} — Thiên Số`,
        description: `Tổng hợp kết quả XSMB, XSMN, XSMT ngày ${dateVN}. Tra cứu nhanh và chính xác.`,
    }
}

// ── Fetch data for all regions on a specific date ──
async function getResultsByDate(dateStr: string) {
    const drawDate = parseDate(dateStr)!
    const nextDay = new Date(drawDate)
    nextDay.setDate(nextDay.getDate() + 1)

    // XSMB
    const xsmb = await prisma.draw.findFirst({
        where: {
            lotteryType: { code: 'XSMB' },
            drawDate: { gte: drawDate, lt: nextDay },
            isComplete: true,
        },
        include: {
            results: true,
            lotoResults: true,
        },
    })

    // XSMN
    const xsmn = await prisma.draw.findMany({
        where: {
            lotteryType: { code: 'XSMN' },
            drawDate: { gte: drawDate, lt: nextDay },
            isComplete: true,
        },
        include: {
            results: true,
            province: true,
        },
    })

    // XSMT
    const xsmt = await prisma.draw.findMany({
        where: {
            lotteryType: { code: 'XSMT' },
            drawDate: { gte: drawDate, lt: nextDay },
            isComplete: true,
        },
        include: {
            results: true,
            province: true,
        },
    })

    // Navigation
    const prev = await prisma.draw.findFirst({
        where: { drawDate: { lt: drawDate }, isComplete: true },
        orderBy: { drawDate: 'desc' },
        select: { drawDate: true },
    })
    const next = await prisma.draw.findFirst({
        where: { drawDate: { gt: drawDate }, isComplete: true },
        orderBy: { drawDate: 'asc' },
        select: { drawDate: true },
    })

    return {
        xsmb,
        xsmn,
        xsmt,
        prevDate: prev ? formatDateForUrl(prev.drawDate) : null,
        nextDate: next ? formatDateForUrl(next.drawDate) : null,
    }
}

// ── Results Table Component ─────────────────────────
function ResultsTable({ results, regionLabel }: { results: Array<{ prizeName: string; numbers: string[] }>; regionLabel: string }) {
    const sorted = [...results].sort(
        (a, b) => PRIZE_ORDER.indexOf(a.prizeName) - PRIZE_ORDER.indexOf(b.prizeName)
    )

    return (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-gray-50 px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">{regionLabel}</h3>
            </div>
            <table className="w-full">
                <tbody>
                    {sorted.map(result => (
                        <tr key={result.prizeName} className="border-b border-gray-50 last:border-0">
                            <td className="py-3 px-5 text-sm font-medium text-gray-500 w-28 whitespace-nowrap">
                                {PRIZE_LABEL[result.prizeName] ?? result.prizeName}
                            </td>
                            <td className="py-3 px-5">
                                <div className="flex flex-wrap gap-2">
                                    {result.numbers.map((num, i) => (
                                        <span key={i} className="inline-block font-bold text-sm text-gray-800 bg-gray-100 px-3 py-1.5 rounded-lg">
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
    )
}

// ── Province Card ────────────────────────────────────
function ProvinceCard({ province, results }: { province: { name: string; shortName?: string | null }; results: Array<{ prizeName: string; numbers: string[] }> }) {
    const db = results.find(r => r.prizeName === 'DB')
    const sorted = [...results].sort(
        (a, b) => PRIZE_ORDER.indexOf(a.prizeName) - PRIZE_ORDER.indexOf(b.prizeName)
    )

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <h4 className="font-bold text-gray-800 mb-3">{province.shortName ?? province.name}</h4>
            {db && (
                <div className="text-center bg-amber-50 rounded-lg py-2 mb-2">
                    <p className="text-xs text-gray-500">ĐB</p>
                    <p className="text-xl font-black text-amber-700">{db.numbers[0]}</p>
                </div>
            )}
            <div className="space-y-1">
                {sorted.filter(r => r.prizeName !== 'DB').slice(0, 3).map(result => (
                    <div key={result.prizeName} className="flex justify-between text-xs">
                        <span className="text-gray-400">{PRIZE_LABEL[result.prizeName] ?? result.prizeName}</span>
                        <span className="font-semibold text-gray-700">{result.numbers.join(', ')}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ── Page ────────────────────────────────────────────
export default async function KetQuaPage(
    { params }: { params: Promise<{ date: string }> }
) {
    const { date } = await params

    if (!isValidDateFormat(date)) notFound()

    const { xsmb, xsmn, xsmt, prevDate, nextDate } = await getResultsByDate(date)
    const drawDate = parseDate(date)!
    const dateVN = formatDate(drawDate, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })

    const xsmbDb = xsmb?.results.find(r => r.prizeName === 'DB')?.numbers[0] ?? null

    return (
        <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex gap-6">
                <main className="flex-1 space-y-6 min-w-0">

                    {/* Breadcrumb */}
                    <nav className="text-sm text-gray-500">
                        <Link href="/" className="hover:text-gray-700">Trang chủ</Link>
                        <span className="mx-2 text-gray-300">›</span>
                        <span className="text-gray-800 font-medium capitalize">Kết quả ngày {dateVN}</span>
                    </nav>

                    {/* Header */}
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                Kết quả xổ số ngày {date}
                            </h1>
                            <p className="text-gray-500 text-sm mt-1 capitalize">{dateVN}</p>
                        </div>
                        <div className="flex gap-2 shrink-0 mt-1">
                            {prevDate && (
                                <Link
                                    href={`/ket-qua/${prevDate}`}
                                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-amber-300 hover:text-amber-700 transition-colors"
                                >
                                    ← {prevDate}
                                </Link>
                            )}
                            {nextDate && (
                                <Link
                                    href={`/ket-qua/${nextDate}`}
                                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-amber-300 hover:text-amber-700 transition-colors"
                                >
                                    {nextDate} →
                                </Link>
                            )}
                        </div>
                    </div>

                    {/* XSMB */}
                    {xsmb && (
                        <section>
                            <div className="flex items-center gap-2 mb-3">
                                <h2 className="text-lg font-bold text-[#C9A84C]">XSMB — Miền Bắc</h2>
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Hà Nội</span>
                            </div>
                            {xsmbDb && (
                                <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-2xl p-4 text-center mb-4">
                                    <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1">Giải Đặc Biệt</p>
                                    <p className="text-5xl font-black text-amber-700 tracking-widest">{xsmbDb}</p>
                                </div>
                            )}
                            <ResultsTable results={xsmb.results} regionLabel="Bảng kết quả XSMB" />
                        </section>
                    )}

                    {/* XSMN */}
                    {xsmn.length > 0 && (
                        <section>
                            <h2 className="text-lg font-bold text-[#2A6B5C] mb-3">XSMN — Miền Nam</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {xsmn.map(draw => (
                                    <ProvinceCard
                                        key={draw.id}
                                        province={draw.province!}
                                        results={draw.results}
                                    />
                                ))}
                            </div>
                        </section>
                    )}

                    {/* XSMT */}
                    {xsmt.length > 0 && (
                        <section>
                            <h2 className="text-lg font-bold text-[#2A6B5C] mb-3">XSMT — Miền Trung</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {xsmt.map(draw => (
                                    <ProvinceCard
                                        key={draw.id}
                                        province={draw.province!}
                                        results={draw.results}
                                    />
                                ))}
                            </div>
                        </section>
                    )}

                    {/* No data */}
                    {!xsmb && xsmn.length === 0 && xsmt.length === 0 && (
                        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-10 text-center">
                            <p className="font-semibold text-gray-700 text-lg">Không có dữ liệu cho ngày này</p>
                            <p className="text-sm mt-2 text-gray-400">Ngày {date} chưa có kết quả hoặc chưa được cập nhật</p>
                        </div>
                    )}
                </main>

                {/* Side Column */}
                <SideColumn
                    region="xsmb"
                    regionLabel="XSMB"
                    drawDate={drawDate}
                    dbNumbers={xsmbDb ? [{ province: 'XSMB', number: xsmbDb }] : []}
                />
            </div>
        </div>
    )
}
