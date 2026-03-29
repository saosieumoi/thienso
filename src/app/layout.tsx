import type { Metadata } from "next";
import Link from "next/link";
import { Playfair_Display, Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Thiên Số — Kết quả xổ số Việt Nam",
    template: "%s | Thiên Số",
  },
  description: "Kết quả xổ số Miền Bắc, Miền Nam, Miền Trung và Vietlott nhanh nhất. Dữ liệu rõ ràng, cập nhật ngay sau kỳ quay.",
  keywords: ["xổ số", "kết quả xổ số", "XSMB", "XSMN", "XSMT", "Vietlott", "Mega 6/45", "Power 6/55"],
  openGraph: {
    title: "Thiên Số — Kết quả xổ số Việt Nam",
    description: "Kết quả xổ số Miền Bắc, Miền Nam, Miền Trung và Vietlott nhanh nhất.",
    url: "https://thienso.com",
    siteName: "Thiên Số",
    locale: "vi_VN",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${playfair.variable} ${beVietnam.variable}`}>
      <body className="min-h-full flex flex-col bg-gray-50 antialiased">
        <Header />
        <main className="flex-1">
          {children}
        </main>
        <footer className="bg-[#0B0E14] text-white/60 py-10 mt-auto">
          <div className="max-w-6xl mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
              {/* Logo & Description */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#C9A84C] to-[#E8C97A] flex items-center justify-center">
                    <span className="text-[#0B0E14] font-black text-sm">T</span>
                  </div>
                  <span className="font-bold text-white">Thiên Số</span>
                </div>
                <p className="text-sm">Dữ liệu rõ hơn, chọn số tốt hơn.</p>
              </div>

              {/* Sản phẩm */}
              <div>
                <div className="text-white font-semibold mb-3">Sản phẩm</div>
                <div className="flex flex-col gap-2 text-sm">
                  <Link href="/xsmb" className="hover:text-white transition-colors">XSMB</Link>
                  <Link href="/xsmn" className="hover:text-white transition-colors">XSMN</Link>
                  <Link href="/xsmt" className="hover:text-white transition-colors">XSMT</Link>
                  <Link href="/vietlott" className="hover:text-white transition-colors">Vietlott</Link>
                </div>
              </div>

              {/* Chính sách */}
              <div>
                <div className="text-white font-semibold mb-3">Chính sách</div>
                <div className="flex flex-col gap-2 text-sm">
                  <a href="#" className="hover:text-white transition-colors">Điều khoản sử dụng</a>
                  <a href="#" className="hover:text-white transition-colors">Chính sách bảo mật</a>
                  <a href="#" className="hover:text-white transition-colors">Liên hệ</a>
                </div>
              </div>

              {/* Kết nối */}
              <div>
                <div className="text-white font-semibold mb-3">Kết nối</div>
                <div className="flex flex-col gap-2 text-sm">
                  <a href="#" className="hover:text-white transition-colors">Email hỗ trợ</a>
                  <a href="#" className="hover:text-white transition-colors">Facebook</a>
                  <a href="#" className="hover:text-white transition-colors">Zalo / Telegram</a>
                </div>
              </div>
            </div>

            {/* Bottom */}
            <div className="border-t border-white/10 pt-6">
              <p className="text-sm text-center">
                Thiên Số là nền tảng phân tích dữ liệu và hỗ trợ theo dõi thông tin. Nền tảng không bán vé và không cam kết kết quả.
              </p>
              <p className="text-sm text-center mt-2 text-white/40">
                © 2026 Thiên Số. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
