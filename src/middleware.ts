import { NextRequest, NextResponse } from "next/server";

// 로그인 필요 페이지들(앞으로 필요하면 여기만 추가)
const PROTECTED = ["/lobby", "/room", "/game", "/roundresult", "/finalresult"];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const needAuth = PROTECTED.some((p) => pathname.startsWith(p));

  if (!needAuth) return NextResponse.next();

  // AuthContext가 설정하는 쿠키(bbungkabi_auth=1)로 판별
  const hasAuth = req.cookies.get("bbungkabi_auth")?.value === "1";
  if (hasAuth) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname + (search || ""));
  return NextResponse.redirect(url);
}

// _next, 정적 파일 등은 제외
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|cards|sounds).*)",
  ],
};
