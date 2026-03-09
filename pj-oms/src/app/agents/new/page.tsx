"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import { logActivity } from "@/lib/activityLog";

export default function NewAgentPage() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [form, setForm] = useState({
    agent_name: "",
    email: "",
    phone: "",
    agent_type: "individual",
    commission_rate: "",
    notes: "",
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push("/admin");
    });
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.agent_name.trim()) {
      setMessage({ type: "error", text: "Agent Name is required." });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push("/admin"); return; }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", session.user.id)
      .single();

    const payload: Record<string, unknown> = {
      agent_name: form.agent_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      agent_type: form.agent_type || null,
      commission_rate: form.commission_rate ? parseFloat(form.commission_rate) : null,
      notes: form.notes.trim() || null,
      assigned_sales_id: profileData?.id ?? null,
      created_by: session.user.id,
    };

    const { data, error } = await supabase.from("agents").insert(payload).select().single();

    if (error) {
      setMessage({ type: "error", text: error.message });
      setIsSaving(false);
      return;
    }

    await logActivity(supabase, session.user.id, "created_agent", "agents", data.id, { agent_name: form.agent_name });
    router.push(`/agents/${data.id}`);
  };

  const inputClass = "w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none";
  const selectClass = "w-full rounded-lg border border-white/20 bg-blue-900 px-4 py-2.5 text-white focus:border-blue-400 focus:outline-none";
  const labelClass = "block text-sm font-medium text-white/70 mb-1";

  return (
    <div className="min-h-screen bg-blue-950 text-white">
      <Navbar hasUnsavedChanges />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="mb-8">
          <h2 className="text-2xl font-bold sm:text-3xl">Add Agent</h2>
          <p className="text-sm text-white/50 mt-1">Add a new referral agent or partner.</p>
        </div>

        {message && (
          <div className={`mb-6 rounded-lg px-4 py-3 ${message.type === "error" ? "bg-red-500/20 text-red-300 border border-red-500/30" : "bg-green-500/20 text-green-300 border border-green-500/30"}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass}>Agent Name *</label>
              <input name="agent_name" value={form.agent_name} onChange={handleChange} required placeholder="Agent or company name" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input name="email" value={form.email} onChange={handleChange} type="email" placeholder="agent@example.com" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input name="phone" value={form.phone} onChange={handleChange} placeholder="+64 21 000 0000" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Agent Type</label>
              <select name="agent_type" value={form.agent_type} onChange={handleChange} className={selectClass}>
                <option value="individual" className="bg-blue-900">Individual</option>
                <option value="company" className="bg-blue-900">Company</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Commission Rate (%)</label>
              <input name="commission_rate" value={form.commission_rate} onChange={handleChange} type="number" step="0.01" min="0" max="100" placeholder="10" className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Notes</label>
              <textarea name="notes" value={form.notes} onChange={handleChange} rows={3} placeholder="Any notes about this agent..." className={`${inputClass} resize-none`} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={isSaving} className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50">
              {isSaving ? "Saving..." : "Save Agent"}
            </button>
            <button type="button" onClick={() => router.push("/agents")} className="rounded-lg border border-white/20 px-6 py-3 font-bold hover:bg-white/10">
              Cancel
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
