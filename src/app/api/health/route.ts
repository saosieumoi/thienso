import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
    try {
        // Kiểm tra DB kết nối được không
        const count = await prisma.draw.count()

        // Kiểm tra crawl gần nhất
        const lastCrawl = await prisma.crawlLog.findFirst({
            orderBy: { createdAt: 'desc' },
        })

        const lastSuccess = await prisma.crawlLog.findFirst({
            where: { status: 'success' },
            orderBy: { createdAt: 'desc' },
        })

        return NextResponse.json({
            status: 'ok',
            database: 'connected',
            totalDraws: count,
            lastCrawl: lastCrawl
                ? {
                    source: lastCrawl.source,
                    status: lastCrawl.status,
                    at: lastCrawl.createdAt,
                }
                : null,
            lastSuccess: lastSuccess?.createdAt ?? null,
        })
    } catch (err) {
        return NextResponse.json(
            { status: 'error', error: String(err) },
            { status: 500 }
        )
    }
}