import Link from 'next/link'
import { BrandLogo } from '@/components/layout/BrandLogo'

const EFFECTIVE_DATE = '26 April 2026'
const CONTACT_EMAIL = 'plexus.science@outlook.de'

export const metadata = {
  title: 'Privacy Policy — PLEXUS',
  description: 'GDPR-compliant Privacy Policy for the PLEXUS research management platform.',
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id}>
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">{title}</h2>
      <div className="space-y-3 text-sm text-[var(--text-secondary)] leading-relaxed">
        {children}
      </div>
    </section>
  )
}

function RightsBadge({ article, title }: { article: string; title: string }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-[var(--bg-inset)] rounded-lg">
      <span className="text-xs font-mono text-[var(--text-tertiary)] whitespace-nowrap mt-0.5">{article}</span>
      <span className="text-sm text-[var(--text-secondary)]">{title}</span>
    </div>
  )
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-app)]">
      {/* Header */}
      <header className="bg-[var(--bg-surface)] border-b border-[var(--border-default)] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-12 flex items-center justify-between">
          <BrandLogo variant="standalone" href="/" />
          <div className="flex items-center gap-4 text-sm">
            <Link href="/terms" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Terms of Service</Link>
            <Link href="/contact" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Contact</Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        {/* Beta + GDPR notice */}
        <div className="mb-8 px-4 py-3 bg-[var(--status-info-bg)] border border-[var(--border-status-info)] rounded-lg">
          <p className="text-sm text-[var(--status-info-text)] font-medium">
            This Privacy Policy has been prepared in accordance with the EU General Data Protection Regulation (GDPR) (Regulation (EU) 2016/679) and the German Federal Data Protection Act (Bundesdatenschutzgesetz — BDSG). It applies to all users of the PLEXUS beta programme.
          </p>
        </div>

        {/* Title */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight" style={{ fontFamily: 'var(--font-manrope)' }}>
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-[var(--text-tertiary)]">
            Effective date: {EFFECTIVE_DATE} &nbsp;·&nbsp; Version: Beta 1.0
          </p>
        </div>

        {/* TOC */}
        <div className="mb-10 px-5 py-4 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg shadow-[var(--shadow-xs)]">
          <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-widest mb-3">Contents</p>
          <ol className="space-y-1 text-sm text-[var(--accent-blue)]">
            {[
              ['#controller', '1. Data Controller'],
              ['#what-we-collect', '2. Personal Data We Collect'],
              ['#purposes', '3. Purposes and Legal Bases for Processing'],
              ['#processors', '4. Third-Party Processors and Recipients'],
              ['#transfers', '5. International Data Transfers'],
              ['#retention', '6. Data Retention'],
              ['#rights', '7. Your Rights Under the GDPR'],
              ['#cookies', '8. Cookies and Tracking Technologies'],
              ['#children', '9. Children\'s Privacy'],
              ['#automated', '10. Automated Decision-Making'],
              ['#changes', '11. Changes to This Policy'],
              ['#contact', '12. Contact and Complaints'],
            ].map(([href, label]) => (
              <li key={href}>
                <a href={href} className="hover:underline">{label}</a>
              </li>
            ))}
          </ol>
        </div>

        <div className="space-y-10">

          {/* 1 */}
          <Section id="controller" title="1. Data Controller">
            <p>
              The data controller responsible for your personal data is:
            </p>
            <div className="px-4 py-3 bg-[var(--bg-inset)] rounded-lg">
              <p className="font-medium text-[var(--text-primary)]">Plexus Science</p>
              <p>Email: <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--accent-blue)] hover:underline">{CONTACT_EMAIL}</a></p>
              <p className="text-xs text-[var(--text-tertiary)] mt-2">
                Full legal name and registered postal address will be published prior to general availability. Beta participants may exercise their rights via the email address above.
              </p>
            </div>
            <p>
              The data controller is the entity that determines the purposes and means of processing your personal data. We process your personal data only as described in this Privacy Policy.
            </p>
          </Section>

          {/* 2 */}
          <Section id="what-we-collect" title="2. Personal Data We Collect">
            <p>We collect the following categories of personal data:</p>

            <div className="space-y-3">
              <div className="px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg shadow-[var(--shadow-xs)]">
                <p className="font-medium text-[var(--text-primary)] text-sm mb-1">Account and Registration Data</p>
                <p>Full name, email address, password (stored as a secure hash), institutional affiliation, and profile information you choose to provide (role, biography, profile photograph).</p>
              </div>
              <div className="px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg shadow-[var(--shadow-xs)]">
                <p className="font-medium text-[var(--text-primary)] text-sm mb-1">Research and Platform Content</p>
                <p>Research projects, protocols, ethics submissions, datasets, documents, analyses, and other content you create or upload through the Service. This may include personal data of research participants where you include such data in your datasets — you are the data controller for participant data, and we act as your data processor.</p>
              </div>
              <div className="px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg shadow-[var(--shadow-xs)]">
                <p className="font-medium text-[var(--text-primary)] text-sm mb-1">Usage and Technical Data</p>
                <p>IP address, browser type and version, operating system, pages visited, time and duration of visits, referring URL, and device identifiers. This data is collected automatically to operate and improve the Service.</p>
              </div>
              <div className="px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg shadow-[var(--shadow-xs)]">
                <p className="font-medium text-[var(--text-primary)] text-sm mb-1">Communications</p>
                <p>Emails, support requests, and feedback you send to us, including any personal data contained therein.</p>
              </div>
            </div>

            <p>
              We do not intentionally collect special categories of personal data (Article 9 GDPR) such as health data, biometric data, racial or ethnic origin, or political opinions unless they form part of research data you explicitly upload for scientific research purposes, in which case the lawful basis is Article 9(2)(j) GDPR (scientific research).
            </p>
          </Section>

          {/* 3 */}
          <Section id="purposes" title="3. Purposes and Legal Bases for Processing">
            <p>We process your personal data for the following purposes, each with a corresponding legal basis under Article 6 GDPR:</p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-default)]">
                    <th className="text-left py-2 pr-4 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">Purpose</th>
                    <th className="text-left py-2 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">Legal Basis (Art. 6 GDPR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-row)]">
                  {[
                    ['Providing the Service, account management, and authentication', 'Art. 6(1)(b) — performance of a contract'],
                    ['Sending transactional emails (account confirmation, password reset, collaboration invitations)', 'Art. 6(1)(b) — performance of a contract'],
                    ['Processing beta feedback and improving the Service', 'Art. 6(1)(f) — legitimate interests (improving the platform for users)'],
                    ['Security monitoring, fraud prevention, and abuse detection', 'Art. 6(1)(f) — legitimate interests (protecting users and the platform)'],
                    ['Compliance with legal obligations (e.g., responding to lawful requests from authorities)', 'Art. 6(1)(c) — legal obligation'],
                    ['Sending beta programme updates and product communications', 'Art. 6(1)(a) — consent (you may withdraw at any time)'],
                    ['AI-assisted features (analysis suggestions, document assistance)', 'Art. 6(1)(b) — performance of a contract'],
                  ].map(([purpose, basis], i) => (
                    <tr key={i}>
                      <td className="py-2.5 pr-4 text-[var(--text-secondary)] align-top">{purpose}</td>
                      <td className="py-2.5 text-[var(--text-secondary)] align-top font-mono text-xs">{basis}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p>
              Where we rely on legitimate interests (Article 6(1)(f)), we have conducted a balancing test and concluded that our interests do not override your fundamental rights and freedoms. You may object to processing based on legitimate interests at any time (see Section 7).
            </p>
          </Section>

          {/* 4 */}
          <Section id="processors" title="4. Third-Party Processors and Recipients">
            <p>
              We engage the following third-party data processors to operate the Service. Each processor is bound by a Data Processing Agreement and required to process your data only on our documented instructions:
            </p>

            <div className="space-y-3">
              {[
                {
                  name: 'Supabase Inc.',
                  role: 'Database infrastructure, authentication, and real-time data services',
                  location: 'United States (EU-region data residency available)',
                  safeguard: 'Standard Contractual Clauses (SCCs) under Article 46 GDPR',
                },
                {
                  name: 'Anthropic PBC',
                  role: 'AI-assisted features (analysis suggestions, document assistance, natural language processing)',
                  location: 'United States',
                  safeguard: 'Standard Contractual Clauses (SCCs) under Article 46 GDPR',
                },
                {
                  name: 'Vercel Inc.',
                  role: 'Web application hosting and content delivery',
                  location: 'United States (EU-region edge infrastructure)',
                  safeguard: 'Standard Contractual Clauses (SCCs) under Article 46 GDPR',
                },
              ].map((p) => (
                <div key={p.name} className="px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg shadow-[var(--shadow-xs)]">
                  <p className="font-medium text-[var(--text-primary)] text-sm">{p.name}</p>
                  <p className="text-[var(--text-secondary)] text-xs mt-1">{p.role}</p>
                  <div className="flex flex-wrap gap-x-4 mt-2 text-xs text-[var(--text-tertiary)]">
                    <span>Location: {p.location}</span>
                    <span>Safeguard: {p.safeguard}</span>
                  </div>
                </div>
              ))}
            </div>

            <p>
              We do not sell your personal data to third parties. We do not share your data with advertisers or data brokers. We may disclose personal data to competent authorities where required by applicable law.
            </p>
          </Section>

          {/* 5 */}
          <Section id="transfers" title="5. International Data Transfers">
            <p>
              Some of our third-party processors are based in the United States. When we transfer personal data outside the European Economic Area (EEA), we ensure an adequate level of protection through one or more of the following mechanisms:
            </p>
            <ul className="space-y-2 list-none pl-0">
              {[
                'Standard Contractual Clauses (SCCs) adopted by the European Commission pursuant to Article 46(2)(c) GDPR.',
                'Adequacy decisions by the European Commission where applicable.',
                'Supplementary technical measures (encryption at rest and in transit) where required by a transfer impact assessment.',
              ].map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-[var(--text-tertiary)] mt-0.5 flex-shrink-0">·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p>
              You may request a copy of the applicable transfer safeguards by contacting us at <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--accent-blue)] hover:underline">{CONTACT_EMAIL}</a>.
            </p>
          </Section>

          {/* 6 */}
          <Section id="retention" title="6. Data Retention">
            <p>
              We retain personal data only for as long as necessary for the purposes set out in this Privacy Policy, or as required by applicable law. Our standard retention periods are:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-default)]">
                    <th className="text-left py-2 pr-4 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">Data Category</th>
                    <th className="text-left py-2 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">Retention Period</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-row)]">
                  {[
                    ['Account data (name, email, profile)', 'Duration of account + 30 days after deletion request'],
                    ['Research projects and datasets', 'Duration of account + 90 days after deletion (to allow data export)'],
                    ['Audit logs and activity records', '12 months from creation'],
                    ['Support communications', '3 years from last interaction'],
                    ['Technical/usage logs (server logs, IP addresses)', '90 days'],
                    ['Beta feedback', 'Until end of beta programme + 12 months'],
                  ].map(([cat, period], i) => (
                    <tr key={i}>
                      <td className="py-2.5 pr-4 text-[var(--text-secondary)] align-top">{cat}</td>
                      <td className="py-2.5 text-[var(--text-secondary)] align-top">{period}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Upon account deletion, we will anonymise or delete your personal data within the periods above, unless longer retention is required by law (e.g., tax records). Research data you have published to the public registry may be retained in anonymised form to preserve the integrity of public scientific records.
            </p>
          </Section>

          {/* 7 */}
          <Section id="rights" title="7. Your Rights Under the GDPR">
            <p>
              As a data subject in the European Union, you have the following rights. You may exercise any of these rights by contacting us at <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--accent-blue)] hover:underline">{CONTACT_EMAIL}</a>. We will respond within one calendar month, as required by Article 12 GDPR.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <RightsBadge article="Art. 15" title="Right of access — obtain a copy of your personal data and information about how it is processed." />
              <RightsBadge article="Art. 16" title="Right to rectification — have inaccurate personal data corrected or incomplete data completed." />
              <RightsBadge article="Art. 17" title="Right to erasure ('right to be forgotten') — request deletion of your personal data in certain circumstances." />
              <RightsBadge article="Art. 18" title="Right to restriction of processing — request that we limit processing of your data in certain circumstances." />
              <RightsBadge article="Art. 20" title="Right to data portability — receive your personal data in a structured, machine-readable format." />
              <RightsBadge article="Art. 21" title="Right to object — object to processing based on legitimate interests or for direct marketing purposes." />
              <RightsBadge article="Art. 7(3)" title="Right to withdraw consent — withdraw any consent you have given at any time, without affecting the lawfulness of prior processing." />
              <RightsBadge article="Art. 77" title="Right to lodge a complaint with a supervisory authority (see below)." />
            </div>
            <p>
              We will not charge a fee for exercising your rights unless a request is manifestly unfounded or excessive. We may ask you to verify your identity before fulfilling a request.
            </p>
          </Section>

          {/* 8 */}
          <Section id="cookies" title="8. Cookies and Tracking Technologies">
            <p>
              PLEXUS uses only technically necessary cookies and browser storage mechanisms required to operate the Service:
            </p>
            <div className="space-y-2">
              {[
                { name: 'supabase-auth-token', purpose: 'Stores your authenticated session. Required for login to function.', type: 'Session / Persistent', expires: 'Session / 7 days' },
                { name: 'sb-* (Supabase cookies)', purpose: 'Supabase authentication and realtime connection state.', type: 'Session', expires: 'Session' },
              ].map((c) => (
                <div key={c.name} className="px-4 py-3 bg-[var(--bg-inset)] rounded-lg">
                  <p className="font-mono text-xs font-medium text-[var(--text-primary)]">{c.name}</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">{c.purpose}</p>
                  <div className="flex gap-4 mt-1 text-xs text-[var(--text-tertiary)]">
                    <span>{c.type}</span>
                    <span>Expires: {c.expires}</span>
                  </div>
                </div>
              ))}
            </div>
            <p>
              We do not use analytics cookies, advertising cookies, or any tracking technologies beyond what is strictly necessary to provide the Service. We do not use Google Analytics or similar third-party analytics services.
            </p>
          </Section>

          {/* 9 */}
          <Section id="children" title="9. Children's Privacy">
            <p>
              The Service is not directed to persons under the age of 16. We do not knowingly collect personal data from children under 16. If you are a parent or guardian and believe your child has provided us with personal data, please contact us at <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--accent-blue)] hover:underline">{CONTACT_EMAIL}</a> and we will delete it promptly.
            </p>
          </Section>

          {/* 10 */}
          <Section id="automated" title="10. Automated Decision-Making">
            <p>
              We do not make decisions based solely on automated processing, including profiling, that produce legal or similarly significant effects on you within the meaning of Article 22 GDPR.
            </p>
            <p>
              AI-assisted features (such as analysis recommendations or document suggestions) are advisory only. All significant decisions about your research remain with you.
            </p>
          </Section>

          {/* 11 */}
          <Section id="changes" title="11. Changes to This Policy">
            <p>
              We may update this Privacy Policy periodically to reflect changes in our practices or applicable law. We will notify you of material changes by email and by prominent notice within the platform at least 14 days before the changes take effect. The &ldquo;effective date&rdquo; at the top of this page will always reflect the date of the most recent version.
            </p>
          </Section>

          {/* 12 */}
          <Section id="contact" title="12. Contact and Complaints">
            <p>
              For all privacy-related enquiries, requests to exercise your rights, or complaints, contact us at:
            </p>
            <div className="px-4 py-3 bg-[var(--bg-inset)] rounded-lg">
              <p className="font-medium text-[var(--text-primary)]">Plexus Science — Data Protection</p>
              <p>Email: <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--accent-blue)] hover:underline">{CONTACT_EMAIL}</a></p>
              <p className="text-xs text-[var(--text-tertiary)] mt-2">We aim to respond within one calendar month as required by Article 12 GDPR.</p>
            </div>
            <p>
              <strong>Supervisory Authority:</strong> You have the right to lodge a complaint with the competent data protection supervisory authority at any time. The supervisory authorities in Germany are the state data protection commissioners (Landesdatenschutzbeauftragte) for each federal state (Bundesland), and the federal supervisory authority:
            </p>
            <div className="px-4 py-3 bg-[var(--bg-inset)] rounded-lg">
              <p className="font-medium text-[var(--text-primary)] text-sm">Federal Commissioner for Data Protection and Freedom of Information (BfDI)</p>
              <p className="text-sm text-[var(--text-secondary)]">Bundesbeauftragte für den Datenschutz und die Informationsfreiheit</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-1">Website: bfdi.bund.de &nbsp;·&nbsp; Postal: Graurheindorfer Str. 153, 53117 Bonn, Germany</p>
            </div>
            <p>
              You may also contact the supervisory authority of your place of residence or workplace within Germany. A list of all German state supervisory authorities is available at <span className="text-[var(--text-tertiary)]">gdd.de</span>.
            </p>
          </Section>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-[var(--border-default)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-xs text-[var(--text-tertiary)]">
            © {new Date().getFullYear()} Plexus Science · GDPR-compliant · Effective {EFFECTIVE_DATE}
          </p>
          <div className="flex items-center gap-4 text-xs">
            <Link href="/terms" className="text-[var(--text-tertiary)] hover:text-[var(--accent-blue)] transition-colors">Terms of Service</Link>
            <Link href="/contact" className="text-[var(--text-tertiary)] hover:text-[var(--accent-blue)] transition-colors">Contact Support</Link>
            <Link href="/login" className="text-[var(--text-tertiary)] hover:text-[var(--accent-blue)] transition-colors">Sign In</Link>
          </div>
        </div>
      </main>
    </div>
  )
}
