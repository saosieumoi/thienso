// scripts/insert-xsmn-28-03.ts
// Force insert XSMN ngày 28/03/2026 với 4 đài thực tế từ website
import 'dotenv/config'
import { PrismaClient, PrizeName } from '@prisma/client'

const prisma = new PrismaClient()

function tailNum(s: string): number {
    const n = s.replace(/\D/g, '')
    return parseInt(n.slice(-2), 10)
}
function headNum(s: string): number {
    const n = s.replace(/\D/g, '')
    return n.length <= 2 ? 0 : parseInt(n.slice(0, 2), 10)
}

async function insertProvince(
    code: string,
    prizes: Record<string, string[]>,
    drawDate: Date,
    source: string
) {
    const lotteryType = await prisma.lotteryType.findUnique({ where: { code: 'XSMN' } })
    if (!lotteryType) throw new Error('LotteryType XSMN not found')

    const prov = await prisma.province.findUnique({ where: { code } })
    if (!prov) {
        console.warn(`  Province ${code} not in DB, skipping`)
        return
    }

    const [y, m, d] = drawDate.toISOString().split('T')[0].split('-').map(Number)
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

    const PRIZE_MAP: Record<string, PrizeName> = {
        'G7': PrizeName.G7, 'G6': PrizeName.G6, 'G5': PrizeName.G5,
        'G4': PrizeName.G4, 'G3': PrizeName.G3, 'G2': PrizeName.G2,
        'G1': PrizeName.G1, 'DB': PrizeName.DB,
    }

    const allPrizes: { name: PrizeName; numbers: string[] }[] = []
    for (const [label, prizeName] of Object.entries(PRIZE_MAP)) {
        if (prizes[label]) {
            allPrizes.push({ name: prizeName, numbers: prizes[label] })
        }
    }

    for (const p of allPrizes) {
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

    const allTails = allPrizes.flatMap(p => p.numbers.map(tailNum))
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

    console.log(`  ✅ ${code}: DB=${prizes['DB']?.[0]} (${allPrizes.length} giải)`)
}

async function main() {
    // 28/03/2026 = thứ 7 — 4 đài từ website xosodaiphat.com
    const drawDate = new Date('2026-03-28T00:00:00.000Z')

    const provinces = [
        {
            // TP.HCM
            code: 'TPHCM',
            prizes: {
                G7: ['740', '009', '919'],
                G6: ['9841', '7911', '7232'],
                G5: ['2858'],
                G4: ['66314', '85208', '34551', '03793', '92303', '44172', '42207'],
                G3: ['31224', '32016'],
                G2: ['02798'],
                G1: ['54338'],
                DB: ['802879'],
            }
        },
        {
            code: 'LONGAN',
            prizes: {
                G7: ['688'],
                G6: ['0018', '5905', '6740'],
                G5: ['9027'],
                G4: ['22760', '97136', '07580', '85728', '90388', '94203', '73240'],
                G3: ['44048', '03341'],
                G2: ['90415'],
                G1: ['47282'],
                DB: ['988358'],
            }
        },
        {
            code: 'BINHPHUOC',
            prizes: {
                G7: ['919'],
                G6: ['8234', '4886', '6886'],
                G5: ['2489'],
                G4: ['32406', '48925', '34495', '82323', '85203', '11728', '98309'],
                G3: ['69650', '67657'],
                G2: ['99558'],
                G1: ['05092'],
                DB: ['988402'],
            }
        },
        {
            code: 'HAUGIANG',
            prizes: {
                G7: ['688'],
                G6: ['8334', '1160', '8380'],
                G5: ['5639'],
                G4: ['30061', '87439', '55103', '93812', '44822', '22484', '36545'],
                G3: ['10241', '26616'],
                G2: ['06069'],
                G1: ['12029'],
                DB: ['514346'],
            }
        },
    ]

    console.log('Inserting XSMN 28/03/2026 (thứ 7)...\n')
    for (const prov of provinces) {
        await insertProvince(prov.code, prov.prizes, drawDate, 'xosodaiphat.com')
    }
    console.log('\n✅ Done!')
    await prisma.$disconnect()
}

main().catch(console.error)
