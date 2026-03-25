import { PrismaClient, LotteryRegion, LotteryCategory } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Seeding lottery types...')

    // ── Xổ số Miền Bắc ──
    const xsmb = await prisma.lotteryType.upsert({
        where: { code: 'XSMB' },
        update: {},
        create: {
            code: 'XSMB',
            name: 'Xổ số Miền Bắc',
            shortName: 'MB',
            category: LotteryCategory.XSKT,
            region: LotteryRegion.MIEN_BAC,
            drawDays: [0, 1, 2, 3, 4, 5, 6], // Quay hàng ngày
            drawTime: '18:15',
            sortOrder: 1,
        },
    })

    // XSMB chỉ có 1 "đài" — Hà Nội
    await prisma.province.upsert({
        where: { code: 'HN' },
        update: {},
        create: {
            code: 'HN',
            name: 'Hà Nội',
            shortName: 'HN',
            region: LotteryRegion.MIEN_BAC,
            lotteryTypeId: xsmb.id,
            sortOrder: 1,
        },
    })

    // ── Xổ số Miền Nam ──
    const xsmn = await prisma.lotteryType.upsert({
        where: { code: 'XSMN' },
        update: {},
        create: {
            code: 'XSMN',
            name: 'Xổ số Miền Nam',
            shortName: 'MN',
            category: LotteryCategory.XSKT,
            region: LotteryRegion.MIEN_NAM,
            drawDays: [0, 1, 2, 3, 4, 5, 6],
            drawTime: '16:30',
            sortOrder: 2,
        },
    })

    // Tỉnh Miền Nam theo ngày quay
    const mienNamProvinces = [
        // Thứ 2
        { code: 'TPHCM', name: 'TP. Hồ Chí Minh', shortName: 'HCM', day: 1 },
        { code: 'DONGTHÁP', name: 'Đồng Tháp', shortName: 'ĐTP', day: 1 },
        { code: 'CAMAU', name: 'Cà Mau', shortName: 'CMU', day: 1 },
        // Thứ 3
        { code: 'BACLIEU', name: 'Bạc Liêu', shortName: 'BLI', day: 2 },
        { code: 'BINHDUONG', name: 'Bình Dương', shortName: 'BDG', day: 2 },
        { code: 'VUNGTAU', name: 'Vũng Tàu', shortName: 'VTU', day: 2 },
        // Thứ 4
        { code: 'CANTHO', name: 'Cần Thơ', shortName: 'CTH', day: 3 },
        { code: 'DONGNAÍ', name: 'Đồng Nai', shortName: 'ĐNI', day: 3 },
        { code: 'SOCTRANG', name: 'Sóc Trăng', shortName: 'STG', day: 3 },
        // Thứ 5
        { code: 'TAYNINH', name: 'Tây Ninh', shortName: 'TNH', day: 4 },
        { code: 'ANHGIANG', name: 'An Giang', shortName: 'AGI', day: 4 },
        { code: 'BINHTHUAN', name: 'Bình Thuận', shortName: 'BTN', day: 4 },
        // Thứ 6
        { code: 'VINHLONG', name: 'Vĩnh Long', shortName: 'VLG', day: 5 },
        { code: 'BINHPHUOC', name: 'Bình Phước', shortName: 'BPC', day: 5 },
        { code: 'TRAVINH', name: 'Trà Vinh', shortName: 'TVI', day: 5 },
        // Thứ 7
        { code: 'TPHCM2', name: 'TP. HCM (T7)', shortName: 'HCM2', day: 6 },
        { code: 'LONGAN', name: 'Long An', shortName: 'LAN', day: 6 },
        { code: 'BINHDUONG2', name: 'Bình Dương (T7)', shortName: 'BDG2', day: 6 },
        // Chủ nhật
        { code: 'TIENGANG', name: 'Tiền Giang', shortName: 'TGI', day: 0 },
        { code: 'KIENGIANG', name: 'Kiên Giang', shortName: 'KGI', day: 0 },
        { code: 'DALAT', name: 'Đà Lạt', shortName: 'DLA', day: 0 },
    ]

    for (const [i, p] of mienNamProvinces.entries()) {
        await prisma.province.upsert({
            where: { code: p.code },
            update: {},
            create: {
                code: p.code,
                name: p.name,
                shortName: p.shortName,
                region: LotteryRegion.MIEN_NAM,
                lotteryTypeId: xsmn.id,
                drawDayOfWeek: p.day,
                sortOrder: i + 1,
            },
        })
    }

    // ── Xổ số Miền Trung ──
    const xsmt = await prisma.lotteryType.upsert({
        where: { code: 'XSMT' },
        update: {},
        create: {
            code: 'XSMT',
            name: 'Xổ số Miền Trung',
            shortName: 'MT',
            category: LotteryCategory.XSKT,
            region: LotteryRegion.MIEN_TRUNG,
            drawDays: [0, 1, 2, 3, 4, 5, 6],
            drawTime: '17:15',
            sortOrder: 3,
        },
    })

    const mienTrungProvinces = [
        { code: 'THUATHIENHUE', name: 'Thừa T. Huế', shortName: 'TTH', day: 1 },
        { code: 'PHUYEN', name: 'Phú Yên', shortName: 'PYE', day: 1 },
        { code: 'DAKCAK', name: 'Đắk Lắk', shortName: 'DLK', day: 2 },
        { code: 'QUANGNAM', name: 'Quảng Nam', shortName: 'QNM', day: 2 },
        { code: 'DANANG', name: 'Đà Nẵng', shortName: 'DNA', day: 3 },
        { code: 'KHANHHOA', name: 'Khánh Hòa', shortName: 'KHO', day: 3 },
        { code: 'BINHDINH', name: 'Bình Định', shortName: 'BDI', day: 4 },
        { code: 'QUANGTRI', name: 'Quảng Trị', shortName: 'QTR', day: 4 },
        { code: 'QUANGBINH', name: 'Quảng Bình', shortName: 'QBI', day: 4 },
        { code: 'GIALAI', name: 'Gia Lai', shortName: 'GLA', day: 5 },
        { code: 'NINHTHUAN', name: 'Ninh Thuận', shortName: 'NTN', day: 5 },
        { code: 'DANANG2', name: 'Đà Nẵng (T7)', shortName: 'DNA2', day: 6 },
        { code: 'KHANHHOA2', name: 'Khánh Hòa (T7)', shortName: 'KHO2', day: 6 },
        { code: 'DAKNONG', name: 'Đắk Nông', shortName: 'DNG', day: 0 },
        { code: 'QUANGNGAI', name: 'Quảng Ngãi', shortName: 'QNG', day: 0 },
        { code: 'KONTUM', name: 'Kon Tum', shortName: 'KTM', day: 0 },
    ]

    for (const [i, p] of mienTrungProvinces.entries()) {
        await prisma.province.upsert({
            where: { code: p.code },
            update: {},
            create: {
                code: p.code,
                name: p.name,
                shortName: p.shortName,
                region: LotteryRegion.MIEN_TRUNG,
                lotteryTypeId: xsmt.id,
                drawDayOfWeek: p.day,
                sortOrder: i + 1,
            },
        })
    }

    // ── Vietlott ──
    const vietlottTypes = [
        {
            code: 'MEGA645',
            name: 'Mega 6/45',
            shortName: 'Mega',
            category: LotteryCategory.MEGA645,
            drawDays: [2, 4, 6], // T4, T6, T7
            drawTime: '18:00',
            sortOrder: 4,
        },
        {
            code: 'POWER655',
            name: 'Power 6/55',
            shortName: 'Power',
            category: LotteryCategory.POWER655,
            drawDays: [2, 4, 6], // T4, T6, T7 (khác tuần với Mega)
            drawTime: '18:00',
            sortOrder: 5,
        },
        {
            code: 'MAX3D',
            name: 'Max 3D',
            shortName: '3D',
            category: LotteryCategory.MAX3D,
            drawDays: [1, 3, 5], // T2, T4, T6
            drawTime: '18:00',
            sortOrder: 6,
        },
        {
            code: 'MAX3DPRO',
            name: 'Max 3D Pro',
            shortName: '3D Pro',
            category: LotteryCategory.MAX3DPRO,
            drawDays: [1, 3, 5],
            drawTime: '18:00',
            sortOrder: 7,
        },
        {
            code: 'KENO',
            name: 'Keno',
            shortName: 'Keno',
            category: LotteryCategory.KENO,
            drawDays: [], // Mỗi 10 phút — xử lý riêng
            drawTime: '06:00', // Bắt đầu từ 6h
            sortOrder: 8,
        },
    ]

    for (const vl of vietlottTypes) {
        await prisma.lotteryType.upsert({
            where: { code: vl.code },
            update: {},
            create: {
                ...vl,
                region: LotteryRegion.VIETLOTT,
            },
        })
    }

    console.log('✅ Seed completed!')
    console.log(`   - ${await prisma.lotteryType.count()} lottery types`)
    console.log(`   - ${await prisma.province.count()} provinces`)
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())