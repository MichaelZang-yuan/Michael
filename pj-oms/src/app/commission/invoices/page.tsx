"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { hasAnyRole, hasRole } from "@/lib/roles";
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
  notes: string | null;
  commission_invoice_items: {
    id: string;
    commission_id: string;
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

type AvailableCommission = {
  id: string;
  student_id: string;
  year: number;
  amount: number;
  tuition_fee: number | null;
  commission_rate: number | null;
  enrollment_date: string | null;
  students: { full_name: string; student_number: string | null; school_id: string };
};

type School = { id: string; name: string };

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
  const [profile, setProfile] = useState<{ role: string; roles?: string[] } | null>(null);

  // Detail modal state
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Record payment modal
  const [paymentModal, setPaymentModal] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentNotes, setPaymentNotes] = useState("");

  // Edit modal state
  const [editModal, setEditModal] = useState<InvoiceDetail | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editItemAmounts, setEditItemAmounts] = useState<Record<string, string>>({});
  const [editItemsToRemove, setEditItemsToRemove] = useState<string[]>([]);
  const [editAvailableCommissions, setEditAvailableCommissions] = useState<AvailableCommission[]>([]);
  const [editItemsToAdd, setEditItemsToAdd] = useState<string[]>([]);

  // Create invoice modal state
  const [createModal, setCreateModal] = useState(false);
  const [createSchoolId, setCreateSchoolId] = useState("");
  const [createSchools, setCreateSchools] = useState<School[]>([]);
  const [createAvailable, setCreateAvailable] = useState<AvailableCommission[]>([]);
  const [createSelected, setCreateSelected] = useState<string[]>([]);
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/admin"); return; }
      const { data: profileData } = await supabase.from("profiles").select("role, roles").eq("id", session.user.id).single();
      if (!profileData || !hasAnyRole(profileData, ["admin", "accountant"])) { router.push("/crm"); return; }
      setProfile(profileData);
      await fetchInvoices();
      setIsLoading(false);
    }
    init();
  }, [router]);

  const isAdmin = profile ? hasRole(profile, "admin") : false;

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

  const handleDelete = async (id: string, xeroId: string | null) => {
    if (xeroId) {
      alert("Cannot delete: already pushed to Xero. Please void in Xero first.");
      return;
    }
    if (!confirm("Delete this invoice? Associated commissions will be unlinked but not deleted.")) return;
    setActionLoading(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/commission-invoices/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        setMessage({ type: "success", text: "Invoice deleted" });
        await fetchInvoices();
        if (detail?.id === id) setDetail(null);
      } else {
        setMessage({ type: "error", text: data.error || "Failed to delete" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    }
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

  // --- Edit Invoice ---
  const openEditModal = async (inv: InvoiceDetail) => {
    setEditModal(inv);
    setEditNotes(inv.notes || "");
    setEditDueDate(inv.due_date);
    setEditItemsToRemove([]);
    setEditItemsToAdd([]);
    const amounts: Record<string, string> = {};
    for (const item of inv.commission_invoice_items ?? []) {
      amounts[item.id] = String(item.amount);
    }
    setEditItemAmounts(amounts);
    // Load available commissions for this school
    try {
      const res = await fetch(`/api/commission-invoices/available-commissions?school_id=${inv.school_id}`);
      const data = await res.json();
      setEditAvailableCommissions(data.commissions ?? []);
    } catch {
      setEditAvailableCommissions([]);
    }
  };

  const handleSaveEdit = async () => {
    if (!editModal) return;
    setActionLoading(editModal.id);
    setMessage(null);
    try {
      const itemAmounts: Record<string, number> = {};
      for (const [itemId, val] of Object.entries(editItemAmounts)) {
        if (editItemsToRemove.includes(itemId)) continue;
        const orig = editModal.commission_invoice_items.find(i => i.id === itemId);
        if (orig && Number(val) !== orig.amount) {
          itemAmounts[itemId] = Number(val);
        }
      }

      const res = await fetch(`/api/commission-invoices/${editModal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: editNotes,
          due_date: editDueDate,
          items_to_remove: editItemsToRemove.length > 0 ? editItemsToRemove : undefined,
          items_to_add: editItemsToAdd.length > 0 ? editItemsToAdd : undefined,
          item_amounts: Object.keys(itemAmounts).length > 0 ? itemAmounts : undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage({ type: "success", text: data.deleted ? "Invoice deleted (no items remaining)" : "Invoice updated" });
        setEditModal(null);
        await fetchInvoices();
        if (!data.deleted && detail?.id === editModal.id) openDetail(editModal.id);
        else if (data.deleted) setDetail(null);
      } else {
        setMessage({ type: "error", text: data.error || "Failed to update" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    }
    setActionLoading(null);
  };

  // --- Create Invoice ---
  const openCreateModal = async () => {
    setCreateModal(true);
    setCreateSchoolId("");
    setCreateAvailable([]);
    setCreateSelected([]);
    // Fetch schools
    const { data } = await supabase.from("schools").select("id, name").order("name");
    setCreateSchools(data ?? []);
  };

  const handleCreateSchoolChange = async (schoolId: string) => {
    setCreateSchoolId(schoolId);
    setCreateSelected([]);
    if (!schoolId) { setCreateAvailable([]); return; }
    try {
      const res = await fetch(`/api/commission-invoices/available-commissions?school_id=${schoolId}`);
      const data = await res.json();
      setCreateAvailable(data.commissions ?? []);
    } catch {
      setCreateAvailable([]);
    }
  };

  const handleCreateInvoice = async () => {
    if (!createSchoolId || createSelected.length === 0) return;
    setCreateLoading(true);
    setMessage(null);
    try {
      const school = createSchools.find(s => s.id === createSchoolId);
      const { data: { session } } = await supabase.auth.getSession();

      // Create the first item to generate the invoice
      const firstComm = createAvailable.find(c => c.id === createSelected[0]);
      if (!firstComm) { setCreateLoading(false); return; }

      const res = await fetch("/api/commission-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commission_id: firstComm.id,
          student_id: firstComm.student_id,
          student_name: firstComm.students.full_name,
          student_number: firstComm.students.student_number ?? undefined,
          school_id: createSchoolId,
          school_name: school?.name ?? "",
          enrollment_date: firstComm.enrollment_date ?? undefined,
          tuition_fee: firstComm.tuition_fee ?? undefined,
          commission_rate: firstComm.commission_rate ?? undefined,
          amount: firstComm.amount,
          created_by: session?.user.id,
        }),
      });
      const data = await res.json();

      if (data.ok && data.invoice_id && createSelected.length > 1) {
        // Add remaining items via PUT
        const remainingIds = createSelected.slice(1);
        await fetch(`/api/commission-invoices/${data.invoice_id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items_to_add: remainingIds }),
        });
      }

      if (data.ok) {
        setMessage({ type: "success", text: `Invoice ${data.invoice_number} created` });
        setCreateModal(false);
        await fetchInvoices();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to create invoice" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    }
    setCreateLoading(false);
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
          {isAdmin && (
            <button onClick={openCreateModal} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold hover:bg-blue-500">
              + Create Invoice
            </button>
          )}
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
                        {inv.status !== "cancelled" && (
                          <button
                            onClick={async () => {
                              const res = await fetch(`/api/commission-invoices/${inv.id}`);
                              const data = await res.json();
                              if (data.invoice) openEditModal(data.invoice);
                            }}
                            className={`${btnClass} bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/40`}
                          >
                            Edit
                          </button>
                        )}
                        {inv.status === "draft" && isAdmin && (
                          <button
                            onClick={() => handleDelete(inv.id, inv.xero_invoice_id)}
                            disabled={actionLoading === inv.id}
                            className={`${btnClass} bg-red-600/20 text-red-400 hover:bg-red-600/40 disabled:opacity-50`}
                          >
                            Delete
                          </button>
                        )}
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
                  {detail.notes && <div className="col-span-2"><span className="text-white/50">Notes:</span> {detail.notes}</div>}
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
                <div className="flex gap-2 flex-wrap pt-4 border-t border-white/10">
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
                  {detail.status !== "cancelled" && (
                    <button onClick={() => { openEditModal(detail); setDetail(null); }}
                      className="rounded-lg bg-yellow-600/20 px-4 py-2 text-sm font-bold text-yellow-400 hover:bg-yellow-600/40">
                      Edit
                    </button>
                  )}
                  {detail.status === "draft" && isAdmin && (
                    <button onClick={() => handleDelete(detail.id, detail.xero_invoice_id)} disabled={actionLoading === detail.id}
                      className="rounded-lg bg-red-600/20 px-4 py-2 text-sm font-bold text-red-400 hover:bg-red-600/40 disabled:opacity-50">
                      Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Edit Invoice Modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditModal(null)}>
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-white/10 bg-blue-950 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">Edit {editModal.invoice_number}</h3>
              <button onClick={() => setEditModal(null)} className="text-white/40 hover:text-white text-xl">&times;</button>
            </div>

            {editModal.xero_invoice_id && (
              <div className="mb-4 rounded-lg bg-yellow-500/20 px-4 py-3 text-sm text-yellow-400">
                Changes will not auto-sync to Xero. Push again to update.
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/50 mb-1">Due Date</label>
                <input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm text-white/50 mb-1">Notes</label>
                <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className={inputClass + " h-20"} placeholder="Optional notes..." />
              </div>

              {/* Line Items */}
              <div>
                <h4 className="font-semibold mb-2">Line Items</h4>
                <div className="space-y-2">
                  {(editModal.commission_invoice_items ?? []).map((item) => {
                    const removed = editItemsToRemove.includes(item.id);
                    return (
                      <div key={item.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${removed ? "border-red-500/30 bg-red-500/10 opacity-50" : "border-white/10 bg-white/5"}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.student_name}{item.student_number ? ` (${item.student_number})` : ""}</p>
                          <p className="text-xs text-white/50">{item.enrollment_date || "—"} | {item.commission_rate ? `${item.commission_rate}%` : "—"}</p>
                        </div>
                        <div className="w-28">
                          <input
                            type="number"
                            step="0.01"
                            value={editItemAmounts[item.id] ?? String(item.amount)}
                            onChange={(e) => setEditItemAmounts(prev => ({ ...prev, [item.id]: e.target.value }))}
                            disabled={removed}
                            className="w-full rounded border border-white/20 bg-white/10 px-2 py-1 text-sm text-right text-white disabled:opacity-30"
                          />
                        </div>
                        <button
                          onClick={() => {
                            if (removed) {
                              setEditItemsToRemove(prev => prev.filter(i => i !== item.id));
                            } else {
                              setEditItemsToRemove(prev => [...prev, item.id]);
                            }
                          }}
                          className={`text-xs px-2 py-1 rounded ${removed ? "bg-green-600/20 text-green-400" : "bg-red-600/20 text-red-400"}`}
                        >
                          {removed ? "Restore" : "Remove"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Add available commissions */}
              {editAvailableCommissions.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Add Commissions</h4>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {editAvailableCommissions.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 cursor-pointer hover:bg-white/10">
                        <input
                          type="checkbox"
                          checked={editItemsToAdd.includes(c.id)}
                          onChange={() => {
                            setEditItemsToAdd(prev =>
                              prev.includes(c.id) ? prev.filter(i => i !== c.id) : [...prev, c.id]
                            );
                          }}
                          className="accent-blue-500"
                        />
                        <span className="text-sm">{c.students.full_name} — Year {c.year} — ${Number(c.amount).toFixed(2)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t border-white/10">
                <button
                  onClick={handleSaveEdit}
                  disabled={actionLoading === editModal.id}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold hover:bg-blue-500 disabled:opacity-50"
                >
                  {actionLoading === editModal.id ? "Saving..." : "Save Changes"}
                </button>
                <button onClick={() => setEditModal(null)} className="rounded-lg bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Invoice Modal */}
      {createModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setCreateModal(false)}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-white/10 bg-blue-950 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">Create Commission Invoice</h3>
              <button onClick={() => setCreateModal(false)} className="text-white/40 hover:text-white text-xl">&times;</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/50 mb-1">School</label>
                <select
                  value={createSchoolId}
                  onChange={(e) => handleCreateSchoolChange(e.target.value)}
                  className={selectClass + " w-full"}
                >
                  <option value="">Select a school...</option>
                  {createSchools.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {createSchoolId && (
                <div>
                  <h4 className="font-semibold mb-2">
                    Available Commissions ({createAvailable.length})
                  </h4>
                  {createAvailable.length === 0 ? (
                    <p className="text-white/40 text-sm">No claimed commissions without invoice for this school.</p>
                  ) : (
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {createAvailable.map((c) => (
                        <label key={c.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 cursor-pointer hover:bg-white/10">
                          <input
                            type="checkbox"
                            checked={createSelected.includes(c.id)}
                            onChange={() => {
                              setCreateSelected(prev =>
                                prev.includes(c.id) ? prev.filter(i => i !== c.id) : [...prev, c.id]
                              );
                            }}
                            className="accent-blue-500"
                          />
                          <span className="text-sm flex-1">
                            {c.students.full_name}{c.students.student_number ? ` (${c.students.student_number})` : ""} — Year {c.year}
                          </span>
                          <span className="text-sm font-medium">${Number(c.amount).toFixed(2)}</span>
                        </label>
                      ))}
                      {createAvailable.length > 1 && (
                        <button
                          onClick={() => {
                            if (createSelected.length === createAvailable.length) {
                              setCreateSelected([]);
                            } else {
                              setCreateSelected(createAvailable.map(c => c.id));
                            }
                          }}
                          className="text-xs text-blue-400 hover:underline mt-1"
                        >
                          {createSelected.length === createAvailable.length ? "Deselect All" : "Select All"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {createSelected.length > 0 && (
                <div className="rounded-lg bg-white/5 px-4 py-3 text-sm">
                  <span className="text-white/50">Selected:</span> {createSelected.length} items — Total: $
                  {createAvailable.filter(c => createSelected.includes(c.id)).reduce((s, c) => s + c.amount, 0).toFixed(2)}
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t border-white/10">
                <button
                  onClick={handleCreateInvoice}
                  disabled={createLoading || !createSchoolId || createSelected.length === 0}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold hover:bg-blue-500 disabled:opacity-50"
                >
                  {createLoading ? "Creating..." : "Create Invoice"}
                </button>
                <button onClick={() => setCreateModal(false)} className="rounded-lg bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20">
                  Cancel
                </button>
              </div>
            </div>
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
