// src/scripts/export-history-csv.ts
// Crawl lịch sử KQXS từ xosodaiphat.com (01/01/2020 → 24/03/2026)
// Xuất ra CSV theo miền
//
// Chạy tất cả:   npx tsx src/scripts/export-history-csv.ts
// Chỉ XSMB:      npx tsx src/scripts/export-history-csv.ts --only=xsmb
// Chỉ XSMN:      npx tsx src/scripts/export-history-csv.ts --only=xsmn
// Chỉ XSMT:      npx tsx src/scripts/export-history-csv.ts --only=xsmt
//
// Format CSV:
// drawDate,lotteryType,province,DB,DB_head,DB_tail,G1,G2,G3,G4,G5,G6,G7

import * as cheerio from 'cheerio'
import * as fs from 'fs'
import * as path from 'path'

// ─── Config ───────────────────────────────────────────
const START_DATE = new Date('2020-01-01')
const END_DATE = new Date('2026-03-24')
const DELAY_MS = 600   // ms giữa mỗi request
const OUT_DIR = './csv-export'

// ─── Lịch quay ────────────────────────────────────────
const XSMN_SCHEDULE: Record<number, string[]> = {
    1: ['TP. HCM', 'Đồng Tháp', 'Cà Mau'],
    2: ['Bạc Liêu', 'Bình Dương', 'Vũng Tàu'],
    3: ['Cần Thơ', 'Đồng Nai', 'Sóc Trăng'],
    4: ['Tây Ninh', 'An Giang', 'Bình Thuận'],
    5: ['Vĩnh Long', 'Bình Phước', 'Trà Vinh'],
    6: ['TP. HCM', 'Long An', 'Bình Dương'],
    0: ['Tiền Giang', 'Kiên Giang', 'Đà Lạt'],
}

const XSMT_SCHEDULE: Record<number, string[]> = {
    1: ['Thừa Thiên Huế', 'Phú Yên'],
    2: ['Đắk Nông', 'Quảng Nam'],
    3: ['Đà Nẵng', 'Khánh Hòa'],
    4: ['Bình Định', 'Quảng Trị', 'Quảng Bình'],
    5: ['Gia Lai', 'Ninh Thuận'],
    6: ['Đà Nẵng', 'Khánh Hòa', 'Đắk Lắk'],
    0: ['Kon Tum', 'Quảng Ngãi', 'Đắk Nông'],
}

// Row index → prize label
const ROW_LABELS = ['G7', 'G6', 'G5', 'G4', 'G3', 'G2', 'G1', null, 'DB']

// ─── CSV header ───────────────────────────────────────
// specialCodes chỉ có ở XSMB — XSMN/XSMT để trống
const CSV_HEADER = 'drawDate,lotteryType,province,DB,DB_head,DB_tail,specialCodes,G1,G2,G3,G4,G5,G6,G7'

// ─── Helpers ──────────────────────────────────────────
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function addDays(d: Date, n: number): Date {
    const r = new Date(d)
    r.setDate(r.getDate() + n)
    return r
}

function dateToStr(d: Date): string {
    return d.toISOString().split('T')[0]
}

function norm(s: string): string { return s.replace(/\D/g, '').trim() }

async function fetchHtml(url: string): Promise<string | null> {
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,*/*',
                    'Accept-Language': 'vi-VN,vi;q=0.9',
                    'Referer': 'https://xosodaiphat.com/',
                },
                signal: AbortSignal.timeout(12000),
            })
            if (res.status === 404) return null
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            return await res.text()
        } catch (err) {
            if (attempt < 3) await sleep(attempt * 1000)
            else return null
        }
    }
    return null
}

// ─── Parser XSMB từ daiphat ──────────────────────────
// HTML mới (2024+): span[id^="mb_prize_DB_item_"], span[id^="mb_prize_1_item_"]...
//   specialCodes: span[id^="mb_prizeCode_item_"] — VD "9YZ", "18YZ"
// HTML cũ (2020-2023): không có id — dùng vị trí row trong tbody
//   specialCodes: span.special-code — VD "9AP", "3AP"
//   row 0: Mã ĐB (bỏ qua)
//   row 1: G.ĐB → DB
//   row 2-8: G.1 → G7
function parseDaiphatXSMB(html: string): {
    province: string
    prizes: Record<string, string[]>
    specialCodes: string[]
} | null {
    const $ = cheerio.load(html)

    const prizes: Record<string, string[]> = {}

    // ── Thử cách 1: id-based (HTML mới 2024+) ──────────
    const ID_MAP: Record<string, string> = {
        'mb_prize_DB_item_': 'DB',
        'mb_prize_1_item_': 'G1',
        'mb_prize_2_item_': 'G2',
        'mb_prize_3_item_': 'G3',
        'mb_prize_4_item_': 'G4',
        'mb_prize_5_item_': 'G5',
        'mb_prize_6_item_': 'G6',
        'mb_prize_7_item_': 'G7',
    }

    for (const [prefix, label] of Object.entries(ID_MAP)) {
        const numbers: string[] = []
        $(`span[id^="${prefix}"]`).each((_, el) => {
            const n = norm($(el).text())
            if (n.length >= 2) numbers.push(n)
        })
        if (numbers.length > 0) prizes[label] = numbers
    }

    if (prizes['DB']) {
        // specialCodes mới: span[id^="mb_prizeCode_item_"] — text dạng "9YZ", "18YZ"
        const specialCodes: string[] = []
        $('span[id^="mb_prizeCode_item_"]').each((_, el) => {
            const code = $(el).text().trim()
            if (code) specialCodes.push(code)
        })
        return { province: 'Hà Nội', prizes, specialCodes }
    }

    // ── Thử cách 2: row-based (HTML cũ 2020-2023) ──────
    const ROW_MAP: (string | null)[] = [
        null,  // row 0: Mã ĐB — bỏ qua
        'DB',  // row 1: G.ĐB
        'G1',  // row 2: G.1
        'G2',  // row 3: G.2
        'G3',  // row 4: G.3
        'G4',  // row 5: G.4
        'G5',  // row 6: G.5
        'G6',  // row 7: G.6
        'G7',  // row 8: G.7
    ]

    const table = $('table.table-xsmb').first()
    if (!table.length) return null

    const prizesOld: Record<string, string[]> = {}
    table.find('tbody tr').each((rowIdx, row) => {
        if (rowIdx >= ROW_MAP.length) return
        const label = ROW_MAP[rowIdx]
        if (!label) return

        const numbers: string[] = []
        $(row).find('td').eq(1).find('span').each((_, el) => {
            const n = norm($(el).text())
            if (n.length >= 2) numbers.push(n)
        })
        if (numbers.length > 0) prizesOld[label] = numbers
    })

    if (prizesOld['DB']) {
        // specialCodes cũ: span.special-code — text dạng "9AP", "3AP"
        const specialCodes: string[] = []
        $('span.special-code').each((_, el) => {
            const code = $(el).text().trim()
            if (code) specialCodes.push(code)
        })
        return { province: 'Hà Nội', prizes: prizesOld, specialCodes }
    }

    return null
}

// ─── Parser XSMN/XSMT từ daiphat ─────────────────────
// Structure: table.table-xsmn (cả XSMN livetn3 và XSMT livetn2)
// Nhiều đài theo cột, tên đài từ thead, giải từ vị trí row
function parseDaiphatTable(html: string): { province: string; prizes: Record<string, string[]> }[] {
    const $ = cheerio.load(html)
    const table = $('table.table-xsmn').first()
    if (!table.length) return []

    // Lấy tên đài từ thead (bỏ cột 0 "Giải")
    const provinceNames: string[] = []
    table.find('thead th').each((i, th) => {
        if (i === 0) return
        const a = $(th).find('a').first()
        const name = a.text().trim()
        if (name) provinceNames.push(name)
    })

    if (!provinceNames.length) return []

    // Init
    const result: { province: string; prizes: Record<string, string[]> }[] =
        provinceNames.map(p => ({ province: p, prizes: {} }))

    // Parse rows theo thứ tự: G.8→G7, G.7→G6... G.ĐB→DB
    table.find('tbody tr').each((rowIdx, row) => {
        if (rowIdx >= ROW_LABELS.length) return
        const label = ROW_LABELS[rowIdx]
        if (!label) return // bỏ G.1

        $(row).find('td.tn_prize').each((colIdx, td) => {
            const entry = result[colIdx]
            if (!entry) return
            const numbers: string[] = []
            $(td).find('span').each((_, el) => {
                const n = norm($(el).text())
                if (n.length >= 2) numbers.push(n)
            })
            if (numbers.length > 0) entry.prizes[label] = numbers
        })
    })

    return result.filter(r => Object.keys(r.prizes).length > 0)
}

// ─── Build CSV row ────────────────────────────────────
function buildRow(
    dateStr: string,
    lotteryType: string,
    province: string,
    prizes: Record<string, string[]>,
    specialCodes: string[] = []
): string {
    const db = prizes['DB']?.[0] ?? ''
    const dbHead = db.length >= 2 ? db.slice(0, 2) : ''
    const dbTail = db.length >= 2 ? db.slice(-2) : ''

    // specialCodes: join bằng | — VD "9YZ|18YZ|10YZ"
    const codes = specialCodes.join('|')

    // Giải nhiều số → join bằng |
    const g1 = (prizes['G1'] ?? []).join('|')
    const g2 = (prizes['G2'] ?? []).join('|')
    const g3 = (prizes['G3'] ?? []).join('|')
    const g4 = (prizes['G4'] ?? []).join('|')
    const g5 = (prizes['G5'] ?? []).join('|')
    const g6 = (prizes['G6'] ?? []).join('|')
    const g7 = (prizes['G7'] ?? []).join('|')

    return [dateStr, lotteryType, `"${province}"`, db, dbHead, dbTail, codes, g1, g2, g3, g4, g5, g6, g7].join(',')
}

// ─── Progress bar ─────────────────────────────────────
function progressBar(done: number, total: number): string {
    const pct = Math.round(done / total * 100)
    const fill = Math.round(done / total * 25)
    return `[${'█'.repeat(fill)}${'░'.repeat(25 - fill)}] ${pct}% (${done}/${total})`
}

// ─── Main ─────────────────────────────────────────────
async function main() {
    // ── Parse CLI args ──────────────────────────────────
    // --only=xsmb | --only=xsmn | --only=xsmt
    const onlyArg = process.argv.find(a => a.startsWith('--only='))
    const only = onlyArg?.split('=')[1]?.toLowerCase() as 'xsmb' | 'xsmn' | 'xsmt' | undefined

    const runXSMB = !only || only === 'xsmb'
    const runXSMN = !only || only === 'xsmn'
    const runXSMT = !only || only === 'xsmt'

    if (only && !['xsmb', 'xsmn', 'xsmt'].includes(only)) {
        console.error(`❌ --only phải là xsmb, xsmn, hoặc xsmt. Nhận được: "${only}"`)
        process.exit(1)
    }

    // Tạo thư mục output
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

    const xsmbFile = path.join(OUT_DIR, 'xsmb.csv')
    const xsmnFile = path.join(OUT_DIR, 'xsmn.csv')
    const xsmtFile = path.join(OUT_DIR, 'xsmt.csv')

    // Ghi header cho file sẽ chạy
    if (runXSMB) fs.writeFileSync(xsmbFile, CSV_HEADER + '\n', 'utf8')
    if (runXSMN) fs.writeFileSync(xsmnFile, CSV_HEADER + '\n', 'utf8')
    if (runXSMT) fs.writeFileSync(xsmtFile, CSV_HEADER + '\n', 'utf8')

    const totalDays = Math.floor((END_DATE.getTime() - START_DATE.getTime()) / 86400000) + 1
    const regions = [runXSMB && 'XSMB', runXSMN && 'XSMN', runXSMT && 'XSMT'].filter(Boolean).join(' + ')

    console.log('═'.repeat(60))
    console.log(`  📦 Export lịch sử KQXS → CSV  [${regions}]`)
    console.log('═'.repeat(60))
    console.log(`  Từ:     ${dateToStr(START_DATE)}`)
    console.log(`  Đến:    ${dateToStr(END_DATE)}`)
    console.log(`  Tổng:   ${totalDays} ngày`)
    console.log(`  Miền:   ${regions}`)
    console.log(`  Out:    ${OUT_DIR}/`)
    console.log('═'.repeat(60))
    console.log()

    const stats = { xsmb: 0, xsmn: 0, xsmt: 0, errors: 0, skipped: 0 }
    let daysDone = 0
    const current = new Date(START_DATE)

    while (current <= END_DATE) {
        const dateStr = dateToStr(current)
        const dow = current.getDay()
        const [yyyy, mm, dd] = dateStr.split('-')

        // ── XSMB (mỗi ngày) ─────────────────────────────
        if (runXSMB) {
            const url = `https://xosodaiphat.com/xsmb-${dd}-${mm}-${yyyy}.html`
            const html = await fetchHtml(url)

            if (html) {
                const r = parseDaiphatXSMB(html)
                if (r?.prizes['DB']) {
                    const db = r.prizes['DB'][0]
                    const line = buildRow(dateStr, 'XSMB', r.province, r.prizes, r.specialCodes)
                    fs.appendFileSync(xsmbFile, line + '\n', 'utf8')
                    stats.xsmb++
                    // Log mỗi ngày để double-check
                    const codesStr = r.specialCodes.length > 0 ? ` | Mã: ${r.specialCodes.join(' ')}` : ''
                    console.log(`✅ XSMB ${dateStr} | ĐB: ${db} | Đầu: ${db.slice(0, 2)} Đuôi: ${db.slice(-2)}${codesStr}`)
                } else {
                    stats.errors++
                    console.warn(`⚠️  XSMB ${dateStr} | Parse được HTML nhưng không có giải ĐB — URL: ${url}`)
                }
            } else {
                stats.errors++
                console.error(`❌ XSMB ${dateStr} | Fetch thất bại — URL: ${url}`)
            }

            await sleep(DELAY_MS)
        }

        // ── XSMN (theo lịch) ─────────────────────────────
        if (runXSMN) {
            const xsmnProvinces = XSMN_SCHEDULE[dow] ?? []
            if (xsmnProvinces.length > 0) {
                const url = `https://xosodaiphat.com/xsmn-${dd}-${mm}-${yyyy}.html`
                const html = await fetchHtml(url)

                if (html) {
                    const rows = parseDaiphatTable(html)
                    if (rows.length > 0) {
                        for (const r of rows) {
                            if (r.prizes['DB']) {
                                const line = buildRow(dateStr, 'XSMN', r.province, r.prizes)
                                fs.appendFileSync(xsmnFile, line + '\n', 'utf8')
                                stats.xsmn++
                            }
                        }
                    } else {
                        stats.errors++
                        console.warn(`⚠️  XSMN ${dateStr} | Không parse được đài nào — URL: ${url}`)
                    }
                } else {
                    stats.errors++
                    console.error(`❌ XSMN ${dateStr} | Fetch thất bại — URL: ${url}`)
                }
                await sleep(DELAY_MS)
            }
        }

        // ── XSMT (theo lịch) ─────────────────────────────
        if (runXSMT) {
            const xsmtProvinces = XSMT_SCHEDULE[dow] ?? []
            if (xsmtProvinces.length > 0) {
                const url = `https://xosodaiphat.com/xsmt-${dd}-${mm}-${yyyy}.html`
                const html = await fetchHtml(url)

                if (html) {
                    const rows = parseDaiphatTable(html)
                    if (rows.length > 0) {
                        for (const r of rows) {
                            if (r.prizes['DB']) {
                                const line = buildRow(dateStr, 'XSMT', r.province, r.prizes)
                                fs.appendFileSync(xsmtFile, line + '\n', 'utf8')
                                stats.xsmt++
                            }
                        }
                    } else {
                        stats.errors++
                        console.warn(`⚠️  XSMT ${dateStr} | Không parse được đài nào — URL: ${url}`)
                    }
                } else {
                    stats.errors++
                    console.error(`❌ XSMT ${dateStr} | Fetch thất bại — URL: ${url}`)
                }
                await sleep(DELAY_MS)
            }
        }

        daysDone++
        current.setDate(current.getDate() + 1)

        // Progress bar mỗi 30 ngày
        if (daysDone % 30 === 0) {
            console.log()
            console.log(progressBar(daysDone, totalDays))
            console.log(`  XSMB: ${stats.xsmb} | XSMN: ${stats.xsmn} | XSMT: ${stats.xsmt} | Errors: ${stats.errors}`)
            console.log()
        }
    }

    // Kết quả cuối
    console.log()
    console.log('═'.repeat(60))
    console.log('  ✅ HOÀN THÀNH')
    console.log('═'.repeat(60))
    if (runXSMB) console.log(`  XSMB: ${stats.xsmb} rows → ${xsmbFile}`)
    if (runXSMN) console.log(`  XSMN: ${stats.xsmn} rows → ${xsmnFile}`)
    if (runXSMT) console.log(`  XSMT: ${stats.xsmt} rows → ${xsmtFile}`)
    console.log(`  Errors: ${stats.errors} ngày`)
    console.log()
    if (stats.errors > 0) {
        console.log('  ⚠️  Có lỗi — kiểm tra log ở trên để xem ngày nào bị thiếu')
    }
    console.log('  💡 Import vào DB: npx tsx src/scripts/import-csv.ts')
}

main().catch(err => {
    console.error('\n💥 Script crashed:', err)
    process.exit(1)
})