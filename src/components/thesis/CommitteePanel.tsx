"use client";

import { useState, useCallback } from "react";
import { Users, UserCheck, UserX, Mail, Plus } from "lucide-react";
import type { ThesisCommittee, ThesisCommitteeRole, ThesisCommitteeStatus } from "@/types/database";
import { CommitteeInviteModal } from "./CommitteeInviteModal";
import { GuestAccessGenerator } from "./GuestAccessGenerator";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface CommitteePanelProps {
  projectId: string;
  members: ThesisCommittee[];
  canEdit?: boolean;
}

const ROLE_LABELS: Record<ThesisCommitteeRole, string> = {
  chair:             "Chair",
  co_chair:          "Co-Chair",
  member:            "Member",
  external_examiner: "External Examiner",
  advisor:           "Advisor",
};

const STATUS_CONFIG: Record<ThesisCommitteeStatus, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  confirmed: { label: "Confirmed", icon: UserCheck, color: "text-green-600 bg-green-50 border-green-200" },
  invited:   { label: "Invited",   icon: Mail,      color: "text-amber-600 bg-amber-50 border-amber-200" },
  declined:  { label: "Declined",  icon: UserX,     color: "text-red-600 bg-red-50 border-red-200" },
  removed:   { label: "Removed",   icon: UserX,     color: "text-[var(--text-tertiary)] bg-[var(--bg-surface-active)] border-[var(--border-default)]" },
};

export function CommitteePanel({ projectId, members: initialMembers, canEdit }: CommitteePanelProps) {
  const [members, setMembers] = useState(initialMembers);
  const [showInvite, setShowInvite] = useState(false);

  const activeMembers = members.filter(m => m.status !== "removed");

  const refreshMembers = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("thesis_committees")
      .select("*")
      .eq("project_id", projectId)
      .neq("status", "removed")
      .order("created_at", { ascending: true });
    if (data) setMembers(data as ThesisCommittee[]);
  }, [projectId]);

  return (
    <div className="space-y-6">
      {/* Members list */}
      <div className="rounded-lg border overflow-hidden" style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border-subtle)" }}>
          <h3 className="font-semibold text-sm flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Users className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
            Committee Members
          </h3>
          {canEdit && (
            <button
              onClick={() => setShowInvite(true)}
              className="flex items-center gap-1.5 text-sm font-medium"
              style={{ color: "var(--accent-blue)" }}
            >
              <Plus className="h-4 w-4" />
              Invite Member
            </button>
          )}
        </div>

        {activeMembers.length === 0 ? (
          <div className="text-center py-12" style={{ color: "var(--text-secondary)" }}>
            <Users className="h-8 w-8 mx-auto mb-3" style={{ color: "var(--text-tertiary)" }} />
            <p className="text-sm">No committee members yet.</p>
            {canEdit && (
              <button
                onClick={() => setShowInvite(true)}
                className="mt-3 text-sm font-medium"
                style={{ color: "var(--accent-blue)" }}
              >
                Invite the first member
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
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
                      <div className="h-9 w-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--bg-surface-active)" }}>
                        <span className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                          {(displayName || "?")[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{displayName}</span>
                          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{ROLE_LABELS[member.role]}</span>
                          {isExternal && (
                            <span className="text-xs text-purple-600 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded">
                              External
                            </span>
                          )}
                        </div>
                        {member.external_institution && (
                          <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>{member.external_institution}</p>
                        )}
                        {displayEmail && (
                          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{displayEmail}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border", statusCfg.color)}>
                        <StatusIcon className="h-3 w-3" />
                        {statusCfg.label}
                      </span>
                      {isExternal && canEdit && (
                        <GuestAccessGenerator member={member} projectId={projectId} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Activity feed */}
      <div className="rounded-lg border overflow-hidden" style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border-subtle)" }}>
          <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Committee Activity</h3>
        </div>
        <div className="px-5 py-4">
          {members.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: "var(--text-tertiary)" }}>No activity yet.</p>
          ) : (
            <div className="space-y-2">
              {[...members]
                .sort((a, b) => new Date(b.invited_at).getTime() - new Date(a.invited_at).getTime())
                .slice(0, 5)
                .map(m => (
                  <div key={m.id} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <span className="shrink-0 mt-0.5" style={{ color: "var(--text-tertiary)" }}>•</span>
                    <span>
                      {m.external_name ?? m.profile?.full_name ?? "Member"}{" "}
                      {m.status === "confirmed" ? "confirmed as" : "invited as"}{" "}
                      {ROLE_LABELS[m.role].toLowerCase()}
                      {" — "}
                      <span style={{ color: "var(--text-tertiary)" }}>
                        {new Date(m.confirmed_at ?? m.invited_at).toLocaleDateString("en-GB", {
                          day: "numeric", month: "short", year: "numeric",
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
          onInvited={async () => {
            setShowInvite(false);
            await refreshMembers();
          }}
        />
      )}
    </div>
  );
}
