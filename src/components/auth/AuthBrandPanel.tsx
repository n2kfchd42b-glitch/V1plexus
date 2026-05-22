import Link from 'next/link'
import Image from 'next/image'

const FEATURES = [
  {
    icon: 'save',
    title: 'Every step, automatically saved',
    desc: 'From data import to final results, nothing gets lost or forgotten.',
  },
  {
    icon: 'insights',
    title: 'Run the right analysis',
    desc: 'We guide you to the right method and run it — no statistics degree required.',
  },
  {
    icon: 'group',
    title: 'Work with your supervisor',
    desc: 'Share results, get feedback, and move forward — together, in one place.',
  },
]

export function AuthBrandPanel() {
  return (
    <div className="relative h-full w-full bg-[#060d1c] flex flex-col overflow-hidden select-none">

      {/* Background gradient — no GPU blur filters */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 33%, rgba(0,61,155,0.25) 0%, transparent 100%)' }}
      />

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Logo */}
      <div className="relative z-10 p-8">
        <Link href="/">
          <Image
            src="/logo.jpg"
            alt="Plexus Research Lab"
            width={160}
            height={160}
            className="object-contain"
            priority
          />
        </Link>
      </div>

      {/* Main copy */}
      <div className="relative z-10 flex-1 flex flex-col justify-center px-10 pb-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40 mb-5">
          Built for researchers, everywhere
        </p>
        <h2 className="font-serif text-4xl xl:text-5xl leading-[1.08] text-white mb-6">
          From data to<br />manuscript —<br />
          <span className="text-[#93c5fd]">without the chaos.</span>
        </h2>
        <p className="text-white/50 text-sm leading-relaxed max-w-xs mb-10">
          Run analysis, write up your findings, and export everything — all in one place.
        </p>

        {/* Feature list */}
        <div className="flex flex-col gap-5">
          {FEATURES.map(({ icon, title, desc }) => (
            <div key={icon} className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5 h-7 w-7 rounded-lg bg-white/6 border border-white/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-[#93c5fd] text-[14px]">{icon}</span>
              </div>
              <div>
                <p className="text-white/80 text-sm font-medium leading-snug">{title}</p>
                <p className="text-white/35 text-xs leading-relaxed mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom link */}
      <div className="relative z-10 px-10 pb-8">
        <div className="pt-6 border-t border-white/8">
          <Link href="/" className="text-white/40 hover:text-white/60 transition-colors text-xs underline underline-offset-2">
            Learn more about PLEXUS →
          </Link>
        </div>
      </div>
    </div>
  )
}
