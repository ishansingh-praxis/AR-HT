/**
 * Sends email through a provider adapter. MAIL_PROVIDER=resend uses the Resend HTTP API (RESEND_API_KEY, MAIL_FROM).
 * Anything else ("console", the default) prints the message, which is what you want in development and tests;
 * the last messages are also kept in `outbox` so tests can read the verification codes.
 */
export function createMailer({ provider = 'console', apiKey = '', from = 'HomeTown AR <no-reply@example.com>', fetchImpl = fetch, log = console } = {}) {
  const outbox = [];
  async function send({ to, subject, text }) {
    outbox.push({ to, subject, text });
    if (outbox.length > 50) outbox.shift();
    if (provider === 'resend') {
      const res = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST', headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from, to, subject, text }),
      });
      if (!res.ok) throw new Error(`Mail provider returned ${res.status}`);
    } else {
      log.info?.(`[mail to ${to}] ${subject}\n${text}`);
    }
  }
  return { send, outbox };
}
