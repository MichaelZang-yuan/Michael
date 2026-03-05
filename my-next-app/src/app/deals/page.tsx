"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

type Deal = {
  id: string;
  deal_number: string | null;
  deal_type: string | null;
  visa_type: string | null;
  status: string;
  total_amount: number | null;
  payment_status: string;
  department: string | null;
  created_at: string;
  contact_id: string | null;
  company_id: string | null;
  contacts: { first_name: string; last_name: string } | null;
  companies: { company_name: string } | null;
  sales: { full_name: string | null } | null;
  lia: { full_name: string | null } | null;
};

const DEPT_LABELS: Record<string, string> = {
  china: "China", thailand: "Thailand", myanmar: "Myanmar", korea_japan: "Korea & Japan",
};

const DEAL_STATUS_LABELS: Record<string, string> = {
  draft: "Draft", quoted: "Quoted", contracted: "Contracted", in_progress: "In Progress",
  submitted: "Submitted", approved: "Approved", declined: "Declined",
  completed: "Completed", cancelled: "Cancelled",
};

const DEAL_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-500/20 text-gray-400", quoted: "bg-blue-500/20 text-blue-400",
  contracted: "bg-purple-500/20 text-purple-400", in_progress: "bg-yellow-500/20 text-yellow-400",
  submitted: "bg-orange-500/20 text-orange-400", approved: "bg-green-500/20 text-green-400",
  declined: "bg-red-500/20 text-red-400", completed: "bg-green-600/20 text-green-300",
  cancelled: "bg-red-600/20 text-red-300",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  unpaid: "bg-red-500/20 text-red-400",
  partial: "bg-yellow-500/20 text-yellow-400",
  paid: "bg-green-500/20 text-green-400",
};

function escapeCsvValue(val: string): string {
  const str = String(val ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export default function DealsPage() {
  const router = useRouter();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [filters, setFilters] = useState({
    status: "all",
    deal_type: "all",
    department: "all",
    payment_status: "all",
    search: "",
  });

  useEffect(() => {
    async function fetchData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/admin"); return; }

      const { data: profileData } = await supabase.from("profiles").select("role, department").eq("id", session.user.id).single();
      const admin = profileData?.role === "admin";
      setIsAdmin(admin);

      let query = supabase
        .from("deals")
        .select("id, deal_number, deal_type, visa_type, status, total_amount, payment_status, department, created_at, contact_id, company_id, contacts(first_name, last_name), companies(company_name), sales:profiles!deals_assigned_sales_id_fkey(full_name), lia:profiles!deals_assigned_lia_id_fkey(full_name)")
        .order("created_at", { ascending: false });

      if (!admin && profileData?.department) query = query.eq("department", profileData.department);

      const { data } = await query;
      if (data) setDeals(data as unknown as Deal[]);
      setIsLoading(false);
    }
    fetchData();
  }, [router]);

  const filtered = deals.filter((d) => {
    if (filters.status !== "all" && d.status !== filters.status) return false;
    if (filters.deal_type !== "all" && d.deal_type !== filters.deal_type) return false;
    if (filters.department !== "all" && d.department !== filters.department) return false;
    if (filters.payment_status !== "all" && d.payment_status !== filters.payment_status) return false;
    if (filters.search.trim()) {
      const q = filters.search.toLowerCase();
      const clientName = d.contacts ? `${d.contacts.first_name} ${d.contacts.last_name}` : d.companies?.company_name ?? "";
      if (!(d.deal_number ?? "").toLowerCase().includes(q) && !clientName.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const handleExportCsv = () => {
    const headers = ["Deal #", "Client", "Type", "Visa Type", "Status", "Total Amount", "Payment Status", "Department", "Sales", "LIA", "Created Date"];
    const rows = filtered.map(d => {
      const clientName = d.contacts ? `${d.contacts.first_name} ${d.contacts.last_name}` : d.companies?.company_name ?? "";
      return [
        escapeCsvValue(d.deal_number ?? ""),
        escapeCsvValue(clientName),
        escapeCsvValue(d.deal_type?.replace(/_/g, " ") ?? ""),
        escapeCsvValue(d.visa_type ?? ""),
        escapeCsvValue(d.status),
        escapeCsvValue(d.total_amount != null ? String(d.total_amount) : ""),
        escapeCsvValue(d.payment_status),
        escapeCsvValue(d.department ? DEPT_LABELS[d.department] ?? d.department : ""),
        escapeCsvValue(d.sales?.full_name ?? ""),
        escapeCsvValue(d.lia?.full_name ?? ""),
        escapeCsvValue(new Date(d.created_at).toLocaleDateString()),
      ];
    });
    const csv = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "deals-export.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const filterSelectClass = "rounded-lg border border-white/20 bg-blue-900 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none";

  return (
    <div className="min-h-screen bg-blue-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-4 mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">Deals</h2>
            <p className="text-sm text-white/50 mt-1">{filtered.length} total</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <button onClick={handleExportCsv} disabled={filtered.length === 0} className="rounded-lg border border-white/20 px-5 py-2.5 font-bold hover:bg-white/10 disabled:opacity-50 text-sm">
              Export CSV
            </button>
            <Link href="/deals/new" className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700">
              + New Deal
            </Link>
          </div>
        </div>

        {!isLoading && deals.length > 0 && (
          <div className="mb-6 flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:flex-wrap sm:items-center">
            <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} className={filterSelectClass}>
              <option value="all" className="bg-blue-900">All Status</option>
              {Object.entries(DEAL_STATUS_LABELS).map(([v, l]) => <option key={v} value={v} className="bg-blue-900">{l}</option>)}
            </select>
            <select value={filters.deal_type} onChange={e => setFilters(f => ({ ...f, deal_type: e.target.value }))} className={filterSelectClass}>
              <option value="all" className="bg-blue-900">All Types</option>
              <option value="individual_visa" className="bg-blue-900">Individual Visa</option>
              <option value="accreditation" className="bg-blue-900">Accreditation</option>
              <option value="job_check" className="bg-blue-900">Job Check</option>
              <option value="school_application" className="bg-blue-900">School Application</option>
            </select>
            {isAdmin && (
              <select value={filters.department} onChange={e => setFilters(f => ({ ...f, department: e.target.value }))} className={filterSelectClass}>
                <option value="all" className="bg-blue-900">All Departments</option>
                <option value="china" className="bg-blue-900">China</option>
                <option value="thailand" className="bg-blue-900">Thailand</option>
                <option value="myanmar" className="bg-blue-900">Myanmar</option>
                <option value="korea_japan" className="bg-blue-900">Korea & Japan</option>
              </select>
            )}
            <select value={filters.payment_status} onChange={e => setFilters(f => ({ ...f, payment_status: e.target.value }))} className={filterSelectClass}>
              <option value="all" className="bg-blue-900">All Payment</option>
              <option value="unpaid" className="bg-blue-900">Unpaid</option>
              <option value="partial" className="bg-blue-900">Partial</option>
              <option value="paid" className="bg-blue-900">Paid</option>
            </select>
            <input
              type="text" value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              placeholder="Search deal # or client..."
              className="flex-1 min-w-[180px] rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none"
            />
            <button onClick={() => setFilters({ status: "all", deal_type: "all", department: "all", payment_status: "all", search: "" })} className="rounded-lg border border-white/20 px-4 py-2 text-sm font-bold hover:bg-white/10">
              Clear
            </button>
          </div>
        )}

        {isLoading ? (
          <p className="text-white/50 text-center py-20">Loading...</p>
        ) : deals.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center">
            <p className="text-xl font-bold mb-2">No deals yet</p>
            <p className="text-white/50 mb-6">Create your first deal.</p>
            <Link href="/deals/new" className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700">+ New Deal</Link>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-white/50">No deals match the current filters.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[800px] border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Deal #</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Client / Company</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Visa Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Payment</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Sales</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">LIA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const clientName = d.contacts ? `${d.contacts.first_name} ${d.contacts.last_name}` : d.companies?.company_name ?? "—";
                  const href = `/deals/${d.id}`;
                  return (
                    <tr key={d.id} className="border-b border-white/10 last:border-b-0 hover:bg-white/5">
                      <td className="p-0 text-sm font-semibold">
                        <Link href={href} className="block px-4 py-3 text-blue-400 hover:underline">{d.deal_number ?? "—"}</Link>
                      </td>
                      <td className="p-0">
                        <Link href={href} className="block px-4 py-3 text-sm text-white/90">{clientName}</Link>
                      </td>
                      <td className="p-0">
                        <Link href={href} className="block px-4 py-3 text-xs text-white/70">{d.deal_type?.replace(/_/g, " ") ?? "—"}</Link>
                      </td>
                      <td className="p-0">
                        <Link href={href} className="block px-4 py-3 text-xs text-white/70">{d.visa_type ?? "—"}</Link>
                      </td>
                      <td className="p-0">
                        <Link href={href} className="block px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${DEAL_STATUS_COLORS[d.status] ?? "bg-gray-500/20 text-gray-400"}`}>
                            {DEAL_STATUS_LABELS[d.status] ?? d.status}
                          </span>
                        </Link>
                      </td>
                      <td className="p-0">
                        <Link href={href} className="block px-4 py-3 text-sm text-white/90">{d.total_amount != null ? `$${d.total_amount.toLocaleString()}` : "—"}</Link>
                      </td>
                      <td className="p-0">
                        <Link href={href} className="block px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${PAYMENT_STATUS_COLORS[d.payment_status] ?? "bg-gray-500/20 text-gray-400"}`}>
                            {d.payment_status}
                          </span>
                        </Link>
                      </td>
                      <td className="p-0">
                        <Link href={href} className="block px-4 py-3 text-xs text-white/70">{d.sales?.full_name ?? "—"}</Link>
                      </td>
                      <td className="p-0">
                        <Link href={href} className="block px-4 py-3 text-xs text-white/70">{d.lia?.full_name ?? "—"}</Link>
                      </td>
                      <td className="p-0">
                        <Link href={href} className="block px-4 py-3 text-xs text-white/60">{new Date(d.created_at).toLocaleDateString()}</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
