'use client'

import Link from 'next/link'
import { useState } from 'react'

type Region = 'xsmb' | 'xsmn' | 'xsmt' | 'vietlott'

interface SideColumnProps {
    region: Region
    regionLabel: string
    drawDate?: Date | null
    dbNumbers?: Array<{ province: string; number: string }>
    loganData?: Array<{ num: string; days: number; isHot?: boolean }>
    jackpotData?: { mega: string | null; power: string | null }
}

// Format cho hiển thị DD/MM
function formatDateDisplay(d: Date): string {
    const day = d.getDate().toString().padStart(2, '0')
    const month = (d.getMonth() + 1).toString().padStart(2, '0')
    return `${day}/${month}`
}

// Format cho URL: DD-MM-YYYY
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
        // For now, simple check against dbNumbers
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
        if (q.includes('36')) {
            setAiResult('Số 36 về 4 lần trong 10 ngày qua — đang trong chu kỳ nóng. Hay về Thứ 2 và Thứ 5.')
        } else if (q.includes('72')) {
            setAiResult('Số 72 đã vắng 38 kỳ liên tiếp — thuộc nhóm gan dài nhất. Theo lịch sử, số gan trên 30 kỳ thường hồi phục mạnh.')
        } else if (q.includes('đặc biệt') || q.includes('db')) {
            setAiResult(`Đặc biệt hôm nay ${dbNumbers[0]?.number || '—'}. Đầu ${dbNumbers[0]?.number.slice(0, 2) || '—'} có thể đang trong chu kỳ hồi phục.`)
        } else {
            setAiResult('Tính năng AI đang được phát triển. Hãy đăng ký để trải nghiệm sớm!')
        }
    }

    const maxLoganDays = loganData.length > 0 ? Math.max(...loganData.map(l => l.days)) : 1

    return (
        <aside className="w-80 shrink-0 space-y-4">

            {/* Date Picker Mini */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                        Chọn ngày xem kết quả
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
                                    href={`/${region}${i === 0 ? '' : `/${formatDateForUrl(d)}`}`}
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
                        <span className="px-2 py-0.5 rounded bg-[#C9A84C]/20 text-[#E8C97A] text-[10px] font-bold">
                            AI Thiên Số
                        </span>
                    </div>
                    <p className="text-sm font-semibold text-white">
                        Nhận xét hôm nay — {regionLabel}
                    </p>
                </div>
                <div className="p-4 text-white/80 text-sm leading-relaxed">
                    {dbNumbers.length > 0 ? (
                        <>
                            Đặc biệt hôm nay <strong className="text-[#E8C97A]">{dbNumbers[0].number}</strong>
                            {dbNumbers[0].number.length >= 5 && (
                                <>
                                    {' '}— đầu <strong className="text-[#E8C97A]">{dbNumbers[0].number.slice(0, 2)}</strong>,
                                    đuôi <strong className="text-emerald-400">{dbNumbers[0].number.slice(-2)}</strong>.
                                </>
                            )}
                            <br /><br />
                            Đáng chú ý: <strong>số 72</strong> đã vắng mặt 38 kỳ liên tiếp — theo chu kỳ lịch sử,
                            nhóm số này thường hồi phục trong vòng 5–12 kỳ tiếp theo.
                        </>
                    ) : (
                        'Chưa có dữ liệu cho kỳ quay này. Hãy quay lại sau khi có kết quả.'
                    )}
                </div>
                <div className="px-4 pb-3 flex flex-wrap gap-2">
                    {dbNumbers.length > 0 && (
                        <>
                            <span className="px-2 py-1 rounded bg-[#C9A84C]/20 text-[#E8C97A] text-[10px] font-semibold">
                                {dbNumbers[0].number.slice(-2)} đang nóng
                            </span>
                            <span className="px-2 py-1 rounded bg-white/10 text-white/70 text-[10px] font-semibold">
                                Đầu {dbNumbers[0].number.slice(0, 2)} hồi phục
                            </span>
                            <span className="px-2 py-1 rounded bg-[#2A6B5C]/30 text-[#3D9B82] text-[10px] font-semibold">
                                72 lâu chưa về
                            </span>
                        </>
                    )}
                </div>
                <div className="px-4 pb-4">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder='Hỏi: "Số nào hay về thứ 2?"'
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

            {/* Dò vé mini */}
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

            {/* Lô gan / Jackpot tracker */}
            {region !== 'vietlott' && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-800">
                            ❄️ Lô gan hôm nay — {regionLabel}
                        </p>
                        <Link href={`/${region}/thong-ke`} className="text-xs text-[#C9A84C] hover:underline">
                            Xem đủ →
                        </Link>
                    </div>
                    <div className="p-3 space-y-2">
                        {loganData.length > 0 ? (
                            loganData.map((item, i) => (
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
                                                style={{ width: `${(item.days / maxLoganDays) * 100}%` }}
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
                        {!jackpotData.mega && !jackpotData.power && (
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
