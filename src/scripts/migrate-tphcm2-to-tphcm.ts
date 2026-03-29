// scripts/migrate-tphcm2-to-tphcm.ts
// Migration: chuyển dữ liệu TPHCM2 → TPHCM, xóa province TPHCM2
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🔄 Bắt đầu migrate TPHCM2 → TPHCM...\n')

    // 1. Tìm province TPHCM và TPHCM2
    const tphcm = await prisma.province.findUnique({ where: { code: 'TPHCM' } })
    const tphcm2 = await prisma.province.findUnique({ where: { code: 'TPHCM2' } })

    if (!tphcm) {
        console.error('❌ Province TPHCM không tồn tại trong DB!')
        console.error('   Chạy "npx prisma db seed" trước.')
        process.exit(1)
    }

    if (!tphcm2) {
        console.log('✅ Province TPHCM2 không tồn tại — không cần migrate.')
        process.exit(0)
    }

    console.log(`   TPHCM id: ${tphcm.id}`)
    console.log(`   TPHCM2 id: ${tphcm2.id}`)

    // 2. Tìm tất cả Draw liên quan đến TPHCM2
    const drawsTphcm2 = await prisma.draw.findMany({
        where: { provinceId: tphcm2.id },
        include: { results: true },
    })

    console.log(`\n📊 Tìm thấy ${drawsTphcm2.length} Draw liên quan đến TPHCM2:`)
    for (const draw of drawsTphcm2) {
        const date = draw.drawDate.toISOString().split('T')[0]
        console.log(`   - ${date}: ${draw.results.length} results`)
    }

    // 3. Migrate từng draw
    let skipped = 0
    let migrated = 0

    for (const draw of drawsTphcm2) {
        const existing = await prisma.draw.findUnique({
            where: {
                drawDate_lotteryTypeId_provinceId: {
                    drawDate: draw.drawDate,
                    lotteryTypeId: draw.lotteryTypeId,
                    provinceId: tphcm.id,
                },
            },
        })

        if (existing) {
            // Draw đã tồn tại với TPHCM cùng ngày → xóa duplicate TPHCM2
            await prisma.draw.delete({ where: { id: draw.id } })
            console.log(`   ⚠️ ${draw.drawDate.toISOString().split('T')[0]}: Draw đã tồn tại với TPHCM — xóa TPHCM2 duplicate`)
            skipped++
        } else {
            // Update provinceId từ TPHCM2 → TPHCM
            await prisma.draw.update({
                where: { id: draw.id },
                data: { provinceId: tphcm.id },
            })
            console.log(`   ✅ ${draw.drawDate.toISOString().split('T')[0]}: Migrated TPHCM2 → TPHCM`)
            migrated++
        }
    }

    // 4. Xóa province TPHCM2
    await prisma.province.delete({ where: { code: 'TPHCM2' } })
    console.log(`\n🗑️  Đã xóa province TPHCM2`)

    console.log(`\n📊 Tổng kết:`)
    console.log(`   - Migrated: ${migrated} draws`)
    console.log(`   - Skipped (duplicate): ${skipped} draws`)

    console.log(`\n✅ Migration hoàn tất!`)
    await prisma.$disconnect()
}

main().catch(e => {
    console.error('❌ Migration thất bại:', e)
    process.exit(1)
})
