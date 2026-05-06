import { AuthBrandPanel } from '@/components/auth/AuthBrandPanel'
import { LanguageSelector } from '@/components/i18n/LanguageSelector'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Left: Brand panel — hidden on mobile */}
      <div className="hidden lg:block flex-1 min-h-screen">
        <AuthBrandPanel />
      </div>

      {/* Right: Form panel */}
      <div className="w-full lg:w-[440px] flex-shrink-0 bg-white flex flex-col shadow-[-20px_0_60px_rgba(0,0,0,0.25)]">
        {/* Language bar — top right */}
        <div className="flex justify-end px-6 pt-4">
          <LanguageSelector compact />
        </div>

        {/* Form content — vertically centred in the remaining space */}
        <div className="flex-1 flex items-center justify-center px-8 pb-8">
          <div className="w-full max-w-sm">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
