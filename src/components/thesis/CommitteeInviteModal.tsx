"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { CommitteeRole } from "@/lib/types/thesis";

interface CommitteeInviteModalProps {
  projectId: string;
  onClose: () => void;
  onInvited?: () => void;
}

const ROLES: { value: CommitteeRole; label: string }[] = [
  { value: "chair",             label: "Chair" },
  { value: "co_chair",          label: "Co-Chair" },
  { value: "member",            label: "Member" },
  { value: "external_examiner", label: "External Examiner" },
  { value: "advisor",           label: "Advisor" },
];

export function CommitteeInviteModal({ onClose, onInvited }: CommitteeInviteModalProps) {
  const [memberType, setMemberType] = useState<"internal" | "external">("internal");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [role, setRole] = useState<CommitteeRole>("member");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    // TODO: insert into thesis_committees via Supabase
    await new Promise(r => setTimeout(r, 500)); // placeholder delay
    setSaving(false);
    onInvited?.();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-900">Invite Committee Member</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Member type toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMemberType("internal")}
              className={`flex-1 py-2 text-sm font-medium rounded border transition-colors ${
                memberType === "internal"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
              }`}
            >
              PLEXUS User
            </button>
            <button
              type="button"
              onClick={() => setMemberType("external")}
              className={`flex-1 py-2 text-sm font-medium rounded border transition-colors ${
                memberType === "external"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
              }`}
            >
              External Member
            </button>
          </div>

          {memberType === "external" && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Dr. Jane Smith"
                className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {memberType === "internal" ? "Email Address *" : "Institutional Email *"}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="example@university.edu"
              className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {memberType === "external" && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Institution</label>
              <input
                type="text"
                value={institution}
                onChange={e => setInstitution(e.target.value)}
                placeholder="London School of Hygiene & Tropical Medicine"
                className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Role *</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value as CommitteeRole)}
              className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {memberType === "external" && (
            <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded px-3 py-2">
              An invitation email with a guest access link will be sent. External members can view and comment on assigned chapters without creating a PLEXUS account.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Inviting..." : "Send Invitation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
