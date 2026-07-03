import type { Metadata } from "next";
import { notFound } from "next/navigation";

// ⚠️ DRAFT templates for structure only — counsel must review and replace
// before launch (docs/08 §1 legal gate). The banner below stays until then.
const DOCS: Record<string, { title: string; sections: Array<[string, string]> }> = {
  privacy: {
    title: "Privacy Policy",
    sections: [
      ["Who we are", "Calm Point provides telehealth services connecting patients with licensed providers. This policy describes how we collect, use, and protect your information."],
      ["Health information", "Health information you share is protected under HIPAA and our Notice of Privacy Practices. We never sell your data, and we never use your health information for advertising."],
      ["Tracking", "Our questionnaire, portal, and app are free of third-party advertising trackers. Marketing pages may use privacy-reviewed analytics with your consent."],
      ["Your rights", "You may request access to, correction of, or (where legally permitted) deletion of your information at any time by contacting privacy@calmpoint.example."],
    ],
  },
  terms: {
    title: "Terms of Service",
    sections: [
      ["Services", "Calm Point is a technology platform supporting telehealth care delivered by independent licensed providers. Calm Point does not itself practice medicine."],
      ["Not for emergencies", "The service is not for medical emergencies. If you are in crisis, call or text 988, or call 911."],
      ["Eligibility", "You must be 18 or older and located in a state where our providers are licensed at the time of your visit."],
      ["Payments", "Fees are disclosed before purchase and processed by Stripe. Cancellation windows apply to appointments as described at booking."],
    ],
  },
  "telehealth-consent": {
    title: "Telehealth Informed Consent",
    sections: [
      ["What telehealth is", "Care delivered by video, phone, or messaging rather than in person. Your provider will determine whether telehealth is appropriate for your needs."],
      ["Benefits and risks", "Benefits include access and convenience. Risks include technology failures and, in rare cases, the need to redirect you to in-person care."],
      ["Your choices", "You may decline or stop telehealth services at any time; your provider will help you find in-person alternatives."],
      ["Recording & AI assistance", "Visits are never recorded or transcribed without your explicit consent captured at the start of each visit."],
    ],
  },
  "hipaa-npp": {
    title: "Notice of Privacy Practices",
    sections: [
      ["Our duties", "We are required by law to maintain the privacy and security of your protected health information and to notify you of a breach."],
      ["How we may use PHI", "Treatment, payment, and health care operations — with other uses requiring your written authorization."],
      ["Your rights", "Access, amendment, an accounting of disclosures, restriction requests, and confidential communications. Complaints may be filed with us or with HHS without retaliation."],
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(DOCS).map((doc) => ({ doc }));
}
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ doc: string }>;
}): Promise<Metadata> {
  const { doc } = await params;
  return { title: DOCS[doc]?.title ?? "Legal" };
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ doc: string }>;
}) {
  const { doc } = await params;
  const content = DOCS[doc];
  if (!content) notFound();

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="mb-8 rounded-md bg-warn/10 p-4 text-sm text-warn">
        DRAFT — pending legal review. This template establishes structure and
        must be replaced by counsel-approved language before launch.
      </div>
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">{content.title}</h1>
      <p className="mb-10 text-sm text-ink-soft">Last updated: July 2026 (draft)</p>
      <div className="flex flex-col gap-8">
        {content.sections.map(([heading, body]) => (
          <section key={heading}>
            <h2 className="mb-2 text-xl font-semibold tracking-tight">{heading}</h2>
            <p className="leading-relaxed text-ink-soft">{body}</p>
          </section>
        ))}
      </div>
      <p className="mt-12">
        <a href="/" className="text-brand underline">← Back to Calm Point</a>
      </p>
    </main>
  );
}
