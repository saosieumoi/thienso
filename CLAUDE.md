@AGENTS.md
# CLAUDE.md — Thiên Số (thienso.com)

Tài liệu này hướng dẫn Claude làm việc trong dự án Thiên Số. Đọc toàn bộ trước khi viết bất kỳ dòng code nào.

---

## 1. Dự án là gì

**Thiên Số** là nền tảng phân tích dữ liệu xổ số Việt Nam.

- **Định vị:** "AI trợ lý phân tích dữ liệu xổ số và quản lý chiến lược chơi có trách nhiệm"
- **Tagline:** "Dữ liệu rõ hơn, chọn số tốt hơn."
- **Pháp lý quan trọng:** Thiên Số KHÔNG dự đoán kết quả. Chỉ cung cấp phân tích thống kê lịch sử. Mọi ngôn ngữ trong code, UI, comment phải phản ánh điều này.

---

## 2. Tech stack

```
Frontend:    Next.js 14 (App Router) + TypeScript + Tailwind CSS
Database:    Supabase (PostgreSQL) + Prisma ORM v6
Deploy:      Vercel (frontend + cron jobs)
Crawling:    Cheerio (HTML parsing, không dùng Playwright trừ khi cần thiết)
AI:          Claude API (claude-sonnet-4-20250514)
Analytics:   Vercel Analytics + PostHog
Payment:     MoMo / ZaloPay
```

---

## 3. Cấu trúc thư mục

```
thienso/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── (kqxs)/                 # Route group cho kết quả xổ số
│   │   │   ├── xsmb/
│   │   │   │   ├── page.tsx        # Trang XSMB hôm nay
│   │   │   │   └── [date]/page.tsx # Trang theo ngày
│   │   │   ├── xsmn/
│   │   │   └── xsmt/
│   │   ├── vietlott/
│   │   └── api/
│   │       ├── cron/
│   │       │   └── crawl-xsmb/route.ts
│   │       ├── health/route.ts
│   │       └── test-crawler/route.ts  # Chỉ dùng trong development
│   ├── lib/
│   │   ├── prisma.ts               # Prisma Client singleton
│   │   └── crawlers/
│   │       └── xsmb.ts             # Crawler đã production-ready
│   └── scripts/
│       ├── crawlers/
│       │   └── xsmb.ts             # Copy từ lib/crawlers để test local
│       └── test-crawler.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── scripts/
│   └── tsconfig.json
├── vercel.json                     # Cron job config
└── CLAUDE.md                       # File này
```

---

## 4. Database schema — 7 bảng chính

```prisma
LotteryType   # Loại xổ số: XSMB, XSMN, XSMT, MEGA645, POWER655, KENO...
Province      # 63 tỉnh thành + mapping với LotteryType
Draw          # Mỗi kỳ quay (unique: drawDate + lotteryTypeId + provinceId)
Result        # Kết quả từng giải (DB, G1...G7) với tailNums[], headNums[]
LotoResult    # Bảng lô tô xếp theo đầu số (head0[]...head9[])
StatCache     # Cache thống kê tần suất, tránh tính lại mỗi request
CrawlLog      # Lịch sử crawler, dùng để debug và alert
```

**Quan trọng:** Prisma version đang dùng là **v6.12.0** (không phải v7). Không dùng cú pháp Prisma v7 (`prisma.config.ts`, adapter pattern).

---

## 5. Crawler — kiến trúc cross-validate

Crawler XSMB (`src/lib/crawlers/xsmb.ts`) có kiến trúc 4 bước:

```
Bước 1: Fetch SONG SONG 2 nguồn chính (Promise.all)
  - Nguồn 1: xosodaiphat.com — id: mb_prize_DB_item_0, mb_prize_1_item_0...
  - Nguồn 2: minhngoc.net.vn — class: td.giaidb, td.giai1...td.giai7

Bước 2: Kiểm tra đủ 2 nguồn thành công
  - Nếu thiếu → thử fallback: xoso.com.vn (id: mb_prizeDB_item_0...)
  - Vẫn thiếu → CrawlLog(failed) + Telegram alert

Bước 3: Cross-validate — tất cả giải phải khớp cả 2 nguồn
  - Mismatch → CrawlLog(failed) + Telegram alert (kèm chi tiết giải nào sai)
  - Có thể là site đang cập nhật live — cron chạy lúc 19:00 VN để tránh

Bước 4: INSERT vào DB (chỉ khi 2 nguồn khớp nhau)
  - Dùng data từ nguồn 1 (ưu tiên)
  - CrawlLog(success) với source = "xosodaiphat.com+minhngoc.net.vn"
```

**Validate bắt buộc trước khi cross-validate:**
- Phải có đủ 7 giải
- Phải có giải đặc biệt (DB)
- Giải đặc biệt phải là đúng 5 chữ số

**Parsers — selector thực tế đã xác nhận:**

```typescript
// xosodaiphat.com: span[id^="mb_prize_DB_item_"], span[id^="mb_prize_1_item_"]...
// minhngoc.net.vn: td.giaidb > div, td.giai1 > div...
//   Lưu ý: trang minhngoc có nhiều kỳ, phải tìm đúng ngày qua td.ngay > span.tngay a
// xoso.com.vn (fallback): span[id^="mb_prizeDB_item_"]... (không có _ trước item)
```

---

## 6. Prisma Client singleton

Luôn dùng singleton từ `src/lib/prisma.ts`, KHÔNG tạo `new PrismaClient()` trực tiếp trong các file khác (trừ scripts chạy độc lập):

```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

**Ngoại lệ:** Trong `src/scripts/` chạy với tsx độc lập, có thể dùng `new PrismaClient()` trực tiếp để tránh import alias issue.

---

## 7. Env variables

```env
# Database
DATABASE_URL="postgresql://...?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://..."   # Không có pgbouncer, dùng cho Prisma migrate

# Crawler alerts
TELEGRAM_BOT_TOKEN="..."
TELEGRAM_CHAT_ID="..."

# Cron security
CRON_SECRET="..."

# App
NEXT_PUBLIC_APP_URL="https://thienso.com"
```

---

## 8. Vercel cron — lịch crawl

```json
// vercel.json
{
  "crons": [
    { "path": "/api/cron/crawl-xsmb", "schedule": "0 12 * * *" }
  ]
}
```

`0 12 * * *` = 12:00 UTC = 19:00 UTC+7 (VN time). Chờ đến 19:00 để đảm bảo mọi đài đã quay xong và tất cả site đã cập nhật đầy đủ — tránh mismatch false alarm khi đang quay live.

Cron endpoint cần verify `Authorization: Bearer ${CRON_SECRET}` header.

---

## 9. SEO — pattern bắt buộc

Mọi trang KQXS phải có:

```typescript
// generateMetadata() cho từng page type
export async function generateMetadata({ params }): Promise<Metadata> {
  return {
    title: `Kết quả XSMB ${date} - Thiên Số`,
    description: `KQXS Miền Bắc ngày ${date}. Giải đặc biệt: ${db}. Xem đầy đủ tại Thiên Số.`,
    openGraph: { ... },
  }
}

// JSON-LD Schema.org
// LotteryResult + BreadcrumbList + WebPage
```

ISR (Incremental Static Regeneration):
```typescript
export const revalidate = 60 // Revalidate mỗi 60 giây
```

---

## 10. Nguyên tắc code quan trọng

### Luôn làm

- **Verify data bằng Prisma Studio sau mỗi lần crawler chạy.** Mở `npx prisma studio` và kiểm tra số đặc biệt có khớp với kết quả thật không. Đây là bước không thể bỏ qua.
- **Dùng `tsx` để chạy script TypeScript** (không dùng `ts-node` vì conflict trên Windows). Script: `npx tsx src/scripts/test-crawler.ts`
- **Build command phải có `prisma generate`**: `"build": "prisma generate && next build"`
- **Upsert thay vì insert** cho Draw và LotoResult để tránh duplicate khi re-crawl.

### Không làm

- **KHÔNG dùng từ "dự đoán kết quả"** trong bất kỳ text, comment, variable name nào. Dùng "phân tích thống kê", "tần suất lịch sử", "gợi ý dựa trên dữ liệu".
- **KHÔNG import `@/` trong scripts** — dùng relative path hoặc `new PrismaClient()` trực tiếp.
- **KHÔNG dùng Prisma v7 syntax** — project đang dùng v6.12.0.
- **KHÔNG crawl trước 18:45 VN time** — cron chạy lúc 19:00 VN.
- **KHÔNG insert nếu cross-validate fail** — thà không có data còn hơn data sai.

---

## 11. Chạy project

```bash
# Development
npm run dev                    # Next.js dev server tại localhost:3000

# Database
npx prisma migrate dev         # Chạy migration mới
npx prisma db seed             # Seed lottery types + provinces
npx prisma studio              # UI xem/edit data

# Test crawler (chỉ dùng trong dev)
npm run test:crawler           # tsx src/scripts/test-crawler.ts
# hoặc: curl http://localhost:3000/api/test-crawler

# Build + deploy
npm run build                  # prisma generate + next build
vercel --prod                  # Deploy lên Vercel
```

---

## 12. Các query hay dùng

```typescript
// Kết quả XSMB hôm nay
const today = new Date(); today.setHours(0,0,0,0)
const draw = await prisma.draw.findFirst({
  where: { drawDate: today, lotteryType: { code: 'XSMB' }, isComplete: true },
  include: { results: { orderBy: { prizeName: 'asc' } }, lotoResults: true },
})

// Lịch sử 7 ngày
const history = await prisma.draw.findMany({
  where: { lotteryType: { code: 'XSMB' }, isComplete: true },
  orderBy: { drawDate: 'desc' },
  take: 7,
  include: { results: { where: { prizeName: { in: ['DB', 'G7'] } } } },
})

// Thống kê tần suất 30 ngày
const thirtyDaysAgo = new Date()
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
const freqData = await prisma.result.findMany({
  where: { draw: { lotteryType: { code: 'XSMB' }, drawDate: { gte: thirtyDaysAgo } } },
  select: { tailNums: true },
})
```

---

## 13. Màu sắc thương hiệu

```css
--gold:    #C9A84C  /* Kim Tinh — accent chính, CTA, highlight */
--ink:     #0B0E14  /* Thiên Hà — nền tối */
--jade:    #2A6B5C  /* Ngọc Bích — success, data, trust */
--gold-l:  #E8C97A  /* Gold sáng hơn — text trên nền tối */
--jade-l:  #3D9B82  /* Jade sáng hơn */
```

Font: `Playfair Display` (headline, số lớn) + `Be Vietnam Pro` (UI, body).

---

## 14. Roadmap hiện tại

**Sprint 1 (Ngày 1–7) — đang thực hiện:**
- [x] Setup Next.js + Prisma + Supabase
- [x] Database schema 7 bảng
- [x] Seed lottery types + provinces
- [x] Crawler XSMB với cross-validate
- [ ] Trang KQXS hôm nay (XSMB, XSMN, XSMT)
- [ ] Trang Vietlott (Mega, Power, Keno)
- [ ] Dynamic routes `/xsmb/[date]`
- [ ] Nav + submenu component
- [ ] Sitemap + SEO metadata
- [ ] Vercel cron jobs
- [ ] Deploy lên thienso.com

**Sprint 2 (Ngày 8–14):**
- Thống kê tần suất (heatmap 0–99)
- Lô gan tracker
- SEO programmatic content
- Adsterra ads

**Sprint 3–4 (Ngày 15–35):**
- Wheeling system
- AI assistant (Claude API)
- Auth + subscription Pro 79k/tháng
- MoMo/ZaloPay payment