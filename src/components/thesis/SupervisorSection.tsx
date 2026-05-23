"use client";

import { useState } from "react";
import { User, Pencil, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface SupervisorSectionProps {
  projectId: string;
  metaId: string;
  supervisorId: string | null;
  supervisorName: string | null;
  supervisorEmail: string | null;
  canEdit?: boolean;
}

export function SupervisorSection({
  metaId,
  supervisorId: initialSupervisorId,
  supervisorName: initialName,
  supervisorEmail: initialEmail,
  canEdit,
}: SupervisorSectionProps) {
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState(initialEmail ?? "");
  const [supervisorName, setSupervisorName] = useState(initialName);
  const [saving, setSaving] = useState(false);

  const hasSupervisor = !!initialSupervisorId;

  async function handleSave() {
    if (!email.trim()) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();

      if (!profile) {
        toast.error("No PLEXUS account found for that email address.");
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from("thesis_metadata")
        .update({ supervisor_id: profile.id })
        .eq("id", metaId);

      if (error) throw new Error(error.message);

      setSupervisorName(profile.full_name);
      setEditing(false);
      toast.success("Supervisor updated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("thesis_metadata")
        .update({ supervisor_id: null })
        .eq("id", metaId);
      if (error) throw new Error(error.message);
      setSupervisorName(null);
      setEmail("");
      setEditing(false);
      toast.success("Supervisor removed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="rounded-lg border px-4 py-3 mb-5 flex items-center gap-3"
      style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}
    >
      <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--bg-surface-active)" }}>
        <User className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium mb-0.5" style={{ color: "var(--text-tertiary)" }}>Supervisor</p>
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSave()}
              placeholder="supervisor@university.edu"
              className="text-sm rounded px-2 py-1 outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/20 flex-1"
              style={{ border: "1px solid var(--border-default)", background: "var(--bg-app)", color: "var(--text-primary)" }}
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="p-1.5 rounded disabled:opacity-50"
              style={{ color: "var(--accent-blue)" }}
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={() => setEditing(false)}
              className="p-1.5 rounded"
              style={{ color: "var(--text-tertiary)" }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : supervisorName ? (
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{supervisorName}</p>
        ) : (
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>No supervisor linked</p>
        )}
      </div>

      {canEdit && !editing && (
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-xs font-medium"
            style={{ color: "var(--accent-blue)" }}
          >
            <Pencil className="h-3 w-3" />
            {hasSupervisor || supervisorName ? "Change" : "Add"}
          </button>
          {(hasSupervisor || supervisorName) && (
            <button
              onClick={handleRemove}
              disabled={saving}
              className="text-xs font-medium disabled:opacity-50"
              style={{ color: "var(--status-error-text)" }}
            >
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}
