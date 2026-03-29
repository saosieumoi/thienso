'use client'

import Link from 'next/link'
import { useState } from 'react'

type Region = 'home' | 'xsmb' | 'xsmn' | 'xsmt' | 'vietlott'

interface SideColumnProps {
    region: Region
    regionLabel: string
    drawDate?: Date | null
    dbNumbers?: Array<{ province: string; number: string }>
    loganData?: Array<{ num: string; days: number; isHot?: boolean }>
    jackpotData?: { mega: string | null; power: string | null }
}

// Region-specific config
const REGION_CONFIG: Record<Region, {
    title: string
    accentColor: string
    badgeColor: string
    aiHeadline: string
    quickLinks: Array<{ href: string; label: string }>
}> = {
    home: {
        title: 'Tổng hợp',
        accentColor: 'text-[#C9A84C]',
        badgeColor: 'bg-[#C9A84C]/20 text-[#C9A84C]',
        aiHeadline: 'Tổng hợp hôm nay',
        quickLinks: [
            { href: '/xsmb', label: 'XSMB' },
            { href: '/xsmn', label: 'XSMN' },
            { href: '/xsmt', label: 'XSMT' },
            { href: '/vietlott', label: 'Vietlott' },
        ],
    },
    xsmb: {
        title: 'Miền Bắc',
        accentColor: 'text-[#C9A84C]',
        badgeColor: 'bg-[#C9A84C]/20 text-[#C9A84C]',
        aiHeadline: 'XSMB hôm nay',
        quickLinks: [
            { href: '/xsmb', label: 'Kết quả MB' },
            { href: '/xsmb/lich-su', label: 'Lịch sử' },
        ],
    },
    xsmn: {
        title: 'Miền Nam',
        accentColor: 'text-[#2A6B5C]',
        badgeColor: 'bg-[#2A6B5C]/20 text-[#2A6B5C]',
        aiHeadline: 'XSMN hôm nay',
        quickLinks: [
            { href: '/xsmn', label: 'Kết quả MN' },
            { href: '/xsmn/lich-su', label: 'Lịch sử' },
        ],
    },
    xsmt: {
        title: 'Miền Trung',
        accentColor: 'text-[#2A6B5C]',
        badgeColor: 'bg-[#2A6B5C]/20 text-[#2A6B5C]',
        aiHeadline: 'XSMT hôm nay',
        quickLinks: [
            { href: '/xsmt', label: 'Kết quả MT' },
            { href: '/xsmt/lich-su', label: 'Lịch sử' },
        ],
    },
    vietlott: {
        title: 'Vietlott',
        accentColor: 'text-red-600',
        badgeColor: 'bg-red-500/20 text-red-600',
        aiHeadline: 'Vietlott hôm nay',
        quickLinks: [
            { href: '/vietlott', label: 'Mega 6/45' },
            { href: '/vietlott', label: 'Power 6/55' },
            { href: '/vietlott', label: 'Max 3D' },
        ],
    },
}

function formatDateDisplay(d: Date): string {
    const day = d.getDate().toString().padStart(2, '0')
    const month = (d.getMonth() + 1).toString().padStart(2, '0')
    return `${day}/${month}`
}

function formatDateForUrl(d: Date): string {
    const year = d.getFullYear()
    const month = (d.getMonth() + 1).toString().padStart(2, '0')
    const day = d.getDate().toString().padStart(2, '0')
    return `${day}-${month}-${year}`
}

function getDayName(d: Date): string {
    const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
    return days[d.getDay()]
}

export default function SideColumn({
    region,
    regionLabel,
    drawDate,
    dbNumbers = [],
    loganData = [],
    jackpotData,
}: SideColumnProps) {
    const [doveInput, setDoveInput] = useState('')
    const [doveResult, setDoveResult] = useState<{ hit: boolean; message: string } | null>(null)
    const [aiInput, setAiInput] = useState('')
    const [aiResult, setAiResult] = useState<string | null>(null)

    const config = REGION_CONFIG[region]

    // Generate last 7 days for date picker
    const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - i)
        return d
    })

    const handleDove = () => {
        const query = doveInput.trim().replace(/\D/g, '')
        if (!query || query.length < 2) {
            setDoveResult({ hit: false, message: 'Vui lòng nhập ít nhất 2 chữ số.' })
            return
        }
        const hits = dbNumbers.filter(d => d.number.endsWith(query))
        if (hits.length > 0) {
            setDoveResult({
                hit: true,
                message: `🎉 Trúng! Số "${query}" khớp với: ${hits.map(h => `${h.province} (${h.number})`).join(', ')}`
            })
        } else {
            setDoveResult({
                hit: false,
                message: `😔 Số "${query}" không khớp với giải nào hôm nay.`
            })
        }
    }

    const handleAiAsk = () => {
        const q = aiInput.toLowerCase()

        // Dynamic AI responses based on region and query
        if (region === 'vietlott') {
            if (q.includes('mega') || q.includes('6/45')) {
                setAiResult('Mega 6/45 quay vào Thứ 6, CN. Tỷ lệ trúng Jackpot là 1/8.1 triệu.')
            } else if (q.includes('power') || q.includes('6/55')) {
                setAiResult('Power 6/55 quay vào T3, T5, T7. Jackpot tích lũy nhanh chóng.')
            } else if (q.includes('jackpot')) {
                setAiResult(`Mega: ${jackpotData?.mega || '—'}đ | Power: ${jackpotData?.power || '—'}đ`)
            } else {
                setAiResult('Hỏi về Mega, Power, hoặc jackpot để được giải đáp.')
            }
        } else {
            // Traditional lottery
            if (q.includes('đặc biệt') || q.includes('db')) {
                setAiResult(`ĐB hôm nay: ${dbNumbers[0]?.number || '—'}. Đầu ${dbNumbers[0]?.number.slice(0, 2) || '—'}, đuôi ${dbNumbers[0]?.number.slice(-2) || '—'}.`)
            } else if (q.includes('72')) {
                setAiResult('Số 72 đã gan 38 kỳ — thuộc nhóm gan dài nhất. Thường hồi phục 5-12 kỳ tiếp theo.')
            } else if (q.includes('36')) {
                setAiResult('Số 36 về 4 lần/10 kỳ gần đây — đang trong chu kỳ nóng.')
            } else if (q.includes('gan')) {
                setAiResult(`Số gan dài nhất hiện tại: ${loganData[0]?.num || '—'} (${loganData[0]?.days || 0} kỳ).`)
            } else {
                setAiResult('Hỏi về đặc biệt, lô gan, hoặc số nóng để được giải đáp.')
            }
        }
    }

    const maxLoganDays = loganData.length > 0 ? Math.max(...loganData.map(l => l.days)) : 1

    // Get date picker base path
    const getDatePath = (index: number, d: Date): string => {
        const dateStr = formatDateForUrl(d)

        // For "today", go to the region's main page (not /?date=today)
        if (index === 0) {
            if (region === 'home') return '/'
            if (region === 'vietlott') return '/vietlott'
            return `/${region}`
        }

        // For specific dates
        if (region === 'home') {
            return `/?date=${dateStr}`
        }
        // Vietlott doesn't have date-specific pages yet, go to main page
        if (region === 'vietlott') {
            return '/vietlott'
        }
        return `/${region}/${dateStr}`
    }

    return (
        <aside className="w-80 shrink-0 space-y-4">

            {/* Date Picker Mini */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                        {config.title} — Chọn ngày
                    </p>
                </div>
                <div className="p-3">
                    <div className="grid grid-cols-7 gap-1">
                        {days.map((d, i) => {
                            const isToday = i === 0
                            const isActive = drawDate && d.toDateString() === drawDate.toDateString()
                            return (
                                <Link
                                    key={i}
                                    href={getDatePath(i, d)}
                                    className={`flex flex-col items-center py-2 rounded-lg text-xs transition-colors ${
                                        isActive
                                            ? 'bg-[#C9A84C] text-white font-bold'
                                            : isToday
                                                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                                : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                                >
                                    <span className="text-[10px] opacity-70">{getDayName(d)}</span>
                                    <span className="font-semibold">{formatDateDisplay(d)}</span>
                                </Link>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* AI Insight Card */}
            <div className="bg-gradient-to-br from-[#0B0E14] to-[#1a2030] rounded-xl overflow-hidden shadow-lg">
                <div className="px-4 py-3 border-b border-white/10">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded ${config.badgeColor} text-[10px] font-bold`}>
                            AI Thiên Số
                        </span>
                    </div>
                    <p className="text-sm font-semibold text-white">
                        {config.aiHeadline}
                    </p>
                </div>
                <div className="p-4 text-white/80 text-sm leading-relaxed">
                    {dbNumbers.length > 0 ? (
                        <>
                            {region === 'vietlott' ? (
                                <>
                                    {jackpotData?.mega && (
                                        <p>Mega Jackpot: <strong className="text-[#E8C97A]">{jackpotData.mega}đ</strong></p>
                                    )}
                                    {jackpotData?.power && (
                                        <p className="mt-1">Power Jackpot: <strong className="text-[#E8C97A]">{jackpotData.power}đ</strong></p>
                                    )}
                                    {dbNumbers[0]?.number && (
                                        <p className="mt-2">Kết quả mới nhất: <strong className="text-[#E8C97A]">{dbNumbers[0].number}</strong></p>
                                    )}
                                </>
                            ) : (
                                <>
                                    Đặc biệt: <strong className="text-[#E8C97A]">{dbNumbers[0].number}</strong>
                                    {dbNumbers[0].number.length >= 5 && (
                                        <>
                                            {' '}— đầu <strong className="text-[#E8C97A]">{dbNumbers[0].number.slice(0, 2)}</strong>,
                                            đuôi <strong className="text-emerald-400">{dbNumbers[0].number.slice(-2)}</strong>.
                                        </>
                                    )}
                                </>
                            )}
                            <br /><br />
                            {loganData[0] ? (
                                <p>Số gan dài nhất: <strong>{loganData[0].num}</strong> ({loganData[0].days} kỳ chưa về)</p>
                            ) : (
                                <p>Chưa có dữ liệu lô gan.</p>
                            )}
                        </>
                    ) : (
                        <p>Chưa có dữ liệu. Hãy quay lại sau khi có kết quả.</p>
                    )}
                </div>
                <div className="px-4 pb-4">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder='Hỏi về kết quả, số nóng...'
                            value={aiInput}
                            onChange={e => setAiInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAiAsk()}
                            className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-xs placeholder-white/40 focus:outline-none focus:border-[#C9A84C]"
                        />
                        <button
                            onClick={handleAiAsk}
                            className="px-3 py-2 bg-[#C9A84C] text-[#0B0E14] rounded-lg text-xs font-bold hover:bg-[#E8C97A] transition-colors"
                        >
                            Hỏi
                        </button>
                    </div>
                    {aiResult && (
                        <div className="mt-2 p-2 bg-white/5 rounded-lg text-xs text-white/80">
                            🤖 {aiResult}
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Links */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                        Liên kết nhanh
                    </p>
                </div>
                <div className="p-3">
                    <div className="flex flex-wrap gap-2">
                        {config.quickLinks.map((link, i) => (
                            <Link
                                key={i}
                                href={link.href}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${config.badgeColor} hover:opacity-80 transition-opacity`}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            {/* Dò vé mini */}
            {region !== 'vietlott' && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-semibold text-gray-800">
                            🔍 Dò vé nhanh — {regionLabel}
                        </p>
                    </div>
                    <div className="p-4 space-y-3">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1.5">
                                Nhập số cuối (2–5 chữ số)
                            </label>
                            <input
                                type="text"
                                value={doveInput}
                                onChange={e => setDoveInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleDove()}
                                placeholder="VD: 36 hoặc 736"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C]"
                            />
                        </div>
                        <button
                            onClick={handleDove}
                            className="w-full py-2 bg-[#C9A84C] text-white rounded-lg text-sm font-semibold hover:bg-[#b8963f] transition-colors"
                        >
                            Kiểm tra ngay
                        </button>
                        {doveResult && (
                            <div className={`p-3 rounded-lg text-xs ${doveResult.hit ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-50 text-gray-600 border border-gray-200'}`}>
                                {doveResult.message}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Lô gan tracker */}
            {region !== 'vietlott' && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-800">
                            ❄️ Lô gan — {regionLabel}
                        </p>
                        <Link href={`/${region}/thong-ke`} className="text-xs text-[#C9A84C] hover:underline">
                            Xem đủ →
                        </Link>
                    </div>
                    <div className="p-3 space-y-2">
                        {loganData.length > 0 ? (
                            loganData.slice(0, 5).map((item, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <span className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-bold ${
                                        item.isHot
                                            ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                            : 'bg-gray-100 text-gray-600'
                                    }`}>
                                        {item.num}
                                    </span>
                                    <div className="flex-1">
                                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${item.isHot ? 'bg-amber-400' : 'bg-gray-300'}`}
                                                style={{ width: `${Math.min((item.days / 40) * 100, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                    <span className="text-xs text-gray-400 w-12 text-right">
                                        {item.days} ngày
                                    </span>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs text-gray-400 text-center py-4">
                                Chưa có dữ liệu lô gan
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Vietlott Jackpot tracker */}
            {region === 'vietlott' && jackpotData && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-semibold text-gray-800">
                            🏆 Jackpot đang theo dõi
                        </p>
                    </div>
                    <div className="p-4 space-y-4">
                        {jackpotData.mega && (
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-red-600 font-semibold">Mega 6/45</span>
                                    <span className="text-xs text-gray-400">Jackpot 1</span>
                                </div>
                                <p className="text-xl font-black text-red-700">{jackpotData.mega}đ</p>
                            </div>
                        )}
                        {jackpotData.power && (
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-blue-600 font-semibold">Power 6/55</span>
                                    <span className="text-xs text-gray-400">Jackpot 1</span>
                                </div>
                                <p className="text-xl font-black text-blue-700">{jackpotData.power}đ</p>
                            </div>
                        )}
                        {(!jackpotData.mega && !jackpotData.power) && (
                            <p className="text-xs text-gray-400 text-center py-2">
                                Chưa có dữ liệu jackpot
                            </p>
                        )}
                    </div>
                </div>
            )}
        </aside>
    )
}
