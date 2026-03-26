// src/scripts/crawlers/xsmn.ts
//
// Nguồn: xosodaiphat.com — render tĩnh, verified 25/03/2026
//
// Mapping giải (theo thứ tự row trong tbody):
//   row 0: G.8  → PrizeName.G7  (2 số)
//   row 1: G.7  → PrizeName.G6  (3 số)
//   row 2: G.6  → PrizeName.G5  (4 số, 3 con)
//   row 3: G.5  → PrizeName.G4  (4 số)
//   row 4: G.4  → PrizeName.G3  (5 số, 7 con)
//   row 5: G.3  → PrizeName.G2  (5 số, 2 con)
//   row 6: G.2  → PrizeName.G1  (5 số)
//   row 7: G.1  → bỏ qua
//   row 8: G.ĐB → PrizeName.DB  (6 số)

import * as cheerio from 'cheerio'
import { PrismaClient, PrizeName } from '@prisma/client'

const prisma = new PrismaClient()

export interface CrawlResult {
    success: boolean
    drawDate: string
    recordsInserted: number
    source: string
    error?: string
}

interface ParsedPrize {
    name: PrizeName
    numbers: string[]
}

interface ParsedProvince {
    code: string
    prizes: ParsedPrize[]
}

// ─── Lịch quay XSMN ──────────────────────────────────
const XSMN_SCHEDULE: Record<number, string[]> = {
    1: ['TPHCM', 'DONGTHAP', 'CAMAU'],
    2: ['BACLIEU', 'BINHDUONG', 'VUNGTAU'],
    3: ['CANTHO', 'DONGNAI', 'SOCTRANG'],
    4: ['TAYNINH', 'ANGIANG', 'BINHTHUAN'],
    5: ['VINHLONG', 'BINHPHUOC', 'TRAVINH'],
    6: ['TPHCM', 'LONGAN', 'BINHDUONG'],
    0: ['TIENGIANG', 'KIENGIANG', 'DALAT'],
}

// Map tên đài (lowercase) → province code DB
const NAME_TO_CODE: Record<string, string> = {
    'đồng nai': 'DONGNAI',
    'cần thơ': 'CANTHO',
    'sóc trăng': 'SOCTRANG',
    'bạc liêu': 'BACLIEU',
    'bình dương': 'BINHDUONG',
    'vũng tàu': 'VUNGTAU',
    'tây ninh': 'TAYNINH',
    'an giang': 'ANGIANG',
    'bình thuận': 'BINHTHUAN',
    'vĩnh long': 'VINHLONG',
    'bình phước': 'BINHPHUOC',
    'trà vinh': 'TRAVINH',
    'tp. hcm': 'TPHCM',
    'tp.hcm': 'TPHCM',
    'hồ chí minh': 'TPHCM',
    'long an': 'LONGAN',
    'tiền giang': 'TIENGIANG',
    'kiên giang': 'KIENGIANG',
    'đà lạt': 'DALAT',
    'đồng tháp': 'DONGTHAP',
    'cà mau': 'CAMAU',
}

// Row index → PrizeName (null = bỏ qua)
const ROW_MAP: (PrizeName | null)[] = [
    PrizeName.G7,  // row 0: G.8
    PrizeName.G6,  // row 1: G.7
    PrizeName.G5,  // row 2: G.6
    PrizeName.G4,  // row 3: G.5
    PrizeName.G3,  // row 4: G.4
    PrizeName.G2,  // row 5: G.3
    PrizeName.G1,  // row 6: G.2
    null,          // row 7: G.1 — bỏ qua
    PrizeName.DB,  // row 8: G.ĐB
]

const PRIZE_ORDER = [
    PrizeName.DB, PrizeName.G1, PrizeName.G2, PrizeName.G3,
    PrizeName.G4, PrizeName.G5, PrizeName.G6, PrizeName.G7,
]

// ─── Helpers ──────────────────────────────────────────
function norm(s: string): string {
    return s.replace(/\D/g, '').trim()
}
function tailNum(s: string): number {
    return parseInt(norm(s).slice(-2), 10)
}
function headNum(s: string): number {
    const n = norm(s)
    return n.length <= 2 ? 0 : parseInt(n.slice(0, 2), 10)
}

async function fetchHtml(url: string): Promise<string> {
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,*/*',
                    'Accept-Language': 'vi-VN,vi;q=0.9',
                    'Referer': 'https://xosodaiphat.com/',
                },
                signal: AbortSignal.timeout(15000),
            })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            return await res.text()
        } catch (err) {
            if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 1500))
            else throw err
        }
    }
    throw new Error('Max retries exceeded')
}

function validate(prizes: ParsedPrize[], code: string): { valid: boolean; reason?: string } {
    if (prizes.length < 7) {
        return { valid: false, reason: `${code}: chỉ có ${prizes.length}/7 giải` }
    }
    const db = prizes.find(p => p.name === PrizeName.DB)
    if (!db) return { valid: false, reason: `${code}: thiếu giải ĐB` }
    if (norm(db.numbers[0] ?? '').length !== 6) {
        return { valid: false, reason: `${code}: giải ĐB không hợp lệ "${db.numbers[0]}"` }
    }
    return { valid: true }
}

// ─── Parser: xosodaiphat.com ──────────────────────────
// table.table-xsmn
//   thead > tr > th (col 0 = "Giải", col 1..N = đài qua a[title])
//   tbody > tr (9 rows: G.8→G.ĐB)
//     td.tn_prize > span: số (text, trim whitespace)
function parseDaiphat(html: string): ParsedProvince[] {
    const $ = cheerio.load(html)

    const table = $('table.table-xsmn').first()
    if (!table.length) {
        console.warn('[XSMN] table.table-xsmn not found in daiphat HTML')
        return []
    }

    // Lấy tên đài từ thead (bỏ cột 0 "Giải")
    const codes: string[] = []
    table.find('thead th').each((i, th) => {
        if (i === 0) return
        const a = $(th).find('a').first()
        const fromTitle = (a.attr('title') ?? '').replace(/^Xổ số /i, '').toLowerCase().trim()
        const fromText = a.text().toLowerCase().trim()
        const code = NAME_TO_CODE[fromTitle] ?? NAME_TO_CODE[fromText]
        if (code) codes.push(code)
    })

    if (codes.length === 0) {
        console.warn('[XSMN] Không tìm thấy đài nào trong thead')
        return []
    }

    // Init prize map cho mỗi đài
    const prizeMap: Record<string, ParsedPrize[]> = {}
    codes.forEach(c => { prizeMap[c] = [] })

    // Parse từng row
    table.find('tbody tr').each((rowIdx, row) => {
        if (rowIdx >= ROW_MAP.length) return
        const prizeName = ROW_MAP[rowIdx]
        if (prizeName === null) return // bỏ G.1

        $(row).find('td.tn_prize').each((colIdx, td) => {
            const code = codes[colIdx]
            if (!code) return

            const numbers: string[] = []
            $(td).find('span').each((_, el) => {
                const n = norm($(el).text())
                if (n.length >= 2) numbers.push(n)
            })

            if (numbers.length > 0) {
                prizeMap[code].push({ name: prizeName, numbers })
            }
        })
    })

    // Build result, sort giải theo thứ tự chuẩn
    return codes.flatMap(code => {
        const prizes = prizeMap[code]
        if (!prizes.length) return []
        prizes.sort((a, b) => PRIZE_ORDER.indexOf(a.name) - PRIZE_ORDER.indexOf(b.name))
        return [{ code, prizes }]
    })
}

// ─── Insert DB ────────────────────────────────────────
async function insertProvince(
    province: ParsedProvince,
    drawDate: Date,
    source: string
): Promise<number> {
    const lotteryType = await prisma.lotteryType.findUnique({ where: { code: 'XSMN' } })
    if (!lotteryType) throw new Error('LotteryType XSMN not found — chạy seed chưa?')

    const prov = await prisma.province.findUnique({ where: { code: province.code } })
    if (!prov) {
        console.warn(`  Province ${province.code} not in DB, skip`)
        return 0
    }

    // Thành:
    // Tạo ngày đúng theo VN timezone (UTC+7)
    // Lấy yyyy-mm-dd từ dateStr rồi set 17:00 UTC = 00:00 VN
    const dateStr = drawDate.toISOString().split('T')[0]
    const [y, m, d] = dateStr.split('-').map(Number)
    // 17:00 UTC = 00:00 ngày hôm sau VN → dùng 7 giờ sáng VN = 00:00 UTC ngày đó
    const date = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))

    const draw = await prisma.draw.upsert({
        where: {
            drawDate_lotteryTypeId_provinceId: {
                drawDate: date, lotteryTypeId: lotteryType.id, provinceId: prov.id,
            },
        },
        update: { isComplete: true, crawledAt: new Date(), crawlSource: source },
        create: {
            drawDate: date, lotteryTypeId: lotteryType.id, provinceId: prov.id,
            isComplete: true, crawledAt: new Date(), crawlSource: source,
        },
    })

    await prisma.result.deleteMany({ where: { drawId: draw.id } })

    for (const p of province.prizes) {
        await prisma.result.create({
            data: {
                drawId: draw.id,
                prizeName: p.name,
                numbers: p.numbers,
                tailNums: p.numbers.map(tailNum),
                headNums: p.numbers.map(headNum),
            },
        })
    }

    // LotoResult
    const allTails = province.prizes.flatMap(p => p.numbers.map(tailNum))
    const heads: Record<number, number[]> = {}
    for (let i = 0; i <= 9; i++) heads[i] = []
    allTails.forEach(n => heads[Math.floor(n / 10)].push(n % 10))

    await prisma.lotoResult.upsert({
        where: { drawId: draw.id },
        update: {
            head0: heads[0], head1: heads[1], head2: heads[2], head3: heads[3],
            head4: heads[4], head5: heads[5], head6: heads[6], head7: heads[7],
            head8: heads[8], head9: heads[9], allTwoDigits: allTails,
        },
        create: {
            drawId: draw.id,
            head0: heads[0], head1: heads[1], head2: heads[2], head3: heads[3],
            head4: heads[4], head5: heads[5], head6: heads[6], head7: heads[7],
            head8: heads[8], head9: heads[9], allTwoDigits: allTails,
        },
    })

    return province.prizes.length
}

// ─── Telegram ─────────────────────────────────────────
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

// ─── Main ─────────────────────────────────────────────
export async function crawlXSMN(date?: Date): Promise<CrawlResult> {
    const targetDate = date ?? new Date()
    const dateStr = targetDate.toISOString().split('T')[0]
    const dow = targetDate.getDay()
    const dd = String(targetDate.getDate()).padStart(2, '0')
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0')
    const yyyy = targetDate.getFullYear()

    const todayProvinces = XSMN_SCHEDULE[dow] ?? []
    if (todayProvinces.length === 0) {
        return { success: true, drawDate: dateStr, recordsInserted: 0, source: 'skip' }
    }

    console.log(`\n[XSMN] === ${dateStr} | ${todayProvinces.join(', ')} ===`)

    const lotteryType = await prisma.lotteryType.findUnique({ where: { code: 'XSMN' } })
    const url = `https://xosodaiphat.com/xsmn-${dd}-${mm}-${yyyy}.html`

    // ── Fetch và parse ─────────────────────────────────
    let provinces: ParsedProvince[] = []
    try {
        const html = await fetchHtml(url)
        provinces = parseDaiphat(html)
        console.log(`  ✅ daiphat: ${provinces.length} đài (${provinces.map(p => p.code).join(', ')})`)
    } catch (err) {
        const error = String(err)
        console.error(`  ❌ daiphat: ${error}`)
        if (lotteryType) {
            await prisma.crawlLog.create({
                data: {
                    lotteryTypeId: lotteryType.id, targetDate,
                    source: 'xosodaiphat.com', status: 'failed',
                    recordsInserted: 0, errorMessage: error,
                },
            })
        }
        await sendAlert(`🚨 <b>XSMN FAIL</b>\n📅 <b>${dateStr}</b>\n❌ ${error}`)
        return { success: false, drawDate: dateStr, recordsInserted: 0, source: 'xosodaiphat.com', error }
    }

    if (provinces.length === 0) {
        const error = 'Không parse được đài nào từ daiphat'
        console.error(`  ❌ ${error}`)
        await sendAlert(`🚨 <b>XSMN FAIL</b>\n📅 <b>${dateStr}</b>\n❌ ${error}`)
        return { success: false, drawDate: dateStr, recordsInserted: 0, source: 'xosodaiphat.com', error }
    }

    // ── Validate và insert từng đài ────────────────────
    let total = 0

    console.log(`[XSMN] Provinces to insert: ${provinces.length}`, provinces.map(p => p.code))

    for (const province of provinces) {
        const { valid, reason } = validate(province.prizes, province.code)
        if (!valid) {
            console.warn(`  ⚠️  ${reason} — skip`)
            continue
        }
        const count = await insertProvince(province, targetDate, 'xosodaiphat.com')
        total += count
        const db = province.prizes.find(p => p.name === PrizeName.DB)
        console.log(`  ✅ ${province.code}: ĐB=${db?.numbers[0]} (${count} giải)`)
    }

    console.log(`[XSMN] total after loop: ${total}`)

    if (lotteryType) {
        await prisma.crawlLog.create({
            data: {
                lotteryTypeId: lotteryType.id, targetDate,
                source: 'xosodaiphat.com', status: 'success',
                recordsInserted: total,
            },
        })
    }

    console.log(`[XSMN] Provinces inserted:`, provinces.map(p => p.code))

    console.log(`[XSMN] ✅ Done: ${total} records, ${provinces.length} đài`)
    return {
        success: true,
        drawDate: dateStr,
        recordsInserted: total,
        source: 'xosodaiphat.com',
    }
}