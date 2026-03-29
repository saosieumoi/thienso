import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { crawlXSMN } from '@/scripts/crawlers/xsmn'

export const maxDuration = 60

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const startTime = Date.now()

    try {
        const result = await crawlXSMN()
        const executionMs = Date.now() - startTime

        // Revalidate XSMN homepage và trang ngày vừa crawl
        revalidatePath('/xsmn')
        if (result.success && result.drawDate) {
            revalidatePath(`/xsmn/${result.drawDate}`)
            console.log(`[Cron XSMN] Revalidated: /xsmn/${result.drawDate}`)
        }

        return NextResponse.json({ ...result, executionMs })
    } catch (err) {
        return NextResponse.json(
            { error: String(err), executionMs: Date.now() - startTime },
            { status: 500 }
        )
    }
}