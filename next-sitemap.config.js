// next-sitemap.config.js
// Cài đặt: npm install next-sitemap
// Thêm vào package.json scripts: "postbuild": "next-sitemap"

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.SITE_URL || 'https://thienso.com',
  generateRobotsTxt: true,
  generateIndexSitemap: true,
  sitemapSize: 5000,

  // Exclude các route không cần index
  exclude: [
    '/api/*',
    '/dev/*',
  ],

  // Cấu hình mặc định cho tất cả trang
  changefreq: 'daily',
  priority: 0.7,

  // Cấu hình riêng theo pattern
  additionalPaths: async (config) => {
    const results = []

    // Trang chính — priority cao nhất
    const mainPages = [
      { loc: '/',     changefreq: 'daily',  priority: 1.0 },
      { loc: '/xsmb', changefreq: 'daily',  priority: 1.0 },
      { loc: '/xsmn', changefreq: 'daily',  priority: 1.0 },
      { loc: '/xsmt', changefreq: 'daily',  priority: 1.0 },
    ]
    results.push(...mainPages)

    // Trang lịch sử ngày — tự động generate từ DB
    try {
      const { PrismaClient } = require('@prisma/client')
      const prisma = new PrismaClient()

      // Lấy tất cả ngày đã có data từ DB
      const [xsmbDates, xsmnDates, xsmtDates] = await Promise.all([
        prisma.draw.findMany({
          where: { lotteryType: { code: 'XSMB' }, isComplete: true },
          select: { drawDate: true },
          orderBy: { drawDate: 'desc' },
        }),
        prisma.draw.findMany({
          where: { lotteryType: { code: 'XSMN' }, isComplete: true },
          select: { drawDate: true },
          distinct: ['drawDate'],
          orderBy: { drawDate: 'desc' },
        }),
        prisma.draw.findMany({
          where: { lotteryType: { code: 'XSMT' }, isComplete: true },
          select: { drawDate: true },
          distinct: ['drawDate'],
          orderBy: { drawDate: 'desc' },
        }),
      ])

      // XSMB — mỗi ngày 1 URL
      for (const { drawDate } of xsmbDates) {
        const date = drawDate.toISOString().split('T')[0]
        results.push({
          loc: `/xsmb/${date}`,
          changefreq: 'monthly',
          priority: 0.6,
          lastmod: drawDate.toISOString(),
        })
      }

      // XSMN — mỗi ngày 1 URL (nhiều đài nhưng chung 1 URL)
      const xsmnUniqueDates = [...new Set(xsmnDates.map(d => d.drawDate.toISOString().split('T')[0]))]
      for (const date of xsmnUniqueDates) {
        results.push({
          loc: `/xsmn/${date}`,
          changefreq: 'monthly',
          priority: 0.6,
        })
      }

      // XSMT — mỗi ngày 1 URL
      const xsmtUniqueDates = [...new Set(xsmtDates.map(d => d.drawDate.toISOString().split('T')[0]))]
      for (const date of xsmtUniqueDates) {
        results.push({
          loc: `/xsmt/${date}`,
          changefreq: 'monthly',
          priority: 0.6,
        })
      }

      await prisma.$disconnect()
      console.log(`[Sitemap] Generated ${results.length} URLs`)
    } catch (err) {
      console.error('[Sitemap] DB error:', err)
    }

    return results
  },

  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/dev/'],
      },
    ],
    additionalSitemaps: [
      'https://thienso.com/sitemap.xml',
    ],
  },
}
