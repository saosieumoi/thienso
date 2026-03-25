import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
    const lotteryTypes = await prisma.lotteryType.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
            provinces: {
                orderBy: { sortOrder: 'asc' },
                take: 3,
            },
        },
    })

    return NextResponse.json({
        status: 'ok',
        lotteryTypes: lotteryTypes.map(lt => ({
            code: lt.code,
            name: lt.name,
            drawDays: lt.drawDays,
            provinceCount: lt.provinces.length,
        })),
    })
}