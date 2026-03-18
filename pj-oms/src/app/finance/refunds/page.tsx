"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { hasAnyRole, hasRole } from "@/lib/roles";
import Navbar from "@/components/Navbar";

type Refund = {
  id: string;
  deal_id: string;
  deal_number: string;
  client_name: string;
  total_paid: number;
  refund_percentage: number;
  calculated_refund: number;
  approved_refund: number | null;
  actual_refund: number | null;
  deduction_details: { description: string; amount: number }[];
  total_deductions: number;
  status: string;
  refund_method: string | null;
  bank_account_details: string | null;
  reason: string;
  notes: string | null;
  review_notes: string | null;
  requested_at: string;
  reviewed_at: string | null;
  completed_at: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending", approved: "Approved", rejected: "Rejected",
  processing: "Processing", completed: "Completed", cancelled: "Cancelled",
};
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
  approved: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400",
  rejected: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400",
  processing: "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400",
  completed: "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400",
  cancelled: "bg-gray-100 dark:bg-gray-500/20 text-gray-500 dark:text-gray-400",
};
const TABS = ["all", "pending", "approved", "processing", "completed", "rejected"];

export default function RefundsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [tab, setTab] = useState("all");
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Review modal
  const [reviewRefund, setReviewRefund] = useState<Refund | null>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject">("approve");
  const [reviewNotes, setReviewNotes] = useState("");
  const [approvedAmount, setApprovedAmount] = useState("");

  // Process modal
  const [processRefund, setProcessRefund] = useState<Refund | null>(null);
  const [actualRefund, setActualRefund] = useState("");
  const [refundMethod, setRefundMethod] = useState("bank_transfer");
  const [bankDetails, setBankDetails] = useState("");

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/admin"); return; }
      setUserId(session.user.id);
      const { data: profileData } = await supabase.from("profiles").select("role, roles").eq("id", session.user.id).single();
      if (!profileData || !hasAnyRole(profileData, ["admin", "accountant"])) { router.push("/crm"); return; }
      setIsAdmin(hasRole(profileData, "admin"));
      await fetchRefunds("all");
      setIsLoading(false);
    }
    init();
  }, [router]);

  const fetchRefunds = async (status: string) => {
    const res = await fetch(`/api/refunds?status=${status}`);
    const data = await res.json();
    if (data.refunds) setRefunds(data.refunds);
  };

  useEffect(() => {
    if (!isLoading) fetchRefunds(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const handleReview = async () => {
    if (!reviewRefund) return;
    setActionLoading(reviewRefund.id);
    try {
      const res = await fetch(`/api/refunds/${reviewRefund.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: reviewAction,
          approved_refund: reviewAction === "approve" ? Number(approvedAmount) || reviewRefund.calculated_refund : undefined,
          review_notes: reviewNotes || undefined,
          reviewed_by: userId,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage({ type: "success", text: `Refund ${reviewAction === "approve" ? "approved" : "rejected"}` });
        setReviewRefund(null);
        await fetchRefunds(tab);
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } catch { setMessage({ type: "error", text: "Network error" }); }
    setActionLoading(null);
  };

  const handleProcess = async () => {
    if (!processRefund) return;
    setActionLoading(processRefund.id);
    try {
      const res = await fetch(`/api/refunds/${processRefund.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "process",
          actual_refund: Number(actualRefund) || processRefund.approved_refund,
          refund_method: refundMethod,
          bank_account_details: bankDetails || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage({ type: "success", text: "Refund being processed" });
        setProcessRefund(null);
        await fetchRefunds(tab);
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } catch { setMessage({ type: "error", text: "Network error" }); }
    setActionLoading(null);
  };

  const handleComplete = async (refund: Refund) => {
    if (!confirm("Mark this refund as completed? The deal will be cancelled.")) return;
    setActionLoading(refund.id);
    try {
      const res = await fetch(`/api/refunds/${refund.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", completed_by: userId }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage({ type: "success", text: "Refund completed. Deal cancelled." });
        await fetchRefunds(tab);
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } catch { setMessage({ type: "error", text: "Network error" }); }
    setActionLoading(null);
  };

  const inputClass = "w-full rounded-lg border border-gray-300 dark:border-white/20 bg-white dark:bg-blue-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none";
  const selectClass = "w-full rounded-lg border border-gray-300 dark:border-white/20 bg-white dark:bg-blue-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none";

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-blue-950"><p className="text-gray-500 dark:text-white/60">Loading...</p></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-blue-950 text-gray-900 dark:text-white">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <h2 className="text-2xl font-bold mb-6">Refund Management</h2>

        {message && (
          <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${message.type === "success" ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400" : "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400"}`}>
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 flex-wrap">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-2 text-sm font-medium capitalize ${tab === t ? "bg-blue-600" : "bg-gray-100 dark:bg-white/10 hover:bg-white/20"}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/10 text-left text-gray-500 dark:text-white/50">
                <th className="px-4 py-3 font-medium">Deal</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium text-right">Total Paid</th>
                <th className="px-4 py-3 font-medium text-right">Refund Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {refunds.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-white/40">No refund requests found</td></tr>
              ) : refunds.map((r) => {
                const displayAmount = r.actual_refund ?? r.approved_refund ?? r.calculated_refund;
                return (
                  <tr key={r.id} className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5">
                    <td className="px-4 py-3">
                      <Link href={`/deals/${r.deal_id}`} className="text-blue-700 dark:text-blue-400 hover:underline">{r.deal_number}</Link>
                    </td>
                    <td className="px-4 py-3">{r.client_name}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-white/60 max-w-[200px] truncate">{r.reason}</td>
                    <td className="px-4 py-3 text-right">${Number(r.total_paid).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-medium text-red-700 dark:text-red-400">${Number(displayAmount).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status] ?? ""}`}>
                        {STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-white/60">{new Date(r.requested_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {r.status === "pending" && isAdmin && (
                          <button onClick={() => { setReviewRefund(r); setReviewAction("approve"); setReviewNotes(""); setApprovedAmount(String(r.calculated_refund - r.total_deductions)); }}
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium hover:bg-blue-500" disabled={actionLoading === r.id}>
                            Review
                          </button>
                        )}
                        {r.status === "approved" && (
                          <button onClick={() => { setProcessRefund(r); setActualRefund(String(r.approved_refund ?? r.calculated_refund)); setRefundMethod("bank_transfer"); setBankDetails(""); }}
                            className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium hover:bg-orange-500" disabled={actionLoading === r.id}>
                            Process
                          </button>
                        )}
                        {r.status === "processing" && (
                          <button onClick={() => handleComplete(r)}
                            className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium hover:bg-green-500" disabled={actionLoading === r.id}>
                            Complete
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
      </main>

      {/* Review Modal */}
      {reviewRefund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setReviewRefund(null)}>
          <div className="w-full max-w-lg rounded-xl border border-gray-200 dark:border-white/10 bg-slate-50 dark:bg-blue-950 p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Review Refund Request</h3>
            <div className="space-y-3 text-sm mb-4">
              <div className="flex justify-between"><span className="text-gray-500 dark:text-white/50">Deal:</span><Link href={`/deals/${reviewRefund.deal_id}`} className="text-blue-700 dark:text-blue-400">{reviewRefund.deal_number}</Link></div>
              <div className="flex justify-between"><span className="text-gray-500 dark:text-white/50">Client:</span><span>{reviewRefund.client_name}</span></div>
              <div className="flex justify-between"><span className="text-gray-500 dark:text-white/50">Reason:</span><span>{reviewRefund.reason}</span></div>
              <div className="flex justify-between"><span className="text-gray-500 dark:text-white/50">Total Paid:</span><span>${Number(reviewRefund.total_paid).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500 dark:text-white/50">Refund %:</span><span>{reviewRefund.refund_percentage}%</span></div>
              <div className="flex justify-between"><span className="text-gray-500 dark:text-white/50">Calculated:</span><span>${Number(reviewRefund.calculated_refund).toFixed(2)}</span></div>
              {reviewRefund.deduction_details?.length > 0 && (
                <div>
                  <span className="text-gray-500 dark:text-white/50">Deductions:</span>
                  {reviewRefund.deduction_details.map((d, i) => (
                    <div key={i} className="flex justify-between ml-4 text-red-700 dark:text-red-400">
                      <span>{d.description}</span><span>-${Number(d.amount).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
              {reviewRefund.notes && <div><span className="text-gray-500 dark:text-white/50">Notes:</span> <span className="text-gray-600 dark:text-white/70">{reviewRefund.notes}</span></div>}
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex gap-2">
                <button onClick={() => setReviewAction("approve")}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${reviewAction === "approve" ? "bg-green-600" : "bg-gray-100 dark:bg-white/10"}`}>
                  Approve
                </button>
                <button onClick={() => setReviewAction("reject")}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${reviewAction === "reject" ? "bg-red-600" : "bg-gray-100 dark:bg-white/10"}`}>
                  Reject
                </button>
              </div>

              {reviewAction === "approve" && (
                <div>
                  <label className="block text-sm text-gray-500 dark:text-white/50 mb-1">Approved Amount</label>
                  <input type="number" step="0.01" value={approvedAmount} onChange={e => setApprovedAmount(e.target.value)} className={inputClass} />
                </div>
              )}

              <div>
                <label className="block text-sm text-gray-500 dark:text-white/50 mb-1">Review Notes</label>
                <textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} rows={2} className={`${inputClass} resize-none`} placeholder="Optional..." />
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={handleReview} disabled={actionLoading === reviewRefund.id}
                className={`rounded-lg px-4 py-2 text-sm font-bold ${reviewAction === "approve" ? "bg-green-600 hover:bg-green-500" : "bg-red-600 hover:bg-red-500"} disabled:opacity-50`}>
                {actionLoading === reviewRefund.id ? "..." : reviewAction === "approve" ? "Approve" : "Reject"}
              </button>
              <button onClick={() => setReviewRefund(null)} className="rounded-lg bg-gray-100 dark:bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Process Modal */}
      {processRefund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setProcessRefund(null)}>
          <div className="w-full max-w-md rounded-xl border border-gray-200 dark:border-white/10 bg-slate-50 dark:bg-blue-950 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Process Refund</h3>
            <div className="space-y-3 mb-4 text-sm">
              <div className="flex justify-between"><span className="text-gray-500 dark:text-white/50">Client:</span><span>{processRefund.client_name}</span></div>
              <div className="flex justify-between"><span className="text-gray-500 dark:text-white/50">Approved Amount:</span><span className="text-red-700 dark:text-red-400">${Number(processRefund.approved_refund ?? 0).toFixed(2)}</span></div>
            </div>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm text-gray-500 dark:text-white/50 mb-1">Actual Refund Amount</label>
                <input type="number" step="0.01" value={actualRefund} onChange={e => setActualRefund(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm text-gray-500 dark:text-white/50 mb-1">Refund Method</label>
                <select value={refundMethod} onChange={e => setRefundMethod(e.target.value)} className={selectClass}>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="original_payment">Return to Original Payment</option>
                  <option value="other">Other</option>
                </select>
              </div>
              {refundMethod === "bank_transfer" && (
                <div>
                  <label className="block text-sm text-gray-500 dark:text-white/50 mb-1">Client Bank Account</label>
                  <textarea value={bankDetails} onChange={e => setBankDetails(e.target.value)} rows={2} className={`${inputClass} resize-none`} placeholder="Bank name, account number..." />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={handleProcess} disabled={actionLoading === processRefund.id}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold hover:bg-orange-500 disabled:opacity-50">
                {actionLoading === processRefund.id ? "..." : "Start Processing"}
              </button>
              <button onClick={() => setProcessRefund(null)} className="rounded-lg bg-gray-100 dark:bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
