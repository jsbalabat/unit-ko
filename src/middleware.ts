import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  try {
    const {
      data: { session },
      error
    } = await supabase.auth.getSession()

    // Handle auth errors
    if (error) {
      console.error('Auth error:', error)
      return NextResponse.redirect(new URL('/auth/landlord/login', req.url))
    }

    // Allow auth callback routes (for any future auth flows)
    if (req.nextUrl.pathname.startsWith('/auth/callback')) {
      return res
    }

    // Redirect authenticated users away from auth pages while protecting dashboard routes
    if (req.nextUrl.pathname.startsWith('/auth/landlord') && session) {
      return NextResponse.redirect(new URL('/dashboard/landlord', req.url))
    }

    return res
  } catch (error) {
    console.error('Middleware error:', error)
    return NextResponse.redirect(new URL('/auth/landlord/login', req.url))
  }
}

export const config = {
  matcher: [
    // Protect all dashboard routes
    '/dashboard/:path*',
    // Include auth callback for any future auth flows
    '/auth/callback/:path*',
    // Include auth pages to redirect authenticated users
    '/auth/landlord/:path*'
  ]
}