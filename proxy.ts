import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';

function equal(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function proxy(request: NextRequest) {
  const password = process.env.STUDY_PASSWORD;
  // Local development works without configuration; hosted deployments fail CLOSED.
  if (!password) {
    if (process.env.NODE_ENV !== 'production') return NextResponse.next();
    return new NextResponse('Configuration required: set STUDY_PASSWORD in Vercel environment variables and redeploy.', {
      status: 503, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain' }
    });
  }
  const header = request.headers.get('authorization') || '';
  const expected = `Basic ${Buffer.from(`student:${password}`).toString('base64')}`;
  if (equal(header, expected)) {
    const result = NextResponse.next();
    result.headers.set('Cache-Control', 'private, no-store');
    return result;
  }
  return new NextResponse('This is a private study app. Sign in with username student and your STUDY_PASSWORD.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Private Log Lab", charset="UTF-8"',
      'Cache-Control': 'private, no-store',
      'Content-Type': 'text/plain; charset=utf-8'
    },
  });
}

export const config = {
  matcher: ['/', '/:path*'],
};
