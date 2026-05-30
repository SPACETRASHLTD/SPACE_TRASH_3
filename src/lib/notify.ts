import twilio from 'twilio';
import { Resend } from 'resend';
import type { Lead } from './lead';
import { leadSummary } from './lead';

function recipients(envVar?: string): string[] {
  return (envVar || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// Fire SMS to every founder via Twilio. Resolves to per-message results; never throws.
async function sendSms(lead: Lead): Promise<{ ok: boolean; detail: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  const to = recipients(process.env.FOUNDER_PHONES);

  if (!sid || !token || !from || to.length === 0) {
    return { ok: false, detail: 'Twilio not configured' };
  }

  const client = twilio(sid, token);
  const body = `New house-party lead\n${leadSummary(lead)}`;

  const results = await Promise.allSettled(
    to.map((number) => client.messages.create({ from, to: number, body }))
  );
  const failed = results.filter((r) => r.status === 'rejected');
  return {
    ok: failed.length === 0,
    detail: `sms ${results.length - failed.length}/${results.length} sent`,
  };
}

// Fire email to every founder via Resend, with the full transcript. Never throws.
async function sendEmail(
  lead: Lead,
  transcript: string
): Promise<{ ok: boolean; detail: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const to = recipients(process.env.FOUNDER_EMAILS);

  if (!apiKey || !from || to.length === 0) {
    return { ok: false, detail: 'Resend not configured' };
  }

  const resend = new Resend(apiKey);

  const rows: Array<[string, string | null | undefined]> = [
    ['Name', lead.name],
    ['Email', lead.email],
    ['Phone', lead.phone],
    ['Event type', lead.event_type],
    ['Date', lead.event_date],
    ['Neighborhood', lead.neighborhood],
    ['Guests', lead.guest_count],
    ['Vibe', lead.vibe],
    ['Budget', lead.budget_range],
  ];

  const tableRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#6B655C;">${label}</td><td style="padding:4px 0;color:#1A1A1A;font-weight:600;">${
          value || '—'
        }</td></tr>`
    )
    .join('');

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;color:#1A1A1A;max-width:560px;">
      <h2 style="font-family:Georgia,serif;color:#B8893A;">New house-party lead</h2>
      <table style="border-collapse:collapse;font-size:15px;">${tableRows}</table>
      <h3 style="margin-top:24px;">Full transcript</h3>
      <pre style="white-space:pre-wrap;background:#FAF7F2;padding:16px;border-radius:8px;font-family:ui-monospace,monospace;font-size:13px;">${escapeHtml(
        transcript
      )}</pre>
    </div>`;

  const { error } = await resend.emails.send({
    from,
    to,
    subject: `New lead: ${leadSummary(lead)}`,
    html,
    text: `New house-party lead\n\n${rows
      .map(([l, v]) => `${l}: ${v || '—'}`)
      .join('\n')}\n\n--- Transcript ---\n${transcript}`,
  });

  return { ok: !error, detail: error ? `email error: ${error.message}` : 'email sent' };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Fire both notifications in parallel. Returns a status object; never throws so
// a notification failure can't lose a lead that's already saved.
export async function notifyFounders(
  lead: Lead,
  transcript: string
): Promise<{ sms: { ok: boolean; detail: string }; email: { ok: boolean; detail: string } }> {
  const [sms, email] = await Promise.all([
    sendSms(lead).catch((e) => ({ ok: false, detail: `sms threw: ${String(e)}` })),
    sendEmail(lead, transcript).catch((e) => ({
      ok: false,
      detail: `email threw: ${String(e)}`,
    })),
  ]);
  return { sms, email };
}
