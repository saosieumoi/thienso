import { NextResponse } from 'next/server'
import { crawlMega645 } from '@/scripts/crawlers/vietlott-mega'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    const date = dateParam ? new Date(dateParam) : new Date()
    return NextResponse.json(await crawlMega645(date))
}