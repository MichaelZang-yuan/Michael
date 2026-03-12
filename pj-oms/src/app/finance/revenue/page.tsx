"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { hasAnyRole } from "@/lib/roles";
import Navbar from "@/components/Navbar";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
  LineChart, Line,
} from "recharts";

// ─── Types ──────────────────────────────────────────────────────────────────
type CrmInvRow = {
  id: string; invoice_number: string; total: number; paid_amount: number;
  issue_date: string; currency: string; status: string; deal_id: string | null;
  deals: unknown;
};
type CommInvRow = {
  id: string; invoice_number: string; total: number; paid_amount: number;
  issue_date: string; school_name: string; status: string;
  commission_invoice_items: { amount: number; student_id: string | null }[];
};
type ForeignPayRow = {
  id: string; amount: number; currency: string; nzd_equivalent: number;
  payment_date: string;
};
type ProfileRow = { id: string; full_name: string | null; department: string | null };

// ─── Constants ──────────────────────────────────────────────────────────────
const DEPT_LABELS: Record<string, string> = { china: "China", thailand: "Thailand", myanmar: "Myanmar", korea_japan: "Korea & Japan" };
const DEPTS = ["china", "thailand", "myanmar", "korea_japan"];
const CHART_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ef4444", "#06b6d4", "#f97316", "#84cc16", "#ec4899", "#64748b"];
const PERIODS = [
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "last_quarter", label: "Last Quarter" },
  { value: "this_year", label: "This Year" },
  { value: "custom", label: "Custom" },
];

// ─── Helpers ────────────────────────────────────────────────────────────────
function getDateRange(period: string, cf?: string, ct?: string) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  let f: Date, t: Date, pf: Date, pt: Date;
  switch (period) {
    case "this_month":
      f = new Date(y, m, 1); t = new Date(y, m + 1, 0);
      pf = new Date(y, m - 1, 1); pt = new Date(y, m, 0); break;
    case "last_month":
      f = new Date(y, m - 1, 1); t = new Date(y, m, 0);
      pf = new Date(y, m - 2, 1); pt = new Date(y, m - 1, 0); break;
    case "this_quarter": {
      const q = Math.floor(m / 3);
      f = new Date(y, q * 3, 1); t = new Date(y, q * 3 + 3, 0);
      pf = new Date(y, q * 3 - 3, 1); pt = new Date(y, q * 3, 0); break;
    }
    case "last_quarter": {
      const q = Math.floor(m / 3) - 1;
      const qy = q < 0 ? y - 1 : y, qq = ((q % 4) + 4) % 4;
      f = new Date(qy, qq * 3, 1); t = new Date(qy, qq * 3 + 3, 0);
      pf = new Date(qy, qq * 3 - 3, 1); pt = new Date(qy, qq * 3, 0); break;
    }
    case "this_year":
      f = new Date(y, 0, 1); t = new Date(y, 11, 31);
      pf = new Date(y - 1, 0, 1); pt = new Date(y - 1, 11, 31); break;
    case "custom":
      if (cf && ct) {
        f = new Date(cf); t = new Date(ct);
        const diff = t.getTime() - f.getTime();
        pt = new Date(f.getTime() - 86400000);
        pf = new Date(pt.getTime() - diff);
      } else {
        f = new Date(y, m, 1); t = new Date(y, m + 1, 0);
        pf = new Date(y, m - 1, 1); pt = new Date(y, m, 0);
      }
      break;
    default:
      f = new Date(y, m, 1); t = new Date(y, m + 1, 0);
      pf = new Date(y, m - 1, 1); pt = new Date(y, m, 0);
  }
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return { from: fmt(f), to: fmt(t), prevFrom: fmt(pf), prevTo: fmt(pt) };
}

function pctChange(cur: number, prev: number) {
  if (prev === 0 && cur === 0) return { text: "—", positive: true };
  if (prev === 0) return { text: "+100%", positive: true };
  const pct = (cur - prev) / prev * 100;
  return { text: (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%", positive: pct >= 0 };
}

const fmtMoney = (n: number) => "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function getDeal(inv: CrmInvRow) {
  const d = inv.deals as Record<string, unknown> | null;
  if (!d) return null;
  return {
    deal_number: d.deal_number as string,
    department: d.department as string | null,
    visa_type: d.visa_type as string | null,
    assigned_sales_id: d.assigned_sales_id as string | null,
    contacts: d.contacts as { first_name: string; last_name: string } | null,
    companies: d.companies as { company_name: string } | null,
  };
}

function downloadCSV(headers: string[], rows: (string | number)[][], filename: string) {
  const esc = (v: string | number) => { const s = String(v); return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [headers.map(esc).join(","), ...rows.map(r => r.map(esc).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function RevenueReportPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [allCrm, setAllCrm] = useState<CrmInvRow[]>([]);
  const [allComm, setAllComm] = useState<CommInvRow[]>([]);
  const [allForeign, setAllForeign] = useState<ForeignPayRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [studentDeptMap, setStudentDeptMap] = useState<Record<string, string>>({});

  const [detailSearch, setDetailSearch] = useState("");
  const [sortField, setSortField] = useState("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/admin"); return; }
      const { data: p } = await supabase.from("profiles").select("role, roles").eq("id", session.user.id).single();
      if (!p || !hasAnyRole(p, ["admin", "accountant"])) { router.push("/crm"); return; }

      // Fetch all data
      const [crmRes, commRes, foreignRes, profilesRes] = await Promise.all([
        supabase.from("invoices")
          .select("id, invoice_number, total, paid_amount, issue_date, currency, status, deal_id, deals(deal_number, department, visa_type, assigned_sales_id, contacts(first_name, last_name), companies(company_name))")
          .not("status", "eq", "cancelled").order("issue_date", { ascending: false }).limit(5000),
        supabase.from("commission_invoices")
          .select("id, invoice_number, total, paid_amount, issue_date, school_name, status, commission_invoice_items(amount, student_id)")
          .not("status", "eq", "cancelled").order("issue_date", { ascending: false }).limit(5000),
        supabase.from("foreign_currency_payments")
          .select("id, amount, currency, nzd_equivalent, payment_date")
          .order("payment_date", { ascending: false }).limit(5000),
        supabase.from("profiles").select("id, full_name, department"),
      ]);

      setAllCrm((crmRes.data ?? []) as CrmInvRow[]);
      const commData = (commRes.data ?? []) as CommInvRow[];
      setAllComm(commData);
      setAllForeign((foreignRes.data ?? []) as ForeignPayRow[]);
      setProfiles((profilesRes.data ?? []) as ProfileRow[]);

      // Build student → department map
      const sids = new Set<string>();
      for (const inv of commData) {
        for (const item of inv.commission_invoice_items ?? []) {
          if (item.student_id) sids.add(item.student_id);
        }
      }
      const deptMap: Record<string, string> = {};
      if (sids.size > 0) {
        const arr = [...sids];
        for (let i = 0; i < arr.length; i += 100) {
          const { data: sData } = await supabase.from("students").select("id, department").in("id", arr.slice(i, i + 100));
          for (const s of sData ?? []) { if (s.department) deptMap[s.id] = s.department; }
        }
      }
      setStudentDeptMap(deptMap);
      setIsLoading(false);
    }
    init();
  }, [router]);

  // ── Date range ──
  const { from, to, prevFrom, prevTo } = getDateRange(period, customFrom, customTo);

  // ── Filter by period ──
  const filterDate = (d: string, f: string, t: string) => d >= f && d <= t;
  const curCrm = allCrm.filter(i => filterDate(i.issue_date, from, to));
  const prevCrmData = allCrm.filter(i => filterDate(i.issue_date, prevFrom, prevTo));
  const curComm = allComm.filter(i => filterDate(i.issue_date, from, to));
  const prevCommData = allComm.filter(i => filterDate(i.issue_date, prevFrom, prevTo));
  const curForeign = allForeign.filter(i => filterDate(i.payment_date, from, to));
  const prevForeignData = allForeign.filter(i => filterDate(i.payment_date, prevFrom, prevTo));

  // ── Summary metrics ──
  const crmNzdInvoices = curCrm.filter(i => i.currency === "NZD");
  const crmRevenue = crmNzdInvoices.reduce((s, i) => s + Number(i.paid_amount || 0), 0);
  const commRevenue = curComm.reduce((s, i) => s + Number(i.paid_amount || 0), 0);
  const foreignRevenue = curForeign.reduce((s, i) => s + Number(i.nzd_equivalent || 0), 0);
  const totalRevenue = crmRevenue + commRevenue + foreignRevenue;

  const prevCrmRev = prevCrmData.filter(i => i.currency === "NZD").reduce((s, i) => s + Number(i.paid_amount || 0), 0);
  const prevCommRev = prevCommData.reduce((s, i) => s + Number(i.paid_amount || 0), 0);
  const prevForeignRev = prevForeignData.reduce((s, i) => s + Number(i.nzd_equivalent || 0), 0);
  const prevTotal = prevCrmRev + prevCommRev + prevForeignRev;

  const totalChange = pctChange(totalRevenue, prevTotal);
  const crmChange = pctChange(crmRevenue, prevCrmRev);
  const commChange = pctChange(commRevenue, prevCommRev);
  const foreignChange = pctChange(foreignRevenue, prevForeignRev);

  // ── Department chart data ──
  const deptData = DEPTS.map(dept => {
    const crmAmt = curCrm.filter(i => i.currency === "NZD").reduce((s, i) => {
      const d = getDeal(i);
      return d?.department === dept ? s + Number(i.paid_amount || 0) : s;
    }, 0);

    let commAmt = 0;
    for (const inv of curComm) {
      const ratio = Number(inv.total) > 0 ? Number(inv.paid_amount || 0) / Number(inv.total) : 0;
      for (const item of inv.commission_invoice_items ?? []) {
        if (item.student_id && studentDeptMap[item.student_id] === dept) {
          commAmt += Number(item.amount || 0) * ratio;
        }
      }
    }

    return { name: DEPT_LABELS[dept] ?? dept, CRM: Math.round(crmAmt * 100) / 100, Commission: Math.round(commAmt * 100) / 100 };
  });

  // ── Visa type chart data ──
  const visaMap: Record<string, number> = {};
  for (const inv of curCrm) {
    const d = getDeal(inv);
    const vt = d?.visa_type || "Unknown";
    visaMap[vt] = (visaMap[vt] || 0) + Number(inv.paid_amount || 0);
  }
  const visaSorted = Object.entries(visaMap).sort((a, b) => b[1] - a[1]);
  const top10Visa = visaSorted.slice(0, 10);
  const otherVisa = visaSorted.slice(10).reduce((s, [, v]) => s + v, 0);
  const visaData = [...top10Visa.map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))];
  if (otherVisa > 0) visaData.push({ name: "Other", value: Math.round(otherVisa * 100) / 100 });

  // ── Monthly trend (last 12 months) ──
  const months: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const monthlyData = months.map(ym => {
    const crmAmt = allCrm.filter(i => i.currency === "NZD" && i.issue_date.startsWith(ym)).reduce((s, i) => s + Number(i.paid_amount || 0), 0);
    const commAmt = allComm.filter(i => i.issue_date.startsWith(ym)).reduce((s, i) => s + Number(i.paid_amount || 0), 0);
    const label = new Date(ym + "-01").toLocaleDateString("en-NZ", { month: "short", year: "2-digit" });
    return { name: label, CRM: Math.round(crmAmt), Commission: Math.round(commAmt) };
  });

  // ── Revenue by Sales ──
  const profileMap = new Map(profiles.map(p => [p.id, p]));
  const salesMap: Record<string, { deals: number; billed: number; collected: number; outstanding: number }> = {};
  for (const inv of curCrm) {
    const d = getDeal(inv);
    const sid = d?.assigned_sales_id;
    if (!sid) continue;
    if (!salesMap[sid]) salesMap[sid] = { deals: 0, billed: 0, collected: 0, outstanding: 0 };
    salesMap[sid].deals++;
    salesMap[sid].billed += Number(inv.total || 0);
    salesMap[sid].collected += Number(inv.paid_amount || 0);
    salesMap[sid].outstanding += Number(inv.total || 0) - Number(inv.paid_amount || 0);
  }
  const salesData = Object.entries(salesMap)
    .map(([id, v]) => ({ id, name: profileMap.get(id)?.full_name ?? "Unknown", ...v, rate: v.billed > 0 ? (v.collected / v.billed * 100) : 0 }))
    .sort((a, b) => b.collected - a.collected);

  // ── Revenue Detail ──
  type DetailRow = { date: string; invoiceNumber: string; client: string; type: "CRM" | "Commission"; amount: number; currency: string; department: string; sales: string };
  const detailRows: DetailRow[] = [];
  for (const inv of curCrm) {
    const d = getDeal(inv);
    const contact = d?.contacts;
    const company = d?.companies;
    detailRows.push({
      date: inv.issue_date,
      invoiceNumber: inv.invoice_number,
      client: contact ? `${contact.first_name} ${contact.last_name}` : company?.company_name ?? "—",
      type: "CRM",
      amount: Number(inv.paid_amount || 0),
      currency: inv.currency,
      department: DEPT_LABELS[d?.department ?? ""] ?? d?.department ?? "—",
      sales: profileMap.get(d?.assigned_sales_id ?? "")?.full_name ?? "—",
    });
  }
  for (const inv of curComm) {
    detailRows.push({
      date: inv.issue_date,
      invoiceNumber: inv.invoice_number,
      client: inv.school_name,
      type: "Commission",
      amount: Number(inv.paid_amount || 0),
      currency: "NZD",
      department: "—",
      sales: "—",
    });
  }

  // Sort
  const sortedDetail = [...detailRows].sort((a, b) => {
    const av = a[sortField as keyof DetailRow] ?? "";
    const bv = b[sortField as keyof DetailRow] ?? "";
    if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
    return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });
  const q = detailSearch.toLowerCase();
  const filteredDetail = q ? sortedDetail.filter(r => r.invoiceNumber.toLowerCase().includes(q) || r.client.toLowerCase().includes(q) || r.department.toLowerCase().includes(q) || r.sales.toLowerCase().includes(q)) : sortedDetail;

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const selectClass = "rounded-lg border border-white/20 bg-blue-900 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none";
  const inputClass = "rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none";

  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-blue-950"><p className="text-white/60">Loading...</p></div>;

  return (
    <div className="min-h-screen bg-blue-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <h2 className="text-2xl font-bold mb-6">Revenue Report</h2>

        {/* ── Period Selector ──────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-3 mb-8">
          {PERIODS.map(p => (
            <button key={p.value} onClick={() => setPeriod(p.value)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${period === p.value ? "bg-blue-600 text-white" : "bg-white/5 text-white/60 hover:bg-white/10"}`}>
              {p.label}
            </button>
          ))}
          {period === "custom" && (
            <div className="flex gap-2 items-center">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className={inputClass} />
              <span className="text-white/40">to</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className={inputClass} />
            </div>
          )}
        </div>

        {/* ── Summary Cards ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Revenue", value: totalRevenue, change: totalChange },
            { label: "CRM Deal Revenue (NZD)", value: crmRevenue, change: crmChange },
            { label: "Commission Revenue", value: commRevenue, change: commChange },
            { label: "Foreign Currency Revenue", value: foreignRevenue, change: foreignChange },
          ].map(card => (
            <div key={card.label} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-white/50 text-xs mb-1">{card.label}</p>
              <p className="text-xl font-bold">{fmtMoney(card.value)}</p>
              <p className={`text-xs mt-1 ${card.change.positive ? "text-green-400" : "text-red-400"}`}>
                {card.change.text} vs prior period
              </p>
            </div>
          ))}
        </div>

        {/* ── Charts Row: Department + Visa Type ─────────────────────── */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Department */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-lg font-semibold mb-4">Revenue by Department</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={deptData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="name" tick={{ fill: "#ffffff80", fontSize: 12 }} />
                <YAxis tick={{ fill: "#ffffff80", fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "#1e3a5f", border: "1px solid #ffffff20", borderRadius: 8, color: "#fff" }}
                  formatter={(value) => [fmtMoney(Number(value ?? 0))]} />
                <Legend />
                <Bar dataKey="CRM" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Commission" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Visa Type */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-lg font-semibold mb-4">Revenue by Visa Type</h3>
            {visaData.length === 0 ? (
              <p className="text-white/40 text-sm text-center py-20">No data for this period</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={visaData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                    {visaData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#1e3a5f", border: "1px solid #ffffff20", borderRadius: 8, color: "#fff" }}
                    formatter={(value) => [fmtMoney(Number(value ?? 0))]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── Monthly Revenue Trend ───────────────────────────────────── */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-8">
          <h3 className="text-lg font-semibold mb-4">Monthly Revenue Trend (Last 12 Months)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="name" tick={{ fill: "#ffffff80", fontSize: 12 }} />
              <YAxis tick={{ fill: "#ffffff80", fontSize: 12 }} />
              <Tooltip contentStyle={{ background: "#1e3a5f", border: "1px solid #ffffff20", borderRadius: 8, color: "#fff" }}
                formatter={(value) => [fmtMoney(Number(value ?? 0))]} />
              <Legend />
              <Line type="monotone" dataKey="CRM" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Commission" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ── Revenue by Sales ────────────────────────────────────────── */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Revenue by Sales</h3>
            <button onClick={() => {
              const headers = ["Sales", "Deals", "Total Billed", "Total Collected", "Outstanding", "Collection Rate"];
              const rows = salesData.map(s => [s.name, s.deals, s.billed.toFixed(2), s.collected.toFixed(2), s.outstanding.toFixed(2), s.rate.toFixed(1) + "%"]);
              downloadCSV(headers, rows, `revenue-by-sales-${from}-to-${to}.csv`);
            }} className="text-xs text-blue-400 hover:underline">Export CSV</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-white/50">
                  <th className="px-4 py-3 font-medium">Sales</th>
                  <th className="px-4 py-3 font-medium text-right">Deals</th>
                  <th className="px-4 py-3 font-medium text-right">Total Billed</th>
                  <th className="px-4 py-3 font-medium text-right">Total Collected</th>
                  <th className="px-4 py-3 font-medium text-right">Outstanding</th>
                  <th className="px-4 py-3 font-medium text-right">Collection Rate</th>
                </tr>
              </thead>
              <tbody>
                {salesData.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-white/40">No data</td></tr>
                ) : salesData.map(s => (
                  <tr key={s.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-right">{s.deals}</td>
                    <td className="px-4 py-3 text-right">{fmtMoney(s.billed)}</td>
                    <td className="px-4 py-3 text-right font-medium text-green-400">{fmtMoney(s.collected)}</td>
                    <td className="px-4 py-3 text-right text-orange-400">{fmtMoney(s.outstanding)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={s.rate >= 80 ? "text-green-400" : s.rate >= 50 ? "text-yellow-400" : "text-red-400"}>
                        {s.rate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Revenue Detail ─────────────────────────────────────────── */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h3 className="text-lg font-semibold">Revenue Detail</h3>
            <div className="flex gap-3 items-center">
              <input placeholder="Search invoices..." value={detailSearch} onChange={e => setDetailSearch(e.target.value)} className={`${inputClass} w-48`} />
              <button onClick={() => {
                const headers = ["Date", "Invoice #", "Client/School", "Type", "Amount", "Currency", "Department", "Sales"];
                const rows = filteredDetail.map(r => [r.date, r.invoiceNumber, r.client, r.type, r.amount.toFixed(2), r.currency, r.department, r.sales]);
                downloadCSV(headers, rows, `revenue-detail-${from}-to-${to}.csv`);
              }} className="text-xs text-blue-400 hover:underline whitespace-nowrap">Export CSV</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-white/50">
                  {[
                    { key: "date", label: "Date" },
                    { key: "invoiceNumber", label: "Invoice #" },
                    { key: "client", label: "Client / School" },
                    { key: "type", label: "Type" },
                    { key: "amount", label: "Amount", right: true },
                    { key: "currency", label: "Ccy" },
                    { key: "department", label: "Department" },
                    { key: "sales", label: "Sales" },
                  ].map(col => (
                    <th key={col.key} onClick={() => handleSort(col.key)}
                      className={`px-4 py-3 font-medium cursor-pointer hover:text-white/80 select-none ${col.right ? "text-right" : ""}`}>
                      {col.label} {sortField === col.key ? (sortDir === "asc" ? "↑" : "↓") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredDetail.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-white/40">No data</td></tr>
                ) : filteredDetail.slice(0, 100).map((r, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 text-white/60">{r.date}</td>
                    <td className="px-4 py-3 font-medium">{r.invoiceNumber}</td>
                    <td className="px-4 py-3">{r.client}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.type === "CRM" ? "bg-blue-500/20 text-blue-400" : "bg-green-500/20 text-green-400"}`}>{r.type}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{fmtMoney(r.amount)}</td>
                    <td className="px-4 py-3 text-white/60">{r.currency}</td>
                    <td className="px-4 py-3 text-white/60">{r.department}</td>
                    <td className="px-4 py-3 text-white/60">{r.sales}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredDetail.length > 100 && <p className="text-center text-white/40 text-xs py-2">Showing first 100 of {filteredDetail.length} rows</p>}
          </div>
        </div>
      </main>
    </div>
  );
}
