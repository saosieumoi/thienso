// src/scripts/import-csv.ts
// Import 3 file CSV lịch sử KQXS vào database
//
// Chạy tất cả:   npx tsx src/scripts/import-csv.ts
// Chỉ XSMB:      npx tsx src/scripts/import-csv.ts --only=xsmb
// Chỉ XSMN:      npx tsx src/scripts/import-csv.ts --only=xsmn
// Chỉ XSMT:      npx tsx src/scripts/import-csv.ts --only=xsmt
// Từ ngày cụ thể: npx tsx src/scripts/import-csv.ts --only=xsmb --from=2023-01-01
//
// NOTE: Script tự động upsert các province thiếu (BENTRE, HAUGIANG, DONGTHAP...)
//       vào DB trước khi import để tránh lỗi "Province code không có trong DB"

import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'
import { PrismaClient, PrizeName } from '@prisma/client'

const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL } },
})
await prisma.$connect()

const CSV_DIR = './csv-export'

// ─── Map tên đài (CSV) → province code DB ─────────────
const PROVINCE_NAME_TO_CODE: Record<string, string> = {
    // XSMB
    'Hà Nội': 'HN',

    // XSMN — tên từ daiphat + variants
    'TP. HCM': 'TPHCM',
    'TP.HCM': 'TPHCM',
    'TPHCM': 'TPHCM',
    'Hồ Chí Minh': 'TPHCM',
    'TP. Hồ Chí Minh': 'TPHCM',
    'Đồng Tháp': 'DONGTHAP',
    'Cà Mau': 'CAMAU',
    'Bạc Liêu': 'BACLIEU',
    'Bình Dương': 'BINHDUONG',
    'Vũng Tàu': 'VUNGTAU',
    'Cần Thơ': 'CANTHO',
    'Đồng Nai': 'DONGNAI',
    'Sóc Trăng': 'SOCTRANG',
    'Tây Ninh': 'TAYNINH',
    'An Giang': 'ANGIANG',
    'Bình Thuận': 'BINHTHUAN',
    'Vĩnh Long': 'VINHLONG',
    'Bình Phước': 'BINHPHUOC',
    'Trà Vinh': 'TRAVINH',
    'Long An': 'LONGAN',
    'Tiền Giang': 'TIENGIANG',
    'Kiên Giang': 'KIENGIANG',
    'Đà Lạt': 'DALAT',
    // Đài có thể xuất hiện trong CSV lịch sử nhưng chưa có trong seed mới
    'Bến Tre': 'BENTRE',
    'Hậu Giang': 'HAUGIANG',
    'Bình Long': 'BINHLONG',

    // XSMT — tên từ daiphat
    'Đà Nẵng': 'DANANG',
    'Khánh Hòa': 'KHANHHOA',
    'Bình Định': 'BINHDINH',
    'Quảng Trị': 'QUANGTRI',
    'Quảng Bình': 'QUANGBINH',
    'Huế': 'THUATHIENHUE',  // tên ngắn trong CSV lịch sử
    'TT. Huế': 'THUATHIENHUE',
    'Thừa Thiên-Huế': 'THUATHIENHUE',
    'Thừa Thiên Huế': 'THUATHIENHUE',
    'Phú Yên': 'PHUYEN',
    'Đắk Nông': 'DAKNONG',
    'Quảng Nam': 'QUANGNAM',
    'Gia Lai': 'GIALAI',
    'Ninh Thuận': 'NINHTHUAN',
    'Đắk Lắk': 'DAKLAK',
    'Kon Tum': 'KONTUM',
    'Quảng Ngãi': 'QUANGNGAI',
}

// ─── Parse date linh hoạt ─────────────────────────────
// Xử lý cả YYYY-MM-DD (chuẩn) lẫn M/D/YYYY (Excel tự convert)
function parseDate(raw: string): { y: number; m: number; d: number } | null {
    raw = raw.trim()

    // Format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const [y, m, d] = raw.split('-').map(Number)
        return { y, m, d }
    }

    // Format M/D/YYYY hoặc MM/DD/YYYY (Excel)
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
        const parts = raw.split('/')
        const m = Number(parts[0])
        const d = Number(parts[1])
        const y = Number(parts[2])
        return { y, m, d }
    }

    return null
}
const PRIZE_NAME_MAP: Record<string, PrizeName> = {
    DB: PrizeName.DB,
    G1: PrizeName.G1,
    G2: PrizeName.G2,
    G3: PrizeName.G3,
    G4: PrizeName.G4,
    G5: PrizeName.G5,
    G6: PrizeName.G6,
    G7: PrizeName.G7,
}

// Thứ tự chuẩn để insert
const PRIZE_ORDER = [
    PrizeName.DB, PrizeName.G1, PrizeName.G2, PrizeName.G3,
    PrizeName.G4, PrizeName.G5, PrizeName.G6, PrizeName.G7,
]

// ─── Helpers ──────────────────────────────────────────
function tail(s: string): number {
    const n = s.replace(/\D/g, '')
    return parseInt(n.slice(-2), 10)
}
function head(s: string): number {
    const n = s.replace(/\D/g, '')
    return n.length <= 2 ? 0 : parseInt(n.slice(0, 2), 10)
}

// Parse một dòng CSV — xử lý province có dấu ngoặc kép
function parseCSVLine(line: string): string[] {
    const cols: string[] = []
    let current = ''
    let inQuote = false

    for (const char of line) {
        if (char === '"') {
            inQuote = !inQuote
        } else if (char === ',' && !inQuote) {
            cols.push(current)
            current = ''
        } else {
            current += char
        }
    }
    cols.push(current)
    return cols
}

// Đọc CSV theo dòng — trả về async iterator
async function* readCSVLines(filePath: string) {
    const rl = readline.createInterface({
        input: fs.createReadStream(filePath, 'utf8'),
        crlfDelay: Infinity,
    })
    let isHeader = true
    for await (const line of rl) {
        if (isHeader) { isHeader = false; continue } // bỏ header
        if (line.trim()) yield line
    }
}

// ─── Cache LotteryType và Province để tránh query lặp ──
const ltCache: Record<string, string> = {} // code → id
const provCache: Record<string, string | null> = {} // code → id | null

async function getLotteryTypeId(code: string): Promise<string> {
    if (ltCache[code]) return ltCache[code]
    const lt = await prisma.lotteryType.findUnique({ where: { code } })
    if (!lt) throw new Error(`LotteryType ${code} not found — đã chạy seed chưa?`)
    ltCache[code] = lt.id
    return lt.id
}

async function getProvinceId(code: string): Promise<string | null> {
    if (code in provCache) return provCache[code]
    const prov = await prisma.province.findUnique({ where: { code } })
    provCache[code] = prov?.id ?? null
    return provCache[code]
}

// ─── Insert 1 dòng CSV vào DB ──────────────────────────
interface CSVRow {
    drawDate: string      // YYYY-MM-DD
    lotteryType: string   // XSMB | XSMN | XSMT
    province: string      // tên đài từ CSV
    db: string
    specialCodes: string  // "9YZ|18YZ" hoặc rỗng
    g1: string; g2: string; g3: string; g4: string
    g5: string; g6: string; g7: string
}

async function insertRow(row: CSVRow, source: string): Promise<'inserted' | 'skipped' | 'error'> {
    try {
        // Map province name → code
        const provCode = PROVINCE_NAME_TO_CODE[row.province]
        if (!provCode) {
            console.warn(`  ⚠️  Province không map được: "${row.province}" — skip`)
            return 'skipped'
        }

        const [lotteryTypeId, provinceId] = await Promise.all([
            getLotteryTypeId(row.lotteryType),
            getProvinceId(provCode),
        ])

        if (!provinceId) {
            console.warn(`  ⚠️  Province code "${provCode}" không có trong DB — skip`)
            return 'skipped'
        }

        // Parse date — hỗ trợ YYYY-MM-DD và M/D/YYYY
        const parsed = parseDate(row.drawDate)
        if (!parsed) {
            console.warn(`  ⚠️  Date không hợp lệ: "${row.drawDate}" — skip`)
            return 'skipped'
        }
        const { y, m, d } = parsed
        const drawDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))

        // Upsert draw
        const draw = await prisma.draw.upsert({
            where: {
                drawDate_lotteryTypeId_provinceId: {
                    drawDate,
                    lotteryTypeId,
                    provinceId,
                },
            },
            update: { isComplete: true, crawlSource: source },
            create: {
                drawDate,
                lotteryTypeId,
                provinceId,
                isComplete: true,
                crawledAt: new Date(),
                crawlSource: source,
                // specialCodes chỉ có XSMB
                specialCodes: row.specialCodes
                    ? row.specialCodes.split('|').map(s => s.trim()).filter(Boolean)
                    : [],
            },
        })

        // Xóa results cũ rồi insert lại
        await prisma.result.deleteMany({ where: { drawId: draw.id } })

        // Build prizes từ CSV columns
        const prizesData: { name: PrizeName; numbers: string[] }[] = []

        const COL_MAP: [string, PrizeName][] = [
            [row.db, PrizeName.DB],
            [row.g1, PrizeName.G1],
            [row.g2, PrizeName.G2],
            [row.g3, PrizeName.G3],
            [row.g4, PrizeName.G4],
            [row.g5, PrizeName.G5],
            [row.g6, PrizeName.G6],
            [row.g7, PrizeName.G7],
        ]

        for (const [raw, prizeName] of COL_MAP) {
            if (!raw) continue
            const numbers = raw.split('|').map(s => s.replace(/\D/g, '').trim()).filter(s => s.length >= 2)
            if (numbers.length > 0) prizesData.push({ name: prizeName, numbers })
        }

        // Sort theo thứ tự chuẩn
        //prizesData.sort((a, b) => PRIZE_ORDER.indexOf(a.name) - PRIZE_ORDER.indexOf(b.name))
        // Filter prize hợp lệ
        const validPrizes = prizesData.filter(p =>
            (PRIZE_ORDER as readonly PrizeName[]).includes(p.name)
        )

        // Sort an toàn
        validPrizes.sort((a, b) => {
            const ai = (PRIZE_ORDER as readonly string[]).indexOf(a.name)
            const bi = (PRIZE_ORDER as readonly string[]).indexOf(b.name)
            return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
        })

        for (const p of validPrizes) {
            await prisma.result.create({
                data: {
                    drawId: draw.id,
                    prizeName: p.name,
                    numbers: p.numbers,
                    tailNums: p.numbers.map(tail),
                    headNums: p.numbers.map(head),
                },
            })
        }

        // LotoResult
        const allTails = prizesData.flatMap(p => p.numbers.map(tail))
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

        return 'inserted'
    } catch (err) {
        console.error(`  ❌ Lỗi insert ${row.drawDate} ${row.province}: ${String(err)}`)
        return 'error'
    }
}

// ─── Upsert các province thiếu trong seed ─────────────
// Một số đài lịch sử không có trong seed mặc định
async function ensureMissingProvinces() {
    const { LotteryRegion } = await import('@prisma/client')

    const xsmn = await prisma.lotteryType.findUnique({ where: { code: 'XSMN' } })
    const xsmt = await prisma.lotteryType.findUnique({ where: { code: 'XSMT' } })
    if (!xsmn || !xsmt) return

    const missing = [
        // XSMN
        { code: 'BENTRE', name: 'Bến Tre', shortName: 'BT', region: LotteryRegion.MIEN_NAM, lotteryTypeId: xsmn.id, day: 6 },
        { code: 'HAUGIANG', name: 'Hậu Giang', shortName: 'HG', region: LotteryRegion.MIEN_NAM, lotteryTypeId: xsmn.id, day: 5 },
        { code: 'BINHLONG', name: 'Bình Long', shortName: 'BL2', region: LotteryRegion.MIEN_NAM, lotteryTypeId: xsmn.id, day: 4 },
        { code: 'DONGTHAP', name: 'Đồng Tháp', shortName: 'DTP', region: LotteryRegion.MIEN_NAM, lotteryTypeId: xsmn.id, day: 1 },
    ]

    let added = 0
    for (const p of missing) {
        const existing = await prisma.province.findUnique({ where: { code: p.code } })
        if (!existing) {
            await prisma.province.create({
                data: {
                    code: p.code, name: p.name, shortName: p.shortName,
                    region: p.region, lotteryTypeId: p.lotteryTypeId,
                    drawDayOfWeek: p.day, isActive: true, sortOrder: 99,
                },
            })
            added++
            console.log(`  ➕ Thêm province: ${p.code} (${p.name})`)
        }
    }
    if (added === 0) console.log('  ✓ Không có province thiếu')
}


async function importFile(
    filePath: string,
    lotteryType: string,
    fromDate?: Date
): Promise<{ inserted: number; skipped: number; errors: number }> {
    const stats = { inserted: 0, skipped: 0, errors: 0 }

    if (!fs.existsSync(filePath)) {
        console.warn(`  ⚠️  File không tồn tại: ${filePath}`)
        return stats
    }

    const fileSize = fs.statSync(filePath).size
    console.log(`  📄 ${path.basename(filePath)} (${(fileSize / 1024).toFixed(0)} KB)`)

    let lineNum = 0

    for await (const line of readCSVLines(filePath)) {
        lineNum++
        const cols = parseCSVLine(line)

        // Format: drawDate,lotteryType,province,DB,DB_head,DB_tail,specialCodes,G1,G2,G3,G4,G5,G6,G7
        if (cols.length < 14) {
            console.warn(`  ⚠️  Dòng ${lineNum}: thiếu cột (${cols.length}/14) — skip`)
            stats.skipped++
            continue
        }

        const [drawDate, , province, db, , , specialCodes, g1, g2, g3, g4, g5, g6, g7] = cols

        // Lọc theo --from nếu có
        if (fromDate) {
            const p = parseDate(drawDate)
            if (p) {
                const rowDate = new Date(Date.UTC(p.y, p.m - 1, p.d))
                if (rowDate < fromDate) { stats.skipped++; continue }
            }
        }

        const result = await insertRow({
            drawDate, lotteryType, province,
            db, specialCodes, g1, g2, g3, g4, g5, g6, g7,
        }, `csv-import-${lotteryType.toLowerCase()}`)

        if (result === 'inserted') stats.inserted++
        else if (result === 'skipped') stats.skipped++
        else stats.errors++

        // Progress log mỗi 100 dòng
        if (lineNum % 100 === 0) {
            process.stdout.write(`\r  → Dòng ${lineNum} | ✅ ${stats.inserted} | ⏭ ${stats.skipped} | ❌ ${stats.errors}`)
        }
    }

    // Clear progress line
    process.stdout.write('\r' + ' '.repeat(60) + '\r')

    return stats
}

// ─── Main ─────────────────────────────────────────────
async function main() {
    // ── Parse CLI args ──────────────────────────────────
    const onlyArg = process.argv.find(a => a.startsWith('--only='))
    const only = onlyArg?.split('=')[1]?.toLowerCase() as 'xsmb' | 'xsmn' | 'xsmt' | undefined

    const fromArg = process.argv.find(a => a.startsWith('--from='))
    const fromStr = fromArg?.split('=')[1]
    let fromDate: Date | undefined
    if (fromStr) {
        const [y, m, d] = fromStr.split('-').map(Number)
        fromDate = new Date(Date.UTC(y, m - 1, d))
        if (isNaN(fromDate.getTime())) {
            console.error(`❌ --from không hợp lệ: "${fromStr}" — dùng format YYYY-MM-DD`)
            process.exit(1)
        }
    }

    if (only && !['xsmb', 'xsmn', 'xsmt'].includes(only)) {
        console.error(`❌ --only phải là xsmb, xsmn, hoặc xsmt`)
        process.exit(1)
    }

    const runXSMB = !only || only === 'xsmb'
    const runXSMN = !only || only === 'xsmn'
    const runXSMT = !only || only === 'xsmt'

    const regions = [runXSMB && 'XSMB', runXSMN && 'XSMN', runXSMT && 'XSMT'].filter(Boolean).join(' + ')

    console.log('═'.repeat(60))
    console.log(`  📥 Import CSV → Database  [${regions}]`)
    console.log('═'.repeat(60))
    console.log(`  CSV dir: ${CSV_DIR}`)
    if (fromDate) console.log(`  Từ ngày: ${fromStr}`)
    console.log()

    const startTime = Date.now()
    const totalStats = { inserted: 0, skipped: 0, errors: 0 }

    console.log('▶ Kiểm tra provinces...')
    await ensureMissingProvinces()
    console.log()

    // ── XSMB ──────────────────────────────────────────
    if (runXSMB) {
        console.log('▶ XSMB...')
        const stats = await importFile(path.join(CSV_DIR, 'xsmb.csv'), 'XSMB', fromDate)
        console.log(`  ✅ ${stats.inserted} inserted | ⏭ ${stats.skipped} skipped | ❌ ${stats.errors} errors`)
        console.log()
        totalStats.inserted += stats.inserted
        totalStats.skipped += stats.skipped
        totalStats.errors += stats.errors
    }

    // ── XSMN ──────────────────────────────────────────
    if (runXSMN) {
        console.log('▶ XSMN...')
        const stats = await importFile(path.join(CSV_DIR, 'xsmn.csv'), 'XSMN', fromDate)
        console.log(`  ✅ ${stats.inserted} inserted | ⏭ ${stats.skipped} skipped | ❌ ${stats.errors} errors`)
        console.log()
        totalStats.inserted += stats.inserted
        totalStats.skipped += stats.skipped
        totalStats.errors += stats.errors
    }

    // ── XSMT ──────────────────────────────────────────
    if (runXSMT) {
        console.log('▶ XSMT...')
        const stats = await importFile(path.join(CSV_DIR, 'xsmt.csv'), 'XSMT', fromDate)
        console.log(`  ✅ ${stats.inserted} inserted | ⏭ ${stats.skipped} skipped | ❌ ${stats.errors} errors`)
        console.log()
        totalStats.inserted += stats.inserted
        totalStats.skipped += stats.skipped
        totalStats.errors += stats.errors
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

    console.log('═'.repeat(60))
    console.log('  ✅ HOÀN THÀNH')
    console.log('═'.repeat(60))
    console.log(`  Inserted: ${totalStats.inserted.toLocaleString()} records`)
    console.log(`  Skipped:  ${totalStats.skipped.toLocaleString()}`)
    console.log(`  Errors:   ${totalStats.errors}`)
    console.log(`  Time:     ${elapsed}s`)
    if (totalStats.errors > 0) {
        console.log()
        console.log('  ⚠️  Có lỗi — kiểm tra log ở trên')
    }

    await prisma.$disconnect()
}

main().catch(async err => {
    console.error('\n💥 Script crashed:', err)
    await prisma.$disconnect()
    process.exit(1)
})