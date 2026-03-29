// src/scripts/crawlers/vietlott-mega.ts
// Crawler Vietlott Mega 6/45 từ xosodaiphat.com
//
// URL: https://xosodaiphat.com/xs-mega-xo-so-mega-645-ngay-DD-MM-YYYY.html
//
// HTML structure (verified 25/03/2026):
//   Kỳ quay:  p.para.text-black-bold → "Kỳ 1488: Thứ Tư, 25-03-2026"
//   Kết quả:  div.mega-detail > ul > li (6 số chính, không có số thưởng)
//   Jackpot:  div.prize-value > span.result-jackpot (1 jackpot duy nhất)
//   Giải:     div.prize-detail table.table-bordered tbody tr

import * as cheerio from 'cheerio'
import { prisma } from '@/lib/prisma'

export interface VietlottCrawlResult {
    success: boolean
    drawDate: string
    drawNumber?: string
    recordsInserted: number
    source: string
    error?: string
}

// ─── Helpers ──────────────────────────────────────────
async function fetchHtml(url: string): Promise<string> {
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,*/*',
                    'Accept-Language': 'vi-VN,vi;q=0.9',
                    'Referer': 'https://xosodaiphat.com/',
                },
                signal: AbortSignal.timeout(15000),
            })
            if (res.status === 404) throw new Error('404 Not Found')
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            return await res.text()
        } catch (err) {
            if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 1500))
            else throw err
        }
    }
    throw new Error('Max retries exceeded')
}

async function sendAlert(message: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID
    if (!token || !chatId) return
    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
        })
    } catch { /* silent */ }
}

// ─── Parser Mega 6/45 ─────────────────────────────────
function parseMega(html: string) {
    const $ = cheerio.load(html)

    // Kỳ quay: "Kỳ 1488: Thứ Tư, 25-03-2026"
    const paraText = $('p.para.text-black-bold').first().text().trim()
    const drawNumberMatch = paraText.match(/Kỳ\s+(\d+)/)
    const drawNumber = drawNumberMatch ? drawNumberMatch[1] : null

    // 6 số từ div.mega-detail > ul > li
    const numbers: number[] = []
    $('div.mega-detail ul li').each((_, el) => {
        const n = parseInt($(el).text().trim(), 10)
        if (!isNaN(n)) numbers.push(n)
    })

    if (numbers.length < 6) return null

    // Jackpot: 1 span.result-jackpot (khác Power có 2)
    const jackpot = $('div.prize-value span.result-jackpot').first().text().trim()

    // Giải thưởng từ div.prize-detail table
    const prizes: { name: string; winners: number; value: number }[] = []
    $('div.prize-detail table.table-bordered tbody tr').each((_, row) => {
        const cells = $('td', row)
        if (cells.length < 4) return
        const name = $(cells[0]).text().trim()
        const winners = parseInt($(cells[2]).text().trim().replace(/[^\d]/g, ''), 10) || 0
        const value = parseInt($(cells[3]).text().trim().replace(/[^\d]/g, ''), 10) || 0
        prizes.push({ name, winners, value })
    })

    // Kiểm tra jackpot (Jackpot winners > 0)
    const jackpotRow = prizes.find(p => p.name.toLowerCase().includes('jackpot'))
    const isJackpot = (jackpotRow?.winners ?? 0) > 0

    return { drawNumber, numbers, jackpot, prizes, isJackpot }
}

// ─── Lấy hoặc tạo province Vietlott ──────────────────
// Vietlott không có tỉnh — dùng province "VIETLOTT" làm placeholder
async function getVietlottProvinceId(lotteryTypeId: string): Promise<string> {
    const existing = await prisma.province.findUnique({ where: { code: 'VIETLOTT' } })
    if (existing) return existing.id

    // Tạo mới nếu chưa có
    const created = await prisma.province.create({
        data: {
            code: 'VIETLOTT',
            name: 'Vietlott',
            shortName: 'VL',
            region: 'VIETLOTT' as any,
            lotteryTypeId,
            isActive: true,
            sortOrder: 99,
        },
    })
    console.log('  ➕ Tạo province VIETLOTT')
    return created.id
}

// ─── Insert DB ────────────────────────────────────────
async function insertToDB(
    parsed: NonNullable<ReturnType<typeof parseMega>>,
    drawDate: Date,
    source: string
): Promise<number> {
    const lotteryType = await prisma.lotteryType.findUnique({ where: { code: 'MEGA645' } })
    if (!lotteryType) throw new Error('LotteryType MEGA645 not found — chạy seed chưa?')

    const provinceId = await getVietlottProvinceId(lotteryType.id)

    const [y, m, d] = drawDate.toISOString().split('T')[0].split('-').map(Number)
    const date = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))

    const draw = await prisma.draw.upsert({
        where: {
            drawDate_lotteryTypeId_provinceId: {
                drawDate: date,
                lotteryTypeId: lotteryType.id,
                provinceId,
            },
        },
        update: {
            isComplete: true,
            crawledAt: new Date(),
            crawlSource: source,
            drawNumber: parsed.drawNumber ? parseInt(parsed.drawNumber, 10) : undefined,
        },
        create: {
            drawDate: date,
            lotteryTypeId: lotteryType.id,
            provinceId,
            isComplete: true,
            crawledAt: new Date(),
            crawlSource: source,
            drawNumber: parsed.drawNumber ? parseInt(parsed.drawNumber, 10) : undefined,
        },
    })

    await prisma.result.deleteMany({ where: { drawId: draw.id } })

    // Insert VL1 — 6 số chính
    await prisma.result.create({
        data: {
            drawId: draw.id,
            prizeName: 'VL1',
            numbers: parsed.numbers.map(String),
            tailNums: parsed.numbers.map(n => n % 100),
            headNums: parsed.numbers.map(n => Math.floor(n / 10)),
        },
    })

    if (lotteryType) {
        await prisma.crawlLog.create({
            data: {
                lotteryTypeId: lotteryType.id,
                targetDate: drawDate,
                source,
                status: 'success',
                recordsInserted: 1,
            },
        })
    }

    return 1
}

// ─── Main ─────────────────────────────────────────────
export async function crawlMega645(date?: Date): Promise<VietlottCrawlResult> {
    const targetDate = date ?? new Date()
    const dateStr = targetDate.toISOString().split('T')[0]
    const dow = targetDate.getDay()

    // Mega quay Thứ 4, Thứ 6, Chủ Nhật (3, 5, 0)
    if (![3, 5, 0].includes(dow)) {
        return { success: true, drawDate: dateStr, recordsInserted: 0, source: 'skip' }
    }

    const [yyyy, mm, dd] = dateStr.split('-')
    const url = `https://xosodaiphat.com/xo-so-dien-toan-tu-chon-mega-645-ngay-${dd}-${mm}-${yyyy}.html`

    console.log(`\n[Mega 6/45] === ${dateStr} ===`)
    console.log(`  URL: ${url}`)

    const lotteryType = await prisma.lotteryType.findUnique({ where: { code: 'MEGA645' } })

    try {
        const html = await fetchHtml(url)
        const parsed = parseMega(html)

        if (!parsed) throw new Error('Không parse được kết quả')
        if (parsed.numbers.length !== 6) throw new Error(`Số lượng không đúng: ${parsed.numbers.length}/6`)

        console.log(`  ✅ Kỳ ${parsed.drawNumber}: [${parsed.numbers.join(', ')}]`)
        console.log(`  Jackpot: ${parsed.jackpot}${parsed.isJackpot ? ' 🎉 CÓ NGƯỜI TRÚNG!' : ''}`)

        const count = await insertToDB(parsed, targetDate, 'xosodaiphat.com')

        return {
            success: true,
            drawDate: dateStr,
            drawNumber: parsed.drawNumber ?? undefined,
            recordsInserted: count,
            source: 'xosodaiphat.com',
        }
    } catch (err) {
        const error = String(err)
        console.error(`  ❌ ${error}`)

        if (lotteryType) {
            await prisma.crawlLog.create({
                data: {
                    lotteryTypeId: lotteryType.id,
                    targetDate,
                    source: 'xosodaiphat.com',
                    status: 'failed',
                    recordsInserted: 0,
                    errorMessage: error,
                },
            })
        }

        await sendAlert(`🚨 <b>Mega 6/45 FAIL</b>\n📅 <b>${dateStr}</b>\n❌ ${error}`)
        return { success: false, drawDate: dateStr, recordsInserted: 0, source: 'xosodaiphat.com', error }
    }
}