import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const password = process.env.FIELD_MAPPER_PASSWORD;
  if (!password) return NextResponse.next();

  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Basic ')) {
    const credentials = atob(authorization.slice('Basic '.length));
    const separatorIndex = credentials.indexOf(':');
    const suppliedPassword = separatorIndex >= 0 ? credentials.slice(separatorIndex + 1) : '';

    if (suppliedPassword === password) {
      return withSecurityHeaders(NextResponse.next());
    }
  }

  return new NextResponse('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Field Photo Mapper"',
      'Cache-Control': 'no-store'
    }
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};

function withSecurityHeaders(response: NextResponse) {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'same-origin');
  response.headers.set('X-Frame-Options', 'DENY');
  return response;
}
