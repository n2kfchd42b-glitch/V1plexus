"use client";

import { useState } from "react";
import { Link2, Copy, Check, Clock } from "lucide-react";
import type { ThesisCommittee } from "@/types/database";

interface GuestAccessGeneratorProps {
  member: ThesisCommittee;
  projectId: string;
}

export function GuestAccessGenerator({ member }: GuestAccessGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [expiryDays, setExpiryDays] = useState(30);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    // TODO: call API to insert guest_access_tokens and return link
    await new Promise(r => setTimeout(r, 600));
    const mockToken = `plexus_guest_${Math.random().toString(36).slice(2, 18)}`;
    setGeneratedLink(`${window.location.origin}/guest/${mockToken}`);
    setLoading(false);
  }

  async function handleCopy() {
    if (!generatedLink) return;
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const displayName = member.external_name ?? member.profile?.full_name ?? member.external_email ?? "Member";

  return (
    <div className="inline-block">
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
      >
        <Link2 className="h-3 w-3" />
        Generate Guest Link
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-5">
            <h3 className="font-semibold text-gray-900 mb-1">Guest Access Link</h3>
            <p className="text-xs text-gray-500 mb-4">
              Generate a time-limited link for <strong>{displayName}</strong> to view and comment on thesis documents without a PLEXUS account.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <Clock className="inline h-3 w-3 mr-1" />
                Link expires in
              </label>
              <select
                value={expiryDays}
                onChange={e => setExpiryDays(Number(e.target.value))}
                className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>

            {generatedLink ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded px-3 py-2">
                  <span className="flex-1 text-xs text-gray-700 truncate font-mono">{generatedLink}</span>
                  <button onClick={handleCopy} className="text-gray-400 hover:text-gray-600 shrink-0">
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-green-600">
                  Link generated. Expires in {expiryDays} days.
                </p>
              </div>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Generating..." : "Generate Link"}
              </button>
            )}

            <div className="flex justify-end mt-4">
              <button
                onClick={() => { setOpen(false); setGeneratedLink(null); }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
