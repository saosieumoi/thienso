// src/app/api/cron/crawl-all/route.ts
import { NextResponse } from 'next/server'
import { crawlXSMB } from '@/scripts/crawlers/xsmb'
import { crawlXSMN } from '@/scripts/crawlers/xsmn'
import { crawlXSMT } from '@/scripts/crawlers/xsmt'

export const maxDuration = 300 // 5 phút — đủ cho 3 crawler chạy tuần tự

interface CrawlerRun {
    name: string
    success: boolean
    recordsInserted: number
    source: string
    error?: string
    executionMs: number
}

export async function GET(request: Request) {
    // Xác thực — chỉ Vercel Cron mới được gọi
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const today = new Date()
    const dateStr = today.toISOString().split('T')[0]
    const results: CrawlerRun[] = []

    console.log(`\n[Cron All] === Bắt đầu crawl tất cả ngày ${dateStr} ===`)

    // ── XSMB — chạy mỗi ngày ─────────────────────────
    {
        const t = Date.now()
        try {
            console.log('\n[Cron All] 1/3 Crawling XSMB...')
            const result = await crawlXSMB(today)
            results.push({
                name: 'XSMB',
                ...result,
                executionMs: Date.now() - t,
            })
        } catch (err) {
            results.push({
                name: 'XSMB',
                success: false,
                recordsInserted: 0,
                source: 'error',
                error: String(err),
                executionMs: Date.now() - t,
            })
        }
    }

    // ── XSMN — chạy mỗi ngày (nhiều đài, mỗi đài 1 ngày/tuần) ──
    {
        const t = Date.now()
        try {
            console.log('\n[Cron All] 2/3 Crawling XSMN...')
            const result = await crawlXSMN(today)
            results.push({
                name: 'XSMN',
                ...result,
                executionMs: Date.now() - t,
            })
        } catch (err) {
            results.push({
                name: 'XSMN',
                success: false,
                recordsInserted: 0,
                source: 'error',
                error: String(err),
                executionMs: Date.now() - t,
            })
        }
    }

    // ── XSMT — chạy mỗi ngày (tương tự XSMN) ────────
    {
        const t = Date.now()
        try {
            console.log('\n[Cron All] 3/3 Crawling XSMT...')
            const result = await crawlXSMT(today)
            results.push({
                name: 'XSMT',
                ...result,
                executionMs: Date.now() - t,
            })
        } catch (err) {
            results.push({
                name: 'XSMT',
                success: false,
                recordsInserted: 0,
                source: 'error',
                error: String(err),
                executionMs: Date.now() - t,
            })
        }
    }

    // ── Tổng kết ──────────────────────────────────────
    const totalSuccess = results.filter(r => r.success).length
    const totalFailed = results.filter(r => !r.success).length
    const totalRecords = results.reduce((sum, r) => sum + r.recordsInserted, 0)

    console.log('\n[Cron All] === Kết quả ===')
    results.forEach(r => {
        console.log(
            `  ${r.success ? '✅' : '❌'} ${r.name}: ${r.recordsInserted} giải — ${r.executionMs}ms`
        )
    })

    return NextResponse.json({
        date: dateStr,
        summary: {
            success: totalSuccess,
            failed: totalFailed,
            totalRecords,
        },
        results,
        timestamp: new Date().toISOString(),
    })
}