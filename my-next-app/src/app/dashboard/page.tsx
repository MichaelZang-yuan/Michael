"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Profile = {
  full_name: string;
  role: string;
  department: string;
};

const DEPT_LABELS: Record<string, string> = {
  china: "China",
  thailand: "Thailand",
  myanmar: "Myanmar",
  korea_japan: "Korea & Japan",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  accountant: "Accountant",
  sales: "Sales",
};

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push("/admin");
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("full_name, role, department")
        .eq("id", session.user.id)
        .single();

      if (data) setProfile(data);
      setIsLoading(false);
    }

    init();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/admin");
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-blue-950">
        <p className="text-white/60">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-950 text-white">

      {/* Top nav */}
      <nav className="border-b border-white/10 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <h1 className="text-xl font-bold">Commission Management System</h1>
          <div className="flex items-center gap-4">
            {profile && (
              <span className="text-white/60 text-sm">
                👋 {profile.full_name} ·{" "}
                <span className="text-blue-400">{ROLE_LABELS[profile.role]}</span>
                {" · "}{DEPT_LABELS[profile.department]}
              </span>
            )}
            <button
              onClick={handleSignOut}
              className="rounded-lg border border-white/20 px-4 py-2 text-sm font-bold hover:bg-white/10"
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="mx-auto max-w-6xl px-6 py-10">

        {/* Header with Add Student button */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-3xl font-bold mb-1">Dashboard</h2>
            <p className="text-white/50">Welcome back, {profile?.full_name}!</p>
          </div>
          <Link
            href="/students/new"
            className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700"
          >
            + Add Student
          </Link>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-10">
          {[
            { label: "Total Students", value: "—", color: "bg-blue-600" },
            { label: "Pending Claims", value: "—", color: "bg-yellow-600" },
            { label: "Claimed This Month", value: "—", color: "bg-green-600" },
            { label: "Overdue Claims", value: "—", color: "bg-red-600" },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-white/10 bg-white/5 p-6"
            >
              <div className={`mb-3 inline-block rounded-lg ${card.color} px-3 py-1 text-xs font-bold uppercase tracking-wider`}>
                {card.label}
              </div>
              <p className="text-4xl font-bold">{card.value}</p>
            </div>
          ))}
        </div>

        {/* Coming soon */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-2xl font-bold mb-2">🚧 Students & Commissions</p>
          <p className="text-white/50">Coming in Week 3 — student management and commission tracking will appear here.</p>
        </div>

      </main>
    </div>
  );
}