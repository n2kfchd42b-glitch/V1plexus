import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="bg-[#f8f9fb] text-[#191c1e] font-inter">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 shadow-sm">
        <div className="flex justify-between items-center w-full px-6 py-4 max-w-screen-2xl mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-[#00288e] shadow-md shadow-[#00288e]/30 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[#1e40af] to-[#00288e]" />
              <span className="relative z-10 text-white font-black text-sm tracking-tight leading-none select-none">PR</span>
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-blue-300/20 rounded-tl-lg" />
            </div>
            <span className="text-[15px] font-bold tracking-tight text-[#00288e]">
              PLEXUS <span className="text-slate-400 font-normal">Research</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-slate-600 hover:text-blue-800 transition-colors px-4 py-2 text-sm font-medium">
              Login
            </Link>
            <Link
              href="/register"
              className="bg-[#00288e] hover:bg-[#1e40af] text-white px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 active:scale-90"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-20">
        {/* Hero Section */}
        <section className="relative min-h-[870px] flex items-center justify-center overflow-hidden grid-bg">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#f8f9fb]/50 to-[#f8f9fb]" />
          <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#dde1ff] text-[#001453] text-[10px] uppercase tracking-widest font-bold mb-8">
              <span className="material-symbols-outlined text-[14px]">verified</span>
              Built for Global Health Institutions
            </div>
            <h1 className="font-serif text-6xl md:text-8xl tracking-tight leading-[0.9] text-[#191c1e] mb-8">
              The RESEARCH Platform <br />for Global Health
            </h1>
            <p className="max-w-2xl mx-auto text-xl text-[#444653] leading-relaxed mb-12">
              PLEXUS connects your entire research lifecycle — from protocol design to publication — in one collaborative platform built for institutions.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="w-full sm:w-auto px-8 py-4 bg-[#00288e] text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
              >
                Get Started Free
              </Link>
              <a
                href="#how-it-works"
                className="w-full sm:w-auto px-8 py-4 bg-white text-[#00288e] border border-[#c4c5d5]/30 font-semibold rounded-xl hover:bg-[#f3f4f6] transition-all duration-300 flex items-center justify-center gap-2"
              >
                See How It Works
                <span className="material-symbols-outlined">play_circle</span>
              </a>
            </div>
          </div>
        </section>

        {/* Product Peek (Bento Box) */}
        <section className="py-24 max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-auto md:h-[700px]">
            {/* Main Dashboard Peek */}
            <div className="md:col-span-8 bg-white rounded-2xl overflow-hidden border border-[#c4c5d5]/10 shadow-sm relative group flex flex-col">
              <div className="p-8 pb-0">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#00288e] mb-2 block">Central Intelligence</span>
                <h3 className="text-2xl font-bold tracking-tight mb-2">Real-time Orchestration</h3>
                <p className="text-[#444653] text-sm max-w-md">Monitor every study, data point, and ethical review across your entire institution in a single command center.</p>
              </div>
              <div className="mt-8 flex-grow relative overflow-hidden mx-8 rounded-t-xl border-x border-t border-[#c4c5d5]/20 bg-white">
                {/* Kaplan-Meier Survival Chart */}
                <svg viewBox="0 0 600 300" xmlns="http://www.w3.org/2000/svg" className="w-full h-full" aria-label="Kaplan-Meier survival curve">
                  <rect width="600" height="300" fill="#fafafa" />
                  {/* Window chrome */}
                  <rect width="600" height="28" fill="#f1f3f6" />
                  <rect x="0" y="27" width="600" height="1" fill="#e5e7eb" />
                  <circle cx="12" cy="14" r="4" fill="#ff5f57" />
                  <circle cx="24" cy="14" r="4" fill="#febc2e" />
                  <circle cx="36" cy="14" r="4" fill="#28c840" />
                  <text x="52" y="19" fontSize="8.5" fill="#6b7280" fontFamily="Inter,-apple-system,sans-serif">survival_analysis.R — Study KM-2024-017 · Overall Survival</text>
                  {/* Legend strip */}
                  <rect x="0" y="28" width="600" height="26" fill="white" />
                  <rect x="0" y="53" width="600" height="1" fill="#f3f4f6" />
                  <line x1="58" y1="41" x2="78" y2="41" stroke="#00288e" strokeWidth="2.5" />
                  <circle cx="68" cy="41" r="2.5" fill="#00288e" />
                  <text x="82" y="45" fontSize="8.5" fill="#191c1e" fontFamily="Inter,sans-serif">Treatment group (n=148)</text>
                  <line x1="225" y1="41" x2="245" y2="41" stroke="#9ca3af" strokeWidth="2" strokeDasharray="4,2" />
                  <text x="249" y="45" fontSize="8.5" fill="#444653" fontFamily="Inter,sans-serif">Control group (n=152)</text>
                  <rect x="432" y="31" width="154" height="22" rx="11" fill="#eff6ff" />
                  <text x="451" y="46" fontSize="8.5" fill="#1e40af" fontFamily="Inter,sans-serif" fontWeight="700">p &lt; 0.001 · HR = 0.52</text>
                  {/* Y-axis label */}
                  <text x="10" y="160" fontSize="8.5" fill="#6b7280" fontFamily="Inter,sans-serif" textAnchor="middle" transform="rotate(-90,10,160)">Survival Probability</text>
                  {/* Horizontal grid */}
                  <line x1="55" y1="58"  x2="560" y2="58"  stroke="#f0f0f0" strokeWidth="1" />
                  <line x1="55" y1="106" x2="560" y2="106" stroke="#f0f0f0" strokeWidth="1" />
                  <line x1="55" y1="154" x2="560" y2="154" stroke="#f0f0f0" strokeWidth="1" />
                  <line x1="55" y1="202" x2="560" y2="202" stroke="#f0f0f0" strokeWidth="1" />
                  <line x1="55" y1="250" x2="560" y2="250" stroke="#f0f0f0" strokeWidth="1" />
                  {/* Vertical grid */}
                  <line x1="156" y1="58" x2="156" y2="250" stroke="#f0f0f0" strokeWidth="1" />
                  <line x1="257" y1="58" x2="257" y2="250" stroke="#f0f0f0" strokeWidth="1" />
                  <line x1="358" y1="58" x2="358" y2="250" stroke="#f0f0f0" strokeWidth="1" />
                  <line x1="459" y1="58" x2="459" y2="250" stroke="#f0f0f0" strokeWidth="1" />
                  {/* Axes */}
                  <line x1="55" y1="58" x2="55"  y2="252" stroke="#d1d5db" strokeWidth="1.5" />
                  <line x1="53" y1="250" x2="562" y2="250" stroke="#d1d5db" strokeWidth="1.5" />
                  {/* Y ticks + labels */}
                  {([1.0, 0.75, 0.5, 0.25, 0.0] as number[]).map((p) => {
                    const y = 250 - p * 192
                    return (
                      <g key={p}>
                        <line x1="50" y1={y} x2="55" y2={y} stroke="#9ca3af" strokeWidth="1" />
                        <text x="46" y={y + 3.5} fontSize="7.5" fill="#9ca3af" fontFamily="Inter,sans-serif" textAnchor="end">{p.toFixed(2)}</text>
                      </g>
                    )
                  })}
                  {/* X ticks + labels */}
                  {([0, 12, 24, 36, 48, 60] as number[]).map((t) => {
                    const x = 55 + (t / 60) * 505
                    return (
                      <g key={t}>
                        <line x1={x} y1="250" x2={x} y2="255" stroke="#9ca3af" strokeWidth="1" />
                        <text x={x} y="264" fontSize="7.5" fill="#9ca3af" fontFamily="Inter,sans-serif" textAnchor="middle">{t}</text>
                      </g>
                    )
                  })}
                  <text x="307" y="281" fontSize="8.5" fill="#6b7280" fontFamily="Inter,sans-serif" textAnchor="middle">Time (months)</text>
                  {/* CI band — treatment ±0.08 */}
                  <path
                    d="M55,58 H106 V58 H156 V66 H207 V81 H257 V96 H308 V110 H358 V123 H409 V137 H459 V148 H510 V160 H560 V169 V200 H510 V191 H459 V179 H409 V167 H358 V154 H308 V141 H257 V127 H207 V112 H156 V83 H106 V73 H55 Z"
                    fill="#00288e"
                    fillOpacity="0.07"
                  />
                  {/* Control curve (dashed gray) */}
                  <path
                    d="M55,58 H106 V87 H156 V116 H207 V139 H257 V158 H308 V173 H358 V189 H409 V200 H459 V212 H510 V219 H560 V227"
                    fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="5,3" strokeLinejoin="miter"
                  />
                  {/* Treatment curve (solid blue) */}
                  <path
                    d="M55,58 H106 V68 H156 V81 H207 V96 H257 V112 H308 V125 H358 V139 H409 V152 H459 V164 H510 V175 H560 V185"
                    fill="none" stroke="#00288e" strokeWidth="2.5" strokeLinejoin="miter" strokeLinecap="round"
                  />
                  {/* Censoring marks — treatment */}
                  <line x1="178" y1="84" x2="178" y2="92" stroke="#00288e" strokeWidth="1.5" />
                  <line x1="290" y1="117" x2="290" y2="125" stroke="#00288e" strokeWidth="1.5" />
                  <line x1="435" y1="154" x2="435" y2="162" stroke="#00288e" strokeWidth="1.5" />
                  {/* Censoring marks — control */}
                  <line x1="145" y1="106" x2="145" y2="114" stroke="#9ca3af" strokeWidth="1.5" />
                  <line x1="275" y1="159" x2="275" y2="167" stroke="#9ca3af" strokeWidth="1.5" />
                  <line x1="440" y1="203" x2="440" y2="211" stroke="#9ca3af" strokeWidth="1.5" />
                  {/* Median survival annotation — treatment */}
                  <line x1="55" y1="154" x2="350" y2="154" stroke="#00288e" strokeWidth="0.75" strokeDasharray="3,2" opacity="0.4" />
                  <line x1="350" y1="154" x2="350" y2="250" stroke="#00288e" strokeWidth="0.75" strokeDasharray="3,2" opacity="0.4" />
                  <text x="354" y="247" fontSize="7" fill="#00288e" fontFamily="Inter,sans-serif">m=35mo</text>
                </svg>
              </div>
            </div>

            {/* Global Map Peek */}
            <div className="md:col-span-4 bg-[#2b3542] rounded-2xl overflow-hidden border border-[#c4c5d5]/10 shadow-sm relative group">
              <div className="p-8 relative z-10">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#d9e3f4] mb-2 block">Global Reach</span>
                <h3 className="text-2xl font-bold tracking-tight mb-2 text-white">Geospatial Distribution</h3>
                <p className="text-[#b2bccd] text-sm">Track field sites and clinical trials globally with granular geographic precision.</p>
              </div>
              <div className="absolute inset-0 z-0">
                <div className="w-full h-full opacity-40 bg-slate-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt="World map showing research distribution"
                    className="w-full h-full object-cover"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDHNkAhTuRtOT-KAFXT3uBiHzUzSIGzENk-VIFioNUo-y2508nOnV1oJA3Cm1vgJg8CQAZIOr5lQevKA9L-aSlfBz6HADBW7F7veyoCtaiJ5I8iBwAB-CYZSKsV_ADsXsCiswWkJfhoG14MNNXqHK67GkiF0IW2SUbUBS6FpRWuVIrifYBe84LGY4VLK65pXNudr5-I2n66payUIJVszA3fdKWRrBApi2dhZKX3fqqy0J2aabl0oq5eQHa1T2BiA3NIAbIP4VvA4Q"
                  />
                </div>
              </div>
              <div className="absolute bottom-6 left-6 right-6 p-4 glass-panel rounded-lg border border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  <span className="text-[10px] font-medium text-slate-800">42 Live Active Nodes</span>
                </div>
              </div>
            </div>

            {/* Analysis Engine Peek */}
            <div className="md:col-span-4 bg-[#e7e8ea] rounded-2xl overflow-hidden border border-[#c4c5d5]/10 shadow-sm relative group">
              <div className="p-8">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#00288e] mb-2 block">Data Science</span>
                <h3 className="text-2xl font-bold tracking-tight mb-2">Clinical-Grade Analysis</h3>
                <p className="text-[#444653] text-sm">Automated statistical modeling compliant with international health standards.</p>
              </div>
              <div className="absolute bottom-0 right-0 w-3/4 translate-x-1/4 translate-y-1/4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt="Statistical analysis charts"
                  className="rounded-xl shadow-2xl border border-white/20"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCt7xJE2FR-tOF5aPHkp11a0kHuZHrQYc1IafhaQlGWkkb0UhVGsN8t0DKsCPQGPqe_Re-5P--5D7DApuIOUs41vIQTauLZs5mLF7m7yyjtlG55iNwh0OS9KQV4kvQAKT7NOYhrAJJ-okR324PsSWXlkSKk1osA5lo7AGHT4DAtprBp8HAoiiplJmFxnIJcywdVfQzCIYp2JlnPi6SmFPwAmeuRmbKl58NET9bA0ulbnDdymiIcDkPAr5_1HpzcJGxdS9yef-KJTg"
                />
              </div>
            </div>

            {/* Collaborative Section */}
            <div className="md:col-span-8 bg-[#00288e] rounded-2xl overflow-hidden shadow-xl flex flex-col md:flex-row">
              <div className="p-8 md:w-1/2 flex flex-col justify-center">
                <h3 className="text-3xl font-bold tracking-tight text-white mb-4">The New Standard for Collaboration.</h3>
                <p className="text-[#a8b8ff] text-sm leading-relaxed">Built for teams of any size, from local field offices to intercontinental research consortiums. PLEXUS synchronizes your work instantly.</p>
              </div>
              <div className="md:w-1/2 relative bg-[#1e40af]/30 min-h-[200px]">
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="material-symbols-outlined text-white/20 text-9xl">groups</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Built for Every Role */}
        <section className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className="mb-16">
              <h2 className="text-4xl font-bold tracking-tight mb-4">Built for every role.</h2>
              <p className="text-[#444653] max-w-xl">Tailored interfaces and permission-sets for every member of the global health ecosystem.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { icon: 'school', label: 'Students', bg: 'bg-[#dde1ff]', text: 'text-[#00288e]', desc: 'Streamlined tools to design protocols and collect field data with ease.' },
                { icon: 'psychology', label: 'Supervisors', bg: 'bg-[#d8e2ff]', text: 'text-[#0058be]', desc: 'Oversee multiple cohorts and provide real-time feedback on progress.' },
                { icon: 'account_balance', label: 'Departments', bg: 'bg-[#d9e3f4]', text: 'text-[#2b3542]', desc: 'Manage resource allocation and ethics compliance across the faculty.' },
                { icon: 'hub', label: 'Institutions', bg: 'bg-[#ffdad6]', text: 'text-[#93000a]', desc: 'Enterprise-grade security, data governance, and long-term registry.' },
              ].map(({ icon, label, bg, text, desc }) => (
                <div key={label} className="p-8 bg-[#edeef0] rounded-xl border border-transparent hover:border-[#00288e]/20 transition-all">
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
                Global Health Operating System
              </span>
              <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-4 font-geist text-white">The Global Research Plexus</h2>
              <p className="text-blue-100 text-lg max-w-2xl mx-auto opacity-80">A unified orchestration layer connecting every stage of the institutional research lifecycle.</p>
            </div>
            <div className="relative">
              <div className="hidden md:block absolute top-1/2 left-0 w-full h-[2px] flow-line -translate-y-1/2" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 shadow-sm group hover:border-white/30 transition-all duration-500 flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-full bg-blue-400/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-blue-200 text-3xl">description</span>
                  </div>
                  <h4 className="text-xl font-bold font-geist tracking-tight mb-2 text-white">Protocol Design</h4>
                  <p className="text-sm text-blue-100 leading-relaxed opacity-80">Integrated ethics submission and methodology validation at the point of creation.</p>
                  <div className="mt-8 flex gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-300 animate-pulse" />
                    <div className="w-2 h-2 rounded-full bg-white/20" />
                    <div className="w-2 h-2 rounded-full bg-white/20" />
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/30 rounded-2xl p-8 shadow-2xl flex flex-col items-center text-center scale-105 z-20">
                  <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mb-6 shadow-lg shadow-blue-900/40">
                    <span className="material-symbols-outlined text-[#1E40AF] text-3xl">insights</span>
                  </div>
                  <h4 className="text-xl font-bold font-geist tracking-tight mb-2 text-white">Real-time Analysis</h4>
                  <p className="text-sm text-blue-100 leading-relaxed">Continuous data cleaning and automated statistical modeling as field data arrives.</p>
                  <div className="mt-8 w-full h-12 flex items-end gap-1 px-4">
                    <div className="flex-1 bg-white/20 rounded-t h-4 animate-bounce" />
                    <div className="flex-1 bg-white/80 rounded-t h-10 animate-bounce [animation-delay:150ms]" />
                    <div className="flex-1 bg-white/40 rounded-t h-6 animate-bounce [animation-delay:300ms]" />
                    <div className="flex-1 bg-white/60 rounded-t h-8 animate-bounce [animation-delay:450ms]" />
                  </div>
                </div>
                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 shadow-sm group hover:border-white/30 transition-all duration-500 flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-full bg-blue-400/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-blue-200 text-3xl">auto_stories</span>
                  </div>
                  <h4 className="text-xl font-bold font-geist tracking-tight mb-2 text-white">Dynamic Publication</h4>
                  <p className="text-sm text-blue-100 leading-relaxed opacity-80">Automated manuscript prep and seamless export to major institutional registries.</p>
                  <div className="mt-8 flex gap-2">
                    <div className="w-2 h-2 rounded-full bg-white/20" />
                    <div className="w-2 h-2 rounded-full bg-white/20" />
                    <div className="w-2 h-2 rounded-full bg-blue-300 animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-16 text-center">
              <Link
                href="/register"
                className="inline-flex items-center gap-3 px-8 py-4 bg-white text-[#1E40AF] font-bold rounded-xl hover:bg-blue-50 transition-all group shadow-xl shadow-blue-900/20"
              >
                Explore More
                <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-32 bg-[#f8f9fb] relative overflow-hidden">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <h2 className="text-5xl font-bold tracking-tight mb-8">Ready to transform your research ecosystem?</h2>
            <p className="text-xl text-[#444653] mb-12">Join over 150+ global institutions already using PLEXUS to accelerate health outcomes.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <Link
                href="/register"
                className="px-10 py-5 bg-[#00288e] text-white font-bold rounded-xl shadow-xl hover:shadow-2xl hover:scale-105 transition-all font-geist"
              >
                Get Started for Free
              </Link>
              <a href="mailto:team@plexusresearch.io" className="text-[#00288e] font-bold hover:underline font-geist">
                Contact our Institutional Team
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
              © 2026 PLEXUS Research. All rights reserved. Global Health Data Registry.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-8">
            {['Privacy Policy', 'Terms of Service', 'Compliance', 'Ethics Board', 'Contact Support'].map(link => (
              <a key={link} className="text-slate-500 hover:text-slate-900 text-sm hover:underline transition-all opacity-80 hover:opacity-100" href="#">
                {link}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
