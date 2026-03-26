// src/app/api/debug-draw/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const draw = await prisma.draw.findFirst({
        where: { lotteryType: { code: 'XSMB' } },
        orderBy: { drawDate: 'desc' },
        select: {
            drawDate: true,
            specialCodes: true,
            crawlSource: true,
            isComplete: true,
        },
    })

    return NextResponse.json(draw)
}