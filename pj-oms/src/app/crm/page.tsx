"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { hasRole } from "@/lib/roles";
import Navbar from "@/components/Navbar";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const DEPT_LABELS: Record<string, string> = {
  china: "China",
  thailand: "Thailand",
  myanmar: "Myanmar",
  korea_japan: "Korea & Japan",
};

const DEAL_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  quoted: "Quoted",
  contracted: "Contracted",
  in_progress: "In Progress",
  submitted: "Submitted",
  approved: "Approved",
  declined: "Declined",
  completed: "Completed",
  cancelled: "Cancelled",
};

const DEAL_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-500/20 text-gray-400",
  quoted: "bg-blue-500/20 text-blue-400",
  contracted: "bg-purple-500/20 text-purple-400",
  in_progress: "bg-yellow-500/20 text-yellow-400",
  submitted: "bg-orange-500/20 text-orange-400",
  approved: "bg-green-500/20 text-green-400",
  declined: "bg-red-500/20 text-red-400",
  completed: "bg-green-600/20 text-green-300",
  cancelled: "bg-red-600/20 text-red-300",
};

const PIE_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ef4444", "#06b6d4", "#f97316", "#84cc16", "#ec4899"];

type RecentDeal = {
  id: string;
  deal_number: string | null;
  deal_type: string | null;
  status: string;
  total_amount: number | null;
  created_at: string;
  contact_id: string | null;
  company_id: string | null;
  department: string | null;
  contacts: { first_name: string; last_name: string } | null;
  companies: { company_name: string } | null;
  profiles: { full_name: string | null } | null;
};

export default function CrmDashboardPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<{ full_name: string; role: string; roles: string[]; department: string } | null>(null);
  const [stats, setStats] = useState({
    totalContacts: 0,
    totalLeads: 0,
    totalClients: 0,
    totalCompanies: 0,
    totalDeals: 0,
    totalAgents: 0,
  });
  const [recentDeals, setRecentDeals] = useState<RecentDeal[]>([]);
  const [dealsByStatus, setDealsByStatus] = useState<{ name: string; value: number }[]>([]);
  const [dealsByDept, setDealsByDept] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/admin"); return; }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, role, roles, department")
        .eq("id", session.user.id)
        .single();
      if (profileData) setProfile(profileData);

      const isAdmin = hasRole(profileData, "admin");
      const dept = profileData?.department;

      // Contacts stats
      let contactsQuery = supabase.from("contacts").select("type, department");
      if (!isAdmin && dept) contactsQuery = contactsQuery.eq("department", dept);
      const { data: contactsData } = await contactsQuery;

      // Companies stats
      let companiesQuery = supabase.from("companies").select("id, department");
      if (!isAdmin && dept) companiesQuery = companiesQuery.eq("department", dept);
      const { data: companiesData } = await companiesQuery;

      // Agents stats (admin sees all, sales sees own)
      let agentsQuery = supabase.from("agents").select("id");
      if (!isAdmin && dept) {
        // For agents, filter by assigned_sales_id matching sales users in dept - simplify: just show count
        const { data: deptSales } = await supabase.from("profiles").select("id").eq("department", dept);
        const salesIds = deptSales?.map(s => s.id) ?? [];
        if (salesIds.length > 0) agentsQuery = agentsQuery.in("assigned_sales_id", salesIds);
      }
      const { data: agentsData } = await agentsQuery;

      // Deals stats
      let dealsQuery = supabase.from("deals").select("id, status, department");
      if (!isAdmin && dept) dealsQuery = dealsQuery.eq("department", dept);
      const { data: dealsData } = await dealsQuery;

      const leads = (contactsData ?? []).filter(c => c.type === "lead").length;
      const clients = (contactsData ?? []).filter(c => c.type === "client").length;

      setStats({
        totalContacts: (contactsData ?? []).length,
        totalLeads: leads,
        totalClients: clients,
        totalCompanies: (companiesData ?? []).length,
        totalDeals: (dealsData ?? []).length,
        totalAgents: (agentsData ?? []).length,
      });

      // Deals by status
      const statusCounts: Record<string, number> = {};
      for (const d of (dealsData ?? [])) {
        statusCounts[d.status] = (statusCounts[d.status] ?? 0) + 1;
      }
      setDealsByStatus(Object.entries(statusCounts).map(([name, value]) => ({
        name: DEAL_STATUS_LABELS[name] ?? name,
        value,
      })));

      // Deals by department
      const deptCounts: Record<string, number> = {};
      for (const d of (dealsData ?? [])) {
        if (d.department) deptCounts[d.department] = (deptCounts[d.department] ?? 0) + 1;
      }
      setDealsByDept(Object.entries(deptCounts).map(([k, v]) => ({
        name: DEPT_LABELS[k] ?? k,
        value: v,
      })));

      // Recent deals
      let recentQuery = supabase
        .from("deals")
        .select("id, deal_number, deal_type, status, total_amount, created_at, contact_id, company_id, department, contacts(first_name, last_name), companies(company_name), profiles!deals_assigned_sales_id_fkey(full_name)")
        .order("created_at", { ascending: false })
        .limit(10);
      if (!isAdmin && dept) recentQuery = recentQuery.eq("department", dept);
      const { data: recentData } = await recentQuery;
      if (recentData) setRecentDeals(recentData as unknown as RecentDeal[]);

      setIsLoading(false);
    }
    init();
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-blue-950">
        <p className="text-white/60">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">

        {/* Header */}
        <div className="flex flex-col gap-4 mb-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-1 sm:text-3xl">CRM Dashboard</h2>
            <p className="text-sm text-white/50 sm:text-base">Welcome back, {profile?.full_name}!</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <Link href="/contacts/new" className="rounded-lg bg-blue-600 px-5 py-2.5 font-bold text-white hover:bg-blue-700 text-sm">
              + Add Contact
            </Link>
            <Link href="/deals/new" className="rounded-lg bg-purple-600 px-5 py-2.5 font-bold text-white hover:bg-purple-700 text-sm">
              + New Deal
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg border border-white/20 bg-white/5 px-5 py-2.5 font-bold text-white/80 hover:bg-white/10 text-sm"
            >
              Commission Dashboard →
            </Link>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4 mb-10">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6">
            <div className="mb-2 inline-block rounded-lg bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              Total Contacts
            </div>
            <p className="text-3xl font-bold sm:text-4xl">{stats.totalContacts}</p>
            <p className="mt-1 text-xs text-white/50">
              {stats.totalLeads} Leads · {stats.totalClients} Clients
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6">
            <div className="mb-2 inline-block rounded-lg bg-green-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              Companies
            </div>
            <p className="text-3xl font-bold sm:text-4xl">{stats.totalCompanies}</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6">
            <div className="mb-2 inline-block rounded-lg bg-purple-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              Total Deals
            </div>
            <p className="text-3xl font-bold sm:text-4xl">{stats.totalDeals}</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6">
            <div className="mb-2 inline-block rounded-lg bg-orange-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              Agents
            </div>
            <p className="text-3xl font-bold sm:text-4xl">{stats.totalAgents}</p>
          </div>
        </div>

        {/* Charts */}
        <div className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6">
            <h3 className="mb-4 text-lg font-bold">Deals by Status</h3>
            <div className="h-[260px]">
              {dealsByStatus.length === 0 ? (
                <p className="flex h-full items-center justify-center text-white/50">No deals data</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dealsByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                      {dealsByStatus.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "rgb(30 58 138)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "8px" }} />
                    <Legend wrapperStyle={{ color: "white" }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6">
            <h3 className="mb-4 text-lg font-bold">Deals by Department</h3>
            <div className="h-[260px]">
              {dealsByDept.length === 0 ? (
                <p className="flex h-full items-center justify-center text-white/50">No deals data</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dealsByDept}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.7)" tick={{ fill: "rgba(255,255,255,0.9)" }} />
                    <YAxis stroke="rgba(255,255,255,0.7)" tick={{ fill: "rgba(255,255,255,0.9)" }} />
                    <Tooltip contentStyle={{ backgroundColor: "rgb(30 58 138)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "8px" }} />
                    <Bar dataKey="value" fill="#a855f7" radius={[4, 4, 0, 0]} name="Deals" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Recent Deals */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Recent Deals</h3>
            <Link href="/deals" className="text-sm text-blue-400 hover:underline">View all →</Link>
          </div>
          {recentDeals.length === 0 ? (
            <p className="py-8 text-center text-white/50">No deals yet. <Link href="/deals/new" className="text-blue-400 hover:underline">Create a deal →</Link></p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] border-collapse">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Deal #</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Client</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Dept</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDeals.map((deal) => {
                    const clientName = deal.contacts
                      ? `${deal.contacts.first_name} ${deal.contacts.last_name}`
                      : deal.companies?.company_name ?? "—";
                    return (
                      <tr key={deal.id} className="border-b border-white/10 last:border-b-0 hover:bg-white/5">
                        <td className="px-4 py-3 text-sm">
                          <Link href={`/deals/${deal.id}`} className="text-blue-400 hover:underline font-medium">
                            {deal.deal_number ?? "—"}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-white/90">{clientName}</td>
                        <td className="px-4 py-3 text-sm text-white/70">{deal.deal_type?.replace("_", " ") ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${DEAL_STATUS_COLORS[deal.status] ?? "bg-gray-500/20 text-gray-400"}`}>
                            {DEAL_STATUS_LABELS[deal.status] ?? deal.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-white/90">
                          {deal.total_amount != null ? `$${deal.total_amount.toLocaleString()}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-white/60">
                          {deal.department ? DEPT_LABELS[deal.department] ?? deal.department : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
