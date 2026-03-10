"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { hasRole } from "@/lib/roles";
import Navbar from "@/components/Navbar";

type AgentCommissionRow = {
  id: string;
  created_at: string;
  agent_id: string;
  deal_id: string;
  commission_type: string;
  commission_rate: number;
  base_amount: number;
  commission_amount: number;
  status: string;
  paid_date: string | null;
  invoice_number: string | null;
  notes: string | null;
  agents: { agent_name: string } | null;
  deals: {
    deal_number: string | null;
    contacts: { first_name: string; last_name: string } | null;
    companies: { company_name: string } | null;
  } | null;
};

type AgentSummary = {
  agent_id: string;
  agent_name: string;
  count: number;
  total: number;
  pending: number;
  paid: number;
};

function escapeCsv(val: unknown): string {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function getDatePreset(preset: string): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case "this_month":
      return { from: `${y}-${String(m + 1).padStart(2, "0")}-01`, to: now.toISOString().split("T")[0] };
    case "last_month": {
      const lm = m === 0 ? 11 : m - 1;
      const ly = m === 0 ? y - 1 : y;
      const lastDay = new Date(ly, lm + 1, 0).getDate();
      return { from: `${ly}-${String(lm + 1).padStart(2, "0")}-01`, to: `${ly}-${String(lm + 1).padStart(2, "0")}-${lastDay}` };
    }
    case "this_quarter": {
      const q = Math.floor(m / 3);
      return { from: `${y}-${String(q * 3 + 1).padStart(2, "0")}-01`, to: now.toISOString().split("T")[0] };
    }
    case "this_year":
      return { from: `${y}-01-01`, to: now.toISOString().split("T")[0] };
    default:
      return { from: "", to: "" };
  }
}

export default function AgentCommissionsReportPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [commissions, setCommissions] = useState<AgentCommissionRow[]>([]);
  const [dateFilter, setDateFilter] = useState({ from: "", to: "" });

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/admin"); return; }
      const { data: profile } = await supabase.from("profiles").select("role, roles").eq("id", session.user.id).single();
      if (!profile || !hasRole(profile, "admin")) { router.push("/crm"); return; }
      await fetchCommissions();
      setIsLoading(false);
    }
    init();
  }, [router]);

  const fetchCommissions = async (filter?: { from: string; to: string }) => {
    const f = filter ?? dateFilter;
    let query = supabase
      .from("agent_commissions")
      .select("id, created_at, agent_id, deal_id, commission_type, commission_rate, base_amount, commission_amount, status, paid_date, invoice_number, notes, agents(agent_name), deals(deal_number, contacts(first_name, last_name), companies(company_name))")
      .order("created_at", { ascending: false });
    if (f.from) query = query.gte("created_at", f.from);
    if (f.to) query = query.lte("created_at", f.to + "T23:59:59");
    const { data } = await query;
    if (data) setCommissions(data as unknown as AgentCommissionRow[]);
  };

  const applyPreset = (preset: string) => {
    const f = getDatePreset(preset);
    setDateFilter(f);
    fetchCommissions(f);
  };

  // Agent summary
  const agentMap = new Map<string, AgentSummary>();
  for (const c of commissions) {
    const key = c.agent_id;
    if (!agentMap.has(key)) {
      agentMap.set(key, {
        agent_id: key,
        agent_name: c.agents?.agent_name ?? "Unknown",
        count: 0,
        total: 0,
        pending: 0,
        paid: 0,
      });
    }
    const s = agentMap.get(key)!;
    s.count++;
    s.total += c.commission_amount || 0;
    if (c.status === "pending" || c.status === "approved") s.pending += c.commission_amount || 0;
    if (c.status === "paid") s.paid += c.commission_amount || 0;
  }
  const agentSummaries = Array.from(agentMap.values()).sort((a, b) => b.total - a.total);

  const grandTotal = commissions.reduce((s, c) => s + (c.commission_amount || 0), 0);
  const grandPending = commissions.filter(c => c.status === "pending" || c.status === "approved").reduce((s, c) => s + (c.commission_amount || 0), 0);
  const grandPaid = commissions.filter(c => c.status === "paid").reduce((s, c) => s + (c.commission_amount || 0), 0);

  const handleExportCsv = () => {
    const headers = ["Agent", "Deal Number", "Client", "Type", "Rate", "Base Amount", "Commission", "Status", "Paid Date", "Invoice #", "Notes"];
    const rows = commissions.map(c => {
      const client = c.deals?.contacts ? `${c.deals.contacts.first_name} ${c.deals.contacts.last_name}` : c.deals?.companies?.company_name ?? "";
      return [
        escapeCsv(c.agents?.agent_name ?? ""),
        escapeCsv(c.deals?.deal_number ?? ""),
        escapeCsv(client),
        escapeCsv(c.commission_type),
        escapeCsv(c.commission_type === "percentage" ? `${c.commission_rate}%` : `$${c.commission_rate}`),
        escapeCsv(c.base_amount),
        escapeCsv(c.commission_amount),
        escapeCsv(c.status),
        escapeCsv(c.paid_date ?? ""),
        escapeCsv(c.invoice_number ?? ""),
        escapeCsv(c.notes ?? ""),
      ];
    });
    const csv = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "agent-commissions.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-blue-950"><p className="text-white/60">Loading...</p></div>;

  const inputClass = "rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none";
  const btnPrimary = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50";
  const btnSecondary = "rounded-lg border border-white/20 px-3 py-1.5 text-xs font-bold hover:bg-white/10";

  return (
    <div className="min-h-screen bg-blue-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-8">
          <p className="text-sm text-white/50 mb-1">Reports</p>
          <h1 className="text-2xl font-bold">Agent Commissions</h1>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3 mb-6">
          <div>
            <label className="block text-xs text-white/50 mb-1">From</label>
            <input
              type="date"
              value={dateFilter.from}
              onChange={e => {
                const f = { ...dateFilter, from: e.target.value };
                setDateFilter(f);
                fetchCommissions(f);
              }}
              className={`${inputClass} text-sm`}
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">To</label>
            <input
              type="date"
              value={dateFilter.to}
              onChange={e => {
                const f = { ...dateFilter, to: e.target.value };
                setDateFilter(f);
                fetchCommissions(f);
              }}
              className={`${inputClass} text-sm`}
            />
          </div>
          <button onClick={() => applyPreset("this_month")} className={btnSecondary}>This Month</button>
          <button onClick={() => applyPreset("last_month")} className={btnSecondary}>Last Month</button>
          <button onClick={() => applyPreset("this_quarter")} className={btnSecondary}>This Quarter</button>
          <button onClick={() => applyPreset("this_year")} className={btnSecondary}>This Year</button>
          {(dateFilter.from || dateFilter.to) && (
            <button onClick={() => { const f = { from: "", to: "" }; setDateFilter(f); fetchCommissions(f); }} className={btnSecondary}>Clear</button>
          )}
          <div className="ml-auto">
            <button onClick={handleExportCsv} className={btnPrimary}>Export CSV</button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-8">
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs text-white/50 mb-1">Total Commission</p>
            <p className="text-2xl font-bold">${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-xs text-white/40 mt-1">{commissions.length} records</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs text-white/50 mb-1">Pending / Approved</p>
            <p className="text-2xl font-bold text-yellow-400">${grandPending.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs text-white/50 mb-1">Paid</p>
            <p className="text-2xl font-bold text-green-400">${grandPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>

        {/* Agent Summary */}
        {agentSummaries.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4">Summary by Agent</h2>
            <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="text-left px-4 py-3 text-white/50 font-medium">Agent</th>
                    <th className="text-left px-4 py-3 text-white/50 font-medium">Deals</th>
                    <th className="text-left px-4 py-3 text-white/50 font-medium">Total</th>
                    <th className="text-left px-4 py-3 text-white/50 font-medium">Pending</th>
                    <th className="text-left px-4 py-3 text-white/50 font-medium">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {agentSummaries.map(s => (
                    <tr key={s.agent_id} className="border-b border-white/5 hover:bg-white/5 last:border-0">
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/agents/${s.agent_id}`} className="text-blue-400 hover:underline">{s.agent_name}</Link>
                      </td>
                      <td className="px-4 py-3 text-white/70">{s.count}</td>
                      <td className="px-4 py-3 font-medium">${s.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-yellow-400">${s.pending.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-green-400">${s.paid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Detail Table */}
        <section>
          <h2 className="text-lg font-bold mb-4">All Commission Records</h2>
          {commissions.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
              <p className="text-white/50">No commission records found for the selected period.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="text-left px-4 py-3 text-white/50 font-medium">Agent</th>
                    <th className="text-left px-4 py-3 text-white/50 font-medium">Deal #</th>
                    <th className="text-left px-4 py-3 text-white/50 font-medium">Client</th>
                    <th className="text-left px-4 py-3 text-white/50 font-medium">Type</th>
                    <th className="text-left px-4 py-3 text-white/50 font-medium">Rate</th>
                    <th className="text-left px-4 py-3 text-white/50 font-medium">Base</th>
                    <th className="text-left px-4 py-3 text-white/50 font-medium">Commission</th>
                    <th className="text-left px-4 py-3 text-white/50 font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-white/50 font-medium">Paid Date</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map(c => {
                    const client = c.deals?.contacts
                      ? `${c.deals.contacts.first_name} ${c.deals.contacts.last_name}`
                      : c.deals?.companies?.company_name ?? "—";
                    const rateDisplay = c.commission_type === "percentage" ? `${c.commission_rate}%` : `$${c.commission_rate}`;
                    return (
                      <tr key={c.id} className="border-b border-white/5 hover:bg-white/5 last:border-0">
                        <td className="px-4 py-3">
                          <Link href={`/agents/${c.agent_id}`} className="text-blue-400 hover:underline">{c.agents?.agent_name ?? "—"}</Link>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/deals/${c.deal_id}`} className="text-blue-400 hover:underline">{c.deals?.deal_number ?? "—"}</Link>
                        </td>
                        <td className="px-4 py-3 text-white/80">{client}</td>
                        <td className="px-4 py-3 text-white/70 capitalize">{c.commission_type}</td>
                        <td className="px-4 py-3 text-white/80">{rateDisplay}</td>
                        <td className="px-4 py-3 text-white/80">${(c.base_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3 font-medium">${(c.commission_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${
                            c.status === "paid" ? "bg-green-500/20 text-green-400" :
                            c.status === "approved" ? "bg-blue-500/20 text-blue-400" :
                            "bg-yellow-500/20 text-yellow-400"
                          }`}>{c.status}</span>
                        </td>
                        <td className="px-4 py-3 text-white/70">{c.paid_date ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/10 bg-white/5">
                    <td colSpan={5} className="px-4 py-3 text-right font-bold text-white/70">Totals:</td>
                    <td className="px-4 py-3 font-bold">${commissions.reduce((s, c) => s + (c.base_amount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 font-bold">${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
