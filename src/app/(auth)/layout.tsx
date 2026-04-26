import { AuthBrandPanel } from '@/components/auth/AuthBrandPanel'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left: Brand panel — static, no JS bundle cost, hidden on mobile */}
      <div className="hidden lg:block flex-1 min-h-screen">
        <AuthBrandPanel />
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
