// scripts/test-crawler.ts
import 'dotenv/config'
import { crawlXSMB } from './crawlers/xsmb'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🕷  Testing XSMB crawler...\n')

    const result = await crawlXSMB()

    console.log('\n📊 Crawl result:')
    console.log(JSON.stringify(result, null, 2))

    if (result.success) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const draw = await prisma.draw.findFirst({
            where: {
                drawDate: today,
                lotteryType: { code: 'XSMB' },
            },
            include: {
                results: { orderBy: { prizeName: 'asc' } },
            },
        })

        if (draw) {
            console.log('\n✅ Data in DB:')
            console.log(`Draw ID: ${draw.id}`)
            draw.results.forEach(r => {
                console.log(`  ${r.prizeName}: ${r.numbers.join(' - ')}`)
            })
        } else {
            console.log('\n⚠️  Không tìm thấy draw trong DB')
        }
    }

    await prisma.$disconnect()
}

main().catch(console.error)