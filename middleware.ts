import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/signin", "/favicon.ico"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/cccc-obayashi-jv") ||
    PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  ) {
    return NextResponse.next();
  }

  const session = request.cookies.get("t5_session")?.value;
  const needsAuth =
    pathname === "/" || pathname.startsWith("/console") || pathname.startsWith("/platform");

  if (!session && needsAuth) {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    if (pathname.startsWith("/console") || pathname.startsWith("/platform")) {
      url.searchParams.set("next", pathname.startsWith("/platform") ? "/platform" : "/console");
    }
    return NextResponse.redirect(url);
  }

  if (session && pathname === "/signin") {
    const next = request.nextUrl.searchParams.get("next");
    const url = request.nextUrl.clone();
    url.pathname = next === "/console" || next === "/platform" ? next : "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
