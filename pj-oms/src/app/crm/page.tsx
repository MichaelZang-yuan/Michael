"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { hasRole, hasAnyRole } from "@/lib/roles";
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
  education_consultation: "Education Consultation",
  school_application: "School Application",
  offer_received: "Offer Received",
  education_only: "Education Only",
};

const DEAL_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 dark:bg-gray-500/20 text-gray-500 dark:text-gray-400",
  quoted: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400",
  contracted: "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400",
  in_progress: "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
  submitted: "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400",
  approved: "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400",
  declined: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400",
  completed: "bg-green-100 dark:bg-green-600/20 text-green-700 dark:text-green-300",
  cancelled: "bg-red-100 dark:bg-red-600/20 text-red-700 dark:text-red-300",
  education_consultation: "bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-400",
  school_application: "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400",
  offer_received: "bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400",
  education_only: "bg-teal-100 dark:bg-teal-600/20 text-teal-700 dark:text-teal-300",
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

type VisaAlert = {
  id: string;
  first_name: string;
  last_name: string;
  visa_expiry_date: string;
  department: string | null;
  assigned_sales_name: string | null;
  days_remaining: number;
  urgency: "expired" | "14_days" | "30_days" | "60_days" | "90_days";
};

const URGENCY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  expired: { bg: "bg-red-900/30 border-red-700", text: "text-red-700 dark:text-red-300", label: "Expired" },
  "14_days": { bg: "bg-red-100 dark:bg-red-500/20 border-red-500", text: "text-red-700 dark:text-red-400", label: "< 14 days" },
  "30_days": { bg: "bg-orange-100 dark:bg-orange-500/20 border-orange-500", text: "text-orange-700 dark:text-orange-400", label: "< 30 days" },
  "60_days": { bg: "bg-yellow-100 dark:bg-yellow-500/20 border-yellow-500", text: "text-yellow-700 dark:text-yellow-400", label: "< 60 days" },
  "90_days": { bg: "bg-green-100 dark:bg-green-500/20 border-green-500", text: "text-green-700 dark:text-green-400", label: "< 90 days" },
};

function getUrgency(daysRemaining: number): VisaAlert["urgency"] {
  if (daysRemaining <= 0) return "expired";
  if (daysRemaining <= 14) return "14_days";
  if (daysRemaining <= 30) return "30_days";
  if (daysRemaining <= 60) return "60_days";
  return "90_days";
}

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
  const [visaAlerts, setVisaAlerts] = useState<VisaAlert[]>([]);
  const [overduePayments, setOverduePayments] = useState<{ id: string; invoice_number: string; type: "crm" | "commission"; client_name: string; outstanding: number; days_overdue: number }[]>([]);
  const [pendingRefunds, setPendingRefunds] = useState<{ id: string; deal_number: string; client_name: string; calculated_refund: number; requested_at: string }[]>([]);
  const [financeSummary, setFinanceSummary] = useState<{ revenue: number; outstanding: number; overdue: number } | null>(null);
  const [reminderLoading, setReminderLoading] = useState<string | null>(null);
  const [reminderMsg, setReminderMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

      // Visa expiry alerts — contacts with visa_expiry_date within 90 days or expired
      let visaQuery = supabase
        .from("contacts")
        .select("id, first_name, last_name, visa_expiry_date, department, profiles!contacts_assigned_sales_id_fkey(full_name)")
        .not("visa_expiry_date", "is", null);
      if (!isAdmin && dept) visaQuery = visaQuery.eq("department", dept);

      const { data: visaData } = await visaQuery;
      if (visaData) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const alerts: VisaAlert[] = [];
        for (const c of visaData as unknown as { id: string; first_name: string; last_name: string; visa_expiry_date: string; department: string | null; profiles: { full_name: string | null } | null }[]) {
          const expiry = new Date(c.visa_expiry_date);
          const diffMs = expiry.getTime() - today.getTime();
          const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          if (daysRemaining <= 90) {
            alerts.push({
              id: c.id,
              first_name: c.first_name,
              last_name: c.last_name,
              visa_expiry_date: c.visa_expiry_date,
              department: c.department,
              assigned_sales_name: c.profiles?.full_name ?? null,
              days_remaining: daysRemaining,
              urgency: getUrgency(daysRemaining),
            });
          }
        }
        alerts.sort((a, b) => a.days_remaining - b.days_remaining);
        setVisaAlerts(alerts);
      }

      // Overdue payments (30+ days overdue)
      if (isAdmin) {
        const overdue: typeof overduePayments = [];
        const todayMs = new Date().getTime();

        const { data: crmOverdue } = await supabase
          .from("invoices")
          .select("id, invoice_number, total, paid_amount, due_date, deal_id, deals(contacts(first_name, last_name), companies(company_name))")
          .not("status", "in", '("paid","cancelled")')
          .not("due_date", "is", null);

        for (const inv of crmOverdue ?? []) {
          const dueMs = new Date(inv.due_date).getTime();
          const daysOverdue = Math.floor((todayMs - dueMs) / (1000 * 60 * 60 * 24));
          if (daysOverdue >= 30) {
            const deal = inv.deals as unknown as Record<string, unknown> | null;
            const contact = deal?.contacts as unknown as Record<string, unknown> | null;
            const company = deal?.companies as unknown as Record<string, unknown> | null;
            const clientName = contact ? `${contact.first_name} ${contact.last_name}` : (company?.company_name as string) ?? "Unknown";
            overdue.push({
              id: inv.id,
              invoice_number: inv.invoice_number,
              type: "crm",
              client_name: clientName,
              outstanding: Number(inv.total) - Number(inv.paid_amount || 0),
              days_overdue: daysOverdue,
            });
          }
        }

        const { data: commOverdue } = await supabase
          .from("commission_invoices")
          .select("id, invoice_number, total, paid_amount, due_date, school_name")
          .not("status", "in", '("paid","cancelled")')
          .not("due_date", "is", null);

        for (const inv of commOverdue ?? []) {
          const dueMs = new Date(inv.due_date).getTime();
          const daysOverdue = Math.floor((todayMs - dueMs) / (1000 * 60 * 60 * 24));
          if (daysOverdue >= 30) {
            overdue.push({
              id: inv.id,
              invoice_number: inv.invoice_number,
              type: "commission",
              client_name: inv.school_name,
              outstanding: Number(inv.total) - Number(inv.paid_amount || 0),
              days_overdue: daysOverdue,
            });
          }
        }

        overdue.sort((a, b) => b.days_overdue - a.days_overdue);
        setOverduePayments(overdue);
      }

      // Pending refunds (admin only)
      if (isAdmin) {
        const { data: refundsData } = await supabase
          .from("refund_requests")
          .select("id, deal_number, client_name, calculated_refund, requested_at")
          .eq("status", "pending")
          .order("requested_at", { ascending: false })
          .limit(10);
        if (refundsData) setPendingRefunds(refundsData);
      }

      // Financial summary (admin + accountant)
      if (isAdmin || hasAnyRole(profileData, ["accountant"])) {
        const now = new Date();
        const monthFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        const monthTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
        const today = new Date().toISOString().split("T")[0];

        const [fCrm, fComm, fForeign, fOutCrm, fOutComm] = await Promise.all([
          supabase.from("invoices").select("paid_amount, currency").not("status", "eq", "cancelled").gte("issue_date", monthFrom).lte("issue_date", monthTo),
          supabase.from("commission_invoices").select("paid_amount").not("status", "eq", "cancelled").gte("issue_date", monthFrom).lte("issue_date", monthTo),
          supabase.from("foreign_currency_payments").select("nzd_equivalent").gte("payment_date", monthFrom).lte("payment_date", monthTo),
          supabase.from("invoices").select("total, paid_amount, due_date").not("status", "in", '("paid","cancelled")'),
          supabase.from("commission_invoices").select("total, paid_amount, due_date").not("status", "in", '("paid","cancelled")'),
        ]);

        const revenue = (fCrm.data ?? []).filter(i => i.currency === "NZD").reduce((s, i) => s + Number(i.paid_amount || 0), 0)
          + (fComm.data ?? []).reduce((s, i) => s + Number(i.paid_amount || 0), 0)
          + (fForeign.data ?? []).reduce((s, i) => s + Number(i.nzd_equivalent || 0), 0);

        let outstanding = 0, overdueAmt = 0;
        for (const inv of [...(fOutCrm.data ?? []), ...(fOutComm.data ?? [])]) {
          const out = Number(inv.total || 0) - Number(inv.paid_amount || 0);
          outstanding += out;
          if (inv.due_date && inv.due_date < today) overdueAmt += out;
        }

        setFinanceSummary({ revenue, outstanding, overdue: overdueAmt });
      }

      setIsLoading(false);
    }
    init();
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-blue-950">
        <p className="text-gray-500 dark:text-white/60">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-blue-950 text-gray-900 dark:text-white">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">

        {/* Header */}
        <div className="flex flex-col gap-4 mb-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-1 sm:text-3xl">CRM Dashboard</h2>
            <p className="text-sm text-gray-500 dark:text-white/50 sm:text-base">Welcome back, {profile?.full_name}!</p>
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
              className="rounded-lg border border-gray-300 dark:border-white/20 bg-gray-50 dark:bg-white/5 px-5 py-2.5 font-bold text-gray-700 dark:text-white/80 hover:bg-gray-100 dark:hover:bg-white/10 text-sm"
            >
              Commission Dashboard →
            </Link>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4 mb-10">
          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4 sm:p-6">
            <div className="mb-2 inline-block rounded-lg bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              Total Contacts
            </div>
            <p className="text-3xl font-bold sm:text-4xl">{stats.totalContacts}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-white/50">
              {stats.totalLeads} Leads · {stats.totalClients} Clients
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4 sm:p-6">
            <div className="mb-2 inline-block rounded-lg bg-green-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              Companies
            </div>
            <p className="text-3xl font-bold sm:text-4xl">{stats.totalCompanies}</p>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4 sm:p-6">
            <div className="mb-2 inline-block rounded-lg bg-purple-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              Total Deals
            </div>
            <p className="text-3xl font-bold sm:text-4xl">{stats.totalDeals}</p>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4 sm:p-6">
            <div className="mb-2 inline-block rounded-lg bg-orange-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              Agents
            </div>
            <p className="text-3xl font-bold sm:text-4xl">{stats.totalAgents}</p>
          </div>
        </div>

        {/* Charts */}
        <div className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4 sm:p-6">
            <h3 className="mb-4 text-lg font-bold">Deals by Status</h3>
            <div className="h-[260px]">
              {dealsByStatus.length === 0 ? (
                <p className="flex h-full items-center justify-center text-gray-500 dark:text-white/50">No deals data</p>
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

          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4 sm:p-6">
            <h3 className="mb-4 text-lg font-bold">Deals by Department</h3>
            <div className="h-[260px]">
              {dealsByDept.length === 0 ? (
                <p className="flex h-full items-center justify-center text-gray-500 dark:text-white/50">No deals data</p>
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

        {/* Visa Expiry Alerts */}
        {visaAlerts.length > 0 && (
          <div className="mb-10 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Visa Expiry Alerts</h3>
              <span className="rounded-full bg-red-100 dark:bg-red-500/20 px-3 py-1 text-xs font-bold text-red-700 dark:text-red-400">
                {visaAlerts.length} alert{visaAlerts.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] border-collapse">
                <thead>
                  <tr className="border-b border-gray-300 dark:border-white/20">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Client</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Visa Expiry</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Days Left</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Assigned Sales</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Dept</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Urgency</th>
                  </tr>
                </thead>
                <tbody>
                  {visaAlerts.map((alert) => {
                    const style = URGENCY_STYLES[alert.urgency];
                    return (
                      <tr key={alert.id} className={`border-b border-gray-200 dark:border-white/10 last:border-b-0 hover:bg-gray-50 dark:hover:bg-white/5 ${alert.urgency === "expired" ? "bg-red-900/10" : ""}`}>
                        <td className="px-4 py-3 text-sm">
                          <Link href={`/contacts/${alert.id}`} className="text-blue-700 dark:text-blue-400 hover:underline font-medium">
                            {alert.first_name} {alert.last_name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-800 dark:text-white/90">
                          {new Date(alert.visa_expiry_date).toLocaleDateString("en-NZ")}
                        </td>
                        <td className={`px-4 py-3 text-sm font-bold ${style.text}`}>
                          {alert.days_remaining <= 0 ? `${Math.abs(alert.days_remaining)} days ago` : `${alert.days_remaining} days`}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-white/70">{alert.assigned_sales_name ?? "—"}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-white/60">
                          {alert.department ? DEPT_LABELS[alert.department] ?? alert.department : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${style.bg} ${style.text}`}>
                            {style.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pending Refunds */}
        {pendingRefunds.length > 0 && (
          <div className="mb-10 rounded-xl border border-red-500/30 bg-red-500/5 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Pending Refund Requests</h3>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-red-100 dark:bg-red-500/20 px-3 py-1 text-xs font-bold text-red-700 dark:text-red-400">
                  {pendingRefunds.length} pending
                </span>
                <Link href="/finance/refunds" className="text-sm text-blue-700 dark:text-blue-400 hover:underline">Manage Refunds →</Link>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] border-collapse">
                <thead>
                  <tr className="border-b border-gray-300 dark:border-white/20">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Deal</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Client</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-white/70">Refund Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Requested</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRefunds.map((r) => (
                    <tr key={r.id} className="border-b border-gray-200 dark:border-white/10 last:border-b-0 hover:bg-gray-50 dark:hover:bg-white/5">
                      <td className="px-4 py-3 text-sm font-medium">{r.deal_number}</td>
                      <td className="px-4 py-3 text-sm">{r.client_name}</td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-red-700 dark:text-red-400">${Number(r.calculated_refund).toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-white/60">{new Date(r.requested_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Overdue Payments */}
        {overduePayments.length > 0 && (
          <div className="mb-10 rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Overdue Payments (30+ days)</h3>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-orange-100 dark:bg-orange-500/20 px-3 py-1 text-xs font-bold text-orange-700 dark:text-orange-400">
                  {overduePayments.length} overdue
                </span>
                <Link href="/finance/ar" className="text-sm text-blue-700 dark:text-blue-400 hover:underline">View AR Dashboard →</Link>
              </div>
            </div>
            {reminderMsg && (
              <div className={`mb-3 rounded-lg px-3 py-2 text-sm ${reminderMsg.type === "success" ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400" : "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400"}`}>
                {reminderMsg.text}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] border-collapse">
                <thead>
                  <tr className="border-b border-gray-300 dark:border-white/20">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Invoice</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Client / School</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-white/70">Outstanding</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-white/70">Days Overdue</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {overduePayments.slice(0, 10).map((inv) => (
                    <tr key={inv.id} className="border-b border-gray-200 dark:border-white/10 last:border-b-0 hover:bg-gray-50 dark:hover:bg-white/5">
                      <td className="px-4 py-3 text-sm font-medium">
                        {inv.type === "crm" ? (
                          <Link href="/invoices" className="text-blue-700 dark:text-blue-400 hover:underline">{inv.invoice_number}</Link>
                        ) : (
                          <Link href="/commission/invoices" className="text-blue-700 dark:text-blue-400 hover:underline">{inv.invoice_number}</Link>
                        )}
                        <span className={`ml-2 text-xs rounded-full px-2 py-0.5 ${inv.type === "crm" ? "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400" : "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400"}`}>
                          {inv.type === "crm" ? "CRM" : "Commission"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{inv.client_name}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">${inv.outstanding.toFixed(2)}</td>
                      <td className={`px-4 py-3 text-sm text-right font-bold ${inv.days_overdue > 90 ? "text-red-500" : inv.days_overdue > 60 ? "text-red-700 dark:text-red-400" : "text-orange-700 dark:text-orange-400"}`}>
                        {inv.days_overdue}d
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={async () => {
                            setReminderLoading(inv.id);
                            setReminderMsg(null);
                            try {
                              const res = await fetch("/api/send-payment-reminder", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ invoice_id: inv.id, invoice_type: inv.type }),
                              });
                              const data = await res.json();
                              setReminderMsg(data.ok
                                ? { type: "success", text: `Reminder sent to ${data.sent_to}` }
                                : { type: "error", text: data.error || "Failed" }
                              );
                            } catch { setReminderMsg({ type: "error", text: "Network error" }); }
                            setReminderLoading(null);
                          }}
                          disabled={reminderLoading === inv.id}
                          className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium hover:bg-orange-500 disabled:opacity-50"
                        >
                          {reminderLoading === inv.id ? "..." : "Send Reminder"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Financial Summary (admin + accountant) */}
        {financeSummary && (
          <div className="mb-10 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Financial Summary (This Month)</h3>
              <Link href="/finance" className="text-sm text-blue-700 dark:text-blue-400 hover:underline">View Financial Dashboard →</Link>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-gray-50 dark:bg-white/5 p-3">
                <p className="text-gray-500 dark:text-white/50 text-xs mb-1">Revenue</p>
                <p className="text-lg font-bold text-green-700 dark:text-green-400">${financeSummary.revenue.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-white/5 p-3">
                <p className="text-gray-500 dark:text-white/50 text-xs mb-1">Outstanding</p>
                <p className="text-lg font-bold text-orange-700 dark:text-orange-400">${financeSummary.outstanding.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-white/5 p-3">
                <p className="text-gray-500 dark:text-white/50 text-xs mb-1">Overdue</p>
                <p className={`text-lg font-bold ${financeSummary.overdue > 0 ? "text-red-700 dark:text-red-400" : "text-gray-900 dark:text-white"}`}>${financeSummary.overdue.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>
        )}

        {/* Recent Deals */}
        <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Recent Deals</h3>
            <Link href="/deals" className="text-sm text-blue-700 dark:text-blue-400 hover:underline">View all →</Link>
          </div>
          {recentDeals.length === 0 ? (
            <p className="py-8 text-center text-gray-500 dark:text-white/50">No deals yet. <Link href="/deals/new" className="text-blue-700 dark:text-blue-400 hover:underline">Create a deal →</Link></p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] border-collapse">
                <thead>
                  <tr className="border-b border-gray-300 dark:border-white/20">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Deal #</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Client</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Dept</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDeals.map((deal) => {
                    const clientName = deal.contacts
                      ? `${deal.contacts.first_name} ${deal.contacts.last_name}`
                      : deal.companies?.company_name ?? "—";
                    return (
                      <tr key={deal.id} className="border-b border-gray-200 dark:border-white/10 last:border-b-0 hover:bg-gray-50 dark:hover:bg-white/5">
                        <td className="px-4 py-3 text-sm">
                          <Link href={`/deals/${deal.id}`} className="text-blue-700 dark:text-blue-400 hover:underline font-medium">
                            {deal.deal_number ?? "—"}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-800 dark:text-white/90">{clientName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-white/70">{deal.deal_type?.replace("_", " ") ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${DEAL_STATUS_COLORS[deal.status] ?? "bg-gray-100 dark:bg-gray-500/20 text-gray-500 dark:text-gray-400"}`}>
                            {DEAL_STATUS_LABELS[deal.status] ?? deal.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-800 dark:text-white/90">
                          {deal.total_amount != null ? `$${deal.total_amount.toLocaleString()}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-white/60">
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
