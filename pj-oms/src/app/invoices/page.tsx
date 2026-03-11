"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { hasAnyRole } from "@/lib/roles";
import Navbar from "@/components/Navbar";

type InvoiceRow = {
  id: string;
  invoice_number: string;
  deal_id: string;
  currency: string;
  status: string;
  total: number;
  issue_date: string;
  due_date: string | null;
  sent_at: string | null;
  sent_to_email: string | null;
  pdf_url: string | null;
  xero_invoice_id: string | null;
  created_at: string;
  deals: {
    deal_number: string | null;
    contacts: { first_name: string; last_name: string } | null;
    companies: { company_name: string } | null;
  } | null;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", sent: "Sent", paid: "Paid", cancelled: "Cancelled", overdue: "Overdue", partial: "Partial",
};
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-500/20 text-gray-400",
  sent: "bg-blue-500/20 text-blue-400",
  paid: "bg-green-500/20 text-green-400",
  cancelled: "bg-red-500/20 text-red-400",
  overdue: "bg-orange-500/20 text-orange-400",
  partial: "bg-yellow-500/20 text-yellow-400",
};

const CURRENCY_SYMBOLS: Record<string, string> = { NZD: "NZ$", CNY: "\u00A5", THB: "\u0E3F" };

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCurrency, setFilterCurrency] = useState("");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/admin"); return; }
      const { data: profileData } = await supabase.from("profiles").select("role, roles").eq("id", session.user.id).single();
      if (!profileData || !hasAnyRole(profileData, ["admin", "accountant"])) { router.push("/crm"); return; }
      await fetchInvoices();
      setIsLoading(false);
    }
    init();
  }, [router]);

  const fetchInvoices = async () => {
    const { data } = await supabase
      .from("invoices")
      .select("*, deals(deal_number, contacts(first_name, last_name), companies(company_name))")
      .order("created_at", { ascending: false });
    if (data) setInvoices(data as unknown as InvoiceRow[]);
  };

  const handleMarkPaid = async (id: string) => {
    setActionLoading(id);
    await supabase.from("invoices").update({ status: "paid" }).eq("id", id);
    await fetchInvoices();
    setActionLoading(null);
  };

  const handleCancel = async (id: string) => {
    setActionLoading(id);
    await supabase.from("invoices").update({ status: "cancelled" }).eq("id", id);
    await fetchInvoices();
    setActionLoading(null);
  };

  const handleGeneratePdf = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/invoices/${id}/generate-pdf`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.url) window.open(data.url, "_blank");
      }
    } catch {}
    await fetchInvoices();
    setActionLoading(null);
  };

  const handleSend = async (id: string) => {
    setActionLoading(id);
    try {
      await fetch(`/api/invoices/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    } catch {}
    await fetchInvoices();
    setActionLoading(null);
  };

  const [xeroMsg, setXeroMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handlePushToXero = async (id: string) => {
    setActionLoading(id);
    setXeroMsg(null);
    try {
      const res = await fetch("/api/xero/create-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXeroMsg({ type: "error", text: data.error || "Failed to push to Xero" });
      } else {
        setXeroMsg({ type: "success", text: `Pushed to Xero: ${data.xero_invoice_number || "OK"}` });
      }
    } catch (e) {
      setXeroMsg({ type: "error", text: `Xero error: ${e instanceof Error ? e.message : "Unknown"}` });
    }
    await fetchInvoices();
    setActionLoading(null);
  };

  const filtered = invoices.filter(inv => {
    if (filterStatus && inv.status !== filterStatus) return false;
    if (filterCurrency && inv.currency !== filterCurrency) return false;
    if (search) {
      const q = search.toLowerCase();
      const clientName = inv.deals?.contacts
        ? `${inv.deals.contacts.first_name} ${inv.deals.contacts.last_name}`
        : inv.deals?.companies?.company_name ?? "";
      if (!inv.invoice_number.toLowerCase().includes(q) && !clientName.toLowerCase().includes(q) && !(inv.deals?.deal_number ?? "").toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  const fmt = (n: number, currency: string) => {
    const sym = CURRENCY_SYMBOLS[currency] ?? "$";
    return sym + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const selectClass = "rounded-lg border border-white/20 bg-blue-900 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none";
  const inputClass = "rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none";

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-blue-950"><p className="text-white/60">Loading...</p></div>;
  }

  return (
    <div className="min-h-screen bg-blue-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Invoices</h2>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoice #, client, deal..." className={`${inputClass} w-64`} />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={selectClass}>
            <option value="" className="bg-blue-900">All Statuses</option>
            <option value="draft" className="bg-blue-900">Draft</option>
            <option value="sent" className="bg-blue-900">Sent</option>
            <option value="partial" className="bg-blue-900">Partial</option>
            <option value="paid" className="bg-blue-900">Paid</option>
            <option value="cancelled" className="bg-blue-900">Cancelled</option>
          </select>
          <select value={filterCurrency} onChange={e => setFilterCurrency(e.target.value)} className={selectClass}>
            <option value="" className="bg-blue-900">All Currencies</option>
            <option value="NZD" className="bg-blue-900">NZD</option>
            <option value="CNY" className="bg-blue-900">CNY</option>
            <option value="THB" className="bg-blue-900">THB</option>
          </select>
        </div>

        {xeroMsg && (
          <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${xeroMsg.type === "success" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
            {xeroMsg.text}
          </div>
        )}

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-white/40">
            <p className="text-lg">No invoices found.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="text-left py-3 px-4 text-white/50 font-medium">Invoice #</th>
                    <th className="text-left py-3 px-4 text-white/50 font-medium">Deal</th>
                    <th className="text-left py-3 px-4 text-white/50 font-medium">Client</th>
                    <th className="text-left py-3 px-4 text-white/50 font-medium">Ccy</th>
                    <th className="text-right py-3 px-4 text-white/50 font-medium">Amount</th>
                    <th className="text-left py-3 px-4 text-white/50 font-medium">Status</th>
                    <th className="text-left py-3 px-4 text-white/50 font-medium">Date</th>
                    <th className="text-left py-3 px-4 text-white/50 font-medium">Xero</th>
                    <th className="py-3 px-4 text-white/50 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(inv => {
                    const clientName = inv.deals?.contacts
                      ? `${inv.deals.contacts.first_name} ${inv.deals.contacts.last_name}`
                      : inv.deals?.companies?.company_name ?? "—";
                    return (
                      <tr key={inv.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-3 px-4 font-medium text-white/90">{inv.invoice_number}</td>
                        <td className="py-3 px-4">
                          <Link href={`/deals/${inv.deal_id}`} className="text-blue-400 hover:underline text-xs">
                            {inv.deals?.deal_number ?? inv.deal_id.slice(0, 8)}
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-white/70">{clientName}</td>
                        <td className="py-3 px-4 text-white/60">{inv.currency}</td>
                        <td className="py-3 px-4 text-right font-semibold">{fmt(inv.total, inv.currency)}</td>
                        <td className="py-3 px-4">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_COLORS[inv.status] ?? "bg-gray-500/20 text-gray-400"}`}>
                            {STATUS_LABELS[inv.status] ?? inv.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-white/60 text-xs">{inv.issue_date}</td>
                        <td className="py-3 px-4">
                          {inv.xero_invoice_id ? (
                            <span className="rounded-full px-2 py-0.5 text-xs font-bold bg-green-500/20 text-green-400" title={inv.xero_invoice_id}>Pushed</span>
                          ) : (inv.status === "draft" || inv.status === "sent") ? (
                            <button onClick={() => handlePushToXero(inv.id)} disabled={actionLoading === inv.id} className="text-xs text-purple-400 hover:text-purple-300 disabled:opacity-50">{actionLoading === inv.id ? "Pushing..." : "Push to Xero"}</button>
                          ) : (
                            <span className="text-xs text-white/30">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2 text-xs">
                            {inv.pdf_url ? (
                              <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">PDF</a>
                            ) : (
                              <button onClick={() => handleGeneratePdf(inv.id)} disabled={actionLoading === inv.id} className="text-blue-400 hover:text-blue-300 disabled:opacity-50">Gen PDF</button>
                            )}
                            {inv.status === "draft" && (
                              <button onClick={() => handleSend(inv.id)} disabled={actionLoading === inv.id} className="text-green-400 hover:text-green-300 disabled:opacity-50">Send</button>
                            )}
                            {inv.status !== "paid" && inv.status !== "cancelled" && (
                              <Link href={`/deals/${inv.deal_id}`} className="text-green-400 hover:text-green-300">Record Pay</Link>
                            )}
                            {inv.status !== "cancelled" && inv.status !== "paid" && (
                              <button onClick={() => handleCancel(inv.id)} disabled={actionLoading === inv.id} className="text-red-400 hover:text-red-300 disabled:opacity-50">Cancel</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
