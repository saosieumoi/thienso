// src/scripts/crawlers/vietlott-power.ts
// Crawler Vietlott Power 6/55 từ xosodaiphat.com
//
// URL pattern: https://xosodaiphat.com/xs-power-xo-so-power-655-ngay-DD-MM-YYYY.html
//
// HTML structure (verified 26/03/2026):
//   Kỳ quay:  p.para.text-black-bold → "Kỳ 1324: Thứ Năm, 26-03-2026"
//   Kết quả:  div.power-detail > ul > li (7 số: 6 chính + 1 số thưởng cuối)
//   Jackpot:  div.prize-value > span.result-jackpot (2 jackpot)
//   Giải:     table.table-bordered tbody tr

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
function normMoney(s: string): number {
    return parseInt(s.replace(/[^\d]/g, ''), 10) || 0
}

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

// ─── Parser Power 6/55 ────────────────────────────────
function parsePower(html: string) {
    const $ = cheerio.load(html)

    // Kỳ quay: "Kỳ 1324: Thứ Năm, 26-03-2026"
    const paraText = $('p.para.text-black-bold').first().text().trim()
    const drawNumberMatch = paraText.match(/Kỳ\s+(\d+)/)
    const drawNumber = drawNumberMatch ? drawNumberMatch[1] : null

    // 7 số từ div.power-detail > ul > li
    // Số 1-6: số chính, số 7: số thưởng (Power number)
    const numbers: number[] = []
    $('div.power-detail ul li').each((_, el) => {
        const n = parseInt($(el).text().trim(), 10)
        if (!isNaN(n)) numbers.push(n)
    })

    if (numbers.length < 7) return null

    const mainNumbers = numbers.slice(0, 6)   // 6 số chính
    const powerNumber = numbers[6]             // số thưởng

    // Jackpot từ div.prize-value
    const jackpots: string[] = []
    $('div.prize-value span.result-jackpot').each((_, el) => {
        jackpots.push($(el).text().trim())
    })

    const jackpot1 = jackpots[0] ?? ''
    const jackpot2 = jackpots[1] ?? ''

    // Giải thưởng từ table
    const prizes: { name: string; matched: number; winners: number; value: number }[] = []
    $('table.table-bordered tbody tr').each((_, row) => {
        const cells = $('td', row)
        if (cells.length < 4) return
        const name = $(cells[0]).text().trim()
        const winners = parseInt($(cells[2]).text().trim().replace(/[^\d]/g, ''), 10) || 0
        const value = normMoney($(cells[3]).text().trim())
        // Đếm số i trong circle-no
        const matched = $(cells[1]).find('i').length
        prizes.push({ name, matched, winners, value })
    })

    return { drawNumber, mainNumbers, powerNumber, jackpot1, jackpot2, prizes }
}

// ─── Lấy hoặc tạo province Vietlott ──────────────────
async function getVietlottProvinceId(lotteryTypeId: string): Promise<string> {
    const existing = await prisma.province.findUnique({ where: { code: 'VIETLOTT' } })
    if (existing) return existing.id

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
    parsed: NonNullable<ReturnType<typeof parsePower>>,
    drawDate: Date,
    source: string
): Promise<number> {
    const lotteryType = await prisma.lotteryType.findUnique({ where: { code: 'POWER655' } })
    if (!lotteryType) throw new Error('LotteryType POWER655 not found — chạy seed chưa?')

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

    // Insert JP1 — 6 số chính
    await prisma.result.create({
        data: {
            drawId: draw.id,
            prizeName: 'JP1',
            numbers: parsed.mainNumbers.map(String),
            tailNums: parsed.mainNumbers.map(n => n % 100),
            headNums: parsed.mainNumbers.map(n => Math.floor(n / 10)),
        },
    })

    // Insert JP2 — số Power
    await prisma.result.create({
        data: {
            drawId: draw.id,
            prizeName: 'JP2',
            numbers: [String(parsed.powerNumber)],
            tailNums: [parsed.powerNumber % 100],
            headNums: [Math.floor(parsed.powerNumber / 10)],
        },
    })

    return 2
}

// ─── Main ─────────────────────────────────────────────
export async function crawlPower655(date?: Date): Promise<VietlottCrawlResult> {
    const targetDate = date ?? new Date()
    const dateStr = targetDate.toISOString().split('T')[0]
    const dow = targetDate.getDay()

    // Power quay Thứ 3, Thứ 5, Thứ 7 (2, 4, 6)
    if (![2, 4, 6].includes(dow)) {
        return { success: true, drawDate: dateStr, recordsInserted: 0, source: 'skip' }
    }

    const [yyyy, mm, dd] = dateStr.split('-')
    const url = `https://xosodaiphat.com/xs-power-xo-so-power-655-ngay-${dd}-${mm}-${yyyy}.html`

    // Fallback URL nếu cần: xo-so-dien-toan-tu-chon-power-655-ngay-DD-MM-YYYY.html

    console.log(`\n[Power 6/55] === ${dateStr} ===`)
    console.log(`  URL: ${url}`)

    const lotteryType = await prisma.lotteryType.findUnique({ where: { code: 'POWER655' } })

    try {
        const html = await fetchHtml(url)
        const parsed = parsePower(html)

        if (!parsed) {
            throw new Error('Không parse được kết quả — kiểm tra HTML selector')
        }

        if (parsed.mainNumbers.length !== 6) {
            throw new Error(`Số lượng số chính không đúng: ${parsed.mainNumbers.length}/6`)
        }

        console.log(`  ✅ Kỳ ${parsed.drawNumber}: [${parsed.mainNumbers.join(', ')}] + ${parsed.powerNumber}`)
        console.log(`  Jackpot 1: ${parsed.jackpot1}`)
        console.log(`  Jackpot 2: ${parsed.jackpot2}`)

        const count = await insertToDB(parsed, targetDate, 'xosodaiphat.com')

        if (lotteryType) {
            await prisma.crawlLog.create({
                data: {
                    lotteryTypeId: lotteryType.id,
                    targetDate,
                    source: 'xosodaiphat.com',
                    status: 'success',
                    recordsInserted: count,
                },
            })
        }

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

        await sendAlert(`🚨 <b>Power 6/55 FAIL</b>\n📅 <b>${dateStr}</b>\n❌ ${error}`)
        return { success: false, drawDate: dateStr, recordsInserted: 0, source: 'xosodaiphat.com', error }
    }
}