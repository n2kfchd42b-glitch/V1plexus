import { permanentRedirect } from 'next/navigation'

// Moved to /institution/link-requests as part of the dedicated institution admin section.
export default function LinkRequestsRedirect() {
  permanentRedirect('/institution/link-requests')
}
