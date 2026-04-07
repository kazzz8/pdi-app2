import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(req: NextRequest) {
  const token = await getToken({ req });
  const isAuth = !!token;
  const { pathname } = req.nextUrl;
  const isAuthPage = pathname.startsWith("/login");

  if (isAuthPage) {
    if (isAuth) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  if (!isAuth) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // 分析ダッシュボード・モニター画面は管理者・班長のみ
  if (pathname.startsWith("/analytics") || pathname.startsWith("/monitor")) {
    const role = token.role as string;
    if (role !== "MANAGER" && role !== "TEAM_LEADER") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/vehicles/:path*", "/admin/:path*", "/analytics/:path*", "/monitor/:path*", "/login"],
};
