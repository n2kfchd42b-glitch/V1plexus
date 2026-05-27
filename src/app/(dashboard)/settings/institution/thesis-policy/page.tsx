import { permanentRedirect } from 'next/navigation'

// Moved to /institution/policy as part of the dedicated institution admin section.
// Kept as a deprecation redirect for any bookmarks or external links.
export default function ThesisPolicyRedirect() {
  permanentRedirect('/institution/policy')
}
