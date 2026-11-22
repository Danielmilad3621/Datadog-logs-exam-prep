// Shared-password Basic Auth gate (username "student", password STUDY_PASSWORD).
// Open in development when unset; fails closed in production.
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function checkStudyGate(request: Request, password: string | undefined, isProd: boolean): Response | null {
  if (!password) {
    if (!isProd) return null;
    return new Response("Configuration required: set the STUDY_PASSWORD secret and republish.", {
      status: 503,
      headers: { "Cache-Control": "no-store", "Content-Type": "text/plain" },
    });
  }
  const header = request.headers.get("authorization") || "";
  const expected = `Basic ${btoa(`student:${password}`)}`;
  if (safeEqual(header, expected)) return null;
  return new Response(
    "This is a private study app. Sign in with username student and your STUDY_PASSWORD.",
    {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Private Log Lab", charset="UTF-8"',
        "Cache-Control": "private, no-store",
        "Content-Type": "text/plain; charset=utf-8",
      },
    },
  );
}
