// src/scripts/export-history-csv.ts
// Crawl lịch sử KQXS từ xosodaiphat.com (01/01/2020 → 24/03/2026)
// Xuất ra 3 file CSV: xsmb.csv, xsmn.csv, xsmt.csv
//
// Chạy: npx tsx src/scripts/export-history-csv.ts
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
const CSV_HEADER = 'drawDate,lotteryType,province,DB,DB_head,DB_tail,G1,G2,G3,G4,G5,G6,G7'

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

// ─── Parse table từ daiphat ───────────────────────────
// Trả về: { province: string, prizes: Record<string, string[]> }[]
function parseDaiphatTable(html: string): { province: string; prizes: Record<string, string[]> }[] {
    const $ = cheerio.load(html)
    const table = $('table.table-xsmn').first()
    if (!table.length) return []

    // Lấy tên đài từ thead
    const provinceNames: string[] = []
    table.find('thead th').each((i, th) => {
        if (i === 0) return
        const a = $(th).find('a').first()
        // Lấy text tên đài (không dùng title vì XSMN có "Xổ số ", XSMT không có)
        const name = a.text().trim()
        if (name) provinceNames.push(name)
    })

    if (!provinceNames.length) return []

    // Init
    const result: { province: string; prizes: Record<string, string[]> }[] =
        provinceNames.map(p => ({ province: p, prizes: {} }))

    // Parse rows
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
    prizes: Record<string, string[]>
): string {
    const db = prizes['DB']?.[0] ?? ''
    const dbHead = db.length >= 2 ? db.slice(0, 2) : ''
    const dbTail = db.length >= 2 ? db.slice(-2) : ''

    // Giải nhiều số → join bằng |
    const g1 = (prizes['G1'] ?? []).join('|')
    const g2 = (prizes['G2'] ?? []).join('|')
    const g3 = (prizes['G3'] ?? []).join('|')
    const g4 = (prizes['G4'] ?? []).join('|')
    const g5 = (prizes['G5'] ?? []).join('|')
    const g6 = (prizes['G6'] ?? []).join('|')
    const g7 = (prizes['G7'] ?? []).join('|')

    return [dateStr, lotteryType, `"${province}"`, db, dbHead, dbTail, g1, g2, g3, g4, g5, g6, g7].join(',')
}

// ─── Progress bar ─────────────────────────────────────
function progressBar(done: number, total: number): string {
    const pct = Math.round(done / total * 100)
    const fill = Math.round(done / total * 25)
    return `[${'█'.repeat(fill)}${'░'.repeat(25 - fill)}] ${pct}% (${done}/${total})`
}

// ─── Main ─────────────────────────────────────────────
async function main() {
    // Tạo thư mục output
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

    const xsmbFile = path.join(OUT_DIR, 'xsmb.csv')
    const xsmnFile = path.join(OUT_DIR, 'xsmn.csv')
    const xsmtFile = path.join(OUT_DIR, 'xsmt.csv')

    // Ghi header
    fs.writeFileSync(xsmbFile, CSV_HEADER + '\n', 'utf8')
    fs.writeFileSync(xsmnFile, CSV_HEADER + '\n', 'utf8')
    fs.writeFileSync(xsmtFile, CSV_HEADER + '\n', 'utf8')

    // Tính tổng số ngày
    const totalDays = Math.floor((END_DATE.getTime() - START_DATE.getTime()) / 86400000) + 1

    console.log('═'.repeat(60))
    console.log('  📦 Export lịch sử KQXS → CSV')
    console.log('═'.repeat(60))
    console.log(`  Từ:   ${dateToStr(START_DATE)}`)
    console.log(`  Đến:  ${dateToStr(END_DATE)}`)
    console.log(`  Tổng: ${totalDays} ngày`)
    console.log(`  ETA:  ~${Math.round(totalDays * DELAY_MS / 60000)} phút`)
    console.log(`  Out:  ${OUT_DIR}/`)
    console.log('═'.repeat(60))
    console.log()

    const stats = { xsmb: 0, xsmn: 0, xsmt: 0, errors: 0 }
    let daysDone = 0
    const current = new Date(START_DATE)

    while (current <= END_DATE) {
        const dateStr = dateToStr(current)
        const dow = current.getDay()
        const [yyyy, mm, dd] = dateStr.split('-')

        // ── XSMB (mỗi ngày) ─────────────────────────────
        const xsmbUrl = `https://xosodaiphat.com/xsmb-${dd}-${mm}-${yyyy}.html`
        const xsmbHtml = await fetchHtml(xsmbUrl)
        if (xsmbHtml) {
            const rows = parseDaiphatTable(xsmbHtml)
            for (const r of rows) {
                if (r.prizes['DB']) {
                    const line = buildRow(dateStr, 'XSMB', r.province || 'Hà Nội', r.prizes)
                    fs.appendFileSync(xsmbFile, line + '\n', 'utf8')
                    stats.xsmb++
                }
            }
        } else {
            stats.errors++
        }

        await sleep(DELAY_MS)

        // ── XSMN (theo lịch) ─────────────────────────────
        const xsmnProvinces = XSMN_SCHEDULE[dow] ?? []
        if (xsmnProvinces.length > 0) {
            const xsmnUrl = `https://xosodaiphat.com/xsmn-${dd}-${mm}-${yyyy}.html`
            const xsmnHtml = await fetchHtml(xsmnUrl)
            if (xsmnHtml) {
                const rows = parseDaiphatTable(xsmnHtml)
                for (const r of rows) {
                    if (r.prizes['DB']) {
                        const line = buildRow(dateStr, 'XSMN', r.province, r.prizes)
                        fs.appendFileSync(xsmnFile, line + '\n', 'utf8')
                        stats.xsmn++
                    }
                }
            } else {
                stats.errors++
            }
            await sleep(DELAY_MS)
        }

        // ── XSMT (theo lịch) ─────────────────────────────
        const xsmtProvinces = XSMT_SCHEDULE[dow] ?? []
        if (xsmtProvinces.length > 0) {
            const xsmtUrl = `https://xosodaiphat.com/xsmt-${dd}-${mm}-${yyyy}.html`
            const xsmtHtml = await fetchHtml(xsmtUrl)
            if (xsmtHtml) {
                const rows = parseDaiphatTable(xsmtHtml)
                for (const r of rows) {
                    if (r.prizes['DB']) {
                        const line = buildRow(dateStr, 'XSMT', r.province, r.prizes)
                        fs.appendFileSync(xsmtFile, line + '\n', 'utf8')
                        stats.xsmt++
                    }
                }
            } else {
                stats.errors++
            }
            await sleep(DELAY_MS)
        }

        daysDone++
        current.setDate(current.getDate() + 1)

        // Log tiến độ mỗi 30 ngày
        if (daysDone % 30 === 0) {
            console.log(`${progressBar(daysDone, totalDays)}`)
            console.log(`  XSMB: ${stats.xsmb} rows | XSMN: ${stats.xsmn} rows | XSMT: ${stats.xsmt} rows | Errors: ${stats.errors}`)
            console.log()
        }
    }

    // Kết quả cuối
    console.log()
    console.log('═'.repeat(60))
    console.log('  ✅ HOÀN THÀNH')
    console.log('═'.repeat(60))
    console.log(`  XSMB: ${stats.xsmb} rows → ${xsmbFile}`)
    console.log(`  XSMN: ${stats.xsmn} rows → ${xsmnFile}`)
    console.log(`  XSMT: ${stats.xsmt} rows → ${xsmtFile}`)
    console.log(`  Errors: ${stats.errors} ngày`)
    console.log()
    console.log('  💡 Import vào DB bằng lệnh:')
    console.log('     npx tsx src/scripts/import-csv.ts')
}

main().catch(err => {
    console.error('\n💥 Script crashed:', err)
    process.exit(1)
})