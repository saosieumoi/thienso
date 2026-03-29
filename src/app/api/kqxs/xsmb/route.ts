import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const PRIZE_ORDER = ['DB', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7']
type LotoKey = 'head0' | 'head1' | 'head2' | 'head3' | 'head4' | 'head5' | 'head6' | 'head7' | 'head8' | 'head9'

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET',
}

function formatViDate(d: Date): string {
    return d.toLocaleDateString('vi-VN', {
        weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
    })
}

function formatShortDate(d: Date): string {
    const weekdays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
    const wd = weekdays[d.getDay()]
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    return `${wd} ${day}/${month}`
}

function toDateStr(d: Date): string {
    return d.toISOString().split('T')[0]
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')

    const targetDate = dateParam ? new Date(dateParam) : new Date()
    targetDate.setHours(0, 0, 0, 0)

    const nextDay = new Date(targetDate)
    nextDay.setDate(nextDay.getDate() + 1)

    const [draw, history] = await Promise.all([
        prisma.draw.findFirst({
            where: {
                lotteryType: { code: 'XSMB' },
                drawDate: { gte: targetDate, lt: nextDay },
            },
            include: { results: true, lotoResults: true },
        }),
        prisma.draw.findMany({
            where: { lotteryType: { code: 'XSMB' }, isComplete: true },
            orderBy: { drawDate: 'desc' },
            take: 7,
            include: {
                results: { where: { prizeName: { in: ['DB', 'G1', 'G7'] } } },
            },
        }),
    ])

    if (draw?.results) {
        draw.results.sort(
            (a, b) => PRIZE_ORDER.indexOf(a.prizeName) - PRIZE_ORDER.indexOf(b.prizeName)
        )
    }

    // Xây loto map head0-head9 và flat set
    const loto: Record<string, number[]> = {}
    const lotoSet: number[] = []
    if (draw?.lotoResults) {
        for (let h = 0; h <= 9; h++) {
            const key = `head${h}` as LotoKey
            const tails = (draw.lotoResults[key] as number[]) ?? []
            loto[`head${h}`] = tails
            tails.forEach(t => lotoSet.push(h * 10 + t))
        }
    }

    return NextResponse.json({
        date: toDateStr(targetDate),
        dateLabel: formatViDate(targetDate),
        isComplete: draw?.isComplete ?? false,
        results: (draw?.results ?? []).map(r => ({
            prize: r.prizeName,
            numbers: r.numbers,
        })),
        loto,
        lotoSet,
        history: history.map(h => {
            const drawDate = h.drawDate instanceof Date ? h.drawDate : new Date(h.drawDate)
            const db = h.results.find(r => r.prizeName === 'DB')
            const g1 = h.results.find(r => r.prizeName === 'G1')
            const g7 = h.results.find(r => r.prizeName === 'G7')
            const dbNum = db?.numbers[0] ?? ''
            return {
                date: toDateStr(drawDate),
                dateLabel: formatShortDate(drawDate),
                db: dbNum,
                head: dbNum ? dbNum.slice(0, 2) : '',
                tail: dbNum ? dbNum.slice(-2) : '',
                g1: g1?.numbers[0] ?? '',
                g7: g7?.numbers ?? [],
            }
        }),
    }, { headers: CORS })
}
