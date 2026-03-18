"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
  deal_id: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  deal_approval_request: "Approval",
  deal_approval_result: "Approval",
  contract_signed: "Contract",
  visa_submitted: "Visa",
  visa_result: "Visa",
  intake_completed: "Intake",
  stage_update: "Stage",
  refund_request: "Refund",
  invoice_overdue: "Invoice",
};

const TYPE_COLORS: Record<string, string> = {
  deal_approval_request: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400",
  deal_approval_result: "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400",
  contract_signed: "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400",
  visa_submitted: "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400",
  visa_result: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
  intake_completed: "bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400",
  refund_request: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400",
  invoice_overdue: "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
};

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const d = new Date(dateStr).getTime();
  const diffMs = now - d;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const LIMIT = 30;

  const fetchNotifications = useCallback(async (uid: string, off: number, unreadOnly: boolean, type: string) => {
    const params = new URLSearchParams({
      user_id: uid,
      limit: String(LIMIT),
      offset: String(off),
    });
    if (unreadOnly) params.set("unread_only", "true");
    if (type !== "all") params.set("type", type);

    const res = await fetch(`/api/notifications?${params}`);
    if (res.ok) {
      const data = await res.json();
      return { notifications: data.notifications as Notification[], total: data.total as number };
    }
    return { notifications: [], total: 0 };
  }, []);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/admin"); return; }
      setUserId(session.user.id);

      const result = await fetchNotifications(session.user.id, 0, filter === "unread", typeFilter);
      setNotifications(result.notifications);
      setTotal(result.total);
      setIsLoading(false);
    }
    init();
  }, [router, fetchNotifications, filter, typeFilter]);

  const handleLoadMore = async () => {
    if (!userId) return;
    const newOffset = offset + LIMIT;
    const result = await fetchNotifications(userId, newOffset, filter === "unread", typeFilter);
    setNotifications(prev => [...prev, ...result.notifications]);
    setOffset(newOffset);
  };

  const handleMarkRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: "PUT" });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const handleMarkAllRead = async () => {
    if (!userId) return;
    await fetch("/api/notifications/read-all", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleClick = async (n: Notification) => {
    if (!n.is_read) await handleMarkRead(n.id);
    if (n.link) router.push(n.link);
  };

  const filterClass = (active: boolean) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      active ? "bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white" : "text-gray-500 dark:text-white/60 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5"
    }`;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-blue-950 text-gray-900 dark:text-white">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/crm" className="text-sm text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/80 mb-2 inline-block">← Dashboard</Link>
            <h2 className="text-2xl font-bold sm:text-3xl">Notifications</h2>
            <p className="text-sm text-gray-500 dark:text-white/50 mt-1">{total} total{unreadCount > 0 ? ` · ${unreadCount} unread` : ""}</p>
          </div>
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead} className="rounded-lg border border-gray-300 dark:border-white/20 px-4 py-2 text-sm font-bold hover:bg-gray-100 dark:hover:bg-white/10">
              Mark All as Read
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-2 items-center">
          <button onClick={() => { setFilter("all"); setOffset(0); }} className={filterClass(filter === "all")}>
            All
          </button>
          <button onClick={() => { setFilter("unread"); setOffset(0); }} className={filterClass(filter === "unread")}>
            Unread
          </button>
          <span className="text-gray-500 dark:text-white/20 mx-1">|</span>
          <select
            value={typeFilter}
            onChange={e => { setTypeFilter(e.target.value); setOffset(0); }}
            className="rounded-lg border border-gray-300 dark:border-white/20 bg-white dark:bg-blue-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
          >
            <option value="all" className="bg-white dark:bg-blue-900">All Types</option>
            <option value="deal_approval_request" className="bg-white dark:bg-blue-900">Approval Requests</option>
            <option value="deal_approval_result" className="bg-white dark:bg-blue-900">Approval Results</option>
            <option value="contract_signed" className="bg-white dark:bg-blue-900">Contract Signed</option>
            <option value="visa_submitted" className="bg-white dark:bg-blue-900">Visa Submitted</option>
            <option value="visa_result" className="bg-white dark:bg-blue-900">Visa Results</option>
            <option value="intake_completed" className="bg-white dark:bg-blue-900">Intake Completed</option>
            <option value="refund_request" className="bg-white dark:bg-blue-900">Refund Requests</option>
            <option value="invoice_overdue" className="bg-white dark:bg-blue-900">Invoice Overdue</option>
          </select>
        </div>

        {/* Notification List */}
        {isLoading ? (
          <p className="text-gray-500 dark:text-white/50 text-center py-20">Loading...</p>
        ) : notifications.length === 0 ? (
          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-12 text-center">
            <p className="text-xl font-bold mb-2">No notifications</p>
            <p className="text-gray-500 dark:text-white/50">You&apos;re all caught up!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map(n => (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                className={`rounded-xl border p-4 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-white/5 flex gap-4 items-start ${
                  !n.is_read
                    ? "border-blue-400/30 bg-blue-600/5 border-l-4 border-l-blue-500 dark:border-l-blue-400"
                    : "border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02]"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${TYPE_COLORS[n.type] ?? "bg-gray-100 dark:bg-gray-500/20 text-gray-500 dark:text-gray-400"}`}>
                      {TYPE_LABELS[n.type] ?? n.type}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-white/30">{formatTimeAgo(n.created_at)}</span>
                  </div>
                  <p className={`text-sm font-semibold ${!n.is_read ? "text-gray-900 dark:text-white" : "text-gray-600 dark:text-white/70"}`}>
                    {n.title}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-white/50 mt-0.5">{n.message}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!n.is_read && (
                    <button
                      onClick={e => { e.stopPropagation(); handleMarkRead(n.id); }}
                      className="text-xs text-blue-700 dark:text-blue-400 hover:text-blue-700 dark:text-blue-300 whitespace-nowrap"
                    >
                      Mark read
                    </button>
                  )}
                  {!n.is_read && <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />}
                </div>
              </div>
            ))}

            {notifications.length < total && (
              <div className="text-center pt-4">
                <button onClick={handleLoadMore} className="rounded-lg border border-gray-300 dark:border-white/20 px-6 py-2.5 text-sm font-bold hover:bg-gray-100 dark:hover:bg-white/10">
                  Load More
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
