"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import { logActivity } from "@/lib/activityLog";
import { hasRole } from "@/lib/roles";

type AttachmentFile = { name: string; url: string; createdAt: string | null };
type ActivityLog = { id: string; action: string; details: Record<string, unknown> | null; created_at: string; user_id: string };

type ReferredContact = {
  id: string;
  first_name: string;
  last_name: string;
  type: string;
  mobile: string | null;
  email: string | null;
};

type RelatedDeal = {
  id: string;
  deal_number: string | null;
  deal_type: string | null;
  status: string;
  total_amount: number | null;
  contacts: { first_name: string; last_name: string } | null;
  companies: { company_name: string } | null;
};

type AgentCommission = {
  id: string;
  created_at: string;
  deal_id: string;
  commission_type: string;
  commission_rate: number;
  base_amount: number;
  commission_amount: number;
  status: string;
  paid_date: string | null;
  invoice_number: string | null;
  notes: string | null;
  deals: {
    deal_number: string | null;
    total_amount: number | null;
    contacts: { first_name: string; last_name: string } | null;
    companies: { company_name: string } | null;
  } | null;
};

const DEAL_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 dark:bg-gray-500/20 text-gray-500 dark:text-gray-400",
  quoted: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400",
  contracted: "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400",
  in_progress: "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
  submitted: "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400",
  approved: "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400",
  declined: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400",
  completed: "bg-green-100 dark:bg-green-600/20 text-green-700 dark:text-green-300",
  cancelled: "bg-red-100 dark:bg-red-600/20 text-red-700 dark:text-red-300",
};

const COMMISSION_STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
  approved: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400",
  paid: "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400",
};

export default function AgentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [profile, setProfile] = useState<{ role: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [form, setForm] = useState({
    agent_name: "",
    email: "",
    phone: "",
    agent_type: "individual",
    commission_rate: "",
    notes: "",
  });
  const [initialForm, setInitialForm] = useState("");
  const [referredContacts, setReferredContacts] = useState<ReferredContact[]>([]);
  const [relatedDeals, setRelatedDeals] = useState<RelatedDeal[]>([]);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  // Commissions state
  const [commissions, setCommissions] = useState<AgentCommission[]>([]);
  const [commissionFilter, setCommissionFilter] = useState({ from: "", to: "" });

  const fetchAttachments = useCallback(async () => {
    const res = await fetch(`/api/attachments?type=agents&id=${id}`);
    const json = await res.json().catch(() => ({ files: [] }));
    if (json.files) setAttachments(json.files);
  }, [id]);

  const fetchLogs = useCallback(async () => {
    const { data } = await supabase
      .from("activity_logs")
      .select("id, action, details, created_at, user_id")
      .eq("entity_id", id)
      .order("created_at", { ascending: false });
    if (data) {
      setActivityLogs(data as unknown as ActivityLog[]);
      const userIds = [...new Set((data as { user_id: string }[]).map(l => l.user_id))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
        const map: Record<string, string> = {};
        for (const p of profiles ?? []) map[(p as { id: string; full_name: string }).id] = (p as { id: string; full_name: string }).full_name ?? "Unknown";
        setUserNames(map);
      }
    }
  }, [id]);

  const fetchCommissions = useCallback(async (filter?: { from: string; to: string }) => {
    const f = filter ?? commissionFilter;
    let query = supabase
      .from("agent_commissions")
      .select("id, created_at, deal_id, commission_type, commission_rate, base_amount, commission_amount, status, paid_date, invoice_number, notes, deals(deal_number, total_amount, contacts(first_name, last_name), companies(company_name))")
      .eq("agent_id", id)
      .order("created_at", { ascending: false });
    if (f.from) query = query.gte("created_at", f.from);
    if (f.to) query = query.lte("created_at", f.to + "T23:59:59");
    const { data } = await query;
    if (data) setCommissions(data as unknown as AgentCommission[]);
  }, [id, commissionFilter]);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/admin"); return; }

      const { data: profileData } = await supabase.from("profiles").select("role, roles").eq("id", session.user.id).single();
      if (profileData) setProfile(profileData);

      const { data: agentData } = await supabase.from("agents").select("*").eq("id", id).single();
      if (!agentData) { router.push("/agents"); return; }

      const loadedForm = {
        agent_name: agentData.agent_name ?? "",
        email: agentData.email ?? "",
        phone: agentData.phone ?? "",
        agent_type: agentData.agent_type ?? "individual",
        commission_rate: agentData.commission_rate != null ? String(agentData.commission_rate) : "",
        notes: agentData.notes ?? "",
      };
      setForm(loadedForm);
      setInitialForm(JSON.stringify(loadedForm));

      const { data: contactsData } = await supabase
        .from("contacts").select("id, first_name, last_name, type, mobile, email").eq("agent_id", id).order("created_at", { ascending: false });
      if (contactsData) setReferredContacts(contactsData as ReferredContact[]);

      const { data: dealsData } = await supabase
        .from("deals").select("id, deal_number, deal_type, status, total_amount, contacts(first_name, last_name), companies(company_name)").eq("agent_id", id).order("created_at", { ascending: false });
      if (dealsData) setRelatedDeals(dealsData as unknown as RelatedDeal[]);

      await Promise.all([fetchAttachments(), fetchLogs(), fetchCommissions({ from: "", to: "" })]);
      setIsLoading(false);
    }
    init();
  }, [id, router, fetchAttachments, fetchLogs, fetchCommissions]);

  const hasUnsavedChanges = JSON.stringify(form) !== initialForm;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    if (!form.agent_name.trim()) { setMessage({ type: "error", text: "Agent Name is required." }); return; }
    setIsSaving(true);
    setMessage(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase.from("agents").update({
      agent_name: form.agent_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      agent_type: form.agent_type || null,
      commission_rate: form.commission_rate ? parseFloat(form.commission_rate) : null,
      notes: form.notes.trim() || null,
    }).eq("id", id);

    if (error) { setMessage({ type: "error", text: error.message }); }
    else {
      setInitialForm(JSON.stringify(form));
      setMessage({ type: "success", text: "Agent saved successfully." });
      await logActivity(supabase, session.user.id, "updated_agent", "agents", id, { agent_name: form.agent_name });
      await fetchLogs();
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete agent "${form.agent_name}"? This cannot be undone.`)) return;
    setIsDeleting(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { error } = await supabase.from("agents").delete().eq("id", id);
    if (error) { setMessage({ type: "error", text: error.message }); setIsDeleting(false); return; }
    await logActivity(supabase, session.user.id, "deleted_agent", "agents", id, { agent_name: form.agent_name });
    router.push("/agents");
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", "agents");
    fd.append("id", id);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (res.ok) await fetchAttachments();
    setIsUploading(false);
    e.target.value = "";
  };

  // Commission summary
  const totalCommission = commissions.reduce((s, c) => s + (c.commission_amount || 0), 0);
  const pendingCommission = commissions.filter(c => c.status === "pending" || c.status === "approved").reduce((s, c) => s + (c.commission_amount || 0), 0);
  const paidCommission = commissions.filter(c => c.status === "paid").reduce((s, c) => s + (c.commission_amount || 0), 0);

  if (isLoading) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-blue-950">
      <p className="text-gray-500 dark:text-white/60">Loading...</p>
    </div>
  );

  const inputClass = "w-full rounded-lg border border-gray-300 dark:border-white/20 bg-gray-100 dark:bg-white/10 px-4 py-2.5 text-gray-900 dark:text-white placeholder:text-gray-500 dark:text-white/30 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none";
  const selectClass = "w-full rounded-lg border border-gray-300 dark:border-white/20 bg-white dark:bg-blue-900 px-4 py-2.5 text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none";
  const labelClass = "block text-sm font-medium text-gray-600 dark:text-white/70 mb-1";
  const sectionClass = "rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-6 mb-6";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-blue-950 text-gray-900 dark:text-white">
      <Navbar hasUnsavedChanges={hasUnsavedChanges} />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">

        {/* Header */}
        <div className="flex flex-col gap-4 mb-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href="/agents" className="text-sm text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/80 mb-2 inline-block">← Agents</Link>
            <h2 className="text-2xl font-bold sm:text-3xl">{form.agent_name}</h2>
            <span className="mt-1 inline-block rounded-full bg-orange-100 dark:bg-orange-500/20 px-3 py-0.5 text-xs font-bold uppercase text-orange-700 dark:text-orange-400 capitalize">
              {form.agent_type}
            </span>
          </div>
          {hasRole(profile, "admin") && (
            <button onClick={handleDelete} disabled={isDeleting} className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-700 dark:text-red-400 hover:bg-red-100 dark:bg-red-500/20 disabled:opacity-50">
              {isDeleting ? "Deleting..." : "Delete Agent"}
            </button>
          )}
        </div>

        {message && (
          <div className={`mb-6 rounded-lg px-4 py-3 ${message.type === "error" ? "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 border border-red-500/30" : "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 border border-green-500/30"}`}>
            {message.text}
          </div>
        )}

        {/* Agent Information */}
        <div className={sectionClass}>
          <h3 className="text-lg font-bold mb-4">Agent Information</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass}>Agent Name *</label>
              <input name="agent_name" value={form.agent_name} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input name="email" value={form.email} onChange={handleChange} type="email" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input name="phone" value={form.phone} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Agent Type</label>
              <select name="agent_type" value={form.agent_type} onChange={handleChange} className={selectClass}>
                <option value="individual" className="bg-white dark:bg-blue-900">Individual</option>
                <option value="company" className="bg-white dark:bg-blue-900">Company</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Commission Rate (%)</label>
              <input name="commission_rate" value={form.commission_rate} onChange={handleChange} type="number" step="0.01" min="0" max="100" className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Notes</label>
              <textarea name="notes" value={form.notes} onChange={handleChange} rows={3} className={`${inputClass} resize-none`} />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button onClick={handleSave} disabled={isSaving || !hasUnsavedChanges} className="rounded-lg bg-blue-600 px-6 py-2.5 font-bold text-white hover:bg-blue-700 disabled:opacity-50">
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        {/* Referred Contacts */}
        <div className={sectionClass}>
          <h3 className="text-lg font-bold mb-4">Referred Contacts ({referredContacts.length})</h3>
          {referredContacts.length === 0 ? (
            <p className="text-gray-500 dark:text-white/50 text-sm">No referred contacts yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px] border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-white/10">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Name</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Type</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Email</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Mobile</th>
                  </tr>
                </thead>
                <tbody>
                  {referredContacts.map((c) => (
                    <tr key={c.id} className="border-b border-gray-200 dark:border-white/10 last:border-b-0 hover:bg-gray-50 dark:hover:bg-white/5">
                      <td className="px-3 py-2 text-sm font-medium">
                        <Link href={`/contacts/${c.id}`} className="text-blue-700 dark:text-blue-400 hover:underline">
                          {c.first_name} {c.last_name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${c.type === "client" ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400" : "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400"}`}>
                          {c.type}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-600 dark:text-white/70">{c.email ?? "—"}</td>
                      <td className="px-3 py-2 text-sm text-gray-600 dark:text-white/70">{c.mobile ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Related Deals */}
        <div className={sectionClass}>
          <h3 className="text-lg font-bold mb-4">Related Deals ({relatedDeals.length})</h3>
          {relatedDeals.length === 0 ? (
            <p className="text-gray-500 dark:text-white/50 text-sm">No deals linked to this agent.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-white/10">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Deal #</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Client</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Type</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {relatedDeals.map((d) => {
                    const clientName = d.contacts ? `${d.contacts.first_name} ${d.contacts.last_name}` : d.companies?.company_name ?? "—";
                    return (
                      <tr key={d.id} className="border-b border-gray-200 dark:border-white/10 last:border-b-0 hover:bg-gray-50 dark:hover:bg-white/5">
                        <td className="px-3 py-2 text-sm">
                          <Link href={`/deals/${d.id}`} className="text-blue-700 dark:text-blue-400 hover:underline">{d.deal_number ?? "—"}</Link>
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-800 dark:text-white/90">{clientName}</td>
                        <td className="px-3 py-2 text-sm text-gray-600 dark:text-white/70">{d.deal_type?.replace(/_/g, " ") ?? "—"}</td>
                        <td className="px-3 py-2 text-sm">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${DEAL_STATUS_COLORS[d.status] ?? "bg-gray-100 dark:bg-gray-500/20 text-gray-500 dark:text-gray-400"}`}>{d.status}</span>
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-800 dark:text-white/90">{d.total_amount != null ? `$${d.total_amount.toLocaleString()}` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Commissions */}
        <div className={sectionClass}>
          <h3 className="text-lg font-bold mb-4">Commissions</h3>

          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-4">
            <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4">
              <p className="text-xs text-gray-500 dark:text-white/50 mb-1">Total Commission</p>
              <p className="text-xl font-bold">${totalCommission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4">
              <p className="text-xs text-gray-500 dark:text-white/50 mb-1">Pending</p>
              <p className="text-xl font-bold text-yellow-700 dark:text-yellow-400">${pendingCommission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4">
              <p className="text-xs text-gray-500 dark:text-white/50 mb-1">Paid</p>
              <p className="text-xl font-bold text-green-700 dark:text-green-400">${paidCommission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>

          {/* Date filter */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div>
              <label className="block text-xs text-gray-500 dark:text-white/50 mb-1">From</label>
              <input
                type="date"
                value={commissionFilter.from}
                onChange={e => {
                  const f = { ...commissionFilter, from: e.target.value };
                  setCommissionFilter(f);
                  fetchCommissions(f);
                }}
                className="rounded-lg border border-gray-300 dark:border-white/20 bg-gray-100 dark:bg-white/10 px-3 py-1.5 text-sm text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-white/50 mb-1">To</label>
              <input
                type="date"
                value={commissionFilter.to}
                onChange={e => {
                  const f = { ...commissionFilter, to: e.target.value };
                  setCommissionFilter(f);
                  fetchCommissions(f);
                }}
                className="rounded-lg border border-gray-300 dark:border-white/20 bg-gray-100 dark:bg-white/10 px-3 py-1.5 text-sm text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
              />
            </div>
            {(commissionFilter.from || commissionFilter.to) && (
              <div className="flex items-end">
                <button
                  onClick={() => {
                    const f = { from: "", to: "" };
                    setCommissionFilter(f);
                    fetchCommissions(f);
                  }}
                  className="rounded-lg border border-gray-300 dark:border-white/20 px-3 py-1.5 text-xs font-bold hover:bg-gray-100 dark:hover:bg-white/10"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Commission table */}
          {commissions.length === 0 ? (
            <p className="text-gray-500 dark:text-white/50 text-sm">No commission records yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-white/10">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Deal #</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Client</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Service Fee</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Rate</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Commission</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Paid Date</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((c) => {
                    const deal = c.deals;
                    const client = deal?.contacts ? `${deal.contacts.first_name} ${deal.contacts.last_name}` : deal?.companies?.company_name ?? "—";
                    const rateDisplay = c.commission_type === "percentage" ? `${c.commission_rate}%` : `$${c.commission_rate}`;
                    return (
                      <tr key={c.id} className="border-b border-gray-200 dark:border-white/10 last:border-b-0 hover:bg-gray-50 dark:hover:bg-white/5">
                        <td className="px-3 py-2 text-sm">
                          <Link href={`/deals/${c.deal_id}`} className="text-blue-700 dark:text-blue-400 hover:underline">{deal?.deal_number ?? "—"}</Link>
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-800 dark:text-white/90">{client}</td>
                        <td className="px-3 py-2 text-sm text-gray-800 dark:text-white/90">${(c.base_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-sm text-gray-800 dark:text-white/90">{rateDisplay}</td>
                        <td className="px-3 py-2 text-sm font-medium">${(c.commission_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-sm">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${COMMISSION_STATUS_COLORS[c.status] ?? "bg-gray-100 dark:bg-gray-500/20 text-gray-500 dark:text-gray-400"}`}>{c.status}</span>
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-600 dark:text-white/70">{c.paid_date ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Attachments */}
        <div className={sectionClass}>
          <h3 className="text-lg font-bold mb-4">Attachments</h3>
          <div className="mb-3">
            <label className="cursor-pointer rounded-lg border border-gray-300 dark:border-white/20 bg-gray-100 dark:bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20">
              {isUploading ? "Uploading..." : "Upload File"}
              <input type="file" className="hidden" onChange={handleUpload} disabled={isUploading} />
            </label>
          </div>
          {attachments.length === 0 ? (
            <p className="text-gray-500 dark:text-white/50 text-sm">No attachments yet.</p>
          ) : (
            <ul className="space-y-2">
              {attachments.map((f) => (
                <li key={f.name} className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-2">
                  <span className="text-sm text-gray-800 dark:text-white/90 truncate mr-4">{f.name.replace(/^\d+-/, "")}</span>
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-700 dark:text-blue-400 hover:underline whitespace-nowrap">View</a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Activity Timeline */}
        <div className={sectionClass}>
          <h3 className="text-lg font-bold mb-4">Activity Timeline</h3>
          {activityLogs.length === 0 ? (
            <p className="text-gray-500 dark:text-white/50 text-sm">No activity yet.</p>
          ) : (
            <ul className="space-y-3">
              {activityLogs.map((log) => (
                <li key={log.id} className="flex gap-3 text-sm">
                  <span className="text-gray-500 dark:text-white/40 whitespace-nowrap">{new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="text-gray-500 dark:text-white/60">{userNames[log.user_id] ?? "Unknown"}</span>
                  <span className="text-gray-800 dark:text-white/90">{log.action.replace(/_/g, " ")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

      </main>
    </div>
  );
}
