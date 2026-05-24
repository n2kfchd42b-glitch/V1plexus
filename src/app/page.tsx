"use client"

import Link from 'next/link'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { LandingGlobeWrapper } from '@/components/landing/LandingGlobeWrapper'
import { LanguageSelector } from '@/components/i18n/LanguageSelector'
import { useLocale } from '@/i18n/LocaleProvider'

export default function LandingPage() {
  const { t } = useLocale()

  const SUPERVISOR_ITEMS = [
    { icon: 'approval',         text: t('landing.bento.supervisor.item1') },
    { icon: 'manage_accounts',  text: t('landing.bento.supervisor.item2') },
    { icon: 'verified',         text: t('landing.bento.supervisor.item3') },
  ]

  const ROLES = [
    { icon: 'school',           label: t('landing.roles.students.label'),    bg: 'bg-[#dde1ff]', text: 'text-[#003D9B]', desc: t('landing.roles.students.desc') },
    { icon: 'psychology',       label: t('landing.roles.supervisors.label'), bg: 'bg-[#d8e2ff]', text: 'text-[#0058be]', desc: t('landing.roles.supervisors.desc') },
    { icon: 'account_balance',  label: t('landing.roles.departments.label'), bg: 'bg-[#d9e3f4]', text: 'text-[#2b3542]', desc: t('landing.roles.departments.desc') },
    { icon: 'hub',              label: t('landing.roles.institutions.label'),bg: 'bg-[#ffdad6]', text: 'text-[#93000a]', desc: t('landing.roles.institutions.desc') },
  ]

  const HOW_IT_WORKS = [
    { icon: 'description',  title: t('landing.howItWorks.step1.title'), desc: t('landing.howItWorks.step1.desc'), dots: [true, false, false] },
    { icon: 'insights',     title: t('landing.howItWorks.step2.title'), desc: t('landing.howItWorks.step2.desc'), dots: null },
    { icon: 'auto_stories', title: t('landing.howItWorks.step3.title'), desc: t('landing.howItWorks.step3.desc'), dots: [false, false, true] },
  ]

  const FOOTER_LINKS = [
    { label: t('landing.footer.privacy'), href: '/privacy' },
    { label: t('landing.footer.terms'),   href: '/terms' },
    { label: t('landing.footer.contact'), href: '/contact' },
  ]

  return (
    <div className="bg-[#f8f9fb] text-[#191c1e] font-inter">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 shadow-sm">
        <div className="flex justify-between items-center w-full px-6 py-4 max-w-screen-2xl mx-auto">
          {/* Logo */}
          <BrandLogo variant="light" href="/" />
          <div className="flex items-center gap-4">
            <LanguageSelector compact />
            <Link href="/login" className="text-slate-600 hover:text-blue-800 transition-colors px-4 py-2 text-sm font-medium">
              {t('landing.nav.login')}
            </Link>
            <Link
              href="/register"
              className="bg-[#003D9B] hover:bg-[#1e40af] text-white px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 active:scale-90"
            >
              {t('landing.nav.signUp')}
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-20">
        {/* Hero Section */}
        <section className="relative min-h-screen flex items-center overflow-hidden grid-bg">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#f8f9fb]/40 to-[#f8f9fb]" />
          <div className="relative z-10 w-full max-w-7xl mx-auto px-6 py-24 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

            {/* Left — copy */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#dde1ff] text-[#001453] text-[10px] uppercase tracking-widest font-bold mb-8">
                <span className="material-symbols-outlined text-[14px]">verified</span>
                {t('landing.hero.badge')}
              </div>
              <h1 className="font-serif text-5xl md:text-7xl tracking-tight leading-[0.92] text-[#191c1e] mb-6">
                {t('landing.hero.line1')}<br />{t('landing.hero.line2')}<br />{t('landing.hero.line3')}
              </h1>
              <p className="text-lg text-[#444653] leading-relaxed mb-10 max-w-lg">
                {t('landing.hero.sub')}
              </p>
              <div className="flex flex-col sm:flex-row items-start gap-4 mb-10">
                <Link
                  href="/register"
                  className="px-8 py-4 bg-[#003D9B] text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
                >
                  {t('landing.hero.cta.getStarted')}
                </Link>
                <a
                  href="#how-it-works"
                  className="px-8 py-4 bg-white text-[#003D9B] border border-[#c4c5d5]/30 font-semibold rounded-xl hover:bg-[#f3f4f6] transition-all duration-300 flex items-center gap-2"
                >
                  {t('landing.hero.cta.seeHow')}
                  <span className="material-symbols-outlined">play_circle</span>
                </a>
              </div>
              {/* Globe caption */}
              <p className="text-sm text-[#444653]/60 font-medium">
                {t('landing.hero.globeCaption')}
              </p>
            </div>

            {/* Right — live globe */}
            <div className="h-64 sm:h-80 lg:h-[540px] rounded-2xl overflow-hidden shadow-2xl shadow-[#003D9B]/10 ring-1 ring-white/60">
              <LandingGlobeWrapper />
            </div>
          </div>
        </section>

        {/* Product Peek (Bento Box) */}
        <section className="py-24 max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-auto md:h-[700px]">
            {/* Main Dashboard Peek */}
            <div className="md:col-span-8 bg-white rounded-2xl overflow-hidden border border-[#c4c5d5]/10 shadow-sm relative group flex flex-col">
              <div className="p-8 pb-0">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#003D9B] mb-2 block">{t('landing.bento.hub.label')}</span>
                <h3 className="text-2xl font-bold tracking-tight mb-2">{t('landing.bento.hub.title')}</h3>
                <p className="text-[#444653] text-sm max-w-md">{t('landing.bento.hub.desc')}</p>
              </div>
              <div className="mt-8 flex-grow relative overflow-hidden mx-8 rounded-t-xl border-x border-t border-[#c4c5d5]/20 bg-white">
                {/* Institution Study Pipeline Dashboard */}
                <svg viewBox="0 0 600 300" xmlns="http://www.w3.org/2000/svg" className="w-full h-full" aria-label="Institution study pipeline overview">
                  <rect width="600" height="300" fill="#fafafa" />

                  {/* Window chrome */}
                  <rect width="600" height="28" fill="#f1f3f6" />
                  <rect x="0" y="27" width="600" height="1" fill="#e5e7eb" />
                  <circle cx="12" cy="14" r="4" fill="#ff5f57" />
                  <circle cx="24" cy="14" r="4" fill="#febc2e" />
                  <circle cx="36" cy="14" r="4" fill="#28c840" />
                  <text x="52" y="19" fontSize="8.5" fill="#6b7280" fontFamily="Inter,-apple-system,sans-serif">plexus_dashboard — Institution Overview · Live</text>
                  <circle cx="577" cy="14" r="3.5" fill="#28c840" />

                  {/* Stats strip */}
                  <rect x="0" y="28" width="600" height="38" fill="white" />
                  <rect x="0" y="65" width="600" height="1" fill="#e5e7eb" />

                  <rect x="14" y="36" width="108" height="22" rx="5" fill="#eff6ff" />
                  <text x="24" y="51" fontSize="9" fill="#1e40af" fontFamily="Inter,sans-serif" fontWeight="700">8</text>
                  <text x="34" y="51" fontSize="8.5" fill="#3b82f6" fontFamily="Inter,sans-serif"> Active Studies</text>

                  <rect x="134" y="36" width="118" height="22" rx="5" fill="#f0fdf4" />
                  <text x="144" y="51" fontSize="9" fill="#15803d" fontFamily="Inter,sans-serif" fontWeight="700">1,247</text>
                  <text x="175" y="51" fontSize="8.5" fill="#16a34a" fontFamily="Inter,sans-serif"> Enrolled</text>

                  <rect x="264" y="36" width="122" height="22" rx="5" fill="#fefce8" />
                  <text x="274" y="51" fontSize="9" fill="#a16207" fontFamily="Inter,sans-serif" fontWeight="700">3</text>
                  <text x="283" y="51" fontSize="8.5" fill="#ca8a04" fontFamily="Inter,sans-serif"> Ethics Pending</text>

                  <rect x="398" y="36" width="108" height="22" rx="5" fill="#fdf4ff" />
                  <text x="408" y="51" fontSize="9" fill="#7e22ce" fontFamily="Inter,sans-serif" fontWeight="700">2</text>
                  <text x="417" y="51" fontSize="8.5" fill="#9333ea" fontFamily="Inter,sans-serif"> In Publication</text>

                  {/* Column headers */}
                  <rect x="0" y="66" width="600" height="22" fill="#f8f9fb" />
                  <text x="14"  y="80" fontSize="7" fill="#9ca3af" fontFamily="Inter,sans-serif" fontWeight="700" letterSpacing="0.05em">STUDY ID</text>
                  <text x="148" y="80" fontSize="7" fill="#9ca3af" fontFamily="Inter,sans-serif" fontWeight="700" letterSpacing="0.05em">STATUS</text>
                  <text x="218" y="80" fontSize="7" fill="#9ca3af" fontFamily="Inter,sans-serif" fontWeight="700" letterSpacing="0.05em">PROTOCOL</text>
                  <text x="296" y="80" fontSize="7" fill="#9ca3af" fontFamily="Inter,sans-serif" fontWeight="700" letterSpacing="0.05em">COLLECTION</text>
                  <text x="390" y="80" fontSize="7" fill="#9ca3af" fontFamily="Inter,sans-serif" fontWeight="700" letterSpacing="0.05em">ANALYSIS</text>
                  <text x="476" y="80" fontSize="7" fill="#9ca3af" fontFamily="Inter,sans-serif" fontWeight="700" letterSpacing="0.05em">PUBLICATION</text>
                  <rect x="0" y="88" width="600" height="1" fill="#e5e7eb" />

                  {/* Row 1 — KM-2024-017 */}
                  <rect x="0" y="89" width="600" height="46" fill="white" />
                  <text x="14" y="110" fontSize="9" fill="#111827" fontFamily="Inter,sans-serif" fontWeight="600">KM-2024-017</text>
                  <text x="14" y="124" fontSize="7.5" fill="#6b7280" fontFamily="Inter,sans-serif">Oncology · n=300</text>
                  <rect x="148" y="103" width="54" height="16" rx="8" fill="#dbeafe" />
                  <text x="175" y="115" fontSize="7.5" fill="#1d4ed8" fontFamily="Inter,sans-serif" fontWeight="700" textAnchor="middle">Active</text>
                  <rect x="218" y="108" width="64" height="6" rx="3" fill="#e5e7eb" />
                  <rect x="218" y="108" width="64" height="6" rx="3" fill="#003D9B" />
                  <rect x="296" y="108" width="80" height="6" rx="3" fill="#e5e7eb" />
                  <rect x="296" y="108" width="80" height="6" rx="3" fill="#003D9B" />
                  <rect x="390" y="108" width="72" height="6" rx="3" fill="#e5e7eb" />
                  <rect x="390" y="108" width="40" height="6" rx="3" fill="#3b82f6" />
                  <rect x="476" y="108" width="60" height="6" rx="3" fill="#e5e7eb" />
                  <rect x="0" y="135" width="600" height="1" fill="#f3f4f6" />

                  {/* Row 2 — MAL-2023-089 */}
                  <rect x="0" y="136" width="600" height="46" fill="white" />
                  <text x="14" y="157" fontSize="9" fill="#111827" fontFamily="Inter,sans-serif" fontWeight="600">MAL-2023-089</text>
                  <text x="14" y="171" fontSize="7.5" fill="#6b7280" fontFamily="Inter,sans-serif">Malaria · n=512</text>
                  <rect x="148" y="150" width="64" height="16" rx="8" fill="#d1fae5" />
                  <text x="180" y="162" fontSize="7.5" fill="#065f46" fontFamily="Inter,sans-serif" fontWeight="700" textAnchor="middle">Publishing</text>
                  <rect x="218" y="155" width="64" height="6" rx="3" fill="#003D9B" />
                  <rect x="296" y="155" width="80" height="6" rx="3" fill="#003D9B" />
                  <rect x="390" y="155" width="72" height="6" rx="3" fill="#003D9B" />
                  <rect x="476" y="155" width="60" height="6" rx="3" fill="#e5e7eb" />
                  <rect x="476" y="155" width="23" height="6" rx="3" fill="#8b5cf6" />
                  <rect x="0" y="182" width="600" height="1" fill="#f3f4f6" />

                  {/* Row 3 — TB-2024-003 */}
                  <rect x="0" y="183" width="600" height="46" fill="white" />
                  <text x="14" y="204" fontSize="9" fill="#111827" fontFamily="Inter,sans-serif" fontWeight="600">TB-2024-003</text>
                  <text x="14" y="218" fontSize="7.5" fill="#6b7280" fontFamily="Inter,sans-serif">Tuberculosis · n=189</text>
                  <rect x="148" y="197" width="54" height="16" rx="8" fill="#dbeafe" />
                  <text x="175" y="209" fontSize="7.5" fill="#1d4ed8" fontFamily="Inter,sans-serif" fontWeight="700" textAnchor="middle">Active</text>
                  <rect x="218" y="202" width="64" height="6" rx="3" fill="#003D9B" />
                  <rect x="296" y="202" width="80" height="6" rx="3" fill="#e5e7eb" />
                  <rect x="296" y="202" width="34" height="6" rx="3" fill="#3b82f6" />
                  <rect x="390" y="202" width="72" height="6" rx="3" fill="#e5e7eb" />
                  <rect x="476" y="202" width="60" height="6" rx="3" fill="#e5e7eb" />
                  <rect x="0" y="229" width="600" height="1" fill="#f3f4f6" />

                  {/* Row 4 — HIV-2024-022 */}
                  <rect x="0" y="230" width="600" height="46" fill="white" />
                  <text x="14" y="251" fontSize="9" fill="#111827" fontFamily="Inter,sans-serif" fontWeight="600">HIV-2024-022</text>
                  <text x="14" y="265" fontSize="7.5" fill="#6b7280" fontFamily="Inter,sans-serif">Immunology · n=—</text>
                  <rect x="148" y="244" width="46" height="16" rx="8" fill="#f3f4f6" />
                  <text x="171" y="256" fontSize="7.5" fill="#6b7280" fontFamily="Inter,sans-serif" fontWeight="700" textAnchor="middle">Setup</text>
                  <rect x="218" y="249" width="64" height="6" rx="3" fill="#e5e7eb" />
                  <rect x="218" y="249" width="40" height="6" rx="3" fill="#93c5fd" />
                  <rect x="296" y="249" width="80" height="6" rx="3" fill="#e5e7eb" />
                  <rect x="390" y="249" width="72" height="6" rx="3" fill="#e5e7eb" />
                  <rect x="476" y="249" width="60" height="6" rx="3" fill="#e5e7eb" />

                  {/* Audit footer */}
                  <rect x="0" y="276" width="600" height="24" fill="#f8f9fb" />
                  <rect x="0" y="276" width="600" height="1" fill="#e5e7eb" />
                  <text x="14" y="291" fontSize="7.5" fill="#9ca3af" fontFamily="Inter,sans-serif">🔒  Audit chain active · 48 blocks · Last entry 2 min ago</text>
                  <text x="530" y="291" fontSize="7.5" fill="#003D9B" fontFamily="Inter,sans-serif" fontWeight="600">View Ledger →</text>
                </svg>
              </div>
            </div>

            {/* Immutable Audit Ledger Peek */}
            <div className="md:col-span-4 bg-[#2b3542] rounded-2xl overflow-hidden border border-[#c4c5d5]/10 shadow-sm flex flex-col">
              <div className="p-7">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#d9e3f4] mb-2 block">{t('landing.bento.trail.label')}</span>
                <h3 className="text-2xl font-bold tracking-tight mb-2 text-white">{t('landing.bento.trail.title')}</h3>
                <p className="text-[#b2bccd] text-sm leading-relaxed">{t('landing.bento.trail.desc')}</p>
              </div>
              <div className="flex-1 px-5 pb-5 flex flex-col gap-2">
                {/* Genesis block */}
                <div className="rounded-lg bg-white/5 border border-white/10 px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-blue-300">Genesis Block</span>
                    <span className="text-[9px] text-slate-500 font-mono">#0</span>
                  </div>
                  <div className="font-mono text-[9px] text-slate-400 tracking-wide">a3f8d2e1b7c94f02…</div>
                </div>
                <div className="flex justify-center py-0.5">
                  <div className="w-px h-4 bg-slate-600" />
                </div>
                {/* Block 1 — Data Import */}
                <div className="rounded-lg bg-white/5 border border-blue-400/25 px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-blue-200">Data Import</span>
                    <span className="text-[9px] text-slate-500 font-mono">#47</span>
                  </div>
                  <div className="text-[9px] text-slate-300 mb-1.5">KoboToolbox · n=300 rows ingested</div>
                  <div className="font-mono text-[9px] text-slate-400 tracking-wide">prev: a3f8… → b9e2c4a1f6d8…</div>
                </div>
                <div className="flex justify-center py-0.5">
                  <div className="w-px h-4 bg-slate-600" />
                </div>
                {/* Block 2 — Analysis */}
                <div className="rounded-lg bg-white/5 border border-blue-400/25 px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-blue-200">Analysis Run</span>
                    <span className="text-[9px] text-slate-500 font-mono">#48</span>
                  </div>
                  <div className="text-[9px] text-slate-300 mb-1.5">Kaplan-Meier · HR=0.52 · p&lt;0.001</div>
                  <div className="font-mono text-[9px] text-slate-400 tracking-wide">prev: b9e2… → c7d3e5b2a8f1…</div>
                </div>
                {/* Verified pill */}
                <div className="mt-auto pt-3">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-400/20">
                    <span className="material-symbols-outlined text-blue-300 text-[15px]">lock</span>
                    <span className="text-[10px] font-medium text-blue-200">Chain verified · 0 mutations detected</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Analysis Engine Peek */}
            <div className="md:col-span-4 bg-[#e7e8ea] rounded-2xl overflow-hidden border border-[#c4c5d5]/10 shadow-sm flex flex-col">
              <div className="p-7">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#003D9B] mb-2 block">{t('landing.bento.analysis.label')}</span>
                <h3 className="text-2xl font-bold tracking-tight mb-2">{t('landing.bento.analysis.title')}</h3>
                <p className="text-[#444653] text-sm leading-relaxed">{t('landing.bento.analysis.desc')}</p>
              </div>
              <div className="flex-1 flex items-end justify-center px-5 pb-5 overflow-hidden">
                {/* ROC Curve SVG */}
                <svg viewBox="0 0 240 190" xmlns="http://www.w3.org/2000/svg" className="w-full" aria-label="ROC curve — AUC 0.87">
                  <rect width="240" height="190" fill="transparent" />
                  <line x1="38" y1="20" x2="38" y2="165" stroke="#9ca3af" strokeWidth="1.2" />
                  <line x1="38" y1="165" x2="220" y2="165" stroke="#9ca3af" strokeWidth="1.2" />
                  {[0.25, 0.5, 0.75].map((v) => {
                    const y = 165 - v * 145
                    const x = 38 + v * 182
                    return (
                      <g key={v}>
                        <line x1="38" y1={y} x2="220" y2={y} stroke="#d1d5db" strokeWidth="0.7" strokeDasharray="3,2" />
                        <line x1={x} y1="20" x2={x} y2="165" stroke="#d1d5db" strokeWidth="0.7" strokeDasharray="3,2" />
                      </g>
                    )
                  })}
                  <line x1="38" y1="165" x2="220" y2="20" stroke="#9ca3af" strokeWidth="1" strokeDasharray="4,3" opacity="0.6" />
                  <path
                    d="M38,165 C38,140 44,100 60,72 C76,44 100,30 130,25 C160,20 190,20 220,20 L220,165 Z"
                    fill="#003D9B"
                    fillOpacity="0.08"
                  />
                  <path
                    d="M38,165 C38,140 44,100 60,72 C76,44 100,30 130,25 C160,20 190,20 220,20"
                    fill="none"
                    stroke="#003D9B"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <rect x="130" y="105" width="80" height="22" rx="11" fill="#003D9B" fillOpacity="0.9" />
                  <text x="170" y="120" fontSize="8.5" fill="white" fontFamily="Inter,sans-serif" fontWeight="700" textAnchor="middle">AUC = 0.87</text>
                  <text x="129" y="182" fontSize="8" fill="#6b7280" fontFamily="Inter,sans-serif" textAnchor="middle">False Positive Rate</text>
                  <text x="13" y="95" fontSize="8" fill="#6b7280" fontFamily="Inter,sans-serif" textAnchor="middle" transform="rotate(-90,13,95)">True Positive Rate</text>
                  {([0, 0.25, 0.5, 0.75, 1.0] as number[]).map((v) => {
                    const y = 165 - v * 145
                    return (
                      <g key={v}>
                        <line x1="34" y1={y} x2="38" y2={y} stroke="#9ca3af" strokeWidth="1" />
                        <text x="30" y={y + 3} fontSize="7" fill="#9ca3af" fontFamily="Inter,sans-serif" textAnchor="end">{v.toFixed(2)}</text>
                      </g>
                    )
                  })}
                  {([0, 0.25, 0.5, 0.75, 1.0] as number[]).map((v) => {
                    const x = 38 + v * 182
                    return (
                      <g key={v}>
                        <line x1={x} y1="165" x2={x} y2="169" stroke="#9ca3af" strokeWidth="1" />
                        <text x={x} y="178" fontSize="7" fill="#9ca3af" fontFamily="Inter,sans-serif" textAnchor="middle">{v.toFixed(2)}</text>
                      </g>
                    )
                  })}
                  <text x="129" y="14" fontSize="8" fill="#374151" fontFamily="Inter,sans-serif" textAnchor="middle" fontWeight="600">Diagnostic Performance · Study KM-2024-017</text>
                </svg>
              </div>
            </div>

            {/* Supervisor Workflows Section */}
            <div className="md:col-span-8 bg-[#003D9B] rounded-2xl overflow-hidden shadow-xl flex flex-col md:flex-row">
              <div className="p-8 md:w-1/2 flex flex-col justify-center">
                <h3 className="text-3xl font-bold tracking-tight text-white mb-7">{t('landing.bento.supervisor.title')}</h3>
                <div className="flex flex-col gap-5">
                  {SUPERVISOR_ITEMS.map(({ icon, text }) => (
                    <div key={icon} className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-blue-200 text-[18px] mt-0.5 shrink-0">{icon}</span>
                      <span className="text-[#d4dfff] text-sm leading-relaxed">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="md:w-1/2 bg-[#1e40af]/30 flex items-center justify-center p-8 min-h-[220px]">
                {/* Approval workflow visualization */}
                <div className="w-full max-w-[240px] flex flex-col gap-2">
                  {([
                    { label: 'Data Import', sub: 'KoboToolbox · n=300', status: 'approved', by: 'Dr. Mensah' },
                    { label: 'Analysis Parameters', sub: 'Kaplan-Meier · HR, CI', status: 'approved', by: 'Dr. Mensah' },
                    { label: 'Manuscript Draft', sub: 'Tables & figures export', status: 'pending', by: 'Awaiting review' },
                  ] as { label: string; sub: string; status: string; by: string }[]).map(({ label, sub, status, by }, i) => (
                    <div key={label}>
                      <div className={`rounded-lg px-4 py-3 border ${status === 'approved' ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/10'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-semibold text-white">{label}</span>
                          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${status === 'approved' ? 'bg-emerald-400/20 text-emerald-300' : 'bg-amber-400/20 text-amber-300'}`}>
                            <span className="material-symbols-outlined text-[10px]">{status === 'approved' ? 'check_circle' : 'schedule'}</span>
                            {status}
                          </div>
                        </div>
                        <div className="text-[9px] text-blue-200 opacity-70">{sub}</div>
                        <div className="text-[9px] text-blue-300 mt-0.5">{by}</div>
                      </div>
                      {i < 2 && <div className="flex justify-center"><div className="w-px h-2 bg-white/20" /></div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Built for Every Role */}
        <section className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className="mb-16">
              <h2 className="text-4xl font-bold tracking-tight mb-4">{t('landing.roles.heading')}</h2>
              <p className="text-[#444653] max-w-xl">{t('landing.roles.desc')}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {ROLES.map(({ icon, label, bg, text, desc }) => (
                <div key={icon} className="p-8 bg-[#edeef0] rounded-xl border border-transparent hover:border-[#003D9B]/20 transition-all">
                  <div className={`w-12 h-12 rounded-lg ${bg} flex items-center justify-center ${text} mb-6`}>
                    <span className="material-symbols-outlined">{icon}</span>
                  </div>
                  <h4 className="font-bold mb-3">{label}</h4>
                  <p className="text-sm text-[#444653] leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* The Global Research Plexus */}
        <section id="how-it-works" className="py-24 bg-[#1E40AF] text-white overflow-hidden relative">
          <div className="absolute inset-0 z-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt=""
              className="w-full h-full object-cover opacity-20 mix-blend-overlay"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDHNkAhTuRtOT-KAFXT3uBiHzUzSIGzENk-VIFioNUo-y2508nOnV1oJA3Cm1vgJg8CQAZIOr5lQevKA9L-aSlfBz6HADBW7F7veyoCtaiJ5I8iBwAB-CYZSKsV_ADsXsCiswWkJfhoG14MNNXqHK67GkiF0IW2SUbUBS6FpRWuVIrifYBe84LGY4VLK65pXNudr5-I2n66payUIJVszA3fdKWRrBApi2dhZKX3fqqy0J2aabl0oq5eQHa1T2BiA3NIAbIP4VvA4Q"
            />
          </div>
          <div className="max-w-7xl mx-auto px-6 relative z-10">
            <div className="text-center mb-16">
              <span className="inline-block px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-blue-100 text-xs font-bold uppercase tracking-[0.2em] mb-6 font-geist">
                {t('landing.howItWorks.badge')}
              </span>
              <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-4 font-geist text-white">{t('landing.howItWorks.heading')}</h2>
              <p className="text-blue-100 text-lg max-w-2xl mx-auto opacity-80">{t('landing.howItWorks.desc')}</p>
            </div>
            <div className="relative">
              <div className="hidden md:block absolute top-1/2 left-0 w-full h-[2px] flow-line -translate-y-1/2" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
                {HOW_IT_WORKS.map(({ icon, title, desc, dots }, idx) => {
                  const isCenter = idx === 1
                  return (
                    <div
                      key={icon}
                      className={
                        isCenter
                          ? 'bg-white/10 backdrop-blur-lg border border-white/30 rounded-2xl p-8 shadow-2xl flex flex-col items-center text-center scale-105 z-20'
                          : 'bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 shadow-sm group hover:border-white/30 transition-all duration-500 flex flex-col items-center text-center'
                      }
                    >
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 ${isCenter ? 'bg-white shadow-lg shadow-blue-900/40' : 'bg-blue-400/10 group-hover:scale-110 transition-transform'}`}>
                        <span className={`material-symbols-outlined text-3xl ${isCenter ? 'text-[#1E40AF]' : 'text-blue-200'}`}>{icon}</span>
                      </div>
                      <h4 className="text-xl font-bold font-geist tracking-tight mb-2 text-white">{title}</h4>
                      <p className={`text-sm text-blue-100 leading-relaxed ${isCenter ? '' : 'opacity-80'}`}>{desc}</p>
                      {isCenter ? (
                        <div className="mt-8 w-full h-12 flex items-end gap-1 px-4">
                          <div className="flex-1 bg-white/20 rounded-t h-4 animate-bounce" />
                          <div className="flex-1 bg-white/80 rounded-t h-10 animate-bounce [animation-delay:150ms]" />
                          <div className="flex-1 bg-white/40 rounded-t h-6 animate-bounce [animation-delay:300ms]" />
                          <div className="flex-1 bg-white/60 rounded-t h-8 animate-bounce [animation-delay:450ms]" />
                        </div>
                      ) : (
                        <div className="mt-8 flex gap-2">
                          {dots!.map((active, i) => (
                            <div key={i} className={`w-2 h-2 rounded-full ${active ? 'bg-blue-300 animate-pulse' : 'bg-white/20'}`} />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="mt-16 text-center">
              <Link
                href="/register"
                className="inline-flex items-center gap-3 px-8 py-4 bg-white text-[#1E40AF] font-bold rounded-xl hover:bg-blue-50 transition-all group shadow-xl shadow-blue-900/20"
              >
                {t('landing.howItWorks.cta')}
                <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-32 bg-[#f8f9fb] relative overflow-hidden">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <h2 className="text-5xl font-bold tracking-tight mb-8">{t('landing.cta.heading')}</h2>
            <p className="text-xl text-[#444653] mb-12">{t('landing.cta.desc')}</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <Link
                href="/register"
                className="px-10 py-5 bg-[#003D9B] text-white font-bold rounded-xl shadow-xl hover:shadow-2xl hover:scale-105 transition-all font-geist"
              >
                {t('landing.cta.getStarted')}
              </Link>
              <a href="mailto:plexus.science@outlook.de" className="text-[#003D9B] font-bold hover:underline font-geist">
                {t('landing.cta.contact')}
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200 bg-slate-50">
        <div className="flex flex-col md:flex-row justify-between items-center w-full px-8 py-12 max-w-7xl mx-auto gap-6">
          <div className="flex flex-col items-center md:items-start gap-4">
            <span className="text-lg font-bold text-slate-900">PLEXUS Research</span>
            <p className="text-sm leading-relaxed text-slate-500 text-center md:text-left max-w-xs">
              {t('landing.footer.copyright')}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-8">
            {FOOTER_LINKS.map(({ label, href }) => (
              <a key={href} className="text-slate-500 hover:text-slate-900 text-sm hover:underline transition-all opacity-80 hover:opacity-100" href={href}>
                {label}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
