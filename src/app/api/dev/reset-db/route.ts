// src/app/api/dev/reset-db/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 })
    }

    // Xóa theo thứ tự đúng (foreign key)
    await prisma.lotoResult.deleteMany()
    await prisma.result.deleteMany()
    await prisma.crawlLog.deleteMany()
    await prisma.draw.deleteMany()

    const counts = {
        draws: await prisma.draw.count(),
        results: await prisma.result.count(),
        loto: await prisma.lotoResult.count(),
        crawlLogs: await prisma.crawlLog.count(),
    }

    return NextResponse.json({ success: true, remaining: counts })
}