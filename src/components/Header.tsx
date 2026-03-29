import Link from 'next/link'
import { prisma } from '@/lib/prisma'

// ── Fetch latest DB from each region for quick nav ──
async function getQuickStats() {
    const [xsmb, xsmn, xsmt, mega, power] = await Promise.all([
        prisma.draw.findFirst({
            where: { lotteryType: { code: 'XSMB' }, isComplete: true },
            orderBy: { drawDate: 'desc' },
            include: { results: { where: { prizeName: 'DB' } } },
        }),
        prisma.draw.findFirst({
            where: { lotteryType: { code: 'XSMN' }, isComplete: true },
            orderBy: { drawDate: 'desc' },
            include: { results: { where: { prizeName: 'DB' } }, province: true },
        }),
        prisma.draw.findFirst({
            where: { lotteryType: { code: 'XSMT' }, isComplete: true },
            orderBy: { drawDate: 'desc' },
            include: { results: { where: { prizeName: 'DB' } }, province: true },
        }),
        prisma.draw.findFirst({
            where: { lotteryType: { code: 'MEGA645' }, isComplete: true },
            orderBy: { drawDate: 'desc' },
            include: { results: { where: { prizeName: 'VL1' } } },
        }),
        prisma.draw.findFirst({
            where: { lotteryType: { code: 'POWER655' }, isComplete: true },
            orderBy: { drawDate: 'desc' },
            include: { results: { where: { prizeName: 'JP1' } } },
        }),
    ])

    return { xsmb, xsmn, xsmt, mega, power }
}

const NAV_ITEMS = [
    {
        label: 'Miền Bắc',
        href: '/xsmb',
        badge: 'XSMB',
        region: 'mb' as const,
    },
    {
        label: 'Miền Nam',
        href: '/xsmn',
        badge: 'XSMN',
        region: 'mn' as const,
    },
    {
        label: 'Miền Trung',
        href: '/xsmt',
        badge: 'XSMT',
        region: 'mt' as const,
    },
    {
        label: 'Vietlott',
        href: '/vietlott',
        badge: 'VL',
        region: 'vl' as const,
    },
]

export default async function Header() {
    const { xsmb, xsmn, xsmt, mega, power } = await getQuickStats()

    const xsmbDb = xsmb?.results[0]?.numbers[0] ?? null
    const megaResult = mega?.results[0]?.numbers ?? []
    const powerResult = power?.results[0]?.numbers ?? []

    return (
        <header className="bg-[#0B0E14] text-white sticky top-0 z-50 shadow-lg">
            {/* Top bar */}
            <div className="border-b border-white/10">
                <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">

                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-3 group">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C9A84C] to-[#E8C97A] flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                            <span className="text-[#0B0E14] font-black text-lg">T</span>
                        </div>
                        <div>
                            <span className="font-bold text-lg tracking-tight text-white">Thiên Số</span>
                            <p className="text-[10px] text-white/50 -mt-0.5">Dữ liệu rõ hơn, chọn số tốt hơn</p>
                        </div>
                    </Link>

                    {/* Desktop Nav */}
                    <nav className="hidden md:flex items-center gap-1">
                        {NAV_ITEMS.map(item => {
                            const isActive = false // TODO: implement active state based on pathname
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:bg-white/10 ${
                                        isActive ? 'bg-white/15 text-[#E8C97A]' : 'text-white/80 hover:text-white'
                                    }`}
                                >
                                    {item.label}
                                </Link>
                            )
                        })}
                    </nav>

                    {/* Right side: Login + CTA */}
                    <div className="hidden md:flex items-center gap-3">
                        <Link
                            href="/login"
                            className="px-4 py-2 text-sm font-medium text-white/80 hover:text-white transition-colors"
                        >
                            Đăng nhập
                        </Link>
                        <Link
                            href="/dang-ky"
                            className="px-4 py-2 text-sm font-bold bg-[#C9A84C] text-[#0B0E14] rounded-lg hover:bg-[#E8C97A] transition-colors"
                        >
                            Bắt đầu miễn phí
                        </Link>
                    </div>

                    {/* Mobile menu button */}
                    <button
                        className="md:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
                        aria-label="Menu"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Quick results bar */}
            <div className="bg-[#0B0E14]/95 backdrop-blur-sm border-t border-white/5">
                <div className="max-w-6xl mx-auto px-4 py-2.5">
                    <div className="flex items-center gap-4 overflow-x-auto text-xs scrollbar-hide">
                        {/* XSMB */}
                        <Link href="/xsmb" className="flex items-center gap-2 shrink-0 group">
                            <span className="px-2 py-0.5 rounded bg-[#C9A84C]/20 text-[#E8C97A] font-bold">XSMB</span>
                            {xsmbDb ? (
                                <span className="text-white/90 font-semibold tracking-wide group-hover:text-[#E8C97A] transition-colors">
                                    {xsmbDb}
                                </span>
                            ) : (
                                <span className="text-white/30 italic">—</span>
                            )}
                        </Link>

                        <span className="text-white/20">|</span>

                        {/* XSMN */}
                        <Link href="/xsmn" className="flex items-center gap-2 shrink-0 group">
                            <span className="px-2 py-0.5 rounded bg-[#2A6B5C]/30 text-[#3D9B82] font-bold">XSMN</span>
                            {xsmn ? (
                                <span className="text-white/90 font-semibold tracking-wide group-hover:text-[#3D9B82] transition-colors">
                                    {xsmn.province?.shortName ?? xsmn.province?.name}: {xsmn.results[0]?.numbers[0] ?? '—'}
                                </span>
                            ) : (
                                <span className="text-white/30 italic">—</span>
                            )}
                        </Link>

                        <span className="text-white/20">|</span>

                        {/* XSMT */}
                        <Link href="/xsmt" className="flex items-center gap-2 shrink-0 group">
                            <span className="px-2 py-0.5 rounded bg-[#2A6B5C]/30 text-[#3D9B82] font-bold">XSMT</span>
                            {xsmt ? (
                                <span className="text-white/90 font-semibold tracking-wide group-hover:text-[#3D9B82] transition-colors">
                                    {xsmt.province?.shortName ?? xsmt.province?.name}: {xsmt.results[0]?.numbers[0] ?? '—'}
                                </span>
                            ) : (
                                <span className="text-white/30 italic">—</span>
                            )}
                        </Link>

                        <span className="text-white/20">|</span>

                        {/* Vietlott */}
                        <Link href="/vietlott" className="flex items-center gap-3 shrink-0 group">
                            <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-bold text-[10px]">MEGA</span>
                                {megaResult.length > 0 && (
                                    <div className="flex gap-0.5">
                                        {megaResult.slice(0, 4).map((n, i) => (
                                            <span key={i} className="text-white/70 text-[10px]">{n}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold text-[10px]">POWER</span>
                                {powerResult.length > 0 && (
                                    <div className="flex gap-0.5">
                                        {powerResult.slice(0, 4).map((n, i) => (
                                            <span key={i} className="text-white/70 text-[10px]">{n}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </Link>
                    </div>
                </div>
            </div>
        </header>
    )
}
