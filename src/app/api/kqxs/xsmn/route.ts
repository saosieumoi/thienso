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

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')

    const targetDate = dateParam ? new Date(dateParam) : new Date()
    targetDate.setHours(0, 0, 0, 0)

    const nextDay = new Date(targetDate)
    nextDay.setDate(nextDay.getDate() + 1)

    const draws = await prisma.draw.findMany({
        where: {
            lotteryType: { code: 'XSMN' },
            drawDate: { gte: targetDate, lt: nextDay },
        },
        include: {
            results: true,
            lotoResults: true,
            province: true,
        },
    })

    draws.forEach(draw => {
        draw.results.sort(
            (a, b) => PRIZE_ORDER.indexOf(a.prizeName) - PRIZE_ORDER.indexOf(b.prizeName)
        )
    })

    return NextResponse.json({
        date: targetDate.toISOString().split('T')[0],
        dateLabel: formatViDate(targetDate),
        stations: draws.map(draw => {
            const loto: Record<string, number[]> = {}
            if (draw.lotoResults) {
                for (let h = 0; h <= 9; h++) {
                    const key = `head${h}` as LotoKey
                    loto[`head${h}`] = (draw.lotoResults[key] as number[]) ?? []
                }
            }
            return {
                provinceCode: draw.province?.code ?? '',
                provinceName: draw.province?.name ?? '',
                isComplete: draw.isComplete,
                results: draw.results.map(r => ({
                    prize: r.prizeName,
                    numbers: r.numbers,
                })),
                loto,
            }
        }),
    }, { headers: CORS })
}
