// src/app/vietlott/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import SideColumn from '@/components/SideColumn'

// Prevent build-time pre-rendering to avoid DB connection pool exhaustion
export const dynamic = 'force-dynamic'
export const revalidate = 300

export const metadata: Metadata = {
    title: 'Kết quả Vietlott — Mega 6/45, Power 6/55, Max 3D, Keno — Thiên Số',
    description: 'Kết quả Vietlott mới nhất: Mega 6/45, Power 6/55, Max 3D, Max 3D Pro. Kỳ quay, jackpot, số lượng và giá trị giải thưởng.',
}

async function getLatestDraw(gameCode: string) {
    return prisma.draw.findFirst({
        where: { lotteryType: { code: gameCode }, isComplete: true },
        orderBy: { drawDate: 'desc' },
        include: {
            results: { orderBy: { prizeName: 'asc' } },
            vietlottPrizes: { orderBy: { id: 'asc' } },
        },
    })
}

type Draw = Awaited<ReturnType<typeof getLatestDraw>>

const GAME_CONFIG = {
    MEGA645: { name: 'Mega 6/45', icon: '🔴', slug: 'mega', color: 'text-red-700', border: 'border-red-200', bg: 'from-red-50 to-rose-50', badge: 'bg-red-100 text-red-700', ballCls: 'bg-white border-red-200 text-red-800', schedule: 'Thứ 4 · Thứ 6 · Chủ Nhật', type: 'ball' as const },
    POWER655: { name: 'Power 6/55', icon: '🔵', slug: 'power', color: 'text-blue-700', border: 'border-blue-200', bg: 'from-blue-50 to-indigo-50', badge: 'bg-blue-100 text-blue-700', ballCls: 'bg-white border-blue-200 text-blue-800', schedule: 'Thứ 3 · Thứ 5 · Thứ 7', type: 'power' as const },
    MAX3D: { name: 'Max 3D', icon: '🟢', slug: 'max3d', color: 'text-green-700', border: 'border-green-200', bg: 'from-green-50 to-emerald-50', badge: 'bg-green-100 text-green-700', ballCls: 'bg-white border-green-200 text-green-800', schedule: 'Thứ 2 · Thứ 4 · Thứ 6', type: 'max3d' as const },
    MAX3DPRO: { name: 'Max 3D Pro', icon: '🟣', slug: 'max3d-pro', color: 'text-purple-700', border: 'border-purple-200', bg: 'from-purple-50 to-violet-50', badge: 'bg-purple-100 text-purple-700', ballCls: 'bg-white border-purple-200 text-purple-800', schedule: 'Thứ 3 · Thứ 5 · Thứ 7', type: 'max3dpro' as const },
} as const

// Prize name map VL1..VL4 → tên giải
const VL_PRIZE_LABEL: Record<string, string> = {
    VL1: 'Đặc biệt', VL2: 'Giải nhất', VL3: 'Giải nhì', VL4: 'Giải ba', VL5: 'Giải khác',
}

function Ball({ num, cls, size = 'lg' }: { num: string | number; cls: string; size?: 'sm' | 'lg' }) {
    const sz = size === 'lg' ? 'w-12 h-12 text-base' : 'w-8 h-8 text-xs'
    return (
        <span className={`inline-flex items-center justify-center ${sz} rounded-full font-bold border-2 shadow-sm ${cls}`}>
            {String(num).padStart(2, '0')}
        </span>
    )
}

// ─── Hiển thị số theo giải cho Max 3D / Max 3D Pro ────
function Max3DResults({ draw, cfg }: {
    draw: NonNullable<Draw>
    cfg: typeof GAME_CONFIG[keyof typeof GAME_CONFIG]
}) {
    const prizeResults = draw.results.filter(r => r.prizeName.startsWith('VL'))

    if (prizeResults.length === 0) {
        const allNums = draw.results.flatMap(r => r.numbers)
        return (
            <div className="flex flex-wrap gap-2">
                {allNums.map((n, i) => (
                    <span key={i} className={`text-xl font-black tracking-widest ${cfg.color} bg-white rounded-xl px-3 py-1.5 border-2 ${cfg.border}`}>
                        {n}
                    </span>
                ))}
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {prizeResults.map(result => (
                <div key={result.id}>
                    <p className={`text-xs font-bold uppercase tracking-wider ${cfg.color} mb-1.5`}>
                        {VL_PRIZE_LABEL[result.prizeName] ?? result.prizeName}
                        <span className="text-gray-400 font-normal ml-1.5 normal-case tracking-normal">
                            ({result.numbers.length} bộ)
                        </span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {result.numbers.map((n, i) => (
                            <span key={i} className={`text-xl font-black tracking-widest ${cfg.color} bg-white rounded-xl px-3 py-1.5 border-2 ${cfg.border}`}>
                                {n}
                            </span>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}

// ─── Bảng giải thưởng ────────────────────────────────
function PrizeTable({ draw, cfg }: {
    draw: NonNullable<Draw>
    cfg: typeof GAME_CONFIG[keyof typeof GAME_CONFIG]
}) {
    if (!draw.vietlottPrizes || draw.vietlottPrizes.length === 0) return null

    const has3DPlus = draw.vietlottPrizes.some(p => p.name.startsWith('Max 3D+'))
    const main3D = has3DPlus ? draw.vietlottPrizes.filter(p => p.name.startsWith('Max 3D —')) : draw.vietlottPrizes
    const plus3D = has3DPlus ? draw.vietlottPrizes.filter(p => p.name.startsWith('Max 3D+')) : []

    const renderRows = (prizes: typeof draw.vietlottPrizes) => prizes.map((p, i) => {
        const isJackpot = p.name.toLowerCase().includes('jackpot') || p.name.includes('Đặc biệt')
        const displayName = p.name.replace(/^Max 3D[+ —]+/, '')
        return (
            <tr key={i} className={`border-t border-white/40 ${isJackpot ? 'font-semibold' : ''}`}>
                <td className={`px-4 py-2.5 ${isJackpot ? cfg.color : 'text-gray-700'}`}>
                    {isJackpot && <span className="mr-1.5">🏆</span>}{displayName}
                </td>
                <td className={`px-4 py-2.5 text-right tabular-nums ${p.winners > 0 ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                    {p.winners > 0 ? p.winners.toLocaleString('vi-VN') : '—'}
                </td>
                <td className="px-4 py-2.5 text-right text-gray-600 tabular-nums text-xs">{p.value}</td>
            </tr>
        )
    })

    const tableHeader = (
        <tr className="bg-white/30 text-xs text-gray-500">
            <th className="px-4 py-2 text-left font-medium">Giải</th>
            <th className="px-4 py-2 text-right font-medium">Số lượng</th>
            <th className="px-4 py-2 text-right font-medium">Giá trị</th>
        </tr>
    )

    return (
        <div className="border-t border-white/60">
            <div className="px-5 py-2.5 bg-white/40">
                <h3 className={`text-xs font-bold uppercase tracking-widest ${cfg.color}`}>Bảng giải thưởng</h3>
            </div>
            {has3DPlus ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-white/60">
                    <div>
                        <p className="px-4 pt-3 pb-1 text-xs font-bold text-green-600">Max 3D</p>
                        <table className="w-full text-sm">
                            <thead>{tableHeader}</thead>
                            <tbody>{renderRows(main3D)}</tbody>
                        </table>
                    </div>
                    <div>
                        <p className="px-4 pt-3 pb-1 text-xs font-bold text-emerald-600">Max 3D+</p>
                        <table className="w-full text-sm">
                            <thead>{tableHeader}</thead>
                            <tbody>{renderRows(plus3D)}</tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <table className="w-full text-sm">
                    <thead>{tableHeader}</thead>
                    <tbody>{renderRows(main3D)}</tbody>
                </table>
            )}
        </div>
    )
}

// ─── Game Card ────────────────────────────────────────
function GameCard({ gameCode, draw }: { gameCode: keyof typeof GAME_CONFIG; draw: Draw }) {
    const cfg = GAME_CONFIG[gameCode]
    const isMax = cfg.type === 'max3d' || cfg.type === 'max3dpro'
    const isPower = cfg.type === 'power'

    const mainResult = draw?.results.find(r => ['VL1', 'JP1'].includes(r.prizeName))
    const powerResult = draw?.results.find(r => r.prizeName === 'JP2')

    const drawDateStr = draw?.drawDate
        ? new Date(draw.drawDate).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
        : null

    const jackpotPrize = draw?.vietlottPrizes?.find(p =>
        p.name.toLowerCase().includes('jackpot 1') || p.name.toLowerCase() === 'jackpot'
    )

    return (
        <div className={`bg-gradient-to-br ${cfg.bg} border-2 ${cfg.border} rounded-2xl overflow-hidden shadow-sm`}>

            {/* Header */}
            <div className="px-5 py-4 flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{cfg.icon}</span>
                        <h2 className={`text-lg font-bold ${cfg.color}`}>{cfg.name}</h2>
                    </div>
                    <p className="text-xs text-gray-400">🗓 {cfg.schedule}</p>
                </div>
                <Link href={`/vietlott/${cfg.slug}`} className={`text-xs font-medium px-3 py-1.5 rounded-lg ${cfg.badge} hover:opacity-80 transition-opacity shrink-0 mt-1`}>
                    Lịch sử →
                </Link>
            </div>

            {draw ? (
                <>
                    {/* Kỳ + ngày */}
                    <div className="px-5 pb-3 flex flex-wrap items-center gap-2">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${cfg.border} ${cfg.badge}`}>
                            Kỳ #{draw.drawNumber ?? '—'}
                        </span>
                        <span className="text-xs text-gray-500 capitalize">{drawDateStr}</span>
                    </div>

                    {/* Jackpot */}
                    {jackpotPrize && (
                        <div className="px-5 pb-3">
                            <p className="text-xs text-gray-500 mb-0.5">
                                {jackpotPrize.name.includes('1') ? 'Jackpot 1' : 'Jackpot'}:
                            </p>
                            <p className={`text-xl font-black ${cfg.color}`}>{jackpotPrize.value}đ</p>
                            {jackpotPrize.winners > 0 && (
                                <p className="text-xs text-emerald-600 font-semibold mt-0.5">
                                    🎉 {jackpotPrize.winners} người trúng!
                                </p>
                            )}
                        </div>
                    )}

                    {/* Số kết quả */}
                    <div className="px-5 pb-5">
                        {isMax ? (
                            <Max3DResults draw={draw} cfg={cfg} />
                        ) : (
                            <div className="flex flex-wrap gap-2 items-center">
                                {mainResult?.numbers.map((n, i) => (
                                    <Ball key={i} num={n} cls={cfg.ballCls} size="lg" />
                                ))}
                                {isPower && powerResult?.numbers[0] && (
                                    <>
                                        <span className="text-gray-300 font-bold text-xl mx-1">+</span>
                                        <Ball num={powerResult.numbers[0]} cls="bg-amber-400 border-amber-500 text-white" size="lg" />
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    <PrizeTable draw={draw} cfg={cfg} />
                </>
            ) : (
                <div className="px-5 pb-6 text-center">
                    <p className="text-sm text-gray-400 italic">Chưa có kết quả — crawler chưa chạy</p>
                </div>
            )}
        </div>
    )
}

// ─── Page ─────────────────────────────────────────────
export default async function VietlottPage() {
    const [mega, power, max3d, max3dpro] = await Promise.all([
        getLatestDraw('MEGA645'),
        getLatestDraw('POWER655'),
        getLatestDraw('MAX3D'),
        getLatestDraw('MAX3DPRO'),
    ])

    // Side column data for Vietlott
    const megaJackpot = mega?.vietlottPrizes?.find(p => p.name.toLowerCase().includes('jackpot 1'))?.value ?? null
    const powerJackpot = power?.vietlottPrizes?.find(p => p.name.toLowerCase().includes('jackpot 1'))?.value ?? null

    return (
        <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex gap-6">
                {/* Main content */}
                <main className="flex-1 space-y-6 min-w-0">

                    <nav className="text-sm text-gray-500">
                        <Link href="/" className="hover:text-gray-700">Trang chủ</Link>
                        <span className="mx-2 text-gray-300">›</span>
                        <span className="text-gray-800 font-medium">Vietlott</span>
                    </nav>

                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Kết quả Vietlott</h1>
                        <p className="text-gray-500 text-sm mt-1">Mega 6/45 · Power 6/55 · Max 3D · Max 3D Pro — cập nhật sau mỗi kỳ quay</p>
                    </div>

                    <section className="space-y-3">
                        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Xổ số chọn số</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <GameCard gameCode="MEGA645" draw={mega} />
                            <GameCard gameCode="POWER655" draw={power} />
                        </div>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Xổ số 3 chữ số</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <GameCard gameCode="MAX3D" draw={max3d} />
                            <GameCard gameCode="MAX3DPRO" draw={max3dpro} />
                        </div>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Keno</h2>
                        <div className="bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-200 rounded-2xl p-5 flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span>🟠</span>
                                    <h2 className="font-bold text-orange-700">Keno</h2>
                                </div>
                                <p className="text-xs text-gray-400">🗓 Hàng ngày mỗi 10 phút</p>
                            </div>
                            <span className="text-sm text-gray-400 italic">Sắp ra mắt</span>
                        </div>
                    </section>

                    <script type="application/ld+json" dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            '@context': 'https://schema.org', '@type': 'WebPage',
                            name: 'Kết quả Vietlott — Thiên Số', url: 'https://thienso.com/vietlott',
                        })
                    }} />
                </main>

                {/* Side Column */}
                <SideColumn
                    region="vietlott"
                    regionLabel="Vietlott"
                    jackpotData={{
                        mega: megaJackpot,
                        power: powerJackpot
                    }}
                />
            </div>
        </div>
    )
}
