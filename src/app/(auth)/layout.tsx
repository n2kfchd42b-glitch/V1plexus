import { GlobeClientWrapper } from '@/components/auth/GlobeClientWrapper'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left: Globe panel — hidden on mobile, client-only render */}
      <div className="hidden lg:flex flex-col flex-1 relative bg-[#060d1c] min-h-screen">
        <GlobeClientWrapper />
      </div>

      {/* Right: Form panel */}
      <div className="w-full lg:w-[440px] flex-shrink-0 bg-white flex flex-col items-center justify-center p-8 shadow-[-20px_0_60px_rgba(0,0,0,0.25)]">
        <div className="w-full max-w-sm">
          {children}
        </div>
      </div>
    </div>
  )
}
