import { NextResponse } from 'next/server'
import { crawlPower655 } from '@/scripts/crawlers/vietlott-power'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    const date = dateParam ? new Date(dateParam) : new Date()
    const result = await crawlPower655(date)
    return NextResponse.json(result)
}