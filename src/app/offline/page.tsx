"use client"

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg-sidebar text-text-inverse p-6 text-center">
      <div className="text-5xl mb-4">📡</div>
      <h1 className="text-2xl font-semibold font-headline mb-2">You&apos;re offline</h1>
      <p className="text-text-tertiary max-w-sm leading-relaxed">
        PLEXUS can&apos;t reach the server right now. Your recent data has been cached and changes will sync automatically when you&apos;re back online.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-8 px-6 py-2.5 bg-accent-primary border border-accent-blue rounded-lg text-white text-sm hover:bg-accent-blue transition-colors"
      >
        Try again
      </button>
    </div>
  )
}
