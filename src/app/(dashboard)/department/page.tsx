import { permanentRedirect } from 'next/navigation'

// Department overview moved under the institution admin section.
// Sidebar link now points at /institution/departments; this redirect handles
// stale bookmarks or in-flight links from older client bundles.
export default function DepartmentRedirect() {
  permanentRedirect('/institution/departments')
}
