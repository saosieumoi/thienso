import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    // Chỉ cho phép trong development
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 })
    }

    const token = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID

    if (!token || !chatId) {
        return NextResponse.json({
            error: 'Thiếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID trong .env'
        }, { status: 500 })
    }

    // Giả lập message y hệt khi crawler fail thật
    const testMessage =
        `🚨 <b>Thiên Số — XSMB Crawler FAIL</b>\n\n` +
        `📅 Ngày: <b>${new Date().toISOString().split('T')[0]}</b>\n` +
        `⏰ ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}\n\n` +
        `❌ Không đủ 2 nguồn để cross-validate:\n` +
        `• xoso.com.vn: HTTP 503\n` +
        `• minhngoc.net.vn: Chỉ parse được 3/7 giải\n\n` +
        `⚠️ <i>Đây là tin nhắn TEST — không phải lỗi thật</i>`

    try {
        const res = await fetch(
            `https://api.telegram.org/bot${token}/sendMessage`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: testMessage,
                    parse_mode: 'HTML',
                }),
            }
        )

        const data = await res.json()

        if (!res.ok) {
            return NextResponse.json({
                success: false,
                error: 'Telegram API lỗi',
                detail: data,
            }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            message: 'Đã gửi test alert đến Telegram ✅',
            telegramResponse: data,
        })
    } catch (err) {
        return NextResponse.json({
            success: false,
            error: String(err),
        }, { status: 500 })
    }
}