// src/app/api/cron/crawl-all/route.ts
import { NextResponse } from 'next/server'
import { crawlXSMB } from '@/scripts/crawlers/xsmb'
import { crawlXSMN } from '@/scripts/crawlers/xsmn'
import { crawlXSMT } from '@/scripts/crawlers/xsmt'

export const maxDuration = 300 // 5 phút

interface CrawlerRun {
    name: string
    success: boolean
    recordsInserted: number
    source: string
    error?: string
    executionMs: number
}

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Hỗ trợ ?date=2026-03-25 để test ngày cụ thể
    // Nếu không có → dùng hôm nay (production)
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    const targetDate = dateParam ? new Date(dateParam) : new Date()
    const dateStr = targetDate.toISOString().split('T')[0]

    const results: CrawlerRun[] = []
    console.log(`\n[Cron] === Crawl ${dateStr} ===`)

    // Chạy tuần tự để tránh overload DB connection
    for (const [name, crawlFn] of [
        ['XSMB', () => crawlXSMB(targetDate)],
        ['XSMN', () => crawlXSMN(targetDate)],
        ['XSMT', () => crawlXSMT(targetDate)],
    ] as [string, () => Promise<any>][]) {
        const t = Date.now()
        try {
            console.log(`\n[Cron] Crawling ${name}...`)
            const result = await crawlFn()
            results.push({ name, ...result, executionMs: Date.now() - t })
        } catch (err) {
            results.push({
                name, success: false, recordsInserted: 0,
                source: 'error', error: String(err), executionMs: Date.now() - t,
            })
        }
        // Nghỉ 2 giây giữa các crawler để connection được release
        await new Promise(r => setTimeout(r, 2000))
    }

    const totalRecords = results.reduce((s, r) => s + r.recordsInserted, 0)
    const failed = results.filter(r => !r.success)

    console.log('\n[Cron] === Kết quả ===')
    results.forEach(r =>
        console.log(`  ${r.success ? '✅' : '❌'} ${r.name}: ${r.recordsInserted} records (${r.executionMs}ms)`)
    )

    return NextResponse.json({
        date: dateStr,
        summary: {
            success: results.filter(r => r.success).length,
            failed: failed.length,
            totalRecords,
        },
        results,
        timestamp: new Date().toISOString(),
    })
}