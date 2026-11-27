/**
 * Contact form → email, as a Vercel Function (Node.js runtime).
 *
 * The portfolio's form POSTs JSON to /api/contact. This function checks it and
 * sends it to your inbox through Resend (https://resend.com, free tier).
 *
 * Set these in Vercel → your project → Settings → Environment Variables:
 *   RESEND_API_KEY      your Resend API key (starts with "re_")
 *   CONTACT_TO_EMAIL    where messages should arrive
 *   CONTACT_FROM_EMAIL  optional. Until you verify a domain in Resend, leave it
 *                       unset: messages are sent from onboarding@resend.dev and
 *                       can only go to the email you signed up to Resend with.
 *
 * Written in plain JavaScript on purpose: Vercel runs it as-is, with nothing
 * to compile. See docs/DEPLOY-VERCEL.md, step 4.
 */

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });

// One message per minute per visitor (best effort: kept per function instance).
const lastSent = new Map();
const RATE_LIMIT_MS = 60_000;

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
const oneLine = (s) => s.replace(/[\r\n]+/g, ' ').trim();

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return json({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'POST' });
    }

    // Only accept submissions sent from this site.
    const origin = request.headers.get('origin');
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    if (origin && host) {
      try {
        if (new URL(origin).host !== host) return json({ ok: false, error: 'forbidden' }, 403);
      } catch {
        return json({ ok: false, error: 'forbidden' }, 403);
      }
    }

    const { RESEND_API_KEY, CONTACT_TO_EMAIL, CONTACT_FROM_EMAIL } = process.env;
    if (!RESEND_API_KEY || !CONTACT_TO_EMAIL) {
      return json({ ok: false, error: 'not_configured' }, 503);
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return json({ ok: false, error: 'invalid_json' }, 400);
    }

    // Bots fill in the hidden "company" field; pretend it worked.
    if (String(data?.company ?? '').trim() !== '') return json({ ok: true });

    const name = String(data?.name ?? '').trim();
    const email = String(data?.email ?? '').trim();
    const message = String(data?.message ?? '').trim();
    if (!name || name.length > 100) return json({ ok: false, error: 'invalid_name' }, 422);
    if (!EMAIL_RE.test(email) || email.length > 200) return json({ ok: false, error: 'invalid_email' }, 422);
    if (message.length < 10 || message.length > 5000) return json({ ok: false, error: 'invalid_message' }, 422);

    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
    const now = Date.now();
    if (now - (lastSent.get(ip) ?? 0) < RATE_LIMIT_MS) {
      return json({ ok: false, error: 'too_many_requests' }, 429);
    }
    lastSent.set(ip, now);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: CONTACT_FROM_EMAIL || 'Portfolio <onboarding@resend.dev>',
        to: [CONTACT_TO_EMAIL],
        reply_to: email,
        subject: `Portfolio message from ${oneLine(name)}`,
        text: `Name: ${oneLine(name)}\nEmail: ${email}\n\n${message}\n`,
      }),
    });

    if (!res.ok) {
      console.error('Resend error', res.status, await res.text().catch(() => ''));
      return json({ ok: false, error: 'send_failed' }, 502);
    }
    return json({ ok: true });
  },
};
