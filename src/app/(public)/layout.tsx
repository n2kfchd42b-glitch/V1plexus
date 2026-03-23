// Public routes — no authentication required
// These pages are accessible without login for public protocol registry
// and dataset landing pages.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
