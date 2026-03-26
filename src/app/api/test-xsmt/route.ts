import { NextResponse } from 'next/server'
import { crawlXSMT } from '@/scripts/crawlers/xsmt'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    const date = dateParam ? new Date(dateParam) : new Date()
    const result = await crawlXSMT(date)
    return NextResponse.json(result)
}