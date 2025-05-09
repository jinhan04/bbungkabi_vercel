import "./globals.css";

export const metadata = {
  title: "뻥카비",
  description: "뻥카비 온라인 게임",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
