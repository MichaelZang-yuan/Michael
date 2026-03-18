"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { hasAnyRole } from "@/lib/roles";
import Navbar from "@/components/Navbar";

type ForeignPayment = {
  id: string;
  invoice_id: string | null;
  deal_id: string | null;
  amount: number;
  currency: string;
  exchange_rate: number | null;
  nzd_equivalent: number | null;
  payment_date: string;
  payment_method: string | null;
  payment_reference: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  invoices: {
    invoice_number: string;
    deal_id: string;
    deals: {
      deal_number: string;
      contacts: { first_name: string; last_name: string } | null;
      companies: { company_name: string } | null;
    } | null;
  } | null;
};

const CURRENCY_SYMBOLS: Record<string, string> = { CNY: "¥", THB: "฿" };
const STATUS_COLORS: Record<string, string> = {
  received: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400",
  confirmed: "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400",
  disputed: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400",
};

export default function ForeignPaymentsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [payments, setPayments] = useState<ForeignPayment[]>([]);
  const [filterCurrency, setFilterCurrency] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/admin"); return; }
      const { data: profileData } = await supabase.from("profiles").select("role, roles").eq("id", session.user.id).single();
      if (!profileData || !hasAnyRole(profileData, ["admin", "accountant"])) { router.push("/crm"); return; }
      await fetchPayments();
      setIsLoading(false);
    }
    init();
  }, [router]);

  const fetchPayments = async (currency?: string, status?: string) => {
    let url = "/api/foreign-payments?";
    if (currency) url += `currency=${currency}&`;
    if (status) url += `status=${status}&`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.payments) setPayments(data.payments);
  };

  useEffect(() => {
    if (!isLoading) fetchPayments(filterCurrency || undefined, filterStatus || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCurrency, filterStatus]);

  // Summary calculations
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const quarter = Math.floor(now.getMonth() / 3);
  const quarterStart = new Date(now.getFullYear(), quarter * 3, 1).toISOString().split("T")[0];

  const totalCNY = payments.filter(p => p.currency === "CNY").reduce((s, p) => s + Number(p.amount), 0);
  const totalTHB = payments.filter(p => p.currency === "THB").reduce((s, p) => s + Number(p.amount), 0);
  const totalNZD = payments.reduce((s, p) => s + Number(p.nzd_equivalent || 0), 0);
  const monthPayments = payments.filter(p => p.payment_date.startsWith(thisMonth));
  const monthNZD = monthPayments.reduce((s, p) => s + Number(p.nzd_equivalent || 0), 0);
  const quarterPayments = payments.filter(p => p.payment_date >= quarterStart);
  const quarterNZD = quarterPayments.reduce((s, p) => s + Number(p.nzd_equivalent || 0), 0);

  const getClientName = (p: ForeignPayment) => {
    const inv = p.invoices as unknown as Record<string, unknown> | null;
    if (!inv) return "—";
    const deal = inv.deals as unknown as Record<string, unknown> | null;
    if (!deal) return "—";
    const contact = deal.contacts as { first_name: string; last_name: string } | null;
    const company = deal.companies as { company_name: string } | null;
    return contact ? `${contact.first_name} ${contact.last_name}` : company?.company_name ?? "—";
  };

  const selectClass = "rounded-lg border border-gray-300 dark:border-white/20 bg-white dark:bg-blue-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none";

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-blue-950"><p className="text-gray-500 dark:text-white/60">Loading...</p></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-blue-950 text-gray-900 dark:text-white">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <h2 className="text-2xl font-bold mb-6">Foreign Currency Payments</h2>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4">
            <p className="text-gray-500 dark:text-white/50 text-xs mb-1">Total CNY</p>
            <p className="text-xl font-bold">¥{totalCNY.toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4">
            <p className="text-gray-500 dark:text-white/50 text-xs mb-1">Total THB</p>
            <p className="text-xl font-bold">฿{totalTHB.toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4">
            <p className="text-gray-500 dark:text-white/50 text-xs mb-1">Total NZD Equiv.</p>
            <p className="text-xl font-bold">${totalNZD.toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4">
            <p className="text-gray-500 dark:text-white/50 text-xs mb-1">This Month (NZD)</p>
            <p className="text-xl font-bold">${monthNZD.toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4">
            <p className="text-gray-500 dark:text-white/50 text-xs mb-1">This Quarter (NZD)</p>
            <p className="text-xl font-bold">${quarterNZD.toFixed(2)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6">
          <select value={filterCurrency} onChange={e => setFilterCurrency(e.target.value)} className={selectClass}>
            <option value="">All Currencies</option>
            <option value="CNY">CNY</option>
            <option value="THB">THB</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={selectClass}>
            <option value="">All Statuses</option>
            <option value="received">Received</option>
            <option value="confirmed">Confirmed</option>
            <option value="disputed">Disputed</option>
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/10 text-left text-gray-500 dark:text-white/50">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Currency</th>
                <th className="px-4 py-3 font-medium text-right">Rate</th>
                <th className="px-4 py-3 font-medium text-right">NZD Equiv.</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Ref</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-500 dark:text-white/40">No foreign currency payments found</td></tr>
              ) : payments.map((p) => {
                const inv = p.invoices as unknown as Record<string, unknown> | null;
                const invNumber = (inv?.invoice_number as string) ?? "—";
                return (
                  <tr key={p.id} className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5">
                    <td className="px-4 py-3 text-gray-500 dark:text-white/60">{p.payment_date}</td>
                    <td className="px-4 py-3 font-medium">{invNumber}</td>
                    <td className="px-4 py-3">{getClientName(p)}</td>
                    <td className="px-4 py-3 text-right font-medium">{CURRENCY_SYMBOLS[p.currency] ?? ""}{Number(p.amount).toFixed(2)}</td>
                    <td className="px-4 py-3">{p.currency}</td>
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-white/60">{p.exchange_rate ?? "—"}</td>
                    <td className="px-4 py-3 text-right">${Number(p.nzd_equivalent || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-white/60">{p.payment_method?.replace("_", " ") ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-white/60 max-w-[120px] truncate">{p.payment_reference ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[p.status] ?? ""}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
