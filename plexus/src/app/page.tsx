import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#1B3A5C] flex flex-col">
      <header className="px-8 py-6 flex items-center justify-between">
        <div className="text-white font-bold text-2xl tracking-tight">PLEXUS</div>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-blue-200 hover:text-white text-sm transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="bg-white text-[#1B3A5C] px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-50 transition-colors"
          >
            Get started
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-8">
        <div className="max-w-3xl text-center">
          <div className="inline-block bg-blue-500/20 text-blue-200 text-sm px-3 py-1 rounded-full mb-6">
            Research Lab Platform — Phase 1
          </div>
          <h1 className="text-5xl font-bold text-white mb-6 leading-tight">
            Research coordination for global health institutions
          </h1>
          <p className="text-xl text-blue-200 mb-10 leading-relaxed">
            PLEXUS brings together graduate students, supervisors, and principal investigators
            to manage the full lifecycle of research projects — from concept to publication.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/register"
              className="bg-white text-[#1B3A5C] px-8 py-3 rounded-md font-semibold hover:bg-blue-50 transition-colors"
            >
              Start your research
            </Link>
            <Link
              href="/login"
              className="border border-blue-400 text-white px-8 py-3 rounded-md font-semibold hover:bg-white/10 transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </main>

      <footer className="px-8 py-6 text-center text-blue-300 text-sm">
        © {new Date().getFullYear()} PLEXUS Research Lab
      </footer>
    </div>
  )
}
