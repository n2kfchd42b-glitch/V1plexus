import { redirect } from 'next/navigation'

// Institution-level audit is not yet deployed.
// Redirect individual users to their personal activity trail.
export default function Page() { redirect('/audit') }
