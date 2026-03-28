"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft } from "lucide-react";
import { logAudit } from "@/lib/audit";

export default function NewProjectPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"active" | "on_hold">("active");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    const { data, error } = await supabase
      .from("projects")
      .insert({
        title,
        description: description || null,
        owner_id: user.id,
        status,
        start_date: startDate || null,
        end_date: endDate || null,
      })
      .select()
      .single();
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      logAudit('create', 'project', data.id, { title, status }, data.id)
      router.push(`/projects/${data.id}/overview`);
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-xl mx-auto">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to projects
      </Link>

      <h1 className="text-2xl font-bold text-slate-900 font-headline mb-6">New project</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-[0_4px_30px_rgba(0,24,72,0.04)] p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Project title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clinical-blue"
            placeholder="e.g. Malaria Prevention Study"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clinical-blue"
            placeholder="Brief description of the project…"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Status
          </label>
          <div className="relative">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "active" | "on_hold")}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-8 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-clinical-blue bg-white"
          >
            <option value="active">Active</option>
            <option value="on_hold">On hold</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Start date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clinical-blue"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              End date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clinical-blue"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-clinical-deep to-clinical-blue text-white rounded-lg py-2.5 text-sm font-bold font-headline hover:opacity-90 disabled:opacity-50 transition-all shadow-[0_4px_20px_rgba(0,82,204,0.22)]"
          >
            {loading ? "Creating…" : "Create project"}
          </button>
          <Link
            href="/projects"
            className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
