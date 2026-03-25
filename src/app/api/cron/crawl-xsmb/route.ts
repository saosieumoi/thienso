import { NextResponse } from 'next/server'
import { crawlXSMB } from '@/scripts/crawlers/xsmb'

export const maxDuration = 60 // timeout 60s cho Vercel

export async function GET(request: Request) {
    // Xác thực — chỉ Vercel Cron mới được gọi
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const startTime = Date.now()

    try {
        const result = await crawlXSMB()
        const executionMs = Date.now() - startTime

        console.log(`[Cron XSMB] Done in ${executionMs}ms:`, result)

        return NextResponse.json({
            ...result,
            executionMs,
            timestamp: new Date().toISOString(),
        })
    } catch (err) {
        return NextResponse.json(
            { error: String(err), executionMs: Date.now() - startTime },
            { status: 500 }
        )
    }
}