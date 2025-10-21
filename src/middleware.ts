// src\middleware.ts
import { NextRequest, NextResponse } from "next/server";

const PROTECTED = [
  "/",
  "/lobby",
  "/room",
  "/game",
  "/roundresult",
  "/finalresult",
];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/cards") ||
    pathname.startsWith("/sounds") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.startsWith("/api/auth") || // 인증 API는 열어둠
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup")
  ) {
    return NextResponse.next();
  }

  const needAuth = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(p)
  );
  if (!needAuth) return NextResponse.next();

  const hasSession = !!req.cookies.get("bbungkabi_session")?.value;
  if (hasSession) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname + (search || ""));
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
