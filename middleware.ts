import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith("/admin")) return NextResponse.next();
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Basic ")) {
    return new NextResponse("Auth required", { status: 401, headers: { "WWW-Authenticate": "Basic realm=\"Admin\"" } });
  }
  const [u, p] = atob(auth.split(" ")[1]).split(":");
  if (u === process.env.ADMIN_USER && p === process.env.ADMIN_PASS) return NextResponse.next();
  return new NextResponse("Unauthorized", { status: 401, headers: { "WWW-Authenticate": "Basic" } });
}
export const config = { matcher: ["/admin/:path*"] };
