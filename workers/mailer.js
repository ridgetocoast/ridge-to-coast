// workers/mailer.js — transactional email
//
// One seam, one provider. Swapping Resend for anything else means changing this
// file and nothing that calls it. Plain fetch against a REST API — no SDK, so
// the zero-npm rule holds inside the Worker too.
//
// Config comes from the environment:
//   NEWSLETTER_API_KEY  secret  — provider API key (wrangler secret put)
//   MAIL_FROM           var     — "Ridge to Coast <notes@ridgetocoast.com>"
//   SITE_ORIGIN         var     — "https://ridgetocoast.com"

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

function escapeHTML(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function confirmationBody(confirmUrl, unsubUrl) {
  const safeConfirm = escapeHTML(confirmUrl);
  const safeUnsub = escapeHTML(unsubUrl);

  const text = [
    'Confirm your Ridge to Coast subscription',
    '',
    'Someone — we hope you — asked for the monthly Ridge to Coast note at this',
    'address. Confirm to start receiving it:',
    '',
    confirmUrl,
    '',
    'If that was not you, ignore this email. You will not hear from us again,',
    'and the pending record is deleted after 30 days.',
    '',
    'Unsubscribe at any time: ' + unsubUrl,
  ].join('\n');

  const html = [
    '<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#1a1a2e;',
    'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;color:#eee">',
    '<div style="max-width:520px;margin:0 auto">',
    '<h1 style="font-family:Georgia,serif;font-size:22px;font-weight:600;margin:0 0 16px">',
    'Confirm your subscription</h1>',
    '<p style="line-height:1.6;color:#aaa;margin:0 0 20px">',
    'Someone — we hope you — asked for the monthly Ridge to Coast note at this address. ',
    'Confirm and you will get the planting window for your zone, frost risk, river levels, ',
    'and what people are finding nearby.</p>',
    `<p style="margin:0 0 24px"><a href="${safeConfirm}" `,
    'style="display:inline-block;padding:12px 24px;background:#c88232;color:#14182a;',
    'text-decoration:none;border-radius:5px;font-weight:600">Confirm subscription</a></p>',
    '<p style="line-height:1.6;color:#777;font-size:13px;margin:0 0 8px">',
    'If that was not you, ignore this email — you will not hear from us again, and the ',
    'pending record is deleted after 30 days.</p>',
    `<p style="line-height:1.6;color:#777;font-size:13px;margin:0">`,
    `<a href="${safeUnsub}" style="color:#777">Unsubscribe</a></p>`,
    '</div></body></html>',
  ].join('');

  return { text, html };
}

/**
 * Send the double opt-in confirmation.
 *
 * @param {{to: string, confirmUrl: string, unsubUrl: string}} message
 * @param {object} env — Worker environment bindings
 * @returns {Promise<{sent: boolean, skipped?: string}>}
 * @throws when the provider rejects the send
 */
export async function sendConfirmation(message, env) {
  // Without a key configured (local dev, or a preview env with no secret) log
  // the link rather than failing the signup. This is what makes the whole flow
  // testable offline; it must never happen in production, where the key is set.
  if (!env || !env.NEWSLETTER_API_KEY) {
    console.log('[mailer] no NEWSLETTER_API_KEY — confirmation link:', message.confirmUrl);
    return { sent: false, skipped: 'no-api-key' };
  }

  const { text, html } = confirmationBody(message.confirmUrl, message.unsubUrl);

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.NEWSLETTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.MAIL_FROM || 'Ridge to Coast <notes@ridgetocoast.com>',
      to: [message.to],
      subject: 'Confirm your Ridge to Coast subscription',
      text,
      html,
      // One-click unsubscribe, per RFC 8058. Mailbox providers surface this as a
      // native control, which keeps complaint rates down.
      headers: {
        'List-Unsubscribe': `<${message.unsubUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Mail provider returned ${response.status}: ${detail.slice(0, 200)}`);
  }

  return { sent: true };
}

export const __test__ = { confirmationBody, escapeHTML };
