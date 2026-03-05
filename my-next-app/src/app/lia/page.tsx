"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

type Deal = {
  id: string;
  deal_number: string | null;
  deal_type: string | null;
  visa_type: string | null;
  status: string;
  created_at: string;
  contact_id: string | null;
  company_id: string | null;
  assigned_lia_id: string | null;
  contacts: { first_name: string; last_name: string; email: string | null } | null;
  companies: { company_name: string; email: string | null } | null;
};

type Payment = {
  deal_id: string;
  payment_type: string | null;
  status: string;
  amount: number;
  due_date: string | null;
};

type IntakeForm = {
  deal_id: string;
  status: string;
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

const DEAL_STATUS_LABELS: Record<string, string> = {
  draft: "Draft", quoted: "Quoted", contracted: "Contracted", in_progress: "In Progress",
  submitted: "Submitted", approved: "Approved", declined: "Declined",
  completed: "Completed", cancelled: "Cancelled",
};

const ACTIVE_STATUSES = ["draft", "quoted", "contracted", "in_progress", "submitted"];

export default function LiaDashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<{ id: string; role: string; full_name: string | null } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [myDeals, setMyDeals] = useState<Deal[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [intakeForms, setIntakeForms] = useState<IntakeForm[]>([]);
  const [recentDeals, setRecentDeals] = useState<Deal[]>([]);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/admin"); return; }

      const { data: profileData } = await supabase.from("profiles").select("id, role, full_name").eq("id", session.user.id).single();
      if (!profileData) { router.push("/admin"); return; }

      if (profileData.role !== "admin" && profileData.role !== "lia") {
        router.push("/crm"); return;
      }

      setProfile(profileData);

      // Fetch active deals
      let dealsQuery = supabase.from("deals")
        .select("id, deal_number, deal_type, visa_type, status, created_at, contact_id, company_id, assigned_lia_id, contacts(first_name, last_name, email), companies(company_name, email)")
        .in("status", ACTIVE_STATUSES)
        .order("created_at", { ascending: false });

      // LIA only sees their assigned deals
      if (profileData.role === "lia") {
        dealsQuery = dealsQuery.eq("assigned_lia_id", session.user.id);
      }

      const { data: dealsData } = await dealsQuery;
      const allDeals = (dealsData ?? []) as unknown as Deal[];
      setMyDeals(allDeals);

      // Fetch payments for these deals
      if (allDeals.length > 0) {
        const dealIds = allDeals.map(d => d.id);
        const { data: payData } = await supabase.from("deal_payments").select("deal_id, payment_type, status, amount, due_date").in("deal_id", dealIds);
        if (payData) setPayments(payData as Payment[]);

        const { data: intakeData } = await supabase.from("intake_forms").select("deal_id, status").in("deal_id", dealIds);
        if (intakeData) setIntakeForms(intakeData as IntakeForm[]);
      }

      // Recently resolved deals
      let recentQuery = supabase.from("deals")
        .select("id, deal_number, deal_type, visa_type, status, created_at, contact_id, company_id, assigned_lia_id, contacts(first_name, last_name, email), companies(company_name, email)")
        .in("status", ["approved", "declined"])
        .order("created_at", { ascending: false })
        .limit(5);

      if (profileData.role === "lia") {
        recentQuery = recentQuery.eq("assigned_lia_id", session.user.id);
      }

      const { data: recentData } = await recentQuery;
      setRecentDeals((recentData ?? []) as unknown as Deal[]);

      setIsLoading(false);
    }
    init();
  }, [router]);

  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-blue-950"><p className="text-white/60">Loading...</p></div>;

  const isAdmin = profile?.role === "admin";

  const getClientName = (deal: Deal) => {
    if (deal.contacts) return `${deal.contacts.first_name} ${deal.contacts.last_name}`;
    if (deal.companies) return deal.companies.company_name;
    return "—";
  };

  const getClientEmail = (deal: Deal) => {
    if (deal.contacts) return deal.contacts.email ?? "";
    if (deal.companies) return deal.companies.email ?? "";
    return "";
  };

  // Compute next step hint
  const getNextStep = (deal: Deal): string => {
    const hasIntake = intakeForms.find(f => f.deal_id === deal.id);
    const dealPayments = payments.filter(p => p.deal_id === deal.id);
    const pendingServiceFee = dealPayments.some(p => p.payment_type === "service_fee" && p.status === "pending");
    const pendingGovFee = dealPayments.some(p => p.payment_type === "government_fee" && p.status === "pending");

    switch (deal.status) {
      case "draft": return "Create contract and send to client";
      case "quoted": return "Follow up on contract signing";
      case "contracted":
        if (pendingServiceFee) return "⚠ Waiting for service fee payment";
        if (!hasIntake || hasIntake.status === "draft") return "Send intake form to client";
        if (hasIntake.status === "sent" || hasIntake.status === "in_progress") return "Waiting for client to complete intake form";
        return "Intake form completed — start processing";
      case "in_progress":
        if (pendingGovFee) return "⚠ Waiting for government fee payment";
        return "Prepare and submit application to INZ";
      case "submitted": return "Awaiting INZ decision";
      default: return "Review deal";
    }
  };

  // Payment alerts: deals where service fee is pending
  const paymentAlerts = myDeals.filter(deal => {
    const dealPayments = payments.filter(p => p.deal_id === deal.id);
    return dealPayments.some(p => p.payment_type === "service_fee" && p.status === "pending");
  });

  // Pending intake forms
  const pendingIntake = myDeals.filter(deal => {
    const form = intakeForms.find(f => f.deal_id === deal.id);
    return deal.status === "contracted" && (!form || form.status === "sent" || form.status === "in_progress");
  });

  const inProgressDeals = myDeals.filter(d => d.status === "in_progress");
  const submittedDeals = myDeals.filter(d => d.status === "submitted");

  const sectionClass = "rounded-xl border border-white/10 bg-white/5 p-6 mb-6";

  return (
    <div className="min-h-screen bg-blue-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">

        <div className="mb-8">
          <h1 className="text-2xl font-bold sm:text-3xl">LIA Dashboard</h1>
          <p className="mt-1 text-white/60">
            {isAdmin ? "All active deals" : `Welcome, ${profile?.full_name ?? "LIA"} — your assigned deals`}
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
          {[
            { label: "Active Deals", value: myDeals.length, color: "text-blue-400" },
            { label: "In Progress", value: inProgressDeals.length, color: "text-yellow-400" },
            { label: "Submitted", value: submittedDeals.length, color: "text-orange-400" },
            { label: "Payment Alerts", value: paymentAlerts.length, color: "text-red-400" },
          ].map(stat => (
            <div key={stat.label} className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-sm text-white/60 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Payment Alerts */}
        {paymentAlerts.length > 0 && (
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-5 mb-6">
            <h3 className="text-base font-bold text-yellow-300 mb-3">⚠ Payment Alerts ({paymentAlerts.length})</h3>
            <div className="space-y-2">
              {paymentAlerts.map(deal => (
                <div key={deal.id} className="flex items-center justify-between rounded-lg bg-yellow-500/10 px-4 py-2.5">
                  <div>
                    <span className="font-medium text-white">{deal.deal_number}</span>
                    <span className="ml-2 text-sm text-white/60">{getClientName(deal)}</span>
                    <span className="ml-2 text-xs text-yellow-300">Service fee pending</span>
                  </div>
                  <Link href={`/deals/${deal.id}`} className="text-xs text-blue-400 hover:underline">View →</Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending Intake Forms */}
        {pendingIntake.length > 0 && (
          <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-5 mb-6">
            <h3 className="text-base font-bold text-orange-300 mb-3">Pending Intake Forms ({pendingIntake.length})</h3>
            <div className="space-y-2">
              {pendingIntake.map(deal => {
                const form = intakeForms.find(f => f.deal_id === deal.id);
                return (
                  <div key={deal.id} className="flex items-center justify-between rounded-lg bg-orange-500/10 px-4 py-2.5">
                    <div>
                      <span className="font-medium text-white">{deal.deal_number}</span>
                      <span className="ml-2 text-sm text-white/60">{getClientName(deal)}</span>
                      <span className="ml-2 text-xs text-orange-300">
                        {!form || form.status === "draft" ? "Not sent yet" : form.status === "sent" ? "Sent — awaiting client" : "In Progress"}
                      </span>
                    </div>
                    <Link href={`/deals/${deal.id}`} className="text-xs text-blue-400 hover:underline">View →</Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* My Active Deals */}
        <div className={sectionClass}>
          <h3 className="text-lg font-bold mb-4">Active Deals ({myDeals.length})</h3>
          {myDeals.length === 0 ? (
            <p className="text-white/50 text-sm">No active deals{!isAdmin ? " assigned to you" : ""}.</p>
          ) : (
            <div className="space-y-3">
              {myDeals.map(deal => {
                const dealPayments = payments.filter(p => p.deal_id === deal.id);
                const totalPaid = dealPayments.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0);
                const totalDue = dealPayments.reduce((s, p) => s + p.amount, 0);
                const nextStep = getNextStep(deal);
                const clientEmail = getClientEmail(deal);

                return (
                  <div key={deal.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <Link href={`/deals/${deal.id}`} className="font-bold text-blue-400 hover:underline">
                            {deal.deal_number}
                          </Link>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${DEAL_STATUS_COLORS[deal.status] ?? "bg-gray-500/20 text-gray-400"}`}>
                            {DEAL_STATUS_LABELS[deal.status] ?? deal.status}
                          </span>
                          <span className="text-xs text-white/40 uppercase bg-white/5 rounded px-2 py-0.5">
                            {deal.visa_type ?? deal.deal_type?.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="text-white/80 text-sm">{getClientName(deal)}{clientEmail && <span className="ml-2 text-white/40">{clientEmail}</span>}</p>
                        <p className="text-xs text-white/50 mt-1.5">{nextStep}</p>
                        {totalDue > 0 && (
                          <p className="text-xs text-white/40 mt-1">
                            Paid: ${totalPaid.toLocaleString()} / ${totalDue.toLocaleString()} NZD
                          </p>
                        )}
                      </div>
                      <Link href={`/deals/${deal.id}`} className="shrink-0 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-bold hover:bg-white/10">
                        Open
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recently Approved/Declined */}
        {recentDeals.length > 0 && (
          <div className={sectionClass}>
            <h3 className="text-lg font-bold mb-4">Recently Resolved</h3>
            <div className="space-y-2">
              {recentDeals.map(deal => (
                <div key={deal.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{deal.deal_number}</span>
                    <span className="text-sm text-white/60">{getClientName(deal)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${DEAL_STATUS_COLORS[deal.status] ?? ""}`}>
                      {DEAL_STATUS_LABELS[deal.status] ?? deal.status}
                    </span>
                  </div>
                  <Link href={`/deals/${deal.id}`} className="text-xs text-blue-400 hover:underline">View →</Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
