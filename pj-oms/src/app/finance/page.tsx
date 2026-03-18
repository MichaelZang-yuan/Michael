"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { hasAnyRole } from "@/lib/roles";
import Navbar from "@/components/Navbar";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from "recharts";

const PIE_COLORS = ["#3b82f6", "#22c55e", "#f59e0b"];
const fmtMoney = (n: number) => "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PERIODS = [
  { value: "this_month", label: "This Month" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "this_year", label: "This Year" },
];

function getPeriodRange(period: string) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  let f: Date, t: Date;
  switch (period) {
    case "this_month":
      f = new Date(y, m, 1); t = new Date(y, m + 1, 0); break;
    case "this_quarter": {
      const q = Math.floor(m / 3);
      f = new Date(y, q * 3, 1); t = new Date(y, q * 3 + 3, 0); break;
    }
    case "this_year":
      f = new Date(y, 0, 1); t = new Date(y, 11, 31); break;
    default:
      f = new Date(y, m, 1); t = new Date(y, m + 1, 0);
  }
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return { from: fmt(f), to: fmt(t) };
}

type OverdueRow = { id: string; invoice_number: string; client: string; outstanding: number; days_overdue: number; type: "CRM" | "Commission" };
type RefundRow = { id: string; deal_number: string; client_name: string; calculated_refund: number; requested_at: string };

export default function FinanceDashboardPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState("this_month");

  // Core metrics
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [outstanding, setOutstanding] = useState(0);
  const [overdue, setOverdue] = useState(0);
  const [commPending, setCommPending] = useState(0);

  // Charts
  const [cashFlowData, setCashFlowData] = useState<{ name: string; Revenue: number }[]>([]);
  const [revenueMix, setRevenueMix] = useState<{ name: string; value: number }[]>([]);

  // Lists
  const [overdueInvoices, setOverdueInvoices] = useState<OverdueRow[]>([]);
  const [pendingRefunds, setPendingRefunds] = useState<RefundRow[]>([]);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/admin"); return; }
      const { data: p } = await supabase.from("profiles").select("role, roles").eq("id", session.user.id).single();
      if (!p || !hasAnyRole(p, ["admin", "accountant"])) { router.push("/crm"); return; }
      setIsLoading(false);
    }
    init();
  }, [router]);

  useEffect(() => {
    if (isLoading) return;
    fetchDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, period]);

  const fetchDashboard = async () => {
    const { from, to } = getPeriodRange(period);
    const today = new Date().toISOString().split("T")[0];

    // ── 1. Revenue for this period ──
    const [crmRes, commRes, foreignRes] = await Promise.all([
      supabase.from("invoices")
        .select("paid_amount, currency, issue_date")
        .not("status", "eq", "cancelled")
        .gte("issue_date", from).lte("issue_date", to).limit(5000),
      supabase.from("commission_invoices")
        .select("paid_amount, issue_date")
        .not("status", "eq", "cancelled")
        .gte("issue_date", from).lte("issue_date", to).limit(5000),
      supabase.from("foreign_currency_payments")
        .select("nzd_equivalent, payment_date")
        .gte("payment_date", from).lte("payment_date", to).limit(5000),
    ]);

    const crmRev = (crmRes.data ?? []).filter(i => i.currency === "NZD").reduce((s, i) => s + Number(i.paid_amount || 0), 0);
    const commRev = (commRes.data ?? []).reduce((s, i) => s + Number(i.paid_amount || 0), 0);
    const foreignRev = (foreignRes.data ?? []).reduce((s, i) => s + Number(i.nzd_equivalent || 0), 0);
    setTotalRevenue(crmRev + commRev + foreignRev);

    // Revenue mix
    setRevenueMix([
      { name: "CRM Deals", value: Math.round(crmRev * 100) / 100 },
      { name: "Commission", value: Math.round(commRev * 100) / 100 },
      { name: "Foreign Currency", value: Math.round(foreignRev * 100) / 100 },
    ].filter(d => d.value > 0));

    // ── 2. Outstanding ──
    const [outCrmRes, outCommRes] = await Promise.all([
      supabase.from("invoices")
        .select("total, paid_amount, due_date, invoice_number, deal_id, deals(contacts(first_name, last_name), companies(company_name))")
        .not("status", "in", '("paid","cancelled")').limit(5000),
      supabase.from("commission_invoices")
        .select("total, paid_amount, due_date, invoice_number, school_name")
        .not("status", "in", '("paid","cancelled")').limit(5000),
    ]);

    let totalOutstanding = 0;
    let totalOverdue = 0;
    const overdueList: OverdueRow[] = [];

    for (const inv of outCrmRes.data ?? []) {
      const out = Number(inv.total || 0) - Number(inv.paid_amount || 0);
      totalOutstanding += out;
      if (inv.due_date && inv.due_date < today) {
        totalOverdue += out;
        const daysOverdue = Math.floor((new Date().getTime() - new Date(inv.due_date).getTime()) / 86400000);
        const deal = inv.deals as unknown as Record<string, unknown> | null;
        const contact = deal?.contacts as { first_name: string; last_name: string } | null;
        const company = deal?.companies as { company_name: string } | null;
        overdueList.push({
          id: inv.invoice_number,
          invoice_number: inv.invoice_number,
          client: contact ? `${contact.first_name} ${contact.last_name}` : company?.company_name ?? "Unknown",
          outstanding: out,
          days_overdue: daysOverdue,
          type: "CRM",
        });
      }
    }
    for (const inv of outCommRes.data ?? []) {
      const out = Number(inv.total || 0) - Number(inv.paid_amount || 0);
      totalOutstanding += out;
      if (inv.due_date && inv.due_date < today) {
        totalOverdue += out;
        const daysOverdue = Math.floor((new Date().getTime() - new Date(inv.due_date).getTime()) / 86400000);
        overdueList.push({
          id: inv.invoice_number,
          invoice_number: inv.invoice_number,
          client: inv.school_name,
          outstanding: out,
          days_overdue: daysOverdue,
          type: "Commission",
        });
      }
    }

    setOutstanding(totalOutstanding);
    setOverdue(totalOverdue);
    overdueList.sort((a, b) => b.days_overdue - a.days_overdue);
    setOverdueInvoices(overdueList.slice(0, 10));

    // ── 3. Commission Pending ──
    const { data: pendingComm } = await supabase
      .from("commissions")
      .select("amount")
      .eq("status", "pending");
    setCommPending((pendingComm ?? []).reduce((s, c) => s + Number(c.amount || 0), 0));

    // ── 4. Monthly Cash Flow (last 6 months) ──
    const flowMonths: { label: string; ym: string }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      flowMonths.push({ label: d.toLocaleDateString("en-NZ", { month: "short", year: "2-digit" }), ym });
    }

    // Query payments for last 6 months
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split("T")[0];
    const [flowCrmRes, flowCommRes, flowForeignRes] = await Promise.all([
      supabase.from("invoices")
        .select("paid_amount, currency, issue_date")
        .not("status", "eq", "cancelled")
        .gte("issue_date", sixMonthsAgo).limit(5000),
      supabase.from("commission_invoices")
        .select("paid_amount, issue_date")
        .not("status", "eq", "cancelled")
        .gte("issue_date", sixMonthsAgo).limit(5000),
      supabase.from("foreign_currency_payments")
        .select("nzd_equivalent, payment_date")
        .gte("payment_date", sixMonthsAgo).limit(5000),
    ]);

    const flowData = flowMonths.map(({ label, ym }) => {
      const crm = (flowCrmRes.data ?? []).filter(i => i.currency === "NZD" && i.issue_date?.startsWith(ym)).reduce((s, i) => s + Number(i.paid_amount || 0), 0);
      const comm = (flowCommRes.data ?? []).filter(i => i.issue_date?.startsWith(ym)).reduce((s, i) => s + Number(i.paid_amount || 0), 0);
      const foreign = (flowForeignRes.data ?? []).filter(i => i.payment_date?.startsWith(ym)).reduce((s, i) => s + Number(i.nzd_equivalent || 0), 0);
      return { name: label, Revenue: Math.round((crm + comm + foreign) * 100) / 100 };
    });
    setCashFlowData(flowData);

    // ── 5. Pending Refunds ──
    const { data: refundsData } = await supabase
      .from("refund_requests")
      .select("id, deal_number, client_name, calculated_refund, requested_at")
      .eq("status", "pending")
      .order("requested_at", { ascending: false })
      .limit(10);
    setPendingRefunds((refundsData ?? []) as RefundRow[]);
  };

  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-blue-950"><p className="text-gray-500 dark:text-white/60">Loading...</p></div>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-blue-950 text-gray-900 dark:text-white">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h2 className="text-2xl font-bold">Financial Dashboard</h2>
          <div className="flex gap-2">
            {PERIODS.map(p => (
              <button key={p.value} onClick={() => setPeriod(p.value)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${period === p.value ? "bg-blue-600 text-white" : "bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/10"}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Row 1: Core Metrics ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-5">
            <p className="text-gray-500 dark:text-white/50 text-xs mb-1">Total Revenue</p>
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">{fmtMoney(totalRevenue)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-5">
            <p className="text-gray-500 dark:text-white/50 text-xs mb-1">Outstanding</p>
            <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">{fmtMoney(outstanding)}</p>
          </div>
          <div className={`rounded-xl border p-5 ${overdue > 0 ? "border-red-500/30 bg-red-500/5" : "border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5"}`}>
            <p className="text-gray-500 dark:text-white/50 text-xs mb-1">Overdue</p>
            <p className={`text-2xl font-bold ${overdue > 0 ? "text-red-700 dark:text-red-400" : "text-gray-900 dark:text-white"}`}>{fmtMoney(overdue)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-5">
            <p className="text-gray-500 dark:text-white/50 text-xs mb-1">Commission Pending</p>
            <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">{fmtMoney(commPending)}</p>
          </div>
        </div>

        {/* ── Row 2: Charts ───────────────────────────────────────────── */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Monthly Cash Flow */}
          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4">
            <h3 className="text-lg font-semibold mb-4">Monthly Cash Flow (Last 6 Months)</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={cashFlowData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="name" tick={{ fill: "#ffffff80", fontSize: 12 }} />
                <YAxis tick={{ fill: "#ffffff80", fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "#1e3a5f", border: "1px solid #ffffff20", borderRadius: 8, color: "#fff" }}
                  formatter={(value) => [fmtMoney(Number(value ?? 0)), "Revenue"]} />
                <Bar dataKey="Revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Revenue Mix */}
          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4">
            <h3 className="text-lg font-semibold mb-4">Revenue Mix</h3>
            {revenueMix.length === 0 ? (
              <p className="text-gray-500 dark:text-white/40 text-sm text-center py-24">No revenue data for this period</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={revenueMix} cx="50%" cy="50%" outerRadius={100} dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                    {revenueMix.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#1e3a5f", border: "1px solid #ffffff20", borderRadius: 8, color: "#fff" }}
                    formatter={(value) => [fmtMoney(Number(value ?? 0))]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── Row 3: Lists ────────────────────────────────────────────── */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Overdue Invoices */}
          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Overdue Invoices</h3>
              <Link href="/finance/ar" className="text-xs text-blue-700 dark:text-blue-400 hover:underline">View All →</Link>
            </div>
            {overdueInvoices.length === 0 ? (
              <p className="text-gray-500 dark:text-white/40 text-sm text-center py-8">No overdue invoices</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-white/10 text-left text-gray-500 dark:text-white/50">
                      <th className="px-3 py-2 font-medium">Invoice</th>
                      <th className="px-3 py-2 font-medium">Client</th>
                      <th className="px-3 py-2 font-medium text-right">Due</th>
                      <th className="px-3 py-2 font-medium text-right">Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdueInvoices.map(inv => (
                      <tr key={inv.id} className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5">
                        <td className="px-3 py-2 font-medium">
                          {inv.invoice_number}
                          <span className={`ml-1.5 text-xs rounded-full px-1.5 py-0.5 ${inv.type === "CRM" ? "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400" : "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400"}`}>{inv.type}</span>
                        </td>
                        <td className="px-3 py-2 text-gray-600 dark:text-white/70 max-w-[120px] truncate">{inv.client}</td>
                        <td className="px-3 py-2 text-right text-orange-700 dark:text-orange-400 font-medium">{fmtMoney(inv.outstanding)}</td>
                        <td className={`px-3 py-2 text-right font-bold ${inv.days_overdue > 90 ? "text-red-500" : inv.days_overdue > 60 ? "text-red-700 dark:text-red-400" : "text-orange-700 dark:text-orange-400"}`}>
                          {inv.days_overdue}d
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pending Refunds */}
          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Pending Refunds</h3>
              <Link href="/finance/refunds" className="text-xs text-blue-700 dark:text-blue-400 hover:underline">View All →</Link>
            </div>
            {pendingRefunds.length === 0 ? (
              <p className="text-gray-500 dark:text-white/40 text-sm text-center py-8">No pending refund requests</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-white/10 text-left text-gray-500 dark:text-white/50">
                      <th className="px-3 py-2 font-medium">Deal</th>
                      <th className="px-3 py-2 font-medium">Client</th>
                      <th className="px-3 py-2 font-medium text-right">Amount</th>
                      <th className="px-3 py-2 font-medium">Requested</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRefunds.map(r => (
                      <tr key={r.id} className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5">
                        <td className="px-3 py-2 font-medium">{r.deal_number}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-white/70 max-w-[120px] truncate">{r.client_name}</td>
                        <td className="px-3 py-2 text-right text-red-700 dark:text-red-400 font-bold">{fmtMoney(Number(r.calculated_refund))}</td>
                        <td className="px-3 py-2 text-gray-500 dark:text-white/60">{new Date(r.requested_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Row 4: Quick Actions ────────────────────────────────────── */}
        <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="flex flex-wrap gap-3">
            {[
              { href: "/finance/revenue", label: "View Revenue Report" },
              { href: "/finance/ar", label: "View Accounts Receivable" },
              { href: "/finance/refunds", label: "View Refunds" },
              { href: "/finance/foreign-payments", label: "View Foreign Payments" },
              { href: "/commission/invoices", label: "View Commission Invoices" },
            ].map(link => (
              <Link key={link.href} href={link.href}
                className="rounded-lg border border-gray-300 dark:border-white/20 bg-gray-50 dark:bg-white/5 px-4 py-2.5 text-sm font-medium hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
