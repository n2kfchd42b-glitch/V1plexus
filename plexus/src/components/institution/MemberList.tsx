import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { SYSTEM_ROLES } from '@/lib/constants'
import { getInitials } from '@/lib/utils'
import type { ProfileWithRoles } from '@/types/app'

interface MemberListProps {
  members: ProfileWithRoles[]
}

export function MemberList({ members }: MemberListProps) {
  return (
    <div className="space-y-2">
      {members.map((member) => (
        <div
          key={member.id}
          className="flex items-center gap-3 p-3 rounded-md border border-[#E2E8F0] bg-white"
        >
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={member.avatar_url ?? undefined} />
            <AvatarFallback>{getInitials(member.full_name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#1A202C] truncate">{member.full_name}</p>
            <p className="text-xs text-[#718096] truncate">{member.email}</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {member.roles?.map((role) => {
              const roleLabel = SYSTEM_ROLES.find((r) => r.value === role.role)?.label ?? role.role
              return (
                <Badge key={role.id} variant="secondary" className="text-xs">
                  {roleLabel}
                </Badge>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
