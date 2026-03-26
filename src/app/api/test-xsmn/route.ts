// src/app/api/test-xsmn/route.ts
import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

const NAME_TO_CODE: Record<string, string> = {
    'đồng nai': 'DONGNAI', 'cần thơ': 'CANTHO', 'sóc trăng': 'SOCTRANG',
    'bạc liêu': 'BACLIEU', 'bình dương': 'BINHDUONG', 'vũng tàu': 'VUNGTAU',
    'tây ninh': 'TAYNINH', 'an giang': 'ANGIANG', 'bình thuận': 'BINHTHUAN',
    'vĩnh long': 'VINHLONG', 'bình phước': 'BINHPHUOC', 'trà vinh': 'TRAVINH',
    'tp. hcm': 'TPHCM', 'tp.hcm': 'TPHCM', 'hồ chí minh': 'TPHCM',
    'long an': 'LONGAN', 'tiền giang': 'TIENGIANG', 'kiên giang': 'KIENGIANG',
    'đà lạt': 'DALAT', 'đồng tháp': 'DONGTHAP', 'cà mau': 'CAMAU',
}

const ROW_MAP = [
    'G7', 'G6', 'G5', 'G4', 'G3', 'G2', 'G1', null, 'DB'
]

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') ?? '2026-03-25'
    const [yyyy, mm, dd] = date.split('-')

    const url = `https://xosodaiphat.com/xsmn-${dd}-${mm}-${yyyy}.html`
    const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' },
        signal: AbortSignal.timeout(15000),
    })
    const html = await res.text()
    const $ = cheerio.load(html)

    const table = $('table.table-xsmn').first()
    if (!table.length) {
        return NextResponse.json({ error: 'table.table-xsmn not found' }, { status: 500 })
    }

    // Lấy tên đài
    const provinces: { code: string; prizes: Record<string, string[]> }[] = []
    const codes: string[] = []

    table.find('thead th').each((i, th) => {
        if (i === 0) return
        const a = $(th).find('a').first()
        const title = (a.attr('title') ?? '').replace(/^Xổ số /i, '').toLowerCase().trim()
        const text = a.text().toLowerCase().trim()
        const code = NAME_TO_CODE[title] ?? NAME_TO_CODE[text]
        if (code) {
            codes.push(code)
            provinces.push({ code, prizes: {} })
        }
    })

    // Parse từng row
    table.find('tbody tr').each((rowIdx, row) => {
        const label = ROW_MAP[rowIdx]
        if (!label) return

        $(row).find('td.tn_prize').each((colIdx, td) => {
            const province = provinces[colIdx]
            if (!province) return
            const numbers: string[] = []
            $(td).find('span').each((_, el) => {
                const n = $(el).text().replace(/\D/g, '').trim()
                if (n.length >= 2) numbers.push(n)
            })
            if (numbers.length > 0) province.prizes[label] = numbers
        })
    })

    return NextResponse.json({
        date,
        source: url,
        provinces: provinces.map(p => ({
            code: p.code,
            DB: p.prizes['DB']?.[0],
            G7: p.prizes['G7']?.[0],
            prizeCount: Object.keys(p.prizes).length,
            prizes: p.prizes,
        }))
    })
}