// layout.tsx
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

export const metadata = {
  title: "뻥카비",
  description: "친구들과 함께 즐기는 뻥카비 게임!",
  openGraph: {
    title: "뻥카비",
    description: "🔥 카드 게임 뻥카비를 지금 플레이하세요!",
    url: "https://www.bbungkabe.com",
    images: [
      {
        url: "https://www.bbungkabe.com/og-image.png", // ⬅ 이 경로 중요!
        width: 1200,
        height: 630,
        alt: "뻥카비 로고",
      },
    ],
  },
};
