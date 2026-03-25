import { NextResponse } from 'next/server'
import { crawlXSMT } from '@/scripts/crawlers/xsmt'

export const maxDuration = 60

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // TODO: implement crawlXSMT tương tự XSMN
    return NextResponse.json({ message: 'XSMT crawler not yet implemented' })
}