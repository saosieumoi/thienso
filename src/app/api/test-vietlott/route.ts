// src/app/api/test-vietlott/route.ts
import { NextResponse } from 'next/server'
import { crawlMega645, crawlPower655, crawlMax3D, crawlMax3DPro, parsePower, parseMega } from '@/scripts/crawlers/vietlott'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const game = searchParams.get('game') ?? 'mega'
    const dateParam = searchParams.get('date')
    const debug = searchParams.get('debug') === '1'
    const date = dateParam ? new Date(dateParam) : new Date()

    // Debug mode: fetch HTML và parse trực tiếp, không insert DB
    if (debug) {
        const [yyyy, mm, dd] = date.toISOString().split('T')[0].split('-')
        const urls: Record<string, string> = {
            mega: `https://www.minhchinh.com/xs-mega-645-ket-qua-mega-645-ngay-${dd}-${mm}-${yyyy}.html`,
            power: `https://www.minhchinh.com/xs-power-655-ket-qua-power-655-ngay-${dd}-${mm}-${yyyy}.html`,
            max3d: `https://www.minhchinh.com/xs-max-3d-ket-qua-max-3d-ngay-${dd}-${mm}-${yyyy}.html`,
            max3dpro: `https://www.minhchinh.com/xs-max3d-pro-ket-qua-max3d-pro-ngay-${dd}-${mm}-${yyyy}.html`,
        }
        const url = urls[game]
        if (!url) return NextResponse.json({ error: 'Unknown game' }, { status: 400 })

        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.minhchinh.com/' }
        })
        const html = await res.text()

        const parsers: Record<string, (h: string) => any> = {
            mega: parseMega, power: parsePower,
        }
        const parser = parsers[game]
        if (!parser) return NextResponse.json({ url, html: html.slice(0, 2000) })

        const parsed = parser(html)
        return NextResponse.json({ url, parsed })
    }

    const crawlers = {
        mega: crawlMega645,
        power: crawlPower655,
        max3d: crawlMax3D,
        max3dpro: crawlMax3DPro,
    }
    const fn = crawlers[game as keyof typeof crawlers] ?? crawlMega645
    return NextResponse.json(await fn(date))
}