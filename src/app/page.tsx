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
              href="/login?mode=signup"
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
                href="/login?mode=signup"
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
              <div className="mt-8 flex-grow bg-[#f3f4f6] relative overflow-hidden mx-8 rounded-t-xl border-x border-t border-[#c4c5d5]/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt="Dashboard Preview"
                  className="w-full h-full object-cover object-top opacity-90 group-hover:scale-105 transition-transform duration-700"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCg6YiJKa6pgHJreS9p1iDedEgQow_kzKAc1yDFgoDV9Vyj5AjI6LNIYwJWN2YADdIbQFbE2moBuDa2--Jzp-1Zu_yduxG00Np1S9i2UphzrowCYMm1GEkS2nPpTN9z8TUkKDrIzI0QkGRK4qd0KPmqhiAo87IQl4GFViJQqSN-Sv00UqS6xSualy8ogKRxuUn7x0f1-URIeeBom_Y758rCLOyas0O_acFuYU7Wj86mEabeIaOAvorbmfMDN_7NC5KuWIbK9br-CA"
                />
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
                <p className="text-[#a8b8ff] text-sm leading-relaxed mb-6">Built for teams of any size, from local field offices to intercontinental research consortiums. PLEXUS synchronizes your work instantly.</p>
                <div className="flex -space-x-3">
                  {[
                    'https://lh3.googleusercontent.com/aida-public/AB6AXuAGT6l0PuXZ0sjN6dGdXCHaPmUWNbo2NbE3jPS12ZOsWR5s23cnA-qDs9bZMrFfzxtOBxEDBWWnonobL16cbgEGrTy_omZOABOuMDZ8OgAtwdwzdsnOUkbrMfut1BzloG3h8mMe8jg3qchJ5qUm-BZXu1c9Z81R-v0zA0hvHqrtb7j8N72KlwWGvjmrxs3A8qNa8cbaWWPNoUIz2vtA2QMXOjBoqslnwb3IiN9nkoUxNwF5dEEr1l_j1P8Rn9V2xD6PYWY-tMZUEQ',
                    'https://lh3.googleusercontent.com/aida-public/AB6AXuAKfA2x1i5MewmYOo3a8ExVlymCH9a9dJsKM5DKwqNI81moNpZjSkONTwRhYdM1i5SSiyh37g1uZwx1-Lcvsu7SSwXdJMFeYBs9qIOLLd2sK4HftP2NuQzq0A9vkR5sYX0scxhKBUPCua2mL5PpbzU7tpamC7CqDS1--spFTlWPafk0IGx1eP02HNNxXR29_QgMS7aNY1hSPg9Ta9QoL4mwWCBG2aUabTkPyLjbmQsW6-3YERKClDeLVXZSZRfDGNhxuKayNCU41w',
                    'https://lh3.googleusercontent.com/aida-public/AB6AXuABoc_GnyBhKOG9bIelA_FWjCApR0KvTs7tR0Nk9QSGm5UjEUvAutPdAfXSiLqGP-oDTtiqyHSNCZvlTxuMWy7Mw8rNsfFwjWcCxfn6_GTVqSU7vI76rfQR9QWjdozXN8GCvMlVNLa7LCLqRXO5S9_npGHg-UFn5Qt7W5mvw5vjLxp2y_LBT9MjoOOrOmdwtlTUevM3_kmKMceAQ2JPSoORRz0vh_tPa4xQoAWJys86ez7t-EPoXt3-LYlv6s1Jlew3mARDViZRJQ',
                  ].map((src, i) => (
                    <div key={i} className="w-10 h-10 rounded-full border-2 border-[#00288e] bg-slate-200 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img alt="Team member" src={src} />
                    </div>
                  ))}
                  <div className="w-10 h-10 rounded-full border-2 border-[#00288e] bg-[#e7e8ea] flex items-center justify-center text-[10px] font-bold text-[#00288e]">
                    +12
                  </div>
                </div>
              </div>
              <div className="md:w-1/2 relative bg-[#1e40af]/30 min-h-[200px]">
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="material-symbols-outlined text-white/20 text-9xl">groups</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Social Proof Logos */}
        <section className="py-12 bg-[#f3f4f6] border-y border-[#c4c5d5]/10">
          <div className="max-w-7xl mx-auto px-6">
            <p className="text-center text-[10px] font-bold uppercase tracking-widest text-[#444653] mb-10">Supporting World-Class Institutions</p>
            <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-40 grayscale hover:grayscale-0 transition-all duration-500">
              <span className="font-serif text-2xl font-bold tracking-tighter">WHO</span>
              <span className="font-headline text-xl font-extrabold">MinHealth</span>
              <span className="font-serif text-2xl italic">Oxford Research</span>
              <span className="font-headline text-xl font-black">UNICEF</span>
              <span className="font-serif text-2xl font-bold">CDC</span>
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
                Clinical Operating System
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
                href="/login?mode=signup"
                className="inline-flex items-center gap-3 px-8 py-4 bg-white text-[#1E40AF] font-bold rounded-xl hover:bg-blue-50 transition-all group shadow-xl shadow-blue-900/20"
              >
                Explore the Clinical OS
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
                href="/login?mode=signup"
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
