"use client"

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#18181B] text-[#E4E4E7] p-6 text-center">
      <div className="text-5xl mb-4">📡</div>
      <h1 className="text-2xl font-semibold mb-2">You&apos;re offline</h1>
      <p className="text-[#A1A1AA] max-w-sm leading-relaxed">
        PLEXUS can&apos;t reach the server right now. Your recent data has been cached and changes will sync automatically when you&apos;re back online.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-8 px-6 py-2.5 bg-[#1B3A5C] border border-[#2563EB] rounded-lg text-white text-sm hover:bg-[#2563EB] transition-colors"
      >
        Try again
      </button>
    </div>
  )
}
