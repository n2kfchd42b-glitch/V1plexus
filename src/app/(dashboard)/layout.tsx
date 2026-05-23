import { WorkspaceProvider } from '@/components/workspace/WorkspaceProvider'
import { DashboardShell } from './DashboardShell'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <DashboardShell>{children}</DashboardShell>
    </WorkspaceProvider>
  )
}
