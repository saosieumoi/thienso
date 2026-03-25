// src/scripts/crawlers/xsmt.ts
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

interface SourceResult {
    name: string
    prizes: ParsedPrize[]
    success: boolean
    error?: string
}

// ─────────────────────────────────────────────────────
// Lịch quay XSMT theo ngày trong tuần
// 0=CN, 1=T2, 2=T3, 3=T4, 4=T5, 5=T6, 6=T7
// Mỗi ngày 2 đài quay (trừ một số ngày có 3 đài)
// ─────────────────────────────────────────────────────
const XSMT_SCHEDULE: Record<number, Array<{ code: string; name: string }>> = {
    1: [ // Thứ 2
        { code: 'THUATHIENHUE', name: 'Thừa Thiên Huế' },
        { code: 'PHUYEN', name: 'Phú Yên' },
    ],
    2: [ // Thứ 3
        { code: 'DAKNONG', name: 'Đắk Nông' },
        { code: 'QUANGNAM', name: 'Quảng Nam' },
    ],
    3: [ // Thứ 4
        { code: 'DANANG', name: 'Đà Nẵng' },
        { code: 'KHANHHOA', name: 'Khánh Hòa' },
    ],
    4: [ // Thứ 5
        { code: 'BINHDINH', name: 'Bình Định' },
        { code: 'QUANGTRI', name: 'Quảng Trị' },
        { code: 'QUANGBINH', name: 'Quảng Bình' },
    ],
    5: [ // Thứ 6
        { code: 'GIALAI', name: 'Gia Lai' },
        { code: 'NINHTHUAN', name: 'Ninh Thuận' },
    ],
    6: [ // Thứ 7
        { code: 'DANANG2', name: 'Đà Nẵng' },
        { code: 'KHANHHOA2', name: 'Khánh Hòa' },
        { code: 'DAKLAK', name: 'Đắk Lắk' },
    ],
    0: [ // Chủ nhật
        { code: 'KONTUM', name: 'Kon Tum' },
        { code: 'QUANGNGAI', name: 'Quảng Ngãi' },
        { code: 'DAKNONG2', name: 'Đắk Nông' },
    ],
}

// ─────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────
function normalizeNum(s: string): string {
    return s.replace(/\D/g, '').trim()
}

function getTailNum(s: string): number {
    const n = s.replace(/\D/g, '')
    return parseInt(n.slice(-2), 10)
}

function getHeadNum(s: string): number {
    const n = s.replace(/\D/g, '')
    return n.length <= 2 ? 0 : parseInt(n.slice(0, 2), 10)
}

async function fetchText(url: string): Promise<string> {
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,*/*',
                    'Accept-Language': 'vi-VN,vi;q=0.9',
                    'Referer': 'https://xoso.com.vn/',
                },
                signal: AbortSignal.timeout(15000),
            })
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
            return await res.text()
        } catch (err) {
            console.error(`  Attempt ${attempt}/3 failed: ${String(err)}`)
            if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 1500))
            else throw err
        }
    }
    throw new Error('Max retries exceeded')
}

// ─────────────────────────────────────────────────────
// Validate
// XSMT giải ĐB là 6 số (khác XSMB là 5 số)
// ─────────────────────────────────────────────────────
function validate(prizes: ParsedPrize[]): { valid: boolean; reason?: string } {
    if (prizes.length < 7) {
        return { valid: false, reason: `Chỉ parse được ${prizes.length}/7 giải` }
    }
    const db = prizes.find(p => p.name === PrizeName.DB)
    if (!db) {
        return { valid: false, reason: 'Thiếu giải đặc biệt' }
    }
    const dbNum = normalizeNum(db.numbers[0] ?? '')
    if (dbNum.length !== 6) {
        return { valid: false, reason: `Giải ĐB không hợp lệ (cần 6 số): "${db.numbers[0]}"` }
    }
    return { valid: true }
}

// ─────────────────────────────────────────────────────
// Cross-validate
// ─────────────────────────────────────────────────────
interface CrossValidateResult {
    match: boolean
    mismatches: string[]
    mergedPrizes: ParsedPrize[]
}

function crossValidate(source1: ParsedPrize[], source2: ParsedPrize[]): CrossValidateResult {
    const mismatches: string[] = []
    const PRIZE_ORDER: PrizeName[] = [
        PrizeName.DB, PrizeName.G1, PrizeName.G2, PrizeName.G3,
        PrizeName.G4, PrizeName.G5, PrizeName.G6, PrizeName.G7,
    ]

    for (const prizeName of PRIZE_ORDER) {
        const p1 = source1.find(p => p.name === prizeName)
        const p2 = source2.find(p => p.name === prizeName)

        if (!p1 && !p2) continue

        if (!p1 || !p2) {
            mismatches.push(
                `${prizeName}: nguồn 1=[${p1?.numbers.join(',')}] nguồn 2=[${p2?.numbers.join(',')}]`
            )
            continue
        }

        if (p1.numbers.length !== p2.numbers.length) {
            mismatches.push(
                `${prizeName}: số lượng khác — nguồn 1:${p1.numbers.length} nguồn 2:${p2.numbers.length}`
            )
            continue
        }

        const nums1 = p1.numbers.map(normalizeNum).sort()
        const nums2 = p2.numbers.map(normalizeNum).sort()
        if (nums1.some((n, i) => n !== nums2[i])) {
            mismatches.push(
                `${prizeName}: không khớp — [${nums1.join(',')}] vs [${nums2.join(',')}]`
            )
        }
    }

    return { match: mismatches.length === 0, mismatches, mergedPrizes: source1 }
}

// ─────────────────────────────────────────────────────
// Parsers
// ─────────────────────────────────────────────────────

// Nguồn 1: xoso.com.vn
// XSMT dùng prefix mt_ thay vì mb_
// id: mt_prize_DB_item_0, mt_prize_1_item_0...
function parseXosoMT(html: string): ParsedPrize[] {
    const $ = cheerio.load(html)
    const prizes: ParsedPrize[] = []

    const ID_MAP: Record<string, PrizeName> = {
        'mt_prize_DB_item_': PrizeName.DB,
        'mt_prize_1_item_': PrizeName.G1,
        'mt_prize_2_item_': PrizeName.G2,
        'mt_prize_3_item_': PrizeName.G3,
        'mt_prize_4_item_': PrizeName.G4,
        'mt_prize_5_item_': PrizeName.G5,
        'mt_prize_6_item_': PrizeName.G6,
        'mt_prize_7_item_': PrizeName.G7,
    }

    for (const [prefix, prizeName] of Object.entries(ID_MAP)) {
        const numbers: string[] = []
        $(`span[id^="${prefix}"]`).each((_, el) => {
            const num = normalizeNum($(el).text())
            if (num.length >= 2) numbers.push(num)
        })
        if (numbers.length > 0) prizes.push({ name: prizeName, numbers })
    }

    return prizes
}

// Nguồn 2: minhngoc.net.vn
// Trang hiển thị nhiều kỳ — tìm đúng block theo ngày
// Structure giống XSMB: td.giaidb, td.giai1...td.giai7
function parseMinhNgocMT(html: string, targetDate: Date): ParsedPrize[] {
    const $ = cheerio.load(html)
    const prizes: ParsedPrize[] = []

    const dd = String(targetDate.getDate()).padStart(2, '0')
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0')
    const yyyy = targetDate.getFullYear()
    const targetDateStr = `${dd}/${mm}/${yyyy}`

    const CLASS_MAP: Record<string, PrizeName> = {
        'giaidb': PrizeName.DB,
        'giai1': PrizeName.G1,
        'giai2': PrizeName.G2,
        'giai3': PrizeName.G3,
        'giai4': PrizeName.G4,
        'giai5': PrizeName.G5,
        'giai6': PrizeName.G6,
        'giai7': PrizeName.G7,
    }

    // Tìm block theo ngày
    let targetBlock: ReturnType<typeof $> | null = null

    $('td.ngay').each((_, el) => {
        const dateText = $(el).find('span.tngay a').first().text().trim()
        if (dateText === targetDateStr) {
            targetBlock = $(el).closest('tr')
            return false
        }
    })

    if (!targetBlock) {
        console.warn(`[parseMinhNgocMT] Không tìm thấy ngày ${targetDateStr}`)
        return []
    }

    let current = (targetBlock as ReturnType<typeof $>).next('tr')

    while (current.length) {
        if (current.find('td.ngay').length > 0 || current.find('td.thu').length > 0) break

        const td = current.find('td[class]').filter((_, el) => {
            const cls = $(el).attr('class')?.trim() ?? ''
            return Object.keys(CLASS_MAP).includes(cls)
        }).first()

        if (td.length) {
            const cls = (td.attr('class') ?? '').trim()
            const prizeName = CLASS_MAP[cls]
            if (prizeName) {
                const numbers: string[] = []
                td.next('td').find('div').each((_, el) => {
                    const num = normalizeNum($(el).text())
                    if (num.length >= 2) numbers.push(num)
                })
                if (numbers.length > 0) prizes.push({ name: prizeName, numbers })
            }
        }

        current = current.next('tr')
    }

    return prizes
}

// ─────────────────────────────────────────────────────
// Telegram Alert
// ─────────────────────────────────────────────────────
async function sendTelegramAlert(message: string): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID
    if (!token || !chatId) {
        console.warn('[Crawler XSMT] Chưa set Telegram env vars')
        return
    }
    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
        })
        console.log('[Crawler XSMT] Telegram alert sent ✅')
    } catch (err) {
        console.error('[Crawler XSMT] Telegram error:', String(err))
    }
}

// ─────────────────────────────────────────────────────
// Insert vào DB — mỗi đài là 1 draw riêng
// ─────────────────────────────────────────────────────
async function insertToDB(
    prizes: ParsedPrize[],
    drawDate: Date,
    provinceCode: string,
    source: string
): Promise<number> {
    const lotteryType = await prisma.lotteryType.findUnique({ where: { code: 'XSMT' } })
    if (!lotteryType) throw new Error('LotteryType XSMT not found — đã chạy seed chưa?')

    const province = await prisma.province.findUnique({ where: { code: provinceCode } })
    if (!province) {
        console.warn(`[XSMT] Province ${provinceCode} not found, skipping insert`)
        return 0
    }

    const date = new Date(drawDate)
    date.setHours(0, 0, 0, 0)

    const draw = await prisma.draw.upsert({
        where: {
            drawDate_lotteryTypeId_provinceId: {
                drawDate: date,
                lotteryTypeId: lotteryType.id,
                provinceId: province.id,
            },
        },
        update: { isComplete: true, crawledAt: new Date(), crawlSource: source },
        create: {
            drawDate: date,
            lotteryTypeId: lotteryType.id,
            provinceId: province.id,
            isComplete: true,
            crawledAt: new Date(),
            crawlSource: source,
        },
    })

    await prisma.result.deleteMany({ where: { drawId: draw.id } })

    for (const p of prizes) {
        await prisma.result.create({
            data: {
                drawId: draw.id,
                prizeName: p.name,
                numbers: p.numbers,
                tailNums: p.numbers.map(getTailNum),
                headNums: p.numbers.map(getHeadNum),
            },
        })
    }

    const allTails = prizes.flatMap(p => p.numbers.map(getTailNum))
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

    return prizes.length
}

// ─────────────────────────────────────────────────────
// Hàm chính — Cross-validate đầy đủ
// ─────────────────────────────────────────────────────
export async function crawlXSMT(date?: Date): Promise<CrawlResult> {
    const targetDate = date ?? new Date()
    const dateStr = targetDate.toISOString().split('T')[0]
    const dayOfWeek = targetDate.getDay()

    const dd = String(targetDate.getDate()).padStart(2, '0')
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0')
    const yyyy = targetDate.getFullYear()

    const todayProvinces = XSMT_SCHEDULE[dayOfWeek] ?? []

    // Nếu hôm nay không có đài XSMT nào quay
    if (todayProvinces.length === 0) {
        console.log(`[Crawler XSMT] Không có đài XSMT hôm nay (thứ ${dayOfWeek})`)
        return { success: true, drawDate: dateStr, recordsInserted: 0, source: 'skip' }
    }

    console.log(`\n[Crawler XSMT] === Crawl ngày ${dateStr} ===`)
    console.log(`[Crawler XSMT] Đài hôm nay: ${todayProvinces.map(p => p.name).join(', ')}`)

    const lotteryType = await prisma.lotteryType.findUnique({ where: { code: 'XSMT' } })

    // ── Bước 1: Fetch song song 2 nguồn ────────────────
    console.log('[Crawler XSMT] Bước 1: Fetch 2 nguồn song song...')

    const [res1, res2] = await Promise.all([
        // Nguồn 1: xoso.com.vn
        (async (): Promise<SourceResult> => {
            const url = `https://xoso.com.vn/xsmt-${dd}-${mm}-${yyyy}.html`
            try {
                console.log(`  → Fetching xoso.com.vn: ${url}`)
                const html = await fetchText(url)
                const prizes = parseXosoMT(html)
                const { valid, reason } = validate(prizes)
                if (!valid) return { name: 'xoso.com.vn', prizes: [], success: false, error: reason }
                const db = prizes.find(p => p.name === PrizeName.DB)
                console.log(`  ✅ xoso.com.vn: ${prizes.length} giải, ĐB = ${db?.numbers[0]}`)
                return { name: 'xoso.com.vn', prizes, success: true }
            } catch (err) {
                console.error(`  ❌ xoso.com.vn: ${String(err)}`)
                return { name: 'xoso.com.vn', prizes: [], success: false, error: String(err) }
            }
        })(),

        // Nguồn 2: minhngoc.net.vn
        (async (): Promise<SourceResult> => {
            const url = `https://www.minhngoc.net.vn/ket-qua-xo-so/mien-trung.html`
            try {
                console.log(`  → Fetching minhngoc.net.vn: ${url}`)
                const html = await fetchText(url)
                const prizes = parseMinhNgocMT(html, targetDate)
                const { valid, reason } = validate(prizes)
                if (!valid) return { name: 'minhngoc.net.vn', prizes: [], success: false, error: reason }
                const db = prizes.find(p => p.name === PrizeName.DB)
                console.log(`  ✅ minhngoc.net.vn: ${prizes.length} giải, ĐB = ${db?.numbers[0]}`)
                return { name: 'minhngoc.net.vn', prizes, success: true }
            } catch (err) {
                console.error(`  ❌ minhngoc.net.vn: ${String(err)}`)
                return { name: 'minhngoc.net.vn', prizes: [], success: false, error: String(err) }
            }
        })(),
    ])

    const successSources = [res1, res2].filter(r => r.success)

    // ── Bước 2: Kiểm tra đủ 2 nguồn không ─────────────
    if (successSources.length < 2) {
        const errors = [res1, res2]
            .filter(r => !r.success)
            .map(r => `${r.name}: ${r.error}`)
            .join('\n')

        console.error(`[Crawler XSMT] 🚨 Không đủ 2 nguồn để cross-validate`)

        if (lotteryType) {
            await prisma.crawlLog.create({
                data: {
                    lotteryTypeId: lotteryType.id,
                    targetDate,
                    source: 'all_failed',
                    status: 'failed',
                    recordsInserted: 0,
                    errorMessage: `Không đủ nguồn: ${errors}`,
                },
            })
        }

        await sendTelegramAlert(
            `🚨 <b>Thiên Số — XSMT Crawler FAIL</b>\n\n` +
            `📅 Ngày: <b>${dateStr}</b>\n` +
            `🏙 Đài: ${todayProvinces.map(p => p.name).join(', ')}\n` +
            `⏰ ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}\n\n` +
            `❌ Không đủ 2 nguồn:\n${errors}\n\n` +
            `⚠️ Cần crawl lại thủ công!`
        )

        return {
            success: false,
            drawDate: dateStr,
            recordsInserted: 0,
            source: 'none',
            error: errors,
        }
    }

    // ── Bước 3: Cross-validate ──────────────────────────
    const [src1, src2] = successSources
    console.log(`\n[Crawler XSMT] Bước 3: Cross-validate "${src1.name}" vs "${src2.name}"...`)

    const { match, mismatches, mergedPrizes } = crossValidate(src1.prizes, src2.prizes)

    if (!match) {
        const detail = mismatches.join('\n')
        console.warn('[Crawler XSMT] ⚠️  Data không khớp:')
        mismatches.forEach(m => console.warn(`  • ${m}`))

        if (lotteryType) {
            await prisma.crawlLog.create({
                data: {
                    lotteryTypeId: lotteryType.id,
                    targetDate,
                    source: `${src1.name} vs ${src2.name}`,
                    status: 'failed',
                    recordsInserted: 0,
                    errorMessage: `Mismatch:\n${detail}`,
                },
            })
        }

        await sendTelegramAlert(
            `⚠️ <b>Thiên Số — XSMT Data Mismatch</b>\n\n` +
            `📅 Ngày: <b>${dateStr}</b>\n` +
            `🏙 Đài: ${todayProvinces.map(p => p.name).join(', ')}\n\n` +
            `🔍 <b>${src1.name}</b> vs <b>${src2.name}</b>:\n` +
            `${mismatches.map(m => `• ${m}`).join('\n')}\n\n` +
            `💡 Có thể site đang cập nhật live — sẽ tự retry sau`
        )

        return {
            success: false,
            drawDate: dateStr,
            recordsInserted: 0,
            source: 'mismatch',
            error: detail,
        }
    }

    // ── Bước 4: Insert — mỗi đài insert riêng ──────────
    const sourceLabel = `${src1.name}+${src2.name}`
    console.log(`\n[Crawler XSMT] Bước 4: 2 nguồn khớp ✅ → Insert ${todayProvinces.length} đài...`)

    let totalInserted = 0

    for (const province of todayProvinces) {
        try {
            // Mỗi đài trong cùng 1 ngày dùng chung 1 bộ kết quả
            // (XSMT mỗi ngày chỉ có kết quả chung cho các đài quay ngày đó)
            const count = await insertToDB(mergedPrizes, targetDate, province.code, sourceLabel)
            totalInserted += count
            console.log(`  ✅ ${province.name} (${province.code}): ${count} giải`)
        } catch (err) {
            console.error(`  ❌ ${province.name}: ${String(err)}`)
        }
    }

    // Ghi log thành công
    if (lotteryType) {
        await prisma.crawlLog.create({
            data: {
                lotteryTypeId: lotteryType.id,
                targetDate,
                source: sourceLabel,
                status: 'success',
                recordsInserted: totalInserted,
            },
        })
    }

    const dbPrize = mergedPrizes.find(p => p.name === PrizeName.DB)
    console.log(`\n[Crawler XSMT] ✅ Hoàn thành!`)
    console.log(`  Giải ĐB: ${dbPrize?.numbers[0]}`)
    console.log(`  Tổng records: ${totalInserted}`)
    console.log(`  Nguồn: ${sourceLabel}`)

    return {
        success: true,
        drawDate: dateStr,
        recordsInserted: totalInserted,
        source: sourceLabel,
    }
}