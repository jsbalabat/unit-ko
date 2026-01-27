import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Proxy for route protection (replaces deprecated middleware)
 * Handles session refresh and auth state
 * Note: Route protection is primarily handled by client-side HOCs to avoid redirect loops
 */
export async function proxy(req: NextRequest) {
  const res = NextResponse.next()
  const { pathname } = req.nextUrl

  try {
    const supabase = createMiddlewareClient({ req, res })
    
    // Get session - this also refreshes it if needed
    const {
      data: { session },
    } = await supabase.auth.getSession()

    // Allow auth callback routes (for any future auth flows)
    if (pathname.startsWith('/auth/callback')) {
      return res
    }

    // Redirect authenticated users away from auth pages (but not if there's a redirect param)
    if (pathname.startsWith('/auth/landlord') && session && !req.nextUrl.searchParams.has('redirect')) {
      console.log('Authenticated user accessing auth page, redirecting to dashboard')
      return NextResponse.redirect(new URL('/dashboard/landlord', req.url))
    }

    // Let all other routes through - protection is handled by client-side HOCs
    // This prevents redirect loops with session cookie timing issues
    return res
  } catch (error) {
    console.error('Proxy error:', error)
    return res
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public directory)
     * - api routes
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|api).*)',
  ]
}