"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { ThesisCommitteeRole } from "@/types/database";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface CommitteeInviteModalProps {
  projectId: string;
  onClose: () => void;
  onInvited?: () => void;
}

const ROLES: { value: ThesisCommitteeRole; label: string }[] = [
  { value: "chair",             label: "Chair" },
  { value: "co_chair",          label: "Co-Chair" },
  { value: "member",            label: "Member" },
  { value: "external_examiner", label: "External Examiner" },
  { value: "advisor",           label: "Advisor" },
];

export function CommitteeInviteModal({ projectId, onClose, onInvited }: CommitteeInviteModalProps) {
  const { user } = useAuth();
  const [memberType, setMemberType] = useState<"internal" | "external">("internal");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [role, setRole] = useState<ThesisCommitteeRole>("member");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const supabase = createClient();

      let userId: string | null = null;
      if (memberType === "internal") {
        // Look up PLEXUS user by email
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", email.trim().toLowerCase())
          .maybeSingle();
        if (!profile) {
          toast.error("No PLEXUS account found for that email address.");
          setSaving(false);
          return;
        }
        userId = profile.id;
      }

      const { error } = await supabase.from("thesis_committees").insert({
        project_id: projectId,
        user_id: userId,
        external_name: memberType === "external" ? name.trim() : null,
        external_email: memberType === "external" ? email.trim().toLowerCase() : null,
        external_institution: memberType === "external" && institution.trim() ? institution.trim() : null,
        role,
        status: "invited",
        invited_by: user.id,
      });

      if (error) throw new Error(error.message);

      toast.success("Committee member invited.");
      onInvited?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="rounded-lg shadow-xl w-full max-w-md mx-4" style={{ background: "var(--bg-surface)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border-default)" }}>
          <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Invite Committee Member</h2>
          <button onClick={onClose} style={{ color: "var(--text-tertiary)" }} className="hover:opacity-70">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Member type toggle */}
          <div className="flex gap-2">
            {(["internal", "external"] as const).map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setMemberType(type)}
                className="flex-1 py-2 text-sm font-medium rounded border transition-colors"
                style={memberType === type
                  ? { background: "var(--accent-blue)", color: "#fff", borderColor: "var(--accent-blue)" }
                  : { background: "var(--bg-surface)", color: "var(--text-secondary)", borderColor: "var(--border-default)" }
                }
              >
                {type === "internal" ? "PLEXUS User" : "External Member"}
              </button>
            ))}
          </div>

          {memberType === "external" && (
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Full Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Dr. Jane Smith"
                className="w-full text-sm rounded px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/20"
                style={{ border: "1px solid var(--border-default)", background: "var(--bg-app)", color: "var(--text-primary)" }}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              {memberType === "internal" ? "Email Address *" : "Institutional Email *"}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="example@university.edu"
              className="w-full text-sm rounded px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/20"
              style={{ border: "1px solid var(--border-default)", background: "var(--bg-app)", color: "var(--text-primary)" }}
            />
          </div>

          {memberType === "external" && (
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Institution</label>
              <input
                type="text"
                value={institution}
                onChange={e => setInstitution(e.target.value)}
                placeholder="University or organisation"
                className="w-full text-sm rounded px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/20"
                style={{ border: "1px solid var(--border-default)", background: "var(--bg-app)", color: "var(--text-primary)" }}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Role *</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value as ThesisCommitteeRole)}
              className="w-full text-sm rounded px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/20"
              style={{ border: "1px solid var(--border-default)", background: "var(--bg-app)", color: "var(--text-primary)" }}
            >
              {ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {memberType === "external" && (
            <p className="text-xs rounded px-3 py-2" style={{ background: "var(--accent-blue-subtle)", color: "var(--accent-blue)", border: "1px solid var(--border-status-info)" }}>
              External members can be given a guest access link to view and comment on thesis documents without a PLEXUS account.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded"
              style={{ border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm rounded text-white disabled:opacity-50"
              style={{ background: "var(--accent-blue)" }}
            >
              {saving ? "Inviting..." : "Send Invitation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
