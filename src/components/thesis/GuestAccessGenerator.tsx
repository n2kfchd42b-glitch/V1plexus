"use client";

import { useState } from "react";
import { Link2, Clock } from "lucide-react";
import type { ThesisCommittee } from "@/types/database";
import { UnfinishedFeatureBanner } from "./UnfinishedFeatureBanner";

interface GuestAccessGeneratorProps {
  member: ThesisCommittee;
  projectId: string;
}

export function GuestAccessGenerator({ member }: GuestAccessGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [expiryDays, setExpiryDays] = useState(30);

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
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">Guest Access Link</h3>
            <p className="text-xs text-gray-500">
              Generate a time-limited link for <strong>{displayName}</strong> to view and comment on thesis documents without a PLEXUS account.
            </p>

            <UnfinishedFeatureBanner feature="Guest access token generation" />

            <div>
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

            <button
              type="button"
              disabled
              title="Backend not yet connected"
              className="w-full py-2 text-sm bg-blue-600 text-white rounded opacity-50 cursor-not-allowed"
            >
              Generate Link
            </button>

            <div className="flex justify-end">
              <button
                onClick={() => setOpen(false)}
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
