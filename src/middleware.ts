import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    // If user is authenticated and trying to access auth pages, redirect to chat
    if (req.nextUrl.pathname.startsWith('/auth/') && req.nextauth.token) {
      return NextResponse.redirect(new URL('/', req.url))
    }
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Allow access to auth pages without authentication
        if (req.nextUrl.pathname.startsWith('/auth/')) {
          return true
        }
        // Require authentication for all other pages
        return !!token
      },
    },
    pages: {
      signIn: '/auth/signin',
    },
  }
)

// Protect all routes except auth pages and API routes
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
