// Cloudflare Pages Function — handles POST /api/demo-requests in production.
// In local dev (npm run dev), Express in server/routes.ts handles this route instead.
//
// Required environment variables (set in Cloudflare Pages → Settings → Environment variables):
//   RESEND_API_KEY  — API key from https://resend.com (encrypted)
//
// Optional:
//   CONTACT_TO     — recipient email (default: marcus@flowstateanalytics.com)
//   CONTACT_FROM   — sender email (default: FlowState <demo@flowstateanalytics.com>)
//                    Must be on a domain you've verified in Resend.

interface Env {
  RESEND_API_KEY: string;
  CONTACT_TO?: string;
  CONTACT_FROM?: string;
}

type DemoBody = {
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  phone?: unknown;
  company?: unknown;
  jobTitle?: unknown;
  message?: unknown;
  // honeypot — should always be empty if a real human submits
  website?: unknown;
};

type Validated = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  jobTitle: string;
  message: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// Lightweight email regex — same shape Zod uses for z.string().email()
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function validate(body: DemoBody): { ok: true; data: Validated } | { ok: false; error: string } {
  const firstName = asString(body.firstName);
  const lastName = asString(body.lastName);
  const email = asString(body.email);
  const phone = asString(body.phone);
  const company = asString(body.company);
  const jobTitle = asString(body.jobTitle);
  const message = asString(body.message);

  if (!firstName || firstName.length > 80) return { ok: false, error: "First name is required (max 80 chars)" };
  if (!lastName || lastName.length > 80) return { ok: false, error: "Last name is required (max 80 chars)" };
  if (!email || !EMAIL_RE.test(email)) return { ok: false, error: "Please enter a valid email" };
  if (phone.length > 40) return { ok: false, error: "Phone is too long (max 40 chars)" };
  if (!company || company.length > 120) return { ok: false, error: "Company is required (max 120 chars)" };
  if (jobTitle.length > 120) return { ok: false, error: "Job title is too long (max 120 chars)" };
  if (message.length > 2000) return { ok: false, error: "Message is too long (max 2000 chars)" };

  return {
    ok: true,
    data: { firstName, lastName, email, phone, company, jobTitle, message },
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildEmail(d: Validated) {
  const text = [
    `New demo request from the FlowState site`,
    ``,
    `Name:    ${d.firstName} ${d.lastName}`,
    `Email:   ${d.email}`,
    `Phone:   ${d.phone || "—"}`,
    `Company: ${d.company}`,
    `Title:   ${d.jobTitle || "—"}`,
    ``,
    `Message:`,
    d.message || "(none)",
  ].join("\n");

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;color:#1a1a1a">
      <h2 style="margin:0 0 16px;font-size:18px;color:#3A88B6">New demo request</h2>
      <table style="border-collapse:collapse;font-size:14px;line-height:1.6">
        <tr><td style="padding:4px 12px 4px 0;color:#666">Name</td><td>${escapeHtml(d.firstName)} ${escapeHtml(d.lastName)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Email</td><td><a href="mailto:${escapeHtml(d.email)}">${escapeHtml(d.email)}</a></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Phone</td><td>${escapeHtml(d.phone) || "—"}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Company</td><td>${escapeHtml(d.company)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Title</td><td>${escapeHtml(d.jobTitle) || "—"}</td></tr>
      </table>
      ${d.message ? `<div style="margin-top:16px;padding:12px;background:#f5f7fa;border-left:3px solid #3A88B6;font-size:14px;line-height:1.5;white-space:pre-wrap">${escapeHtml(d.message)}</div>` : ""}
    </div>
  `;

  return { text, html };
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  let body: DemoBody;
  try {
    body = (await request.json()) as DemoBody;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  // Honeypot — if a bot fills the hidden `website` field, silently accept
  // (return success so the bot thinks it worked) but don't actually send.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return json({ ok: true, id: 0 });
  }

  const result = validate(body);
  if (!result.ok) return json({ ok: false, error: result.error }, 400);
  const data = result.data;

  if (!env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY not configured");
    return json(
      { ok: false, error: "Email service is not configured. Please email marcus@flowstateanalytics.com directly." },
      500,
    );
  }

  const to = env.CONTACT_TO || "marcus@flowstateanalytics.com";
  const from = env.CONTACT_FROM || "FlowState <demo@flowstateanalytics.com>";
  const { text, html } = buildEmail(data);

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: data.email,
        subject: `Demo request — ${data.firstName} ${data.lastName} @ ${data.company}`,
        text,
        html,
      }),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error("Resend API error", resp.status, errBody);
      return json(
        { ok: false, error: "Could not send email. Please try again or email marcus@flowstateanalytics.com directly." },
        502,
      );
    }

    const result = (await resp.json()) as { id?: string };
    return json({ ok: true, id: result.id ?? "sent" });
  } catch (err) {
    console.error("Resend fetch failed", err);
    return json(
      { ok: false, error: "Network error sending email. Please try again or email marcus@flowstateanalytics.com directly." },
      502,
    );
  }
};

// Reject other methods cleanly
export const onRequest: PagesFunction<Env> = async ({ request }) => {
  if (request.method === "POST") {
    // shouldn't reach here — onRequestPost takes priority — but be safe
    return json({ ok: false, error: "Use POST" }, 405);
  }
  return json({ ok: false, error: `Method ${request.method} not allowed` }, 405);
};
