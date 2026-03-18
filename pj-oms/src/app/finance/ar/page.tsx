"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { hasAnyRole } from "@/lib/roles";
import Navbar from "@/components/Navbar";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

type InvoiceRow = {
  id: string;
  invoice_number: string;
  type: "crm" | "commission";
  client_name: string;
  total: number;
  paid_amount: number;
  outstanding: number;
  due_date: string;
  status: string;
  days_overdue: number;
  deal_id?: string;
};

type GroupedClient = {
  name: string;
  total_outstanding: number;
  total_overdue: number;
  invoices: InvoiceRow[];
};

const AGING_BUCKETS = [
  { label: "Current", min: -Infinity, max: 0, color: "#22c55e" },
  { label: "1-30 days", min: 1, max: 30, color: "#eab308" },
  { label: "31-60 days", min: 31, max: 60, color: "#f97316" },
  { label: "61-90 days", min: 61, max: 90, color: "#ef4444" },
  { label: "90+ days", min: 91, max: Infinity, color: "#991b1b" },
];

function getOverdueColor(days: number): string {
  if (days <= 0) return "";
  if (days <= 30) return "text-yellow-700 dark:text-yellow-400";
  if (days <= 60) return "text-orange-700 dark:text-orange-400";
  if (days <= 90) return "text-red-700 dark:text-red-400";
  return "text-red-600 font-bold";
}

function getOverdueBgColor(days: number): string {
  if (days <= 0) return "";
  if (days <= 30) return "bg-yellow-500/10";
  if (days <= 60) return "bg-orange-500/10";
  if (days <= 90) return "bg-red-500/10";
  return "bg-red-100 dark:bg-red-500/20";
}

export default function ARDashboardPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [allInvoices, setAllInvoices] = useState<InvoiceRow[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "grouped">("list");
  const [reminderLoading, setReminderLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/admin"); return; }
      const { data: profileData } = await supabase.from("profiles").select("role, roles").eq("id", session.user.id).single();
      if (!profileData || !hasAnyRole(profileData, ["admin", "accountant"])) { router.push("/crm"); return; }
      await fetchAllInvoices();
      setIsLoading(false);
    }
    init();
  }, [router]);

  const fetchAllInvoices = async () => {
    const today = new Date();
    const rows: InvoiceRow[] = [];

    // Fetch CRM invoices (not paid/cancelled)
    const { data: crmInvoices } = await supabase
      .from("invoices")
      .select("id, invoice_number, total, paid_amount, due_date, status, deal_id, deals(deal_number, contacts(first_name, last_name), companies(company_name))")
      .not("status", "in", '("paid","cancelled")')
      .order("due_date", { ascending: true });

    for (const inv of crmInvoices ?? []) {
      const deal = inv.deals as unknown as Record<string, unknown> | null;
      const contact = deal?.contacts as unknown as Record<string, unknown> | null;
      const company = deal?.companies as unknown as Record<string, unknown> | null;
      const clientName = contact
        ? `${contact.first_name} ${contact.last_name}`
        : (company?.company_name as string) ?? "Unknown";

      const outstanding = Number(inv.total) - Number(inv.paid_amount || 0);
      const dueDate = inv.due_date ? new Date(inv.due_date) : null;
      const daysOverdue = dueDate ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

      if (outstanding > 0) {
        rows.push({
          id: inv.id,
          invoice_number: inv.invoice_number,
          type: "crm",
          client_name: clientName,
          total: Number(inv.total),
          paid_amount: Number(inv.paid_amount || 0),
          outstanding,
          due_date: inv.due_date || "",
          status: inv.status,
          days_overdue: daysOverdue,
          deal_id: inv.deal_id,
        });
      }
    }

    // Fetch commission invoices (not paid/cancelled)
    const { data: commInvoices } = await supabase
      .from("commission_invoices")
      .select("id, invoice_number, total, paid_amount, due_date, status, school_name")
      .not("status", "in", '("paid","cancelled")')
      .order("due_date", { ascending: true });

    for (const inv of commInvoices ?? []) {
      const outstanding = Number(inv.total) - Number(inv.paid_amount || 0);
      const dueDate = inv.due_date ? new Date(inv.due_date) : null;
      const daysOverdue = dueDate ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

      if (outstanding > 0) {
        rows.push({
          id: inv.id,
          invoice_number: inv.invoice_number,
          type: "commission",
          client_name: inv.school_name,
          total: Number(inv.total),
          paid_amount: Number(inv.paid_amount || 0),
          outstanding,
          due_date: inv.due_date || "",
          status: inv.status,
          days_overdue: daysOverdue,
        });
      }
    }

    setAllInvoices(rows);
  };

  // Calculate aging buckets
  const agingData = AGING_BUCKETS.map((bucket) => {
    const bucketInvoices = allInvoices.filter(
      (inv) => inv.days_overdue >= bucket.min && inv.days_overdue <= bucket.max
    );
    return {
      name: bucket.label,
      amount: bucketInvoices.reduce((sum, inv) => sum + inv.outstanding, 0),
      count: bucketInvoices.length,
      color: bucket.color,
    };
  });

  const totalReceivable = allInvoices.reduce((s, i) => s + i.outstanding, 0);
  const overdueInvoices = allInvoices.filter((i) => i.days_overdue > 0).sort((a, b) => b.days_overdue - a.days_overdue);

  // Group by client/school
  const grouped: GroupedClient[] = [];
  const groupMap = new Map<string, InvoiceRow[]>();
  for (const inv of allInvoices) {
    const key = inv.client_name;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(inv);
  }
  for (const [name, invoices] of groupMap) {
    grouped.push({
      name,
      total_outstanding: invoices.reduce((s, i) => s + i.outstanding, 0),
      total_overdue: invoices.filter(i => i.days_overdue > 0).reduce((s, i) => s + i.outstanding, 0),
      invoices: invoices.sort((a, b) => b.days_overdue - a.days_overdue),
    });
  }
  grouped.sort((a, b) => b.total_overdue - a.total_overdue);

  const handleSendReminder = async (inv: InvoiceRow) => {
    setReminderLoading(inv.id);
    setMessage(null);
    try {
      const res = await fetch("/api/send-payment-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: inv.id, invoice_type: inv.type }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage({ type: "success", text: `Reminder sent to ${data.sent_to}` });
      } else {
        setMessage({ type: "error", text: data.error || "Failed to send reminder" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    }
    setReminderLoading(null);
  };

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-blue-950"><p className="text-gray-500 dark:text-white/60">Loading...</p></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-blue-950 text-gray-900 dark:text-white">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <h2 className="text-2xl font-bold mb-6">Accounts Receivable</h2>

        {message && (
          <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${message.type === "success" ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400" : "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400"}`}>
            {message.text}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4">
            <p className="text-gray-500 dark:text-white/50 text-xs mb-1">Total Receivable</p>
            <p className="text-xl font-bold">${totalReceivable.toFixed(2)}</p>
          </div>
          {agingData.map((bucket) => (
            <div key={bucket.name} className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4">
              <p className="text-gray-500 dark:text-white/50 text-xs mb-1">{bucket.name}</p>
              <p className="text-xl font-bold" style={{ color: bucket.amount > 0 ? bucket.color : undefined }}>
                ${bucket.amount.toFixed(2)}
              </p>
              <p className="text-gray-500 dark:text-white/30 text-xs">{bucket.count} invoice{bucket.count !== 1 ? "s" : ""}</p>
            </div>
          ))}
        </div>

        {/* AR Aging Chart */}
        <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4">AR Aging</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agingData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" fontSize={12} />
                <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e3a5f", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8 }}
                  labelStyle={{ color: "white" }}
                  formatter={(value) => [`$${Number(value ?? 0).toFixed(2)}`, "Amount"]}
                />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                  {agingData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setViewMode("list")}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${viewMode === "list" ? "bg-blue-600" : "bg-gray-100 dark:bg-white/10 hover:bg-white/20"}`}
          >
            Overdue List
          </button>
          <button
            onClick={() => setViewMode("grouped")}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${viewMode === "grouped" ? "bg-blue-600" : "bg-gray-100 dark:bg-white/10 hover:bg-white/20"}`}
          >
            By Client/School
          </button>
        </div>

        {/* Overdue List View */}
        {viewMode === "list" && (
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-white/10 text-left text-gray-500 dark:text-white/50">
                  <th className="px-4 py-3 font-medium">Invoice #</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Client / School</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                  <th className="px-4 py-3 font-medium text-right">Paid</th>
                  <th className="px-4 py-3 font-medium text-right">Outstanding</th>
                  <th className="px-4 py-3 font-medium">Due Date</th>
                  <th className="px-4 py-3 font-medium">Days Overdue</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {overdueInvoices.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500 dark:text-white/40">No overdue invoices</td></tr>
                ) : overdueInvoices.map((inv) => (
                  <tr key={inv.id} className={`border-b border-gray-100 dark:border-white/5 ${getOverdueBgColor(inv.days_overdue)}`}>
                    <td className="px-4 py-3 font-medium">
                      {inv.type === "crm" && inv.deal_id ? (
                        <Link href={`/deals/${inv.deal_id}`} className="text-blue-700 dark:text-blue-400 hover:underline">{inv.invoice_number}</Link>
                      ) : inv.type === "commission" ? (
                        <Link href="/commission/invoices" className="text-blue-700 dark:text-blue-400 hover:underline">{inv.invoice_number}</Link>
                      ) : (
                        inv.invoice_number
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs rounded-full px-2 py-0.5 ${inv.type === "crm" ? "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400" : "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400"}`}>
                        {inv.type === "crm" ? "CRM" : "Commission"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{inv.client_name}</td>
                    <td className="px-4 py-3 text-right">${inv.total.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-white/60">${inv.paid_amount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-medium">${inv.outstanding.toFixed(2)}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-white/60">{inv.due_date}</td>
                    <td className={`px-4 py-3 font-medium ${getOverdueColor(inv.days_overdue)}`}>
                      {inv.days_overdue > 0 ? `${inv.days_overdue} days` : "Current"}
                    </td>
                    <td className="px-4 py-3">
                      {inv.days_overdue >= 30 && (
                        <button
                          onClick={() => handleSendReminder(inv)}
                          disabled={reminderLoading === inv.id}
                          className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium hover:bg-orange-500 disabled:opacity-50"
                        >
                          {reminderLoading === inv.id ? "Sending..." : "Send Reminder"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Grouped View */}
        {viewMode === "grouped" && (
          <div className="space-y-4">
            {grouped.length === 0 ? (
              <p className="text-gray-500 dark:text-white/40 text-center py-8">No outstanding invoices</p>
            ) : grouped.map((group) => (
              <details key={group.name} className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 overflow-hidden">
                <summary className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5">
                  <div className="flex items-center gap-4">
                    <span className="font-medium">{group.name}</span>
                    <span className="text-gray-500 dark:text-white/50 text-sm">{group.invoices.length} invoice{group.invoices.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <span>Outstanding: <span className="font-bold">${group.total_outstanding.toFixed(2)}</span></span>
                    {group.total_overdue > 0 && (
                      <span className="text-red-700 dark:text-red-400">Overdue: <span className="font-bold">${group.total_overdue.toFixed(2)}</span></span>
                    )}
                  </div>
                </summary>
                <div className="border-t border-gray-200 dark:border-white/10">
                  <table className="w-full text-sm">
                    <tbody>
                      {group.invoices.map((inv) => (
                        <tr key={inv.id} className={`border-b border-gray-100 dark:border-white/5 ${getOverdueBgColor(inv.days_overdue)}`}>
                          <td className="px-4 py-2 font-medium">
                            {inv.type === "crm" && inv.deal_id ? (
                              <Link href={`/deals/${inv.deal_id}`} className="text-blue-700 dark:text-blue-400 hover:underline">{inv.invoice_number}</Link>
                            ) : (
                              <Link href="/commission/invoices" className="text-blue-700 dark:text-blue-400 hover:underline">{inv.invoice_number}</Link>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <span className={`text-xs rounded-full px-2 py-0.5 ${inv.type === "crm" ? "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400" : "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400"}`}>
                              {inv.type === "crm" ? "CRM" : "Commission"}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right">${inv.outstanding.toFixed(2)}</td>
                          <td className="px-4 py-2 text-gray-500 dark:text-white/60">{inv.due_date}</td>
                          <td className={`px-4 py-2 ${getOverdueColor(inv.days_overdue)}`}>
                            {inv.days_overdue > 0 ? `${inv.days_overdue}d overdue` : "Current"}
                          </td>
                          <td className="px-4 py-2">
                            {inv.days_overdue >= 30 && (
                              <button onClick={() => handleSendReminder(inv)} disabled={reminderLoading === inv.id}
                                className="rounded-lg bg-orange-600 px-2 py-1 text-xs hover:bg-orange-500 disabled:opacity-50">
                                Remind
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
