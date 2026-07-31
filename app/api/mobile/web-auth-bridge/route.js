import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getMobileUserByAccessToken } from '@/lib/mobile-auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function getRedirectPath(value) {
  const path = typeof value === 'string' ? value : '/'
  if (!path.startsWith('/')) return '/'
  if (path.startsWith('//')) return '/'
  return path
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization') || ''
  const refreshToken = request.headers.get('x-refresh-token') || ''
  const accessTokenMatch = authHeader.match(/^Bearer\s+(.+)$/i)
  const accessToken = accessTokenMatch?.[1] || ''
  const redirectPath = getRedirectPath(request.nextUrl.searchParams.get('redirect'))

  if (!accessToken || !refreshToken) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const mobileUser = await getMobileUserByAccessToken(accessToken)
  if (mobileUser.status === 'forbidden') {
    return NextResponse.redirect(new URL('/login?error=mobile-not-approved', request.url))
  }
  if (mobileUser.status === 'unauthorized') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const response = NextResponse.redirect(new URL(redirectPath, request.url))
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Expires', '0')

  const supabase = createServerClient(
    process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  })

  if (error) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}
