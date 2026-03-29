// src/app/(kqxs)/ket-qua/page.tsx
import { prisma } from '@/lib/prisma'
import type { Metadata } from 'next'
import Link from 'next/link'
import SideColumn from '@/components/SideColumn'

export const dynamic = 'force-dynamic'

const PRIZE_ORDER = ['DB', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7']
const PRIZE_LABEL: Record<string, string> = {
    DB: 'Đặc biệt', G1: 'Nhất', G2: 'Nhì', G3: 'Ba',
    G4: 'Tư', G5: 'Năm', G6: 'Sáu', G7: 'Bảy',
}

function formatDate(d: Date | string, opts?: Intl.DateTimeFormatOptions) {
    return new Date(d).toLocaleDateString('vi-VN', opts)
}

function formatDateForUrl(date: Date): string {
    const d = date.getDate().toString().padStart(2, '0')
    const m = (date.getMonth() + 1).toString().padStart(2, '0')
    const y = date.getFullYear()
    return `${d}-${m}-${y}`
}

// ── SEO ──────────────────────────────────────────────
export async function generateMetadata(): Promise<Metadata> {
    const today = formatDate(new Date(), { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
    return {
        title: `Kết quả xổ số hôm nay ${today} — Thiên Số`,
        description: `Tổng hợp kết quả XSMB, XSMN, XSMT hôm nay. Tra cứu nhanh và chính xác.`,
    }
}

// ── Fetch data ────────────────────────────────────────
async function getTodayResults() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // XSMB
    const xsmb = await prisma.draw.findFirst({
        where: {
            lotteryType: { code: 'XSMB' },
            drawDate: { gte: today, lt: tomorrow },
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
            drawDate: { gte: today, lt: tomorrow },
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
            drawDate: { gte: today, lt: tomorrow },
            isComplete: true,
        },
        include: {
            results: true,
            province: true,
        },
    })

    return { xsmb, xsmn, xsmt }
}

// ── Results Table ────────────────────────────────────
function ResultsTable({ results, regionLabel }: { results: Array<{ prizeName: string; numbers: string[] }>; regionLabel: string }) {
    const sorted = [...results].sort(
        (a, b) => PRIZE_ORDER.indexOf(a.prizeName) - PRIZE_ORDER.indexOf(b.prizeName)
    )

    return (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-gray-50 px-5 py-3 border-b border-gray-100">
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
export default async function KetQuaHomNayPage() {
    const { xsmb, xsmn, xsmt } = await getTodayResults()

    const today = new Date()
    const dateVN = formatDate(today, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
    const dateStr = formatDateForUrl(today)

    const xsmbDb = xsmb?.results.find(r => r.prizeName === 'DB')?.numbers[0] ?? null

    return (
        <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex gap-6">
                <main className="flex-1 space-y-6 min-w-0">

                    {/* Breadcrumb */}
                    <nav className="text-sm text-gray-500">
                        <Link href="/" className="hover:text-gray-700">Trang chủ</Link>
                        <span className="mx-2 text-gray-300">›</span>
                        <span className="text-gray-800 font-medium">Kết quả hôm nay</span>
                    </nav>

                    {/* Header */}
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                Kết quả xổ số hôm nay
                            </h1>
                            <p className="text-gray-500 text-sm mt-1 capitalize">{dateVN}</p>
                        </div>
                        {dateStr && (
                            <Link
                                href={`/ket-qua/${dateStr}`}
                                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-amber-300 hover:text-amber-700 transition-colors"
                            >
                                Xem chi tiết →
                            </Link>
                        )}
                    </div>

                    {/* XSMB */}
                    {xsmb ? (
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
                    ) : (
                        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center">
                            <p className="font-semibold text-blue-800">XSMB chưa có kết quả</p>
                            <p className="text-sm text-blue-500 mt-1">Kết quả thường có sau 18:15</p>
                        </div>
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
                            <p className="font-semibold text-gray-700 text-lg">Chưa có kết quả hôm nay</p>
                            <p className="text-sm mt-2 text-gray-400">Vui lòng quay lại sau khi có kết quả</p>
                        </div>
                    )}
                </main>

                {/* Side Column */}
                <SideColumn
                    region="xsmb"
                    regionLabel="XSMB"
                    drawDate={xsmb?.drawDate ?? today}
                    dbNumbers={xsmbDb ? [{ province: 'XSMB', number: xsmbDb }] : []}
                />
            </div>
        </div>
    )
}
