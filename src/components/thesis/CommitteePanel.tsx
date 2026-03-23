"use client";

import { useState } from "react";
import { Users, UserCheck, UserX, Mail, Bell, Plus } from "lucide-react";
import { ThesisCommittee, CommitteeRole } from "@/lib/types/thesis";
import { CommitteeInviteModal } from "./CommitteeInviteModal";
import { GuestAccessGenerator } from "./GuestAccessGenerator";
import { cn } from "@/lib/utils";

interface CommitteePanelProps {
  projectId: string;
  members: ThesisCommittee[];
  canEdit?: boolean;
}

const ROLE_LABELS: Record<CommitteeRole, string> = {
  chair:             "Chair",
  co_chair:          "Co-Chair",
  member:            "Member",
  external_examiner: "External Examiner",
  advisor:           "Advisor",
};

const STATUS_CONFIG = {
  confirmed: { label: "Confirmed", icon: UserCheck, color: "text-green-600 bg-green-50 border-green-200" },
  invited:   { label: "Invited",   icon: Mail,      color: "text-amber-600 bg-amber-50 border-amber-200" },
  declined:  { label: "Declined",  icon: UserX,     color: "text-red-600 bg-red-50 border-red-200" },
  removed:   { label: "Removed",   icon: UserX,     color: "text-gray-500 bg-gray-50 border-gray-200" },
};

export function CommitteePanel({ projectId, members: initialMembers, canEdit }: CommitteePanelProps) {
  const [members, setMembers] = useState(initialMembers);
  const [showInvite, setShowInvite] = useState(false);

  const activeMembers = members.filter(m => m.status !== "removed");

  function handleResendInvite(id: string) {
    // TODO: trigger email resend API
    console.log("Resend invite for:", id);
  }

  return (
    <div className="space-y-6">
      {/* Members list */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-400" />
            Committee Members
          </h3>
          {canEdit && (
            <button
              onClick={() => setShowInvite(true)}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus className="h-4 w-4" />
              Invite Member
            </button>
          )}
        </div>

        {activeMembers.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Users className="h-8 w-8 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No committee members yet.</p>
            {canEdit && (
              <button
                onClick={() => setShowInvite(true)}
                className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Invite the first member
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {activeMembers.map(member => {
              const statusCfg = STATUS_CONFIG[member.status] ?? STATUS_CONFIG.invited;
              const StatusIcon = statusCfg.icon;
              const displayName = member.external_name ?? member.profile?.full_name ?? "Unknown";
              const displayEmail = member.external_email ?? member.profile?.email ?? "";
              const isExternal = !member.user_id;

              return (
                <div key={member.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Avatar */}
                      <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                        <span className="text-sm font-semibold text-gray-500">
                          {(displayName || "?")[0].toUpperCase()}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900">{displayName}</span>
                          <span className="text-xs text-gray-500">{ROLE_LABELS[member.role]}</span>
                          {isExternal && (
                            <span className="text-xs text-purple-600 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded">
                              External
                            </span>
                          )}
                        </div>
                        {member.external_institution && (
                          <p className="text-xs text-gray-400 mt-0.5">{member.external_institution}</p>
                        )}
                        {displayEmail && (
                          <p className="text-xs text-gray-400">{displayEmail}</p>
                        )}
                      </div>
                    </div>

                    {/* Status + Actions */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border", statusCfg.color)}>
                        <StatusIcon className="h-3 w-3" />
                        {statusCfg.label}
                      </span>
                      <div className="flex items-center gap-2">
                        {member.status === "invited" && canEdit && (
                          <button
                            onClick={() => handleResendInvite(member.id)}
                            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                          >
                            <Bell className="h-3 w-3" />
                            Resend
                          </button>
                        )}
                        {isExternal && canEdit && (
                          <GuestAccessGenerator member={member} projectId={projectId} />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Activity feed */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 text-sm">Committee Activity</h3>
        </div>
        <div className="px-5 py-4">
          {members.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No activity yet.</p>
          ) : (
            <div className="space-y-2">
              {/* Derived activity from members */}
              {[...members]
                .sort((a, b) => new Date(b.invited_at).getTime() - new Date(a.invited_at).getTime())
                .slice(0, 5)
                .map(m => (
                  <div key={m.id} className="flex items-start gap-2 text-xs text-gray-600">
                    <span className="text-gray-300 shrink-0 mt-0.5">•</span>
                    <span>
                      {m.external_name ?? m.profile?.full_name ?? "Member"}{" "}
                      {m.status === "confirmed" ? "confirmed as" : "invited as"}{" "}
                      {ROLE_LABELS[m.role].toLowerCase()}
                      {" — "}
                      <span className="text-gray-400">
                        {new Date(m.confirmed_at ?? m.invited_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {showInvite && (
        <CommitteeInviteModal
          projectId={projectId}
          onClose={() => setShowInvite(false)}
          onInvited={() => {
            setShowInvite(false);
            // TODO: refresh members from Supabase
          }}
        />
      )}
    </div>
  );
}
