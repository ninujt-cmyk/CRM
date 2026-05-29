import { updateSession } from "@/lib/supabase/middleware"
import { type NextRequest, NextResponse } from "next/server"

export async function middleware(request: NextRequest) {
  // 1. SAFETY CHECK: If the request is for an API route, skip the auth check completely.
  // This ensures Cron jobs and Webhooks are never redirected to login.
  if (request.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  // 2. For all other pages, run the Supabase Session update (Auth check)
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Any file with a common extension (css, js, images, fonts, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|woff|woff2|ttf|eot|pdf|csv|xlsx|json|map)$).*)",
  ],
}
