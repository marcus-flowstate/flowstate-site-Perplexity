# Contact Form Setup — Cloudflare Pages + Resend

This site's "Request a Demo" form is wired to send email via **Resend** through a Cloudflare Pages Function. It runs only in production on Cloudflare; locally (`npm run dev`) the existing Express route in `server/routes.ts` still handles it.

**Files added:**

- `functions/api/demo-requests.ts` — the Pages Function (auto-routes `/api/demo-requests`)
- Honeypot field in `client/src/pages/home.tsx` (hidden `website` input)

**Cost:** $0/month on Resend's free tier (3,000 emails/month, 100/day) and $0 on Cloudflare Pages.

---

## One-Time Setup

You'll do this once. ~15 minutes including DNS propagation.

### 1. Sign up for Resend

1. Go to [resend.com](https://resend.com) and create an account with `marcus@flowstateanalytics.com`.
2. Free tier is enough — no credit card needed.

### 2. Verify your sending domain

The form emails are sent **from** `demo@flowstateanalytics.com`, so Resend needs to confirm you own that domain.

1. In Resend, go to **Domains** → **Add Domain**.
2. Enter `flowstateanalytics.com`.
3. Resend shows you 3 DNS records to add (SPF, DKIM, return-path). Keep that page open.

### 3. Add the DNS records in Cloudflare

Since your domain is already on Cloudflare:

1. Open Cloudflare dashboard → select `flowstateanalytics.com` → **DNS** → **Records**.
2. For each of the 3 records Resend showed you:
   - Click **Add record**
   - Type: `TXT` (or `MX` / `CNAME` — match exactly what Resend says)
   - Name: copy from Resend (e.g. `resend._domainkey`)
   - Value/Content: copy from Resend
   - **Proxy status: DNS only** (gray cloud, not orange). Email routing must be unproxied.
   - Save
3. Back in Resend, click **Verify**. It usually takes 1–5 minutes; sometimes up to 15.

### 4. Generate an API key

1. In Resend → **API Keys** → **Create API Key**.
2. Name: `flowstate-site-prod`
3. Permission: **Sending access** → restrict to the verified domain.
4. **Copy the key** (starts with `re_…`). You won't see it again.

### 5. Add the key to Cloudflare Pages

1. Cloudflare dashboard → **Workers & Pages** → your `flowstate-site` project.
2. **Settings** → **Environment variables** → **Production** tab.
3. Click **Add variable**:
   - Variable name: `RESEND_API_KEY`
   - Value: paste your `re_…` key
   - **Click "Encrypt"** so it's not visible after saving
4. Save.

> Optional overrides (only set if you want to change defaults):
> - `CONTACT_TO` — recipient email (default: `marcus@flowstateanalytics.com`)
> - `CONTACT_FROM` — sender (default: `FlowState <demo@flowstateanalytics.com>`). Must be on a Resend-verified domain.

### 6. Redeploy

The env var only takes effect on a new deployment.

- Easiest: push any commit (e.g. this README) to `main`. Cloudflare auto-builds and deploys ~2 min.
- Or: in Cloudflare Pages → **Deployments** → click the latest one → **Retry deployment**.

---

## Testing

Once `flowstate-site-3bj.pages.dev` (or your custom domain) is redeployed:

1. Open the live site, scroll to "Request a Demo".
2. Fill in real values and submit.
3. You should see the green "Thanks — we'll be in touch" confirmation.
4. Check `marcus@flowstateanalytics.com` — the email arrives within ~10 seconds with subject `Demo request — <name> @ <company>`.
5. Reply-To is set to the submitter's email, so hitting Reply goes straight to them.

**If it fails:**

- Form shows red error toast → check Cloudflare Pages → **Functions** → **Real-time logs** while submitting. The error message there will say what's wrong (usually domain not verified, or wrong env var name).
- Most common: `RESEND_API_KEY` typed incorrectly, or you set it on the **Preview** tab instead of **Production**.

---

## How it works (for reference)

- The React form posts JSON to `/api/demo-requests` (unchanged from before).
- Cloudflare Pages sees a file at `functions/api/demo-requests.ts` and automatically routes that path to it — no config needed.
- The function validates the body (same rules as the old Express handler), checks the honeypot, calls Resend's REST API, and returns `{ ok: true, id: ... }`.
- The frontend's existing `useMutation` handler shows the success toast on a 200 response — no frontend logic changes were needed.

The old Express route (`server/routes.ts`) is left intact so `npm run dev` and the SQLite-based local storage still work for local development.

---

## Spam protection

A honeypot field named `website` is hidden off-screen in the form. Real users never see or fill it; bots usually do. When it's non-empty, the function returns success without sending — bots think they succeeded but you get nothing.

If spam still gets through later, easy upgrades:

- Add Cloudflare Turnstile (free, invisible CAPTCHA) — ~30 lines of code
- Add a minimum-time check (reject submissions < 2 seconds after page load)
