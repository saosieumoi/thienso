// scripts/re-crawl-28-03.ts
// Re-crawl XSMN và XSMT ngày 28/03/2026 (thứ 7)
import 'dotenv/config'
import { crawlXSMN } from './crawlers/xsmn'
import { crawlXSMT } from './crawlers/xsmt'

async function main() {
    // 28/03/2026 = thứ 7
    const date = new Date('2026-03-28T00:00:00.000Z')

    console.log('🕷  Re-crawl XSMN ngày 28/03/2026 (thứ 7)...\n')
    const xsmn = await crawlXSMN(date)
    console.log('\n📊 XSMN result:', JSON.stringify(xsmn, null, 2))

    console.log('\n🕷  Re-crawl XSMT ngày 28/03/2026 (thứ 7)...\n')
    const xsmt = await crawlXSMT(date)
    console.log('\n📊 XSMT result:', JSON.stringify(xsmt, null, 2))
}

main().catch(console.error)