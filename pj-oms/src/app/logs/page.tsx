"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

const ACTION_LABELS: Record<string, string> = {
  created_student: "➕ Added Student",
  updated_student: "✏️ Updated Student",
  claimed_commission: "✅ Claimed Commission",
  unclaimed_commission: "↩️ Undid Claim",
  deleted_student: "🗑️ Deleted Student",
};

type ActivityLog = {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
};

const PAGE_SIZE = 20;

function formatDetails(action: string, details: Record<string, unknown> | null): string {
  if (!details) return "—";
  const parts: string[] = [];
  if (details.name) parts.push(`Student: ${details.name}`);
  if (details.year != null) parts.push(`Year ${details.year}`);
  if (details.amount != null) parts.push(`$${Number(details.amount).toLocaleString()} NZD`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${mins}`;
}

export default function LogsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<{ role: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<Profile[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  const [filters, setFilters] = useState({
    userId: "all",
    entityType: "all",
    dateFrom: "",
    dateTo: "",
  });

  const fetchLogs = useCallback(async () => {
    let query = supabase
      .from("activity_logs")
      .select("id, user_id, action, entity_type, entity_id, details, created_at", { count: "exact" })
      .order("created_at", { ascending: false });

    if (filters.userId !== "all") {
      query = query.eq("user_id", filters.userId);
    }
    if (filters.entityType !== "all") {
      query = query.eq("entity_type", filters.entityType.toLowerCase());
    }
    if (filters.dateFrom) {
      query = query.gte("created_at", `${filters.dateFrom}T00:00:00`);
    }
    if (filters.dateTo) {
      query = query.lte("created_at", `${filters.dateTo}T23:59:59`);
    }

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, count, error } = await query.range(from, to);

    if (error) {
      console.error("Logs fetch error:", error);
      return;
    }
    setLogs((data ?? []) as ActivityLog[]);
    setTotalCount(count ?? 0);
  }, [filters, page]);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/admin");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (profileData) setProfile(profileData);

      if (profileData?.role !== "admin") {
        setIsLoading(false);
        return;
      }

      const { data: usersData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name");
      setUsers(usersData ?? []);

      const map: Record<string, string> = {};
      for (const u of usersData ?? []) {
        const row = u as Profile;
        map[row.id] = row.full_name ?? "Unknown";
      }
      setUserNames(map);

      setIsLoading(false);
    }
    init();
  }, [router]);

  useEffect(() => {
    if (profile?.role === "admin") {
      fetchLogs();
    }
  }, [profile?.role, fetchLogs]);

  const handleClearFilters = () => {
    setFilters({ userId: "all", entityType: "all", dateFrom: "", dateTo: "" });
    setPage(1);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-blue-950">
        <p className="text-white/60">Loading...</p>
      </div>
    );
  }

  if (profile?.role !== "admin") {
    return (
      <div className="min-h-screen bg-blue-950 text-white">
        <Navbar />
        <main className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
          <p className="text-2xl font-bold text-red-400">Access Denied</p>
          <p className="text-white/50 mt-2">You do not have permission to view this page.</p>
          <Link href="/dashboard" className="mt-6 inline-block text-blue-400 hover:underline">← Back to Dashboard</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-950 text-white">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h2 className="text-2xl font-bold mb-8 sm:text-3xl">Activity Logs</h2>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6">
          <select
            value={filters.userId}
            onChange={(e) => { setFilters((f) => ({ ...f, userId: e.target.value })); setPage(1); }}
            className="rounded-lg border border-white/20 bg-blue-900 px-4 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
          >
            <option value="all" className="bg-blue-900">All Users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id} className="bg-blue-900">{u.full_name ?? u.id}</option>
            ))}
          </select>
          <select
            value={filters.entityType}
            onChange={(e) => { setFilters((f) => ({ ...f, entityType: e.target.value })); setPage(1); }}
            className="rounded-lg border border-white/20 bg-blue-900 px-4 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
          >
            <option value="all" className="bg-blue-900">All</option>
            <option value="student" className="bg-blue-900">Student</option>
            <option value="commission" className="bg-blue-900">Commission</option>
          </select>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => { setFilters((f) => ({ ...f, dateFrom: e.target.value })); setPage(1); }}
            className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
            placeholder="From"
          />
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => { setFilters((f) => ({ ...f, dateTo: e.target.value })); setPage(1); }}
            className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
            placeholder="To"
          />
          <button
            onClick={handleClearFilters}
            className="rounded-lg border border-white/20 px-4 py-2 text-sm font-bold hover:bg-white/10"
          >
            Clear Filters
          </button>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse">
              <thead>
                <tr className="border-b border-white/20 bg-white/5">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-white/80">Time</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-white/80">User</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-white/80">Action</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-white/80">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-white/50">No logs found.</td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="border-b border-white/10 last:border-b-0 hover:bg-white/5">
                      <td className="px-4 py-3 text-sm text-white/90">{formatTime(log.created_at)}</td>
                      <td className="px-4 py-3 text-sm text-white/90">{userNames[log.user_id] ?? "Unknown"}</td>
                      <td className="px-4 py-3 text-sm text-white/90">{ACTION_LABELS[log.action] ?? log.action}</td>
                      <td className="px-4 py-3 text-sm text-white/80">{formatDetails(log.action, log.details)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalCount > PAGE_SIZE && (
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 px-4 py-3">
              <p className="text-sm text-white/60">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-white/20 px-4 py-2 text-sm font-bold hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-white/20 px-4 py-2 text-sm font-bold hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
