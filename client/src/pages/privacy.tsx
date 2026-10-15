import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import LogoWhiteSvgUrl from "@assets/Logo-White-Text.svg";

const EFFECTIVE_DATE = "October 15, 2026";
const CONTACT_EMAIL = "marcus@flowstateanalytics.com";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="text-xl font-semibold text-white tracking-tight">{title}</h2>
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-white/70">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc pl-5 space-y-2 marker:text-white/30">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

const mail = (
  <a href={`mailto:${CONTACT_EMAIL}`} className="text-white underline underline-offset-4 decoration-white/30 hover:decoration-white">
    {CONTACT_EMAIL}
  </a>
);

export default function Privacy() {
  useEffect(() => {
    document.title = "Privacy Policy | FlowState Analytics";
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-[hsl(220_38%_8%)] text-white selection:bg-[hsl(192_53%_50%/0.3)]">
      <header className="border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
          <a href="#/" className="flex items-center" aria-label="FlowState Analytics home" data-testid="privacy-link-home">
            <img src={LogoWhiteSvgUrl} alt="FlowState Analytics" className="h-9 w-auto" />
          </a>
          <a href="#/" className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white" data-testid="privacy-link-back">
            <ArrowLeft className="h-4 w-4" />
            Back to site
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 lg:px-8 py-16 lg:py-24">
        <h1 className="text-4xl lg:text-5xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="mt-4 text-sm text-white/40">Effective {EFFECTIVE_DATE}</p>

        <div className="mt-10 space-y-4 text-[15px] leading-relaxed text-white/70">
          <p>
            FlowState Analytics Inc. ("FlowState," "we," or "us") operates flowstateanalytics.com. This policy
            explains what personal information we collect through this website, how we use it, and the choices
            you have.
          </p>
          <p>
            This policy covers this website only. Data that the FlowState platform processes for our customers
            is governed by our agreements with those customers.
          </p>
        </div>

        <Section title="Information we collect">
          <Bullets
            items={[
              <>
                <span className="text-white">Demo requests.</span> When you request a demo, we collect your first and
                last name, work email, and company. You may also give us your phone number, job title, and a message
                about your production line.
              </>,
              <>
                <span className="text-white">Emails you send us.</span> Your email address and whatever you choose to
                include.
              </>,
              <>
                <span className="text-white">Technical data.</span> When you visit the site, our hosting and font
                providers receive the standard information your browser sends, such as your IP address, browser type,
                and the page requested. They use it to deliver the site and protect it from abuse.
              </>,
            ]}
          />
          <p>This website does not use analytics, advertising, or tracking cookies, pixels, or similar technologies.</p>
        </Section>

        <Section title="How we use it">
          <Bullets
            items={[
              "To respond to your request and schedule a demo",
              "To communicate with you about FlowState",
              "To keep this website secure and working",
            ]}
          />
          <p>We do not sell personal information, and we do not share it for targeted advertising.</p>
        </Section>

        <Section title="Who we share it with">
          <p>We share personal information only with service providers that help us run this website and our business, and only for those purposes:</p>
          <Bullets
            items={[
              "Formspree, which receives demo request submissions and delivers them to us by email",
              "Cloudflare, which hosts this website",
              "Google Workspace, which hosts our email",
              "Fontshare, which serves this website's fonts",
            ]}
          />
          <p>
            We may also disclose information when the law requires it, or to a buyer or successor if FlowState is
            involved in a merger, acquisition, or sale of assets.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            We keep personal information for as long as we need it to respond to you and maintain our business
            relationship, or as the law requires. You can ask us to delete it at any time.
          </p>
        </Section>

        <Section title="Your choices">
          <p>
            To see, correct, or delete the personal information we hold about you, email {mail}. We will respond
            within 45 days. To stop hearing from us, reply to any of our emails and tell us.
          </p>
        </Section>

        <Section title="Do Not Track">
          <p>
            We do not track visitors over time or across other websites, so this site does not respond differently
            to Do Not Track signals. We do not allow third parties to use this site to collect information about
            your activity across other websites.
          </p>
        </Section>

        <Section title="Security">
          <p>
            We use reasonable administrative, technical, and physical safeguards to protect personal information.
            No method of transmission or storage is completely secure.
          </p>
        </Section>

        <Section title="Children">
          <p>This website is not directed to children, and we do not knowingly collect personal information from children under 16.</p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            If we change this policy, we will post the updated version on this page and change the effective date
            at the top.
          </p>
        </Section>

        <Section title="Contact us">
          <p>
            FlowState Analytics Inc.
            <br />
            14074 Trade Center Drive, Suite 124
            <br />
            Fishers, IN 46038
            <br />
            {mail}
          </p>
        </Section>
      </main>

      <footer className="border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8 text-xs text-white/40">
          © {new Date().getFullYear()} FlowState Analytics Inc. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
