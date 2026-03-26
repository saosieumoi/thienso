// src/scripts/crawlers/xsmb.ts
import * as cheerio from 'cheerio'
import { PrismaClient, PrizeName } from '@prisma/client'

const prisma = new PrismaClient()

// ─────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────
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
// Helpers
// ─────────────────────────────────────────────────────
function getTailNum(s: string): number {
    const n = s.replace(/\D/g, '')
    return parseInt(n.slice(-2), 10)
}

function getHeadNum(s: string): number {
    const n = s.replace(/\D/g, '')
    return n.length <= 2 ? 0 : parseInt(n.slice(0, 2), 10)
}

function normalizeNum(s: string): string {
    return s.replace(/\D/g, '').trim()
}

// Thêm hàm này sau hàm normalizeNum
function parseSpecialCodes(html: string): string[] {
    const $ = cheerio.load(html)
    const codes: string[] = []

    // ── Nguồn 1: xoso.com.vn ─────────────────────────
    // <span id=mb_prizeCode_item0 class=code-DB8> 5YZ </span>
    $('span[id^="mb_prizeCode_item"]').each((_, el) => {
        const code = $(el).text().replace(/\s/g, '').trim()
        if (code.length > 0) codes.push(code)
    })
    if (codes.length > 0) return codes

    // ── Nguồn 2: minhngoc.net.vn ─────────────────────
    // <div class="loaive_content">9YZ-18YZ-17YZ-6YZ...</div>
    const loaiText = $('div.loaive_content').first().text().trim()
    if (loaiText) {
        loaiText.split('-').forEach(c => {
            const code = c.trim()
            if (code.length > 0) codes.push(code)
        })
        if (codes.length > 0) return codes
    }

    // ── Nguồn 3: xosodaiphat.com ─────────────────────
    // <span id=mb_prizeCode_item_0 class="madb8 special-code">10YX</span>
    $('span[id^="mb_prizeCode_item_"]').each((_, el) => {
        const code = $(el).text().replace(/\s/g, '').trim()
        if (code.length > 0) codes.push(code)
    })

    return codes
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
// Validate từng nguồn — phải đủ 7 giải + có giải ĐB hợp lệ
// ─────────────────────────────────────────────────────
function validate(prizes: ParsedPrize[]): { valid: boolean; reason?: string } {
    if (prizes.length < 7) {
        return { valid: false, reason: `Chỉ parse được ${prizes.length}/7 giải` }
    }
    const db = prizes.find(p => p.name === PrizeName.DB)
    if (!db) {
        return { valid: false, reason: 'Thiếu giải đặc biệt' }
    }
    if (normalizeNum(db.numbers[0] ?? '').length !== 5) {
        return { valid: false, reason: `Giải ĐB không hợp lệ: "${db.numbers[0]}"` }
    }
    return { valid: true }
}

// ─────────────────────────────────────────────────────
// Cross-validate — so sánh từng giải giữa 2 nguồn
// ─────────────────────────────────────────────────────
interface CrossValidateResult {
    match: boolean
    mismatches: string[]
    mergedPrizes: ParsedPrize[] // dùng data từ nguồn 1 nếu match
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

        // Cả 2 đều không có giải này — skip
        if (!p1 && !p2) continue

        // 1 nguồn có, 1 nguồn không có
        if (!p1 || !p2) {
            mismatches.push(
                `${prizeName}: nguồn 1 có [${p1?.numbers.join(',')}], nguồn 2 có [${p2?.numbers.join(',')}]`
            )
            continue
        }

        // Cả 2 đều có — so sánh số lượng
        if (p1.numbers.length !== p2.numbers.length) {
            mismatches.push(
                `${prizeName}: số lượng khác nhau — nguồn 1: ${p1.numbers.length}, nguồn 2: ${p2.numbers.length}`
            )
            continue
        }

        // So sánh từng số (đã normalize)
        const nums1 = p1.numbers.map(normalizeNum).sort()
        const nums2 = p2.numbers.map(normalizeNum).sort()
        const different = nums1.some((n, i) => n !== nums2[i])

        if (different) {
            mismatches.push(
                `${prizeName}: số không khớp — nguồn 1: [${nums1.join(', ')}], nguồn 2: [${nums2.join(', ')}]`
            )
        }
    }

    return {
        match: mismatches.length === 0,
        mismatches,
        mergedPrizes: source1, // dùng data nguồn 1 vì đây là nguồn ưu tiên
    }
}

// ─────────────────────────────────────────────────────
// Parsers
// ─────────────────────────────────────────────────────

// Nguồn 1: xoso.com.vn — id^="mb_prize"
function parseXosoComVn(html: string): ParsedPrize[] {
    const $ = cheerio.load(html)
    const prizes: ParsedPrize[] = []

    const ID_MAP: Record<string, PrizeName> = {
        'mb_prizeDB': PrizeName.DB,
        'mb_prize1': PrizeName.G1,
        'mb_prize2': PrizeName.G2,
        'mb_prize3': PrizeName.G3,
        'mb_prize4': PrizeName.G4,
        'mb_prize5': PrizeName.G5,
        'mb_prize6': PrizeName.G6,
        'mb_prize7': PrizeName.G7,
    }

    for (const [prefix, prizeName] of Object.entries(ID_MAP)) {
        const numbers: string[] = []
        $(`span[id^="${prefix}_item"]`).each((_, el) => {
            const num = normalizeNum($(el).text())
            if (num.length >= 2) numbers.push(num)
        })
        if (numbers.length > 0) prizes.push({ name: prizeName, numbers })
    }

    return prizes
}

// ─── Nguồn 2: minhngoc.net.vn ────────────────────────
// Trang hiển thị nhiều kỳ — cần tìm đúng block theo ngày
// Structure: tr.ngay (chứa date) → các tr.giai* ngay sau đó
function parseMinhNgoc(html: string, targetDate: Date): ParsedPrize[] {
    const $ = cheerio.load(html)
    const prizes: ParsedPrize[] = []

    const dd = String(targetDate.getDate()).padStart(2, '0')
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0')
    const yyyy = targetDate.getFullYear()
    const targetDateStr = `${dd}/${mm}/${yyyy}`

    const CLASS_MAP: Record<string, PrizeName> = {
        giaidb: PrizeName.DB,
        giai1: PrizeName.G1,
        giai2: PrizeName.G2,
        giai3: PrizeName.G3,
        giai4: PrizeName.G4,
        giai5: PrizeName.G5,
        giai6: PrizeName.G6,
        giai7: PrizeName.G7,
    }

    // Tìm đúng <tr> header của ngày cần lấy
    let startRow: cheerio.Cheerio<any> | null = null
    //let prizeCell: cheerio.Cheerio<cheerio.Element> | undefined

    $('tr').each((_, tr) => {
        const row = $(tr)
        const dateText = row.find('td.ngay span.tngay a').first().text().trim()
        if (dateText === targetDateStr) {
            startRow = row
        }
    })

    if (!startRow) {
        console.warn(`[parseMinhNgoc] Không tìm thấy ngày ${targetDateStr} trong trang`)
        return []
    }

    // Duyệt các dòng giải thưởng ngay sau dòng ngày
    let current = $(startRow).next()

    while (current.length) {
        // Gặp block ngày mới thì dừng
        if (current.find('td.ngay').length > 0 && current.find('td.thu').length > 0) {
            break
        }

        // Tìm ô chứa giải thưởng thực sự
        let matchedClass: string | null = null
        let prizeCell: cheerio.Cheerio<any> | null = null

        current.find('td').each((_, td) => {
            const classAttr = ($(td).attr('class') || '').trim()
            const classList = classAttr.split(/\s+/)

            for (const cls of classList) {
                if (CLASS_MAP[cls]) {
                    matchedClass = cls
                    prizeCell = $(td)
                    return false
                }
            }
        })

        if (matchedClass && prizeCell) {
            const prizeName = CLASS_MAP[matchedClass]
            const cell = prizeCell as cheerio.Cheerio<any>
            const numbers: string[] = []

            // Số nằm ngay trong td.giai*
            cell.find('div').each((_, div) => {
                const num = normalizeNum($(div).text())
                if (num.length >= 2) numbers.push(num)
            })

            // fallback: nếu không có <div>, lấy text trực tiếp
            if (numbers.length === 0) {
                const rawText = cell.text().trim()
                if (rawText) {
                    rawText
                        .split(/\s+/)
                        .map(normalizeNum)
                        .filter(num => num.length >= 2)
                        .forEach(num => numbers.push(num))
                }
            }

            if (numbers.length > 0) {
                prizes.push({ name: prizeName, numbers })
            }
        }

        current = current.next()
    }

    return prizes
}

// ─── Nguồn 3: xosodaiphat.com (fallback) ─────────────
// id pattern: mb_prize_DB_item_0, mb_prize_1_item_0 (có dấu _ thêm)
function parseXosodaiphat(html: string): ParsedPrize[] {
    const $ = cheerio.load(html)
    const prizes: ParsedPrize[] = []

    const ID_MAP: Record<string, PrizeName> = {
        'mb_prize_DB_item_': PrizeName.DB,
        'mb_prize_1_item_': PrizeName.G1,
        'mb_prize_2_item_': PrizeName.G2,
        'mb_prize_3_item_': PrizeName.G3,
        'mb_prize_4_item_': PrizeName.G4,
        'mb_prize_5_item_': PrizeName.G5,
        'mb_prize_6_item_': PrizeName.G6,
        'mb_prize_7_item_': PrizeName.G7,
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

// ─────────────────────────────────────────────────────
// Telegram Alert
// ─────────────────────────────────────────────────────
async function sendTelegramAlert(message: string): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID

    if (!token || !chatId) {
        console.warn('[Crawler] Chưa set TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID — bỏ qua alert')
        return
    }

    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML',
            }),
        })
        console.log('[Crawler] Telegram alert sent ✅')
    } catch (err) {
        console.error('[Crawler] Telegram error:', String(err))
    }
}

// ─────────────────────────────────────────────────────
// Insert vào Database
// ─────────────────────────────────────────────────────
async function insertToDB(
    prizes: ParsedPrize[],
    drawDate: Date,
    source: string,
    specialCodes: string[] = []
): Promise<number> {
    const lotteryType = await prisma.lotteryType.findUnique({ where: { code: 'XSMB' } })
    if (!lotteryType) throw new Error('LotteryType XSMB not found — đã chạy seed chưa?')

    const province = await prisma.province.findUnique({ where: { code: 'HN' } })
    if (!province) throw new Error('Province HN not found — đã chạy seed chưa?')

    const [yyyy, mm, dd] = drawDate.toISOString().split('T')[0].split('-').map(Number)
    const date = new Date(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0, 0))

    const draw = await prisma.draw.upsert({
        where: {
            drawDate_lotteryTypeId_provinceId: {
                drawDate: date,
                lotteryTypeId: lotteryType.id,
                provinceId: province.id,
            },
        },
        update: { isComplete: true, crawledAt: new Date(), crawlSource: source, specialCodes, },
        create: {
            drawDate: date,
            lotteryTypeId: lotteryType.id,
            provinceId: province.id,
            isComplete: true,
            crawledAt: new Date(),
            crawlSource: source,
            specialCodes,
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

function formatLocalYMD(date: Date): string {
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
}

// ─────────────────────────────────────────────────────
// Hàm chính — Cross-validate đầy đủ
// ─────────────────────────────────────────────────────
export async function crawlXSMB(date?: Date): Promise<CrawlResult> {
    const targetDate = date ?? new Date()
    const dateStr = formatLocalYMD(targetDate)

    const dd = String(targetDate.getDate()).padStart(2, '0')
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0')
    const yyyy = targetDate.getFullYear()

    console.log(`\n[Crawler XSMB] === Bắt đầu crawl ngày ${dateStr} ===`)

    // ── Bước 1: Fetch song song từ 2 nguồn chính ───────
    let source1Html = ''

    const sourceConfigs = [
        {
            name: 'xoso.com.vn',
            url: `https://xoso.com.vn/xsmb-${dd}-${mm}-${yyyy}.html`,
            parser: (html: string) => {
                source1Html = html // ← lưu lại html
                return parseXosoComVn(html)
            },
        },
        {
            name: 'minhngoc.net.vn',
            url: `https://www.minhngoc.net.vn/ket-qua-xo-so/mien-bac.html`,
            parser: (html: string) => parseMinhNgoc(html, targetDate), // truyền targetDate
        },
    ]

    console.log('[Crawler XSMB] Bước 1: Fetch 2 nguồn chính song song...')

    const sourceResults: SourceResult[] = await Promise.all(
        sourceConfigs.map(async (cfg): Promise<SourceResult> => {
            try {
                console.log(`  → Fetching ${cfg.name}...`)
                const html = await fetchText(cfg.url)
                // Thêm tạm 3 dòng debug này:
                const testCodes = parseSpecialCodes(html)
                console.log('[DEBUG specialCodes] found:', testCodes.length, testCodes)
                console.log('[DEBUG html snippet]', html.substring(html.indexOf('prizeCode'), html.indexOf('prizeCode') + 300))

                const prizes = cfg.parser(html)
                const { valid, reason } = validate(prizes)

                if (!valid) {
                    return { name: cfg.name, prizes: [], success: false, error: reason }
                }

                console.log(`  ✅ ${cfg.name}: ${prizes.length} giải, ĐB = ${prizes.find(p => p.name === PrizeName.DB)?.numbers[0]}`)
                return { name: cfg.name, prizes, success: true }
            } catch (err) {
                const msg = String(err)
                console.error(`  ❌ ${cfg.name} lỗi: ${msg}`)
                return { name: cfg.name, prizes: [], success: false, error: msg }
            }
        })
    )

    const lotteryType = await prisma.lotteryType.findUnique({ where: { code: 'XSMB' } })

    // ── Bước 2: Kiểm tra có ít nhất 2 nguồn thành công không ──
    const successSources = sourceResults.filter(r => r.success)

    if (successSources.length < 2) {
        // Không đủ 2 nguồn để cross-validate — thử nguồn dự phòng
        console.warn('\n[Crawler XSMB] Bước 2: Không đủ 2 nguồn, thử nguồn dự phòng...')

        const failedNames = sourceResults.filter(r => !r.success).map(r => r.name)

        // Thử xosodaiphat nếu chưa có đủ
        try {
            console.log('  → Fetching xosodaiphat.com (fallback)...')
            const html = await fetchText('https://xosodaiphat.com/xsmb-xo-so-mien-bac.html')
            const prizes = parseXosodaiphat(html)
            const { valid, reason } = validate(prizes)

            if (valid) {
                successSources.push({ name: 'xosodaiphat.com', prizes, success: true })
                console.log(`  ✅ xosodaiphat.com: ${prizes.length} giải`)
            } else {
                console.warn(`  ❌ xosodaiphat fallback invalid: ${reason}`)
            }
        } catch (err) {
            console.error(`  ❌ xosodaiphat fallback lỗi: ${String(err)}`)
        }

        // Vẫn không đủ 2 nguồn → alert và exit
        if (successSources.length < 2) {
            const allErrors = [
                ...sourceResults.map(r => `${r.name}: ${r.error ?? 'parse fail'}`),
                ...(successSources.length === 0 ? ['xosodaiphat.com: fail'] : []),
            ].join('\n')

            console.error(`\n[Crawler XSMB] 🚨 Không đủ nguồn để cross-validate`)

            // Ghi log
            if (lotteryType) {
                await prisma.crawlLog.create({
                    data: {
                        lotteryTypeId: lotteryType.id,
                        targetDate,
                        source: 'all_failed',
                        status: 'failed',
                        recordsInserted: 0,
                        errorMessage: `Không đủ 2 nguồn: ${allErrors}`,
                    },
                })
            }

            await sendTelegramAlert(
                `🚨 <b>Thiên Số — XSMB Crawler FAIL</b>\n\n` +
                `📅 Ngày: <b>${dateStr}</b>\n` +
                `⏰ ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}\n\n` +
                `❌ Không đủ 2 nguồn để cross-validate:\n${allErrors}\n\n` +
                `⚠️ Cần crawl lại thủ công!`
            )

            return {
                success: false,
                drawDate: dateStr,
                recordsInserted: 0,
                source: 'none',
                error: `Không đủ 2 nguồn: ${failedNames.join(', ')}`,
            }
        }
    }

    // ── Bước 3: Cross-validate 2 nguồn đầu tiên thành công ──
    const [src1, src2] = successSources
    console.log(`\n[Crawler XSMB] Bước 3: Cross-validate "${src1.name}" vs "${src2.name}"...`)

    const { match, mismatches, mergedPrizes } = crossValidate(src1.prizes, src2.prizes)

    if (!match) {
        // Data không khớp — có thể site đang cập nhật live, thử lại sau 3 phút
        const mismatchDetail = mismatches.join('\n')
        console.warn(`\n[Crawler XSMB] ⚠️  Data không khớp giữa 2 nguồn:`)
        mismatches.forEach(m => console.warn(`  • ${m}`))

        // Ghi log mismatch
        if (lotteryType) {
            await prisma.crawlLog.create({
                data: {
                    lotteryTypeId: lotteryType.id,
                    targetDate,
                    source: `${src1.name} vs ${src2.name}`,
                    status: 'failed',
                    recordsInserted: 0,
                    errorMessage: `Cross-validate mismatch:\n${mismatchDetail}`,
                },
            })
        }

        await sendTelegramAlert(
            `⚠️ <b>Thiên Số — XSMB Data Mismatch</b>\n\n` +
            `📅 Ngày: <b>${dateStr}</b>\n` +
            `⏰ ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}\n\n` +
            `🔍 So sánh <b>${src1.name}</b> vs <b>${src2.name}</b>:\n` +
            `${mismatches.map(m => `• ${m}`).join('\n')}\n\n` +
            `💡 Có thể site đang cập nhật live — sẽ tự retry sau 3 phút`
        )

        return {
            success: false,
            drawDate: dateStr,
            recordsInserted: 0,
            source: 'mismatch',
            error: `Data không khớp: ${mismatchDetail}`,
        }
    }

    // ── Bước 4: Hai nguồn khớp → Insert vào DB ────────
    const sourceLabel = `${src1.name}+${src2.name}`
    console.log(`\n[Crawler XSMB] Bước 4: 2 nguồn khớp nhau ✅ → Insert vào DB...`)
    const specialCodes = parseSpecialCodes(source1Html)
    console.log('[DEBUG specialCodes]', specialCodes)
    const count = await insertToDB(mergedPrizes, targetDate, sourceLabel, specialCodes)

    // Ghi log success
    if (lotteryType) {
        await prisma.crawlLog.create({
            data: {
                lotteryTypeId: lotteryType.id,
                targetDate,
                source: sourceLabel,
                status: 'success',
                recordsInserted: count,
            },
        })
    }

    const dbPrize = mergedPrizes.find(p => p.name === PrizeName.DB)
    console.log(`[Crawler XSMB] ✅ Thành công!`)
    console.log(`  Giải ĐB: ${dbPrize?.numbers[0]}`)
    console.log(`  Tổng giải: ${count}`)
    console.log(`  Nguồn xác nhận: ${sourceLabel}`)

    return {
        success: true,
        drawDate: dateStr,
        recordsInserted: count,
        source: sourceLabel,
    }
}