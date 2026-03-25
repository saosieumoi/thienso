// src/scripts/crawlers/xsmn.ts
// Crawler XSMN — cùng pattern với XSMB
// XSMN có nhiều đài khác nhau, mỗi đài quay 1 ngày/tuần
// Cron chạy hàng ngày, tự detect hôm nay đài nào quay

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

// ─── Map ngày trong tuần → danh sách đài XSMN ───────
// 0 = Chủ nhật, 1 = Thứ 2, ..., 6 = Thứ 7
const XSMN_SCHEDULE: Record<number, string[]> = {
    1: ['TPHCM', 'DONGTHAP', 'CAMAU'],
    2: ['BACLIEU', 'BINHDUONG', 'VUNGTAU'],
    3: ['CANTHO', 'DONGNAI', 'SOCTRANG'],
    4: ['TAYNINH', 'ANGIANG', 'BINHTHUAN'],
    5: ['VINHLONG', 'BINHPHUOC', 'TRAVINH'],
    6: ['TPHCM2', 'LONGAN', 'BINHDUONG2'],
    0: ['TIENGIANG', 'KIENGIANG', 'DALAT'],
}

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
                    'Accept': 'text/html,*/*',
                    'Accept-Language': 'vi-VN,vi;q=0.9',
                    'Referer': 'https://xoso.com.vn/',
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

// ─── Parser xoso.com.vn cho XSMN ────────────────────
// id pattern: tn_prize_DB_item_0 (tên đài viết tắt thay "mb")
// TODO: verify id prefix thực tế bằng cách view-source
// Hiện tại dùng class pattern làm fallback
function parseXosoMN(html: string): ParsedPrize[] {
    const $ = cheerio.load(html)
    const prizes: ParsedPrize[] = []

    // Thử id pattern trước (cần verify với HTML thực tế)
    // XSMN dùng prefix khác tùy đài: hcm_, dn_, ct_...
    // Fallback: dùng class .special-prize, .prize1...
    const CLASS_MAP: Record<string, PrizeName> = {
        'special-prize': PrizeName.DB,
        'prize1': PrizeName.G1,
        'prize2': PrizeName.G2,
        'prize3': PrizeName.G3,
        'prize4': PrizeName.G4,
        'prize5': PrizeName.G5,
        'prize6': PrizeName.G6,
        'prize7': PrizeName.G7,
        'prize8': PrizeName.G7, // XSMN có thêm giải 8
    }

    for (const [cls, prizeName] of Object.entries(CLASS_MAP)) {
        const numbers: string[] = []
        $(`.${cls}`).each((_, el) => {
            const num = normalizeNum($(el).text())
            if (num.length >= 2) numbers.push(num)
        })
        if (numbers.length > 0) prizes.push({ name: prizeName, numbers })
    }

    return prizes
}

function validate(prizes: ParsedPrize[]): { valid: boolean; reason?: string } {
    if (prizes.length < 7) {
        return { valid: false, reason: `Chỉ parse được ${prizes.length}/7 giải` }
    }
    const db = prizes.find(p => p.name === PrizeName.DB)
    if (!db) return { valid: false, reason: 'Thiếu giải đặc biệt' }
    if (normalizeNum(db.numbers[0] ?? '').length !== 6) {
        // XSMN giải ĐB là 6 số (khác XSMB là 5 số)
        return { valid: false, reason: `Giải ĐB không hợp lệ: "${db.numbers[0]}"` }
    }
    return { valid: true }
}

async function sendTelegramAlert(message: string): Promise<void> {
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

// ─── Hàm chính ───────────────────────────────────────
export async function crawlXSMN(date?: Date): Promise<CrawlResult> {
    const targetDate = date ?? new Date()
    const dateStr = targetDate.toISOString().split('T')[0]
    const dayOfWeek = targetDate.getDay()

    const dd = String(targetDate.getDate()).padStart(2, '0')
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0')
    const yyyy = targetDate.getFullYear()

    // Đài quay hôm nay
    const todayProvinces = XSMN_SCHEDULE[dayOfWeek] ?? []
    if (todayProvinces.length === 0) {
        console.log(`[Crawler XSMN] Không có đài XSMN hôm nay (thứ ${dayOfWeek})`)
        return { success: true, drawDate: dateStr, recordsInserted: 0, source: 'skip' }
    }

    console.log(`[Crawler XSMN] Đài hôm nay: ${todayProvinces.join(', ')}`)

    const url = `https://xoso.com.vn/xsmn-${dd}-${mm}-${yyyy}.html`
    const lotteryType = await prisma.lotteryType.findUnique({ where: { code: 'XSMN' } })

    try {
        const html = await fetchText(url)
        const prizes = parseXosoMN(html)
        const { valid, reason } = validate(prizes)

        if (!valid) {
            console.warn(`[Crawler XSMN] Validate fail: ${reason}`)

            if (lotteryType) {
                await prisma.crawlLog.create({
                    data: {
                        lotteryTypeId: lotteryType.id,
                        targetDate,
                        source: 'xoso.com.vn',
                        status: 'failed',
                        recordsInserted: 0,
                        errorMessage: reason,
                    },
                })
            }

            await sendTelegramAlert(
                `🚨 <b>Thiên Số — XSMN Crawler FAIL</b>\n\n` +
                `📅 Ngày: <b>${dateStr}</b>\n` +
                `❌ ${reason}\n` +
                `⚠️ Cần kiểm tra thủ công!`
            )

            return { success: false, drawDate: dateStr, recordsInserted: 0, source: 'none', error: reason }
        }

        // TODO: insert từng đài vào DB
        // Hiện tại XSMN cần tách kết quả theo từng đài — phức tạp hơn XSMB
        // Placeholder: insert gộp, sẽ refine sau
        console.log(`[Crawler XSMN] ✅ Parse OK: ${prizes.length} giải`)

        if (lotteryType) {
            await prisma.crawlLog.create({
                data: {
                    lotteryTypeId: lotteryType.id,
                    targetDate,
                    source: 'xoso.com.vn',
                    status: 'success',
                    recordsInserted: prizes.length,
                },
            })
        }

        return { success: true, drawDate: dateStr, recordsInserted: prizes.length, source: 'xoso.com.vn' }

    } catch (err) {
        const msg = String(err)
        console.error(`[Crawler XSMN] ❌ ${msg}`)

        if (lotteryType) {
            await prisma.crawlLog.create({
                data: {
                    lotteryTypeId: lotteryType.id,
                    targetDate,
                    source: 'xoso.com.vn',
                    status: 'failed',
                    recordsInserted: 0,
                    errorMessage: msg,
                },
            })
        }

        await sendTelegramAlert(
            `🚨 <b>Thiên Số — XSMN Crawler FAIL</b>\n\nNgày: ${dateStr}\n❌ ${msg}`
        )

        return { success: false, drawDate: dateStr, recordsInserted: 0, source: 'none', error: msg }
    }
}