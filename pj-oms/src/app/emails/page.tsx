"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import { hasRole } from "@/lib/roles";

type EmailLog = {
  id: string;
  created_at: string;
  deal_id: string | null;
  contact_id: string | null;
  email_type: string | null;
  recipient_email: string | null;
  recipient_name: string | null;
  subject: string | null;
  status: string | null;
  sent_by: string | null;
  deals: { deal_number: string | null } | null;
};

const EMAIL_TYPE_LABELS: Record<string, string> = {
  welcome: "Welcome",
  contract_sent: "Contract Sent",
  contract_signed: "Contract Signed",
  intake_form_sent: "Intake Form Sent",
  intake_completed: "Intake Completed",
  payment_received: "Payment Received",
  application_submitted: "Application Submitted",
  application_approved: "Application Approved",
  application_declined: "Application Declined",
  commission_claimed: "Commission Claimed",
  other: "Other",
};

const PAGE_SIZE = 25;

export default function EmailsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedBody, setExpandedBody] = useState<string | null>(null);
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/admin"); return; }
      const { data } = await supabase.from("profiles").select("role, roles").eq("id", session.user.id).single();
      if (!data || !hasRole(data, "admin")) { router.push("/crm"); return; }
      setIsLoading(false);
    }
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (isLoading) return;
    fetchLogs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterType, filterStatus, isLoading]);

  const fetchLogs = async () => {
    let query = supabase.from("email_logs")
      .select("id, created_at, deal_id, contact_id, email_type, recipient_email, recipient_name, subject, status, sent_by, deals(deal_number)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (filterType) query = query.eq("email_type", filterType);
    if (filterStatus) query = query.eq("status", filterStatus);

    const { data, count } = await query;
    setLogs((data ?? []) as unknown as EmailLog[]);
    setTotal(count ?? 0);

    // Fetch sender names
    const uids = [...new Set((data ?? []).filter(l => l.sent_by).map(l => l.sent_by as string))];
    if (uids.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", uids);
      const map: Record<string, string> = {};
      for (const p of profs ?? []) map[(p as { id: string; full_name: string | null }).id] = (p as { id: string; full_name: string | null }).full_name ?? "Unknown";
      setUserNames(prev => ({ ...prev, ...map }));
    }
  };

  const fetchBody = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); setExpandedBody(null); return; }
    const { data } = await supabase.from("email_logs").select("body").eq("id", id).single();
    setExpandedId(id);
    setExpandedBody(data?.body ?? "(no body)");
  };

  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-blue-950"><p className="text-gray-500 dark:text-white/60">Loading...</p></div>;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-blue-950 text-gray-900 dark:text-white">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">

        <div className="mb-8">
          <h1 className="text-2xl font-bold sm:text-3xl">Email Logs</h1>
          <p className="mt-1 text-gray-500 dark:text-white/60">All sent notifications — {total} records</p>
        </div>

        {/* Filters */}
        <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4 mb-6 flex flex-wrap gap-3 items-center">
          <select
            value={filterType}
            onChange={e => { setFilterType(e.target.value); setPage(0); }}
            className="rounded-lg border border-gray-300 dark:border-white/20 bg-white dark:bg-blue-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
          >
            <option value="">All Types</option>
            {Object.entries(EMAIL_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v} className="bg-white dark:bg-blue-900">{l}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(0); }}
            className="rounded-lg border border-gray-300 dark:border-white/20 bg-white dark:bg-blue-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
          >
            <option value="">All Status</option>
            <option value="sent" className="bg-white dark:bg-blue-900">Sent</option>
            <option value="failed" className="bg-white dark:bg-blue-900">Failed</option>
          </select>
          {(filterType || filterStatus) && (
            <button onClick={() => { setFilterType(""); setFilterStatus(""); setPage(0); }}
              className="text-sm text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white underline">
              Clear filters
            </button>
          )}
        </div>

        {/* Table */}
        <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-white/10">
                  <th className="text-left px-4 py-3 text-gray-500 dark:text-white/50 font-medium">Date</th>
                  <th className="text-left px-4 py-3 text-gray-500 dark:text-white/50 font-medium">Type</th>
                  <th className="text-left px-4 py-3 text-gray-500 dark:text-white/50 font-medium">Deal</th>
                  <th className="text-left px-4 py-3 text-gray-500 dark:text-white/50 font-medium">Recipient</th>
                  <th className="text-left px-4 py-3 text-gray-500 dark:text-white/50 font-medium">Subject</th>
                  <th className="text-left px-4 py-3 text-gray-500 dark:text-white/50 font-medium">Sent By</th>
                  <th className="text-left px-4 py-3 text-gray-500 dark:text-white/50 font-medium">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-white/40">No email logs found.</td>
                  </tr>
                ) : logs.map(log => (
                  <>
                    <tr key={log.id} className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5">
                      <td className="px-4 py-3 text-gray-600 dark:text-white/70 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleDateString()}{" "}
                        {new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 text-xs font-medium">
                          {EMAIL_TYPE_LABELS[log.email_type ?? ""] ?? log.email_type ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {log.deal_id ? (
                          <Link href={`/deals/${log.deal_id}`} className="text-blue-700 dark:text-blue-400 hover:underline text-xs">
                            {(log.deals as { deal_number: string | null } | null)?.deal_number ?? log.deal_id.slice(0, 8)}
                          </Link>
                        ) : <span className="text-gray-500 dark:text-white/30">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-700 dark:text-white/80">{log.recipient_name ?? "—"}</div>
                        <div className="text-gray-500 dark:text-white/40 text-xs">{log.recipient_email ?? ""}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-white/70 max-w-xs truncate">{log.subject ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-white/60 text-xs">{log.sent_by ? (userNames[log.sent_by] ?? "Unknown") : "System"}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${log.status === "sent" ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400" : "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400"}`}>
                          {log.status ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => fetchBody(log.id)} className="text-xs text-gray-500 dark:text-white/40 hover:text-gray-900 dark:hover:text-white">
                          {expandedId === log.id ? "Hide" : "Body"}
                        </button>
                      </td>
                    </tr>
                    {expandedId === log.id && expandedBody && (
                      <tr key={`${log.id}-body`} className="border-b border-gray-100 dark:border-white/5 bg-white/3">
                        <td colSpan={8} className="px-4 py-3">
                          <pre className="text-xs text-gray-500 dark:text-white/60 whitespace-pre-wrap font-mono max-h-40 overflow-y-auto bg-black/20 rounded p-3" dangerouslySetInnerHTML={{ __html: expandedBody }} />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-500 dark:text-white/50">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => p - 1)} disabled={page === 0}
                className="rounded-lg border border-gray-300 dark:border-white/20 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30">
                ← Prev
              </button>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}
                className="rounded-lg border border-gray-300 dark:border-white/20 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30">
                Next →
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
