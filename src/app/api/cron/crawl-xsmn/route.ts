import { NextResponse } from 'next/server'
// import { crawlXSMN } from '@/scripts/crawlers/xsmn' // sẽ tạo sau

export const maxDuration = 60

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // TODO: implement crawlXSMN tương tự XSMB
    return NextResponse.json({ message: 'XSMN crawler not yet implemented' })
}