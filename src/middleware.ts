import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role;
  const path = nextUrl.pathname;

  // Routes publiques
  const publicPaths = ["/", "/login", "/register", "/tracking", "/services", "/addresses", "/staff-invite", "/privacy", "/api/auth"];
  const isPublic = publicPaths.some((p) => path === p || path.startsWith(`${p}/`)) || path.startsWith("/api/auth");

  if (isPublic) return NextResponse.next();

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(loginUrl);
  }

  // Protection par rôle
  if (path.startsWith("/admin")) {
    if (role !== "ADMIN") return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }
  if (path.startsWith("/staff")) {
    if (role !== "STAFF" && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }
  }
  // ADMIN ou STAFF qui arrivent sur /dashboard → renvoyer vers leur portail
  if (path.startsWith("/dashboard")) {
    if (role === "ADMIN") return NextResponse.redirect(new URL("/admin", nextUrl));
    if (role === "STAFF") return NextResponse.redirect(new URL("/staff", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next|favicon.ico|images|uploads|.*\\..*).*)"],
};
