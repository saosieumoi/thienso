// src/scripts/crawlers/vietlott.ts
// Crawler Vietlott từ minhchinh.com — Mega 6/45, Power 6/55, Max 3D, Max 3D Pro
//
// URL patterns:
//   Mega:     https://www.minhchinh.com/xs-mega-645-ket-qua-mega-645-ngay-DD-MM-YYYY.html
//   Power:    https://www.minhchinh.com/xs-power-655-ket-qua-power-655-ngay-DD-MM-YYYY.html
//   Max 3D:   https://www.minhchinh.com/xs-max-3d-ket-qua-max-3d-ngay-DD-MM-YYYY.html
//   Max3D Pro:https://www.minhchinh.com/xs-max3d-pro-ket-qua-max3d-pro-ngay-DD-MM-YYYY.html

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

export interface VietlottParsed {
    drawNumber: string | null
    numbers: number[]          // số chính (Mega/Power) hoặc tất cả số phẳng
    groups?: {                 // Max 3D/3D Pro: số theo nhóm giải
        prizeName: string        // "Đặc biệt", "Giải nhất", "Giải nhì", "Giải ba"
        numbers: number[]        // các bộ 3 số của giải đó
    }[]
    powerNumber?: number       // chỉ Power
    jackpot1: string
    jackpot2?: string
    prizes: {
        name: string
        winners: number
        value: string
    }[]
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
                    'Referer': 'https://www.minhchinh.com/',
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

async function getVietlottProvinceId(lotteryTypeId: string): Promise<string> {
    const existing = await prisma.province.findUnique({ where: { code: 'VIETLOTT' } })
    if (existing) return existing.id
    const created = await prisma.province.create({
        data: {
            code: 'VIETLOTT', name: 'Vietlott', shortName: 'VL',
            region: 'VIETLOTT' as any, lotteryTypeId,
            isActive: true, sortOrder: 99,
        },
    })
    return created.id
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
// Scope trong div.content_vl đầu tiên để tránh lấy kỳ cũ bên dưới
export function parseMega(html: string): VietlottParsed | null {
    const $ = cheerio.load(html)

    // Chỉ lấy block kỳ đầu tiên — tránh lặp kỳ cũ
    const block = $('div.content_vl').first()
    if (!block.length) return null

    const drawNumber = block.find('div.ngay').text().match(/#(\d+)/)?.[1] ?? null

    const numbers: number[] = []
    block.find('span.ball.ball_mega').each((_, el) => {
        const n = parseInt($(el).text().trim(), 10)
        if (!isNaN(n)) numbers.push(n)
    })
    if (numbers.length < 6) return null

    const jackpot1 = block.find('div.gtblive').first().text().trim()

    const prizes: VietlottParsed['prizes'] = []
    block.find('table.table-mega tbody tr').each((_, row) => {
        const tdList = $(row).children('td')
        if (tdList.length < 4) return
        prizes.push({
            name: tdList.eq(0).text().trim(),
            winners: parseInt(tdList.eq(2).text().replace(/[^\d]/g, ''), 10) || 0,
            value: tdList.eq(3).find('b').text().trim() || tdList.eq(3).text().trim(),
        })
    })

    return { drawNumber, numbers, jackpot1, prizes }
}

// ─── Parser Power 6/55 ────────────────────────────────
// div.box_ketqua: 6 x span.ball_power (số chính) + 1 x span.ball_power2 (số Power)
// QUAN TRỌNG: bảng table-power cũng chứa span.ball_power rỗng (hiển thị visual)
// → chỉ lấy span có text() thực sự khác rỗng
export function parsePower(html: string): VietlottParsed | null {
    const $ = cheerio.load(html)

    const block = $('div.content_vl').first()
    if (!block.length) return null

    const drawNumber = block.find('div.ngay').text().match(/#(\d+)/)?.[1] ?? null

    // Chỉ lấy trong div.box_ketqua, filter span có text (loại bỏ span rỗng trong bảng)
    const boxKetqua = block.find('div.box_ketqua')

    const mainNumbers: number[] = []
    boxKetqua.find('span.ball_power').each((_, el) => {
        const text = $(el).text().trim()
        if (!text) return                          // bỏ span rỗng
        const n = parseInt(text, 10)
        if (!isNaN(n)) mainNumbers.push(n)
    })

    let powerNumber: number | undefined
    const powerEl = boxKetqua.find('span.ball_power2').first()
    if (powerEl.length) {
        const text = powerEl.text().trim()
        if (text) powerNumber = parseInt(text, 10) || undefined
    }

    if (mainNumbers.length < 6) return null

    // 2 jackpot từ div.gtblive (nằm trong div.giatri_jackpot)
    const gtbItems = block.find('div.gtblive')
    const jackpot1 = gtbItems.eq(0).text().trim()
    const jackpot2 = gtbItems.eq(1).text().trim() || undefined

    // Bảng giải: class table-power
    // Cấu trúc mỗi row: [tên giải] [UI visual - bỏ qua] [số lượng] [giá trị]
    const prizes: VietlottParsed['prizes'] = []
    block.find('table.table-power tbody tr').each((i, row) => {
        const cells = $('td', row)
        // Lấy td theo index trực tiếp — tránh lỗi đếm cell khi có nested html
        const tdList = $(row).children('td')
        if (tdList.length < 4) return

        const name = tdList.eq(0).text().trim()
        const winners = parseInt(tdList.eq(2).text().replace(/[^\d]/g, ''), 10) || 0
        const value = tdList.eq(3).find('b').text().trim() || tdList.eq(3).text().trim()

        if (name) prizes.push({ name, winners, value })
    })

    return { drawNumber, numbers: mainNumbers, powerNumber, jackpot1, jackpot2, prizes }
}

// ─── Parser Max 3D ────────────────────────────────────
// table.table_max3d có 3 cột: Max3D (trái) | Số quay thưởng (giữa) | Max3D+ (phải)
//
// Row thường (4 giải đầu): [Max3D info] [td.max3d_number] [Max3D+ info]
// Row giải phụ 3D+ (giải 4,5,6): <td colspan="2"><span.noteGiai>...</span></td> [Max3D+ info]
//   → cột trái colspan=2, chỉ cột phải có span.giaiMax3d
export function parseMax3D(html: string): VietlottParsed | null {
    const $ = cheerio.load(html)

    const block = $('div.content_vl').first()
    if (!block.length) return null

    const drawNumber = block.find('div.ngay').text().match(/#(\d+)/)?.[1] ?? null

    const groups: NonNullable<VietlottParsed['groups']> = []
    const allNumbers: number[] = []
    const prizes: VietlottParsed['prizes'] = []
    const prizes3dPlus: VietlottParsed['prizes'] = []

    block.find('table.table_max3d tbody tr').each((_, row) => {
        const tdList = $(row).children('td')

        // ── Row colspan (giải phụ Max 3D+: giải 4, 5, 6) ──
        // Nhận biết: td đầu có colspan="2" hoặc chứa span.noteGiai
        const firstTd = tdList.eq(0)
        const isColspanRow = firstTd.attr('colspan') === '2'
            || firstTd.find('span.noteGiai').length > 0

        if (isColspanRow) {
            // Cột phải là td cuối (index 1 vì chỉ có 2 td do colspan)
            const rightTd = tdList.eq(tdList.length - 1)
            const rightName = rightTd.find('strong').contents().filter((_, n) => n.type === 'text').first().text().trim()
            const rightGiai = rightTd.find('span.giaiMax3d').text().trim()
            const rightMatch = rightGiai.match(/^(.+):\s*([\d,]+)$/)
            if (rightName && rightMatch) {
                prizes3dPlus.push({
                    name: `Max 3D+ — ${rightName}`,
                    value: rightMatch[1].trim(),
                    winners: parseInt(rightMatch[2].replace(/,/g, ''), 10) || 0,
                })
            }
            return
        }

        // ── Row thường (3 cột): [Max3D] [Số quay] [Max3D+] ──
        if (tdList.length < 3) return

        const leftTd = tdList.eq(0)
        const midTd = tdList.eq(1)
        const rightTd = tdList.eq(tdList.length - 1)

        // Số quay thưởng từ cột giữa
        const rowNumbers: number[] = []
        midTd.find('div').each((_, el) => {
            const text = $(el).text().trim()
            const n = parseInt(text, 10)
            if (text && !isNaN(n)) {
                rowNumbers.push(n)
                allNumbers.push(n)
            }
        })

        // Tên giải từ strong (text node, bỏ span.giaiMax3d)
        const prizeName = leftTd.find('strong')
            .contents()
            .filter((_, n) => n.type === 'text')
            .first().text().trim()

        if (prizeName && rowNumbers.length > 0) {
            groups.push({ prizeName, numbers: rowNumbers })
        }

        // Giải Max 3D (cột trái) — span.giaiMax3d: "1Tr: 20"
        const leftGiai = leftTd.find('span.giaiMax3d').text().trim()
        const leftMatch = leftGiai.match(/^(.+):\s*([\d,]+)$/)
        if (prizeName && leftMatch) {
            prizes.push({
                name: `Max 3D — ${prizeName}`,
                value: leftMatch[1].trim(),
                winners: parseInt(leftMatch[2].replace(/,/g, ''), 10) || 0,
            })
        }

        // Giải Max 3D+ (cột phải)
        if (rightTd[0] !== leftTd[0]) {
            const rightName = rightTd.find('strong').contents().filter((_, n) => n.type === 'text').first().text().trim()
            const rightGiai = rightTd.find('span.giaiMax3d').text().trim()
            const rightMatch = rightGiai.match(/^(.+):\s*([\d,]+)$/)
            if (rightName && rightMatch) {
                prizes3dPlus.push({
                    name: `Max 3D+ — ${rightName}`,
                    value: rightMatch[1].trim(),
                    winners: parseInt(rightMatch[2].replace(/,/g, ''), 10) || 0,
                })
            }
        }
    })

    if (allNumbers.length === 0) return null

    return {
        drawNumber,
        numbers: allNumbers,
        groups,
        jackpot1: '',
        prizes: [...prizes, ...prizes3dPlus],
    }
}

// ─── Parser Max 3D Pro ────────────────────────────────
// table.table_max3d với 4 cột: Giải | Số quay | Giá trị | SL
// Đặc biệt: 2 bộ | Nhất: 4 bộ | Nhì: 6 bộ | Ba: 8 bộ
export function parseMax3DPro(html: string): VietlottParsed | null {
    const $ = cheerio.load(html)

    const block = $('div.content_vl').first()
    if (!block.length) return null

    const drawNumber = block.find('div.ngay').text().match(/#(\d+)/)?.[1] ?? null

    const groups: NonNullable<VietlottParsed['groups']> = []
    const allNumbers: number[] = []
    const prizes: VietlottParsed['prizes'] = []

    block.find('table.table_max3d tbody tr').each((_, row) => {
        const cells = $('td', row)
        if (cells.length < 4) return

        const prizeName = $(cells[0]).find('strong').text().trim()
        const value = $(cells[2]).find('strong').text().trim()
        const winners = parseInt($(cells[3]).find('strong').text().replace(/[^\d]/g, ''), 10) || 0

        // Số của giải này từ cột 2 (td.max3d_number)
        const rowNumbers: number[] = []
        $(cells[1]).find('div').each((_, el) => {
            const n = parseInt($(el).text().trim(), 10)
            if (!isNaN(n) && $(el).text().trim() !== '') {
                rowNumbers.push(n)
                allNumbers.push(n)
            }
        })

        if (prizeName && rowNumbers.length > 0) {
            groups.push({ prizeName, numbers: rowNumbers })
        }
        if (prizeName && value) {
            prizes.push({ name: prizeName, value, winners })
        }
    })

    if (allNumbers.length === 0) return null

    return { drawNumber, numbers: allNumbers, groups, jackpot1: '2 Tỷ', prizes }
}

// ─── Insert DB ────────────────────────────────────────
async function insertToDB(
    parsed: VietlottParsed,
    gameCode: string,
    prizeNameMain: string,
    drawDate: Date,
    source: string
): Promise<number> {
    const lotteryType = await prisma.lotteryType.findUnique({ where: { code: gameCode } })
    if (!lotteryType) throw new Error(`LotteryType ${gameCode} not found`)

    const provinceId = await getVietlottProvinceId(lotteryType.id)
    const [y, m, d] = drawDate.toISOString().split('T')[0].split('-').map(Number)
    const date = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))

    const draw = await prisma.draw.upsert({
        where: { drawDate_lotteryTypeId_provinceId: { drawDate: date, lotteryTypeId: lotteryType.id, provinceId } },
        update: { isComplete: true, crawledAt: new Date(), crawlSource: source, drawNumber: parsed.drawNumber ? parseInt(parsed.drawNumber, 10) : undefined },
        create: { drawDate: date, lotteryTypeId: lotteryType.id, provinceId, isComplete: true, crawledAt: new Date(), crawlSource: source, drawNumber: parsed.drawNumber ? parseInt(parsed.drawNumber, 10) : undefined },
    })

    await prisma.result.deleteMany({ where: { drawId: draw.id } })

    if (parsed.groups && parsed.groups.length > 0) {
        // Max 3D / Max 3D Pro — lưu từng giải riêng biệt
        // prizeName dùng VL1..VL5 theo thứ tự: ĐB=VL1, Nhất=VL2, Nhì=VL3, Ba=VL4
        const PRIZE_NAME_MAP: Record<string, string> = {
            'Đặc biệt': 'VL1', 'Giải nhất': 'VL2',
            'Giải nhì': 'VL3', 'Giải ba': 'VL4',
        }
        for (const group of parsed.groups) {
            // Chỉ lưu giải chính (bỏ các dòng ghi chú không có số)
            if (group.numbers.length === 0) continue
            const pName = PRIZE_NAME_MAP[group.prizeName] ?? 'VL5'
            await prisma.result.create({
                data: {
                    drawId: draw.id,
                    prizeName: pName as any,
                    numbers: group.numbers.map(String),
                    tailNums: group.numbers.map(n => n % 100),
                    headNums: group.numbers.map(n => Math.floor(n / 10)),
                },
            })
        }
    } else {
        // Mega / Power — 1 record số chính
        await prisma.result.create({
            data: {
                drawId: draw.id,
                prizeName: prizeNameMain as any,
                numbers: parsed.numbers.map(String),
                tailNums: parsed.numbers.map(n => n % 100),
                headNums: parsed.numbers.map(n => Math.floor(n / 10)),
            },
        })
    }

    // Số Power (chỉ Power 6/55)
    if (parsed.powerNumber !== undefined) {
        await prisma.result.create({
            data: {
                drawId: draw.id,
                prizeName: 'JP2' as any,
                numbers: [String(parsed.powerNumber)],
                tailNums: [parsed.powerNumber % 100],
                headNums: [Math.floor(parsed.powerNumber / 10)],
            },
        })
    }

    // Insert VietlottPrize — bảng giải thưởng chi tiết
    if (parsed.prizes.length > 0) {
        await prisma.vietlottPrize.deleteMany({ where: { drawId: draw.id } })
        await prisma.vietlottPrize.createMany({
            data: parsed.prizes.map(p => ({
                drawId: draw.id,
                name: p.name,
                winners: p.winners,
                value: p.value,
            })),
        })
    }

    await prisma.crawlLog.create({
        data: { lotteryTypeId: lotteryType.id, targetDate: drawDate, source, status: 'success', recordsInserted: 1 },
    })

    return 1
}

// ─── Helper tạo crawler function ─────────────────────
function makeCrawler(config: {
    gameCode: string
    prizeNameMain: string
    drawDays: number[]           // 0=CN, 1=T2... 6=T7
    urlFn: (dd: string, mm: string, yyyy: string) => string
    parseFn: (html: string) => VietlottParsed | null
    label: string
}) {
    return async function crawl(date?: Date): Promise<VietlottCrawlResult> {
        const targetDate = date ?? new Date()
        const dateStr = targetDate.toISOString().split('T')[0]
        const dow = targetDate.getDay()

        if (!config.drawDays.includes(dow)) {
            return { success: true, drawDate: dateStr, recordsInserted: 0, source: 'skip' }
        }

        const [yyyy, mm, dd] = dateStr.split('-')
        const url = config.urlFn(dd, mm, yyyy)
        console.log(`\n[${config.label}] === ${dateStr} ===\n  URL: ${url}`)

        const lotteryType = await prisma.lotteryType.findUnique({ where: { code: config.gameCode } })

        try {
            const html = await fetchHtml(url)
            const parsed = config.parseFn(html)

            if (!parsed) throw new Error('Không parse được kết quả')
            if (parsed.numbers.length === 0) throw new Error('Không có số kết quả')

            console.log(`  ✅ Kỳ ${parsed.drawNumber}: [${parsed.numbers.join(', ')}]${parsed.powerNumber !== undefined ? ` + ${parsed.powerNumber}` : ''}`)
            if (parsed.jackpot1) console.log(`  Jackpot: ${parsed.jackpot1}`)

            const count = await insertToDB(parsed, config.gameCode, config.prizeNameMain, targetDate, 'minhchinh.com')

            return { success: true, drawDate: dateStr, drawNumber: parsed.drawNumber ?? undefined, recordsInserted: count, source: 'minhchinh.com' }
        } catch (err) {
            const error = String(err)
            console.error(`  ❌ ${error}`)
            if (lotteryType) {
                await prisma.crawlLog.create({
                    data: { lotteryTypeId: lotteryType.id, targetDate, source: 'minhchinh.com', status: 'failed', recordsInserted: 0, errorMessage: error },
                })
            }
            await sendAlert(`🚨 <b>${config.label} FAIL</b>\n📅 <b>${dateStr}</b>\n❌ ${error}`)
            return { success: false, drawDate: dateStr, recordsInserted: 0, source: 'minhchinh.com', error }
        }
    }
}

// ─── Exported crawlers ────────────────────────────────
export const crawlMega645 = makeCrawler({
    gameCode: 'MEGA645', prizeNameMain: 'VL1',
    drawDays: [3, 5, 0], // T4, T6, CN
    urlFn: (dd, mm, yyyy) => `https://www.minhchinh.com/xs-mega-645-ket-qua-mega-645-ngay-${dd}-${mm}-${yyyy}.html`,
    parseFn: parseMega,
    label: 'Mega 6/45',
})

export const crawlPower655 = makeCrawler({
    gameCode: 'POWER655', prizeNameMain: 'JP1',
    drawDays: [2, 4, 6], // T3, T5, T7
    urlFn: (dd, mm, yyyy) => `https://www.minhchinh.com/xs-power-655-ket-qua-power-655-ngay-${dd}-${mm}-${yyyy}.html`,
    parseFn: parsePower,
    label: 'Power 6/55',
})

export const crawlMax3D = makeCrawler({
    gameCode: 'MAX3D', prizeNameMain: 'VL1',
    drawDays: [1, 3, 5], // T2, T4, T6
    urlFn: (dd, mm, yyyy) => `https://www.minhchinh.com/xs-max-3d-ket-qua-max-3d-ngay-${dd}-${mm}-${yyyy}.html`,
    parseFn: parseMax3D,
    label: 'Max 3D',
})

export const crawlMax3DPro = makeCrawler({
    gameCode: 'MAX3DPRO', prizeNameMain: 'VL1',
    drawDays: [2, 4, 6], // T3, T5, T7
    urlFn: (dd, mm, yyyy) => `https://www.minhchinh.com/xs-max3d-pro-ket-qua-max3d-pro-ngay-${dd}-${mm}-${yyyy}.html`,
    parseFn: parseMax3DPro,
    label: 'Max 3D Pro',
})