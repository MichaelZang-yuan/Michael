"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { hasAnyRole } from "@/lib/roles";
import Navbar from "@/components/Navbar";

type CommissionInvoice = {
  id: string;
  invoice_number: string;
  school_id: string;
  school_name: string;
  issue_date: string;
  due_date: string;
  status: string;
  subtotal: number;
  gst_amount: number;
  total: number;
  paid_amount: number;
  currency: string;
  xero_invoice_id: string | null;
  created_at: string;
  commission_invoice_items: { count: number }[];
};

type InvoiceDetail = {
  id: string;
  invoice_number: string;
  school_name: string;
  issue_date: string;
  due_date: string;
  status: string;
  subtotal: number;
  gst_amount: number;
  total: number;
  paid_amount: number;
  currency: string;
  xero_invoice_id: string | null;
  notes: string | null;
  commission_invoice_items: {
    id: string;
    student_name: string;
    student_number: string | null;
    course_name: string | null;
    enrollment_date: string | null;
    tuition_fee: number | null;
    commission_rate: number | null;
    amount: number;
    description: string | null;
  }[];
  commission_invoice_payments: {
    id: string;
    amount: number;
    payment_date: string;
    payment_method: string | null;
    notes: string | null;
    created_at: string;
  }[];
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", sent: "Sent", paid: "Paid", cancelled: "Cancelled", partial: "Partial",
};
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-500/20 text-gray-400",
  sent: "bg-blue-500/20 text-blue-400",
  paid: "bg-green-500/20 text-green-400",
  cancelled: "bg-red-500/20 text-red-400",
  partial: "bg-yellow-500/20 text-yellow-400",
};

export default function CommissionInvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<CommissionInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Detail modal state
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Record payment modal
  const [paymentModal, setPaymentModal] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentNotes, setPaymentNotes] = useState("");

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
    const res = await fetch("/api/commission-invoices" + (filterStatus ? `?status=${filterStatus}` : ""));
    const data = await res.json();
    if (data.invoices) setInvoices(data.invoices);
  };

  useEffect(() => {
    if (!isLoading) fetchInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    const res = await fetch(`/api/commission-invoices/${id}`);
    const data = await res.json();
    if (data.invoice) setDetail(data.invoice);
    setDetailLoading(false);
  };

  const handlePushToXero = async (id: string) => {
    setActionLoading(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/commission-invoices/${id}/push-xero`, { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setMessage({ type: "success", text: `Pushed to Xero: ${data.xero_invoice_number}` });
        await fetchInvoices();
        if (detail?.id === id) openDetail(id);
      } else {
        setMessage({ type: "error", text: data.error || "Push to Xero failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    }
    setActionLoading(null);
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Cancel this invoice? This cannot be undone.")) return;
    setActionLoading(id);
    await supabase.from("commission_invoices").update({ status: "cancelled" }).eq("id", id);
    await fetchInvoices();
    if (detail?.id === id) setDetail(null);
    setActionLoading(null);
  };

  const handleRecordPayment = async () => {
    if (!paymentModal || !paymentAmount) return;
    setActionLoading(paymentModal);
    try {
      const res = await fetch(`/api/commission-invoices/${paymentModal}/record-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(paymentAmount),
          payment_date: paymentDate,
          payment_method: paymentMethod,
          notes: paymentNotes || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage({ type: "success", text: "Payment recorded" });
        setPaymentModal(null);
        setPaymentAmount("");
        setPaymentNotes("");
        await fetchInvoices();
        if (detail?.id === paymentModal) openDetail(paymentModal);
      } else {
        setMessage({ type: "error", text: data.error || "Failed to record payment" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    }
    setActionLoading(null);
  };

  const handleGeneratePdf = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/commission-invoices/${id}/generate-pdf`, { method: "POST" });
      const data = await res.json();
      if (data.ok && data.url) {
        window.open(data.url, "_blank");
      } else {
        setMessage({ type: "error", text: data.error || "Failed to generate PDF" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    }
    setActionLoading(null);
  };

  const filtered = invoices.filter((inv) => {
    if (search) {
      const s = search.toLowerCase();
      if (!inv.invoice_number.toLowerCase().includes(s) && !inv.school_name.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const selectClass = "rounded-lg border border-white/20 bg-blue-900 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none";
  const inputClass = "w-full rounded-lg border border-white/20 bg-blue-900 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-blue-400 focus:outline-none";
  const btnClass = "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors";

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-blue-950"><p className="text-white/60">Loading...</p></div>;
  }

  return (
    <div className="min-h-screen bg-blue-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Commission Invoices</h2>
        </div>

        {message && (
          <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${message.type === "success" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
            {message.text}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            placeholder="Search invoice # or school..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={inputClass + " max-w-xs"}
          />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectClass}>
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-white/50">
                <th className="px-4 py-3 font-medium">Invoice #</th>
                <th className="px-4 py-3 font-medium">School</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Items</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium text-right">Paid</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Xero</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-white/40">No commission invoices found</td></tr>
              ) : filtered.map((inv) => {
                const itemCount = inv.commission_invoice_items?.[0]?.count ?? 0;
                return (
                  <tr key={inv.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 font-medium">
                      <button onClick={() => openDetail(inv.id)} className="text-blue-400 hover:underline">
                        {inv.invoice_number}
                      </button>
                    </td>
                    <td className="px-4 py-3">{inv.school_name}</td>
                    <td className="px-4 py-3 text-white/60">{inv.issue_date}</td>
                    <td className="px-4 py-3 text-center">{itemCount}</td>
                    <td className="px-4 py-3 text-right font-medium">${Number(inv.total).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-white/60">${Number(inv.paid_amount).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[inv.status] ?? "bg-gray-500/20 text-gray-400"}`}>
                        {STATUS_LABELS[inv.status] ?? inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {inv.xero_invoice_id ? (
                        <span className="text-green-400 text-xs">Synced</span>
                      ) : (
                        <span className="text-white/30 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {!inv.xero_invoice_id && inv.status !== "cancelled" && (
                          <button
                            onClick={() => handlePushToXero(inv.id)}
                            disabled={actionLoading === inv.id}
                            className={`${btnClass} bg-blue-600 hover:bg-blue-500 disabled:opacity-50`}
                          >
                            Push Xero
                          </button>
                        )}
                        {inv.status !== "paid" && inv.status !== "cancelled" && (
                          <button
                            onClick={() => { setPaymentModal(inv.id); setPaymentAmount(""); }}
                            className={`${btnClass} bg-green-600 hover:bg-green-500`}
                          >
                            Payment
                          </button>
                        )}
                        <button
                          onClick={() => handleGeneratePdf(inv.id)}
                          disabled={actionLoading === inv.id}
                          className={`${btnClass} bg-white/10 hover:bg-white/20 disabled:opacity-50`}
                        >
                          PDF
                        </button>
                        {inv.status === "draft" && (
                          <button
                            onClick={() => handleCancel(inv.id)}
                            disabled={actionLoading === inv.id}
                            className={`${btnClass} bg-red-600/20 text-red-400 hover:bg-red-600/40 disabled:opacity-50`}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="mt-4 flex gap-6 text-sm text-white/50">
          <span>Total: {filtered.length} invoices</span>
          <span>Outstanding: ${filtered.filter(i => i.status !== "paid" && i.status !== "cancelled").reduce((s, i) => s + Number(i.total) - Number(i.paid_amount), 0).toFixed(2)}</span>
        </div>
      </main>

      {/* Detail Modal */}
      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => { setDetail(null); setDetailLoading(false); }}>
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-white/10 bg-blue-950 p-6" onClick={(e) => e.stopPropagation()}>
            {detailLoading ? (
              <p className="text-white/60">Loading...</p>
            ) : detail && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold">{detail.invoice_number}</h3>
                    <p className="text-white/50 text-sm">{detail.school_name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[detail.status] ?? ""}`}>
                      {STATUS_LABELS[detail.status] ?? detail.status}
                    </span>
                    <button onClick={() => setDetail(null)} className="text-white/40 hover:text-white text-xl">&times;</button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                  <div><span className="text-white/50">Issue Date:</span> {detail.issue_date}</div>
                  <div><span className="text-white/50">Due Date:</span> {detail.due_date}</div>
                  <div><span className="text-white/50">Currency:</span> {detail.currency}</div>
                  <div><span className="text-white/50">Xero:</span> {detail.xero_invoice_id ? "Synced" : "Not pushed"}</div>
                </div>

                {/* Line Items */}
                <h4 className="font-semibold mb-2">Line Items ({detail.commission_invoice_items?.length ?? 0})</h4>
                <div className="overflow-x-auto rounded-lg border border-white/10 mb-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-white/50 text-left">
                        <th className="px-3 py-2">Student</th>
                        <th className="px-3 py-2">Course</th>
                        <th className="px-3 py-2">Intake</th>
                        <th className="px-3 py-2 text-right">Tuition</th>
                        <th className="px-3 py-2 text-right">Rate</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detail.commission_invoice_items ?? []).map((item) => (
                        <tr key={item.id} className="border-b border-white/5">
                          <td className="px-3 py-2">{item.student_name}{item.student_number ? ` (${item.student_number})` : ""}</td>
                          <td className="px-3 py-2 text-white/60">{item.course_name || "—"}</td>
                          <td className="px-3 py-2 text-white/60">{item.enrollment_date || "—"}</td>
                          <td className="px-3 py-2 text-right text-white/60">{item.tuition_fee ? `$${Number(item.tuition_fee).toFixed(2)}` : "—"}</td>
                          <td className="px-3 py-2 text-right text-white/60">{item.commission_rate ? `${item.commission_rate}%` : "—"}</td>
                          <td className="px-3 py-2 text-right font-medium">${Number(item.amount).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="text-right space-y-1 text-sm mb-6">
                  <div><span className="text-white/50">Subtotal:</span> <span className="ml-4">${Number(detail.subtotal).toFixed(2)}</span></div>
                  <div><span className="text-white/50">GST (15%):</span> <span className="ml-4">${Number(detail.gst_amount).toFixed(2)}</span></div>
                  <div className="text-lg font-bold"><span className="text-white/50">Total:</span> <span className="ml-4">${Number(detail.total).toFixed(2)}</span></div>
                  {Number(detail.paid_amount) > 0 && (
                    <div className="text-green-400"><span className="text-white/50">Paid:</span> <span className="ml-4">${Number(detail.paid_amount).toFixed(2)}</span></div>
                  )}
                </div>

                {/* Payments */}
                {detail.commission_invoice_payments && detail.commission_invoice_payments.length > 0 && (
                  <>
                    <h4 className="font-semibold mb-2">Payment History</h4>
                    <div className="space-y-2 mb-6">
                      {detail.commission_invoice_payments.map((p) => (
                        <div key={p.id} className="flex justify-between text-sm rounded-lg bg-white/5 px-3 py-2">
                          <span>{p.payment_date} — {p.payment_method || "N/A"}</span>
                          <span className="font-medium text-green-400">${Number(p.amount).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t border-white/10">
                  {!detail.xero_invoice_id && detail.status !== "cancelled" && (
                    <button onClick={() => handlePushToXero(detail.id)} disabled={actionLoading === detail.id}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold hover:bg-blue-500 disabled:opacity-50">
                      Push to Xero
                    </button>
                  )}
                  {detail.status !== "paid" && detail.status !== "cancelled" && (
                    <button onClick={() => { setPaymentModal(detail.id); setPaymentAmount(""); }}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold hover:bg-green-500">
                      Record Payment
                    </button>
                  )}
                  <button onClick={() => handleGeneratePdf(detail.id)} disabled={actionLoading === detail.id}
                    className="rounded-lg bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20 disabled:opacity-50">
                    Generate PDF
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPaymentModal(null)}>
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-blue-950 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Record Payment</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/50 mb-1">Amount</label>
                <input type="number" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className={inputClass} placeholder="0.00" />
              </div>
              <div>
                <label className="block text-sm text-white/50 mb-1">Date</label>
                <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm text-white/50 mb-1">Method</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={selectClass + " w-full"}>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-white/50 mb-1">Notes</label>
                <input value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} className={inputClass} placeholder="Optional" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={handleRecordPayment} disabled={!paymentAmount || actionLoading === paymentModal}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold hover:bg-green-500 disabled:opacity-50">
                  {actionLoading === paymentModal ? "Saving..." : "Save Payment"}
                </button>
                <button onClick={() => setPaymentModal(null)} className="rounded-lg bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
