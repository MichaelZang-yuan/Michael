"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { hasRole } from "@/lib/roles";
import Navbar from "@/components/Navbar";
import { logActivity } from "@/lib/activityLog";

type StaffSetting = {
  id: string | null;
  user_id: string;
  default_commission_rate: number;
  full_name: string | null;
  role: string;
};

type DealCommission = {
  id: string;
  deal_id: string;
  user_id: string;
  role_in_deal: string | null;
  commission_rate: number;
  base_amount: number;
  commission_amount: number;
  quarter: string | null;
  status: string;
  settled_date: string | null;
  notes: string | null;
  created_at: string;
  deals: { deal_number: string | null; total_amount: number | null } | null;
  staff_profile: { full_name: string | null } | null;
};

type DealOption = {
  id: string;
  deal_number: string | null;
  total_amount: number | null;
};

type ProfileOption = {
  id: string;
  full_name: string | null;
  role: string;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  sales: "Sales",
  lia: "LIA",
  accountant: "Accountant",
  copywriter: "Copywriter",
};

function getCurrentQuarter(): string {
  const d = new Date();
  const q = Math.ceil((d.getMonth() + 1) / 3);
  return `${d.getFullYear()}-Q${q}`;
}

function escapeCsv(val: unknown): string {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const EMPTY_FORM = {
  deal_id: "",
  user_id: "",
  role_in_deal: "sales",
  commission_rate: "0",
  base_amount: "0",
  commission_amount: "0",
  quarter: getCurrentQuarter(),
  notes: "",
};

export default function StaffCommissionPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Rate settings
  const [staffSettings, setStaffSettings] = useState<StaffSetting[]>([]);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editRate, setEditRate] = useState("");
  const [isSavingRate, setIsSavingRate] = useState(false);

  // Commission records
  const [commissions, setCommissions] = useState<DealCommission[]>([]);
  const [deals, setDeals] = useState<DealOption[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ ...EMPTY_FORM });
  const [isAdding, setIsAdding] = useState(false);

  // Summary
  const [filterQuarter, setFilterQuarter] = useState("all");
  const [expandedQuarters, setExpandedQuarters] = useState<Set<string>>(new Set());
  const [isSettling, setIsSettling] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/admin"); return; }
      const { data: profile } = await supabase.from("profiles").select("role, roles").eq("id", session.user.id).single();
      if (!profile || !hasRole(profile, "admin")) { router.push("/crm"); return; }
      setUserId(session.user.id);
      await Promise.all([fetchSettings(), fetchCommissions(), fetchDeals(), fetchProfiles()]);
      setIsLoading(false);
    }
    init();
  }, [router]);

  const fetchSettings = async () => {
    const { data: profilesData } = await supabase.from("profiles").select("id, full_name, role, roles").order("full_name");
    const { data: settingsData } = await supabase.from("staff_commission_settings").select("id, user_id, default_commission_rate");
    const settingsMap = new Map((settingsData ?? []).map(s => [s.user_id, s]));
    const merged: StaffSetting[] = (profilesData ?? []).map(p => ({
      id: settingsMap.get(p.id)?.id ?? null,
      user_id: p.id,
      default_commission_rate: settingsMap.get(p.id)?.default_commission_rate ?? 0,
      full_name: p.full_name,
      role: p.role,
    }));
    setStaffSettings(merged);
  };

  const fetchCommissions = async () => {
    const { data } = await supabase
      .from("deal_staff_commissions")
      .select("id, deal_id, user_id, role_in_deal, commission_rate, base_amount, commission_amount, quarter, status, settled_date, notes, created_at, deals(deal_number, total_amount), staff_profile:profiles(full_name)")
      .order("created_at", { ascending: false });
    if (data) setCommissions(data as unknown as DealCommission[]);
  };

  const fetchDeals = async () => {
    const { data } = await supabase.from("deals").select("id, deal_number, total_amount").order("created_at", { ascending: false });
    if (data) setDeals(data as DealOption[]);
  };

  const fetchProfiles = async () => {
    const { data } = await supabase.from("profiles").select("id, full_name, role, roles").order("full_name");
    if (data) setProfiles(data as ProfileOption[]);
  };

  // Rate settings handlers
  const handleEditRate = (setting: StaffSetting) => {
    setEditingUserId(setting.user_id);
    setEditRate(String(setting.default_commission_rate));
  };

  const handleSaveRate = async (setting: StaffSetting) => {
    const rate = parseFloat(editRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      setMessage({ type: "error", text: "Rate must be between 0 and 100." });
      return;
    }
    setIsSavingRate(true);
    if (setting.id) {
      const { error } = await supabase.from("staff_commission_settings")
        .update({ default_commission_rate: rate, updated_at: new Date().toISOString() })
        .eq("id", setting.id);
      if (error) { setMessage({ type: "error", text: error.message }); setIsSavingRate(false); return; }
    } else {
      const { error } = await supabase.from("staff_commission_settings")
        .insert({ user_id: setting.user_id, default_commission_rate: rate, created_by: userId });
      if (error) { setMessage({ type: "error", text: error.message }); setIsSavingRate(false); return; }
    }
    if (userId) await logActivity(supabase, userId, "updated_staff_commission_rate", "staff_commission_settings", setting.user_id, { rate, staff_name: setting.full_name });
    setEditingUserId(null);
    setIsSavingRate(false);
    await fetchSettings();
    setMessage({ type: "success", text: "Rate saved." });
  };

  // Add form helpers
  const handleAddFormDealChange = (dealId: string) => {
    const deal = deals.find(d => d.id === dealId);
    const base = deal?.total_amount ?? 0;
    const rate = parseFloat(addForm.commission_rate) || 0;
    setAddForm(f => ({ ...f, deal_id: dealId, base_amount: String(base), commission_amount: (base * rate / 100).toFixed(2) }));
  };

  const handleAddFormStaffChange = (staffId: string) => {
    const setting = staffSettings.find(s => s.user_id === staffId);
    const rate = setting?.default_commission_rate ?? 0;
    const base = parseFloat(addForm.base_amount) || 0;
    setAddForm(f => ({ ...f, user_id: staffId, commission_rate: String(rate), commission_amount: (base * rate / 100).toFixed(2) }));
  };

  const handleRateChange = (rate: string) => {
    const r = parseFloat(rate) || 0;
    const base = parseFloat(addForm.base_amount) || 0;
    setAddForm(f => ({ ...f, commission_rate: rate, commission_amount: (base * r / 100).toFixed(2) }));
  };

  const handleBaseChange = (base: string) => {
    const b = parseFloat(base) || 0;
    const r = parseFloat(addForm.commission_rate) || 0;
    setAddForm(f => ({ ...f, base_amount: base, commission_amount: (b * r / 100).toFixed(2) }));
  };

  const handleAddCommission = async () => {
    if (!addForm.deal_id || !addForm.user_id) {
      setMessage({ type: "error", text: "Deal and Staff are required." });
      return;
    }
    setIsAdding(true);
    const { error } = await supabase.from("deal_staff_commissions").insert({
      deal_id: addForm.deal_id,
      user_id: addForm.user_id,
      role_in_deal: addForm.role_in_deal || null,
      commission_rate: parseFloat(addForm.commission_rate) || 0,
      base_amount: parseFloat(addForm.base_amount) || 0,
      commission_amount: parseFloat(addForm.commission_amount) || 0,
      quarter: addForm.quarter || null,
      status: "pending",
      notes: addForm.notes || null,
      created_by: userId,
    });
    if (error) { setMessage({ type: "error", text: error.message }); setIsAdding(false); return; }
    const staffName = profiles.find(p => p.id === addForm.user_id)?.full_name;
    const dealNumber = deals.find(d => d.id === addForm.deal_id)?.deal_number;
    if (userId) await logActivity(supabase, userId, "added_staff_commission", "deal_staff_commissions", undefined, { staff_name: staffName, deal_number: dealNumber, amount: addForm.commission_amount, quarter: addForm.quarter });
    setShowAddModal(false);
    setAddForm({ ...EMPTY_FORM });
    await fetchCommissions();
    setMessage({ type: "success", text: "Commission record added." });
    setIsAdding(false);
  };

  const handleSettle = async (id: string) => {
    if (!window.confirm("Mark this commission as settled?")) return;
    setIsSettling(id);
    const { error } = await supabase.from("deal_staff_commissions")
      .update({ status: "settled", settled_date: new Date().toISOString().split("T")[0], settled_by: userId })
      .eq("id", id);
    if (error) { setMessage({ type: "error", text: error.message }); setIsSettling(null); return; }
    if (userId) await logActivity(supabase, userId, "settled_staff_commission", "deal_staff_commissions", id, {});
    await fetchCommissions();
    setIsSettling(null);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this commission record?")) return;
    setIsDeleting(id);
    await supabase.from("deal_staff_commissions").delete().eq("id", id);
    if (userId) await logActivity(supabase, userId, "deleted_staff_commission", "deal_staff_commissions", id, {});
    await fetchCommissions();
    setIsDeleting(null);
  };

  // Quarterly summary data
  const allQuarters = Array.from(new Set(commissions.map(c => c.quarter ?? "Unassigned"))).sort((a, b) => b.localeCompare(a));
  const filtered = filterQuarter === "all" ? commissions : commissions.filter(c => (c.quarter ?? "Unassigned") === filterQuarter);

  const quarterGroups: Record<string, DealCommission[]> = {};
  for (const c of filtered) {
    const q = c.quarter ?? "Unassigned";
    if (!quarterGroups[q]) quarterGroups[q] = [];
    quarterGroups[q].push(c);
  }

  const handleExportCsv = () => {
    const headers = ["Quarter", "Deal #", "Staff", "Role", "Base Amount", "Rate %", "Commission", "Status", "Settled Date", "Notes"];
    const rows = filtered.map(c => [
      escapeCsv(c.quarter ?? ""),
      escapeCsv(c.deals?.deal_number ?? ""),
      escapeCsv(c.staff_profile?.full_name ?? ""),
      escapeCsv(c.role_in_deal ?? ""),
      escapeCsv(c.base_amount),
      escapeCsv(c.commission_rate),
      escapeCsv(c.commission_amount),
      escapeCsv(c.status),
      escapeCsv(c.settled_date ?? ""),
      escapeCsv(c.notes ?? ""),
    ]);
    const csv = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "staff-commissions.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-blue-950"><p className="text-gray-500 dark:text-white/60">Loading...</p></div>;

  const inputClass = "rounded-lg border border-gray-300 dark:border-white/20 bg-gray-100 dark:bg-white/10 px-3 py-2 text-gray-900 dark:text-white placeholder:text-gray-500 dark:text-white/30 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none";
  const selectClass = "rounded-lg border border-gray-300 dark:border-white/20 bg-white dark:bg-blue-900 px-3 py-2 text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none";
  const btnPrimary = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50";
  const btnSecondary = "rounded-lg border border-gray-300 dark:border-white/20 px-4 py-2 text-sm font-bold hover:bg-gray-100 dark:hover:bg-white/10";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-blue-950 text-gray-900 dark:text-white">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-8">
          <p className="text-sm text-gray-500 dark:text-white/50 mb-1">Reports</p>
          <h1 className="text-2xl font-bold">Staff Commission</h1>
        </div>

        {message && (
          <div className={`mb-6 rounded-lg px-4 py-3 text-sm ${message.type === "error" ? "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 border border-red-500/30" : "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 border border-green-500/30"}`}>
            {message.text}
          </div>
        )}

        {/* Section 1: Rate Settings */}
        <section className="mb-10">
          <h2 className="text-lg font-bold mb-4">Commission Rate Settings</h2>
          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
                  <th className="text-left px-4 py-3 text-gray-500 dark:text-white/50 font-medium">Staff Name</th>
                  <th className="text-left px-4 py-3 text-gray-500 dark:text-white/50 font-medium">Role</th>
                  <th className="text-left px-4 py-3 text-gray-500 dark:text-white/50 font-medium">Default Rate (%)</th>
                  <th className="px-4 py-3 w-32"></th>
                </tr>
              </thead>
              <tbody>
                {staffSettings.map(s => (
                  <tr key={s.user_id} className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 last:border-0">
                    <td className="px-4 py-3 font-medium">{s.full_name ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-white/60">{ROLE_LABELS[s.role] ?? s.role}</td>
                    <td className="px-4 py-3">
                      {editingUserId === s.user_id ? (
                        <input
                          type="number" min="0" max="100" step="0.1"
                          value={editRate}
                          onChange={e => setEditRate(e.target.value)}
                          className={`${inputClass} w-24 text-sm`}
                        />
                      ) : (
                        <span className="text-gray-700 dark:text-white/80">{s.default_commission_rate}%</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingUserId === s.user_id ? (
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => handleSaveRate(s)} disabled={isSavingRate} className="rounded bg-blue-600 px-3 py-1 text-xs font-bold hover:bg-blue-700 disabled:opacity-50">
                            {isSavingRate ? "Saving..." : "Save"}
                          </button>
                          <button onClick={() => setEditingUserId(null)} disabled={isSavingRate} className="rounded border border-gray-300 dark:border-white/20 px-3 py-1 text-xs font-bold hover:bg-gray-100 dark:hover:bg-white/10">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end">
                          <button onClick={() => handleEditRate(s)} className="text-xs text-blue-700 dark:text-blue-400 hover:underline">
                            Edit
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2: Add Commission Record */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Commission Records</h2>
            <button onClick={() => { setShowAddModal(true); setMessage(null); }} className={btnPrimary}>
              + Add Record
            </button>
          </div>

          {showAddModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
              <div className="w-full max-w-lg rounded-xl border border-gray-200 dark:border-white/10 bg-slate-50 dark:bg-blue-950 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-bold mb-5">Add Commission Record</h3>
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-white/70 mb-1">Deal *</label>
                    <select value={addForm.deal_id} onChange={e => handleAddFormDealChange(e.target.value)} className={`${selectClass} w-full`}>
                      <option value="" className="bg-white dark:bg-blue-900">Select deal...</option>
                      {deals.map(d => (
                        <option key={d.id} value={d.id} className="bg-white dark:bg-blue-900">
                          {d.deal_number ?? d.id}{d.total_amount != null ? ` — $${d.total_amount.toLocaleString()}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-white/70 mb-1">Staff Member *</label>
                    <select value={addForm.user_id} onChange={e => handleAddFormStaffChange(e.target.value)} className={`${selectClass} w-full`}>
                      <option value="" className="bg-white dark:bg-blue-900">Select staff...</option>
                      {profiles.map(p => (
                        <option key={p.id} value={p.id} className="bg-white dark:bg-blue-900">
                          {p.full_name ?? p.id} ({ROLE_LABELS[p.role] ?? p.role})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-white/70 mb-1">Role in Deal</label>
                      <select value={addForm.role_in_deal} onChange={e => setAddForm(f => ({ ...f, role_in_deal: e.target.value }))} className={`${selectClass} w-full`}>
                        <option value="sales" className="bg-white dark:bg-blue-900">Sales</option>
                        <option value="lia" className="bg-white dark:bg-blue-900">LIA</option>
                        <option value="copywriter" className="bg-white dark:bg-blue-900">Copywriter</option>
                        <option value="admin" className="bg-white dark:bg-blue-900">Admin</option>
                        <option value="accountant" className="bg-white dark:bg-blue-900">Accountant</option>
                        <option value="other" className="bg-white dark:bg-blue-900">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-white/70 mb-1">Quarter</label>
                      <input value={addForm.quarter} onChange={e => setAddForm(f => ({ ...f, quarter: e.target.value }))} placeholder="e.g. 2026-Q1" className={`${inputClass} w-full text-sm`} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-white/70 mb-1">Base Amount ($)</label>
                      <input type="number" min="0" step="0.01" value={addForm.base_amount} onChange={e => handleBaseChange(e.target.value)} className={`${inputClass} w-full text-sm`} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-white/70 mb-1">Rate (%)</label>
                      <input type="number" min="0" max="100" step="0.1" value={addForm.commission_rate} onChange={e => handleRateChange(e.target.value)} className={`${inputClass} w-full text-sm`} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-white/70 mb-1">Commission ($)</label>
                      <input type="number" min="0" step="0.01" value={addForm.commission_amount} onChange={e => setAddForm(f => ({ ...f, commission_amount: e.target.value }))} className={`${inputClass} w-full text-sm`} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-white/70 mb-1">Notes</label>
                    <textarea value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={`${inputClass} w-full text-sm resize-y`} placeholder="Optional notes..." />
                  </div>
                </div>
                <div className="mt-5 flex gap-3">
                  <button onClick={handleAddCommission} disabled={isAdding} className={btnPrimary}>
                    {isAdding ? "Adding..." : "Add Record"}
                  </button>
                  <button onClick={() => { setShowAddModal(false); setAddForm({ ...EMPTY_FORM }); }} className={btnSecondary}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Section 3: Quarterly Summary */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-bold">Quarterly Summary</h2>
            <div className="flex items-center gap-3">
              <select value={filterQuarter} onChange={e => setFilterQuarter(e.target.value)} className={`${selectClass} text-sm`}>
                <option value="all" className="bg-white dark:bg-blue-900">All Quarters</option>
                {allQuarters.map(q => <option key={q} value={q} className="bg-white dark:bg-blue-900">{q}</option>)}
              </select>
              <button onClick={handleExportCsv} disabled={filtered.length === 0} className={`${btnSecondary} text-sm disabled:opacity-50`}>
                Export CSV
              </button>
            </div>
          </div>

          {Object.keys(quarterGroups).length === 0 ? (
            <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-10 text-center text-gray-500 dark:text-white/50">
              No commission records yet. Add records above.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {Object.entries(quarterGroups)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([quarter, records]) => {
                  const total = records.reduce((s, r) => s + r.commission_amount, 0);
                  const pending = records.filter(r => r.status === "pending").reduce((s, r) => s + r.commission_amount, 0);
                  const settled = records.filter(r => r.status === "settled").reduce((s, r) => s + r.commission_amount, 0);
                  const isExpanded = expandedQuarters.has(quarter);

                  return (
                    <div key={quarter} className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 overflow-hidden">
                      <button
                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-white/5 text-left"
                        onClick={() => setExpandedQuarters(prev => {
                          const next = new Set(prev);
                          if (next.has(quarter)) next.delete(quarter); else next.add(quarter);
                          return next;
                        })}
                      >
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-base">{quarter}</span>
                          <span className="text-gray-500 dark:text-white/50 text-sm">{records.length} record{records.length !== 1 ? "s" : ""}</span>
                        </div>
                        <div className="flex items-center gap-4 sm:gap-6 text-sm">
                          <span className="hidden sm:block"><span className="text-gray-500 dark:text-white/40 mr-1">Total</span><span className="font-bold">${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></span>
                          <span><span className="text-yellow-700 dark:text-yellow-400/70 mr-1">Pending</span><span className="text-yellow-700 dark:text-yellow-400 font-bold">${pending.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></span>
                          <span><span className="text-green-700 dark:text-green-400/70 mr-1">Settled</span><span className="text-green-700 dark:text-green-400 font-bold">${settled.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></span>
                          <svg className={`w-4 h-4 transition-transform text-gray-500 dark:text-white/40 shrink-0 ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-gray-200 dark:border-white/10 overflow-x-auto">
                          <table className="w-full min-w-[750px] text-sm">
                            <thead>
                              <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
                                <th className="text-left px-4 py-2 text-gray-500 dark:text-white/40 font-medium text-xs">Deal</th>
                                <th className="text-left px-4 py-2 text-gray-500 dark:text-white/40 font-medium text-xs">Staff</th>
                                <th className="text-left px-4 py-2 text-gray-500 dark:text-white/40 font-medium text-xs">Role</th>
                                <th className="text-right px-4 py-2 text-gray-500 dark:text-white/40 font-medium text-xs">Base</th>
                                <th className="text-right px-4 py-2 text-gray-500 dark:text-white/40 font-medium text-xs">Rate</th>
                                <th className="text-right px-4 py-2 text-gray-500 dark:text-white/40 font-medium text-xs">Commission</th>
                                <th className="text-left px-4 py-2 text-gray-500 dark:text-white/40 font-medium text-xs">Status</th>
                                <th className="px-4 py-2 text-xs w-24"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {records.map(r => (
                                <tr key={r.id} className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 last:border-0">
                                  <td className="px-4 py-3">
                                    <Link href={`/deals/${r.deal_id}`} className="text-blue-700 dark:text-blue-400 hover:underline">
                                      {r.deals?.deal_number ?? "—"}
                                    </Link>
                                  </td>
                                  <td className="px-4 py-3">{r.staff_profile?.full_name ?? "—"}</td>
                                  <td className="px-4 py-3 text-gray-500 dark:text-white/60 capitalize">{r.role_in_deal ?? "—"}</td>
                                  <td className="px-4 py-3 text-right text-gray-700 dark:text-white/80">${r.base_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                  <td className="px-4 py-3 text-right text-gray-700 dark:text-white/80">{r.commission_rate}%</td>
                                  <td className="px-4 py-3 text-right font-bold">${r.commission_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                  <td className="px-4 py-3">
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${r.status === "settled" ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400" : "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400"}`}>
                                      {r.status === "settled" ? "Settled" : "Pending"}
                                    </span>
                                    {r.settled_date && <span className="text-xs text-gray-500 dark:text-white/40 ml-1">{new Date(r.settled_date).toLocaleDateString()}</span>}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex gap-2">
                                      {r.status === "pending" && (
                                        <button onClick={() => handleSettle(r.id)} disabled={isSettling === r.id} className="text-xs text-green-700 dark:text-green-400 hover:underline disabled:opacity-50">
                                          {isSettling === r.id ? "..." : "Settle"}
                                        </button>
                                      )}
                                      <button onClick={() => handleDelete(r.id)} disabled={isDeleting === r.id} className="text-xs text-red-700 dark:text-red-400 hover:underline disabled:opacity-50">
                                        {isDeleting === r.id ? "..." : "Delete"}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
