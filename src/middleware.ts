import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Si Supabase n'est pas encore configuré (mode développement initial)
  if (!supabaseUrl || !supabaseKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  const isAccessingAdmin = request.nextUrl.pathname.startsWith('/admin');
  const isAccessingUsers = request.nextUrl.pathname.startsWith('/admin/users');
  const isAccessingNewMember = request.nextUrl.pathname.startsWith('/admin/members/new');
  const isAccessingVerify = request.nextUrl.pathname.startsWith('/verify');
  const isAccessingLogin = request.nextUrl.pathname === '/login';

  // Redirection automatique de courtoisie /signin -> /login
  if (request.nextUrl.pathname === '/signin') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const isProtected = isAccessingAdmin || isAccessingVerify;
  const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 1 heure d'inactivité
  const now = Date.now();

  // Protection des routes d'administration et du scanner de vérification
  if (isProtected) {
    if (!user) {
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }

    // Vérification de l'inactivité (1 heure)
    const lastActivityCookie = request.cookies.get('welj_last_activity')?.value;
    if (lastActivityCookie) {
      const lastActivity = parseInt(lastActivityCookie, 10);
      if (!isNaN(lastActivity) && now - lastActivity > INACTIVITY_TIMEOUT_MS) {
        const redirectUrl = new URL('/login', request.url);
        redirectUrl.searchParams.set('reason', 'inactivity');
        redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname);

        const logoutResponse = NextResponse.redirect(redirectUrl);
        logoutResponse.cookies.delete('welj_last_activity');
        request.cookies.getAll().forEach((c) => {
          if (c.name.startsWith('sb-')) {
            logoutResponse.cookies.delete(c.name);
          }
        });
        return logoutResponse;
      }
    }

    // Actualiser le cookie de dernière activité
    response.cookies.set('welj_last_activity', now.toString(), {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 60 * 60,
    });

    const role = user.app_metadata?.role || user.user_metadata?.role || 'agent';

    // Sécurité stricte RBAC :
    // 1. Les comptes agents n'ont AUCUN accès à la gestion des utilisateurs (/admin/users)
    if (role === 'agent' && isAccessingUsers) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }

    // 2. Les comptes agents n'ont AUCUN accès au formulaire de création de membre (/admin/members/new)
    if (role === 'agent' && isAccessingNewMember) {
      return NextResponse.redirect(new URL('/admin/members', request.url));
    }
  }

  // Redirection si déjà connecté et tente d'aller sur /login
  if (isAccessingLogin && user) {
    const reason = request.nextUrl.searchParams.get('reason');
    if (reason !== 'inactivity') {
      const role = user.app_metadata?.role || user.user_metadata?.role || 'agent';
      const redirectToParam = request.nextUrl.searchParams.get('redirectTo');
      if (role === 'admin') {
        if (redirectToParam && redirectToParam.startsWith('/admin')) {
          return NextResponse.redirect(new URL(redirectToParam, request.url));
        }
        return NextResponse.redirect(new URL('/admin/dashboard', request.url));
      } else {
        // Agent de contrôle : va toujours directement au scanner de cartes
        return NextResponse.redirect(new URL('/verify', request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/verify',
    '/verify/:path*',
    '/login',
    '/signin',
  ],
};
