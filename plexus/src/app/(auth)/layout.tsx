export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-md bg-[#1B3A5C] flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <span className="font-bold text-xl text-[#1B3A5C]">PLEXUS</span>
          </div>
          <p className="text-sm text-[#718096]">Research Lab Platform</p>
        </div>
        {children}
      </div>
    </div>
  )
}
