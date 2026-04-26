import Link from 'next/link'
import { BrandLogo } from '@/components/layout/BrandLogo'

const EFFECTIVE_DATE = '26 April 2026'
const CONTACT_EMAIL = 'plexus.science@outlook.de'

export const metadata = {
  title: 'Terms of Service — PLEXUS Beta',
  description: 'Terms of Service for the PLEXUS research management platform beta programme.',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-app)]">
      {/* Header */}
      <header className="bg-[var(--bg-surface)] border-b border-[var(--border-default)] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-12 flex items-center justify-between">
          <BrandLogo variant="standalone" href="/" />
          <div className="flex items-center gap-4 text-sm">
            <Link href="/privacy" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Privacy Policy</Link>
            <Link href="/contact" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Contact</Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        {/* Beta notice */}
        <div className="mb-8 px-4 py-3 bg-[var(--status-warning-bg)] border border-[var(--border-status-warning)] rounded-lg">
          <p className="text-sm text-[var(--status-warning-text)] font-medium">
            Beta Programme Notice — This platform is currently in closed beta. These terms govern your access to and use of the beta version of PLEXUS.
          </p>
        </div>

        {/* Title */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight" style={{ fontFamily: 'var(--font-manrope)' }}>
            Terms of Service
          </h1>
          <p className="mt-2 text-sm text-[var(--text-tertiary)]">
            Effective date: {EFFECTIVE_DATE} &nbsp;·&nbsp; Version: Beta 1.0
          </p>
        </div>

        <div className="space-y-10 text-[var(--text-secondary)] text-sm leading-relaxed">

          {/* 1 */}
          <section>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">1. Parties and Scope</h2>
            <p>
              These Terms of Service (&ldquo;Terms&rdquo;) constitute a legally binding agreement between you (&ldquo;User&rdquo;, &ldquo;you&rdquo;) and Plexus Science (&ldquo;PLEXUS&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;), the operator of the PLEXUS research management platform accessible at <strong>plexus.science</strong> and related subdomains (the &ldquo;Service&rdquo;).
            </p>
            <p className="mt-3">
              By creating an account, clicking &ldquo;I accept&rdquo;, or otherwise accessing or using the Service, you agree to be bound by these Terms and our <Link href="/privacy" className="text-[var(--accent-blue)] hover:underline">Privacy Policy</Link>. If you do not agree, do not use the Service.
            </p>
            <p className="mt-3">
              These Terms apply to all users of the Service, including researchers, students, supervisors, and institutional representatives.
            </p>
            <div className="mt-4 px-4 py-3 bg-[var(--bg-inset)] rounded-lg">
              <p className="text-xs text-[var(--text-secondary)]">
                <strong>Note:</strong> The operator&apos;s full legal name and registered postal address will be added prior to general availability. For beta participants, the contact address is: <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--accent-blue)] hover:underline">{CONTACT_EMAIL}</a>.
              </p>
            </div>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">2. Beta Programme</h2>
            <p>
              The Service is currently offered as a <strong>closed beta</strong>. Access is granted by invitation only and may be revoked at any time at our sole discretion. The beta programme is provided free of charge.
            </p>
            <ul className="mt-3 space-y-2 list-none pl-0">
              {[
                'The Service is provided "as is" and "as available" during the beta period. We make no representations or warranties of any kind, express or implied, regarding the availability, reliability, accuracy, or completeness of the Service.',
                'Beta software is by nature incomplete and may contain bugs, errors, or instabilities. You acknowledge this risk and agree to use the Service accordingly.',
                'We reserve the right to alter, suspend, or discontinue any feature of the Service — including data storage, export functionality, or access — at any time during the beta period, with or without notice.',
                'Data you enter during the beta period may be subject to loss, corruption, or deletion as a result of platform testing and development. You are responsible for maintaining independent backups of any critical research data.',
                'Participation in the beta programme may include receiving occasional requests for feedback. Feedback you provide may be used to improve the Service without compensation or attribution.',
              ].map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-[var(--text-tertiary)] mt-0.5 flex-shrink-0">·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">3. Account Registration</h2>
            <p>
              To access the Service, you must register an account using a valid email address and create a secure password. You agree to:
            </p>
            <ul className="mt-3 space-y-2 list-none pl-0">
              {[
                'Provide accurate, current, and complete registration information.',
                'Maintain the security of your credentials and not share your account with third parties.',
                'Promptly notify us of any unauthorised use of your account at ' + CONTACT_EMAIL + '.',
                'Be at least 18 years of age, or have the authorisation of a guardian or institutional supervisor if younger.',
              ].map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-[var(--text-tertiary)] mt-0.5 flex-shrink-0">·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3">
              We reserve the right to refuse registration or terminate accounts that violate these Terms or where we have reasonable grounds to suspect misuse.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">4. Permitted Use and Acceptable Use Policy</h2>
            <p>
              PLEXUS is designed exclusively for legitimate academic and scientific research purposes. You may use the Service to:
            </p>
            <ul className="mt-3 space-y-2 list-none pl-0">
              {[
                'Design and manage research projects, ethics applications, and data management plans.',
                'Collect, store, and analyse research datasets in accordance with applicable law.',
                'Collaborate with co-researchers and institutional reviewers.',
                'Draft and publish research outputs, manuscripts, and supporting documents.',
              ].map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-[var(--text-tertiary)] mt-0.5 flex-shrink-0">·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 font-medium text-[var(--text-primary)]">You must not:</p>
            <ul className="mt-3 space-y-2 list-none pl-0">
              {[
                'Upload, store, or process personal data of research participants without valid legal basis, appropriate ethics approval, and informed consent as required by applicable law.',
                'Use the Service for any unlawful purpose or in violation of any applicable national or international law or regulation.',
                'Reverse-engineer, decompile, or attempt to extract source code from the Service.',
                'Use the Service to transmit malware, spam, or any harmful or disruptive content.',
                'Attempt to gain unauthorised access to other users\' accounts, data, or any part of the Service infrastructure.',
                'Use AI-assisted features to fabricate, falsify, or manipulate research data or outputs in a misleading manner.',
                'Resell, sublicense, or otherwise make the Service available to third parties without our prior written consent.',
              ].map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-[var(--status-error)] mt-0.5 flex-shrink-0">·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">5. Research Data and Intellectual Property</h2>
            <p>
              <strong>Your data remains yours.</strong> You retain full ownership of all research data, documents, manuscripts, and other content you upload or create through the Service (&ldquo;User Content&rdquo;).
            </p>
            <p className="mt-3">
              By using the Service, you grant PLEXUS a limited, non-exclusive, worldwide, royalty-free licence to store, process, display, and transmit your User Content solely to the extent necessary to provide and improve the Service, including operation of AI-assisted features.
            </p>
            <p className="mt-3">
              You represent and warrant that you have all necessary rights, permissions, and consents to upload User Content and to grant the licence above, including in respect of any personal data of research participants included in your datasets.
            </p>
            <p className="mt-3">
              All intellectual property rights in the PLEXUS platform, software, design, and documentation are owned by or licensed to us. Nothing in these Terms transfers any such rights to you.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">6. Data Protection</h2>
            <p>
              We process your personal data in accordance with the EU General Data Protection Regulation (GDPR) (Regulation (EU) 2016/679) and applicable German data protection law, including the Bundesdatenschutzgesetz (BDSG). Please read our <Link href="/privacy" className="text-[var(--accent-blue)] hover:underline">Privacy Policy</Link> carefully — it forms part of these Terms.
            </p>
            <p className="mt-3">
              Where you use PLEXUS to process personal data of research participants on behalf of your institution, you are the data controller for that participant data. PLEXUS acts as a data processor in respect of such data. Upon request, we will enter into a Data Processing Agreement (DPA) as required under Article 28 GDPR.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">7. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law:
            </p>
            <ul className="mt-3 space-y-2 list-none pl-0">
              {[
                'The Service is provided without any warranty of fitness for a particular purpose, merchantability, or non-infringement.',
                'We shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use the Service, including loss of data, loss of research outputs, or lost research opportunities.',
                'Our total aggregate liability to you for any claim arising out of or relating to these Terms or the Service shall not exceed EUR 100, reflecting the gratuitous nature of beta access.',
              ].map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-[var(--text-tertiary)] mt-0.5 flex-shrink-0">·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3">
              Nothing in these Terms shall limit or exclude liability for death or personal injury caused by our negligence, fraud or fraudulent misrepresentation, or any other liability that cannot be limited or excluded under applicable law.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">8. Termination</h2>
            <p>
              You may close your account at any time via the account settings page or by contacting us at <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--accent-blue)] hover:underline">{CONTACT_EMAIL}</a>. Upon closure, we will delete or anonymise your personal data in accordance with our Privacy Policy, subject to any legal retention obligations.
            </p>
            <p className="mt-3">
              We may suspend or terminate your access immediately, without prior notice, if you breach these Terms, engage in conduct that we reasonably determine to be harmful, illegal, or contrary to the integrity of academic research, or if we discontinue the beta programme.
            </p>
            <p className="mt-3">
              Sections 5 (Intellectual Property), 7 (Limitation of Liability), 9 (Governing Law), and 10 (Dispute Resolution) survive termination of these Terms.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">9. Governing Law</h2>
            <p>
              These Terms and any non-contractual obligations arising out of or in connection with them are governed by and shall be construed in accordance with the laws of the Federal Republic of Germany, excluding its conflict-of-laws rules.
            </p>
            <p className="mt-3">
              If you are a consumer resident in the European Union, you benefit from the mandatory consumer protection provisions of the country in which you reside. Nothing in this clause affects your rights as a consumer.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">10. Dispute Resolution</h2>
            <p>
              We encourage you to contact us first at <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--accent-blue)] hover:underline">{CONTACT_EMAIL}</a> to resolve any dispute informally. If a dispute cannot be resolved within 30 days, either party may pursue legal remedies before the competent courts of Germany.
            </p>
            <p className="mt-3">
              The European Commission provides an online dispute resolution (ODR) platform for consumers, accessible at <span className="text-[var(--text-tertiary)]">https://ec.europa.eu/consumers/odr</span>. We are not obliged to participate in ADR proceedings but will consider requests in good faith.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">11. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time to reflect changes in the law, our business, or the Service. We will notify registered users by email and by prominent notice within the platform at least 14 days before any material changes take effect. Your continued use of the Service after the effective date constitutes acceptance of the revised Terms.
            </p>
            <p className="mt-3">
              If you do not accept the revised Terms, you must stop using the Service and close your account before the effective date.
            </p>
          </section>

          {/* 12 */}
          <section>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">12. Contact</h2>
            <p>
              For questions about these Terms or the Service, contact us at:
            </p>
            <div className="mt-3 px-4 py-3 bg-[var(--bg-inset)] rounded-lg">
              <p className="text-sm font-medium text-[var(--text-primary)]">Plexus Science</p>
              <p className="text-sm text-[var(--text-secondary)]">Email: <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--accent-blue)] hover:underline">{CONTACT_EMAIL}</a></p>
              <p className="text-xs text-[var(--text-tertiary)] mt-2">Full legal address will be published prior to general availability.</p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-[var(--border-default)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-xs text-[var(--text-tertiary)]">
            © {new Date().getFullYear()} Plexus Science · Beta 1.0 · Effective {EFFECTIVE_DATE}
          </p>
          <div className="flex items-center gap-4 text-xs">
            <Link href="/privacy" className="text-[var(--text-tertiary)] hover:text-[var(--accent-blue)] transition-colors">Privacy Policy</Link>
            <Link href="/contact" className="text-[var(--text-tertiary)] hover:text-[var(--accent-blue)] transition-colors">Contact Support</Link>
            <Link href="/login" className="text-[var(--text-tertiary)] hover:text-[var(--accent-blue)] transition-colors">Sign In</Link>
          </div>
        </div>
      </main>
    </div>
  )
}
