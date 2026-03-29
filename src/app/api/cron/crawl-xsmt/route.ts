import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { crawlXSMT } from '@/scripts/crawlers/xsmt'

export const maxDuration = 60

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const startTime = Date.now()

    try {
        const result = await crawlXSMT()
        const executionMs = Date.now() - startTime

        // Revalidate XSMT homepage và trang ngày vừa crawl
        revalidatePath('/xsmt')
        if (result.success && result.drawDate) {
            revalidatePath(`/xsmt/${result.drawDate}`)
            console.log(`[Cron XSMT] Revalidated: /xsmt/${result.drawDate}`)
        }

        return NextResponse.json({ ...result, executionMs })
    } catch (err) {
        return NextResponse.json(
            { error: String(err), executionMs: Date.now() - startTime },
            { status: 500 }
        )
    }
}