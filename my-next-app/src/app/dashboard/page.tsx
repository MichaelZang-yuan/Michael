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

type PendingClaim = {
  id: string;
  year: number;
  amount: number;
  student_id: string;
  students: {
    full_name: string;
    enrollment_date: string | null;
    department: string;
    schools: { name: string | null } | null;
  } | null;
};

type DueReminder = {
  student_id: string;
  full_name: string;
  school_name: string;
  claim_due_date: string;
  days_overdue: number;
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
  const [pendingClaims, setPendingClaims] = useState<PendingClaim[]>([]);
  const [stats, setStats] = useState({
    totalStudents: 0,
    activeStudents: 0,
    cancelledStudents: 0,
    pendingClaims: 0,
  });

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push("/admin");
        return;
      }

      // 1. 先获取当前用户的 profile（role 和 department）
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, role, department")
        .eq("id", session.user.id)
        .single();

      if (profileData) setProfile(profileData);

      const isAdmin = profileData?.role === "admin";
      const isSales = profileData?.role === "sales";

      // 2. 获取学生统计（admin: 全部；sales: 仅本部门）
      let studentsQuery = supabase.from("students").select("status");
      if (isSales && profileData?.department) {
        studentsQuery = studentsQuery.eq("department", profileData.department);
      }
      const { data: students } = await studentsQuery;

      if (students) {
        setStats(prev => ({
          ...prev,
          totalStudents: students.length,
          activeStudents: students.filter(s => s.status === "active").length,
          cancelledStudents: students.filter(s => s.status === "cancelled").length,
        }));
      }

      // 3. 获取 pending claims（admin: 全部；sales: 仅本部门学生的 commission）
      let claims: PendingClaim[] | null = null;
      if (isSales && profileData?.department) {
        const { data: deptStudents } = await supabase
          .from("students")
          .select("id")
          .eq("department", profileData.department);
        const studentIds = deptStudents?.map(s => s.id) ?? [];
        if (studentIds.length > 0) {
          const { data } = await supabase
            .from("commissions")
            .select("id, year, amount, student_id, students(full_name, enrollment_date, department, schools(name))")
            .eq("status", "pending")
            .in("student_id", studentIds)
            .order("created_at");
          claims = data as unknown as PendingClaim[];
        } else {
          claims = [];
        }
      } else {
        const { data } = await supabase
          .from("commissions")
          .select("id, year, amount, student_id, students(full_name, enrollment_date, department, schools(name))")
          .eq("status", "pending")
          .order("created_at");
        claims = data as unknown as PendingClaim[];
      }

      if (claims !== null) {
        setPendingClaims(claims);
        setStats(prev => ({ ...prev, pendingClaims: claims.length }));
      }

      setIsLoading(false);
    }

    init();
  }, [router]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in7Days = new Date(today);
  in7Days.setDate(in7Days.getDate() + 7);

  const { overdue, dueSoon } = (() => {
    const seen = new Set<string>();
    const overdueList: DueReminder[] = [];
    const dueSoonList: DueReminder[] = [];

    for (const claim of pendingClaims) {
      const student = claim.students;
      if (!student?.enrollment_date || seen.has(claim.student_id)) continue;

      const enrollmentDate = new Date(student.enrollment_date);
      const claimDueDate = new Date(enrollmentDate);
      claimDueDate.setDate(claimDueDate.getDate() + 14);
      claimDueDate.setHours(0, 0, 0, 0);

      seen.add(claim.student_id);

      const schoolName = student.schools?.name ?? "—";
      const dueStr = claimDueDate.toISOString().split("T")[0];
      const daysOverdue = Math.floor((today.getTime() - claimDueDate.getTime()) / (1000 * 60 * 60 * 24));

      const item: DueReminder = {
        student_id: claim.student_id,
        full_name: student.full_name ?? "—",
        school_name: schoolName,
        claim_due_date: dueStr,
        days_overdue: daysOverdue,
      };

      if (claimDueDate < today) {
        overdueList.push(item);
      } else if (claimDueDate <= in7Days) {
        dueSoonList.push(item);
      }
    }

    return { overdue: overdueList, dueSoon: dueSoonList };
  })();

  const pendingClaimsColor = overdue.length > 0 ? "text-red-400" : dueSoon.length > 0 ? "text-yellow-400" : "";

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
          <h1 className="text-xl font-bold">PJ Commission Management System</h1>
          <div className="flex items-center gap-4">
            {profile && (
              <span className="text-white/60 text-sm">
                👋 {profile.full_name} ·{" "}
                <span className="text-blue-400">{ROLE_LABELS[profile.role]}</span>
                {" · "}{DEPT_LABELS[profile.department]}
              </span>
            )}
            <Link
              href="/profile"
              className="rounded-lg border border-white/20 px-4 py-2 text-sm font-bold hover:bg-white/10"
            >
              My Profile
            </Link>
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

        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-3xl font-bold mb-1">Dashboard</h2>
            <p className="text-white/50">Welcome back, {profile?.full_name}!</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/students"
              className="rounded-lg border border-white/20 px-6 py-3 font-bold text-white hover:bg-white/10"
            >
              View Students
            </Link>
            {profile?.role === "admin" && (
              <>
                <Link
                  href="/schools"
                  className="rounded-lg border border-white/20 px-6 py-3 font-bold text-white hover:bg-white/10"
                >
                  Manage Schools
                </Link>
                <Link
                  href="/users"
                  className="rounded-lg border border-white/20 px-6 py-3 font-bold text-white hover:bg-white/10"
                >
                  Manage Users
                </Link>
              </>
            )}
            <Link
              href="/students/new"
              className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700"
            >
              + Add Student
            </Link>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-10">
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <div className="mb-3 inline-block rounded-lg bg-blue-600 px-3 py-1 text-xs font-bold uppercase tracking-wider">
              Total Students
            </div>
            <p className="text-5xl font-bold">{stats.totalStudents}</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <div className="mb-3 inline-block rounded-lg bg-green-600 px-3 py-1 text-xs font-bold uppercase tracking-wider">
              Active
            </div>
            <p className="text-5xl font-bold">{stats.activeStudents}</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <div className="mb-3 inline-block rounded-lg bg-red-600 px-3 py-1 text-xs font-bold uppercase tracking-wider">
              Cancelled
            </div>
            <p className="text-5xl font-bold">{stats.cancelledStudents}</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <div className="mb-3 inline-block rounded-lg bg-yellow-600 px-3 py-1 text-xs font-bold uppercase tracking-wider">
              Pending Claims
            </div>
            <p className={`text-5xl font-bold ${pendingClaimsColor}`}>{stats.pendingClaims}</p>
          </div>
        </div>

        {/* Overdue & Due Soon reminders */}
        {overdue.length > 0 && (
          <div className="mb-6 rounded-xl border border-red-500/50 bg-red-500/10 p-6">
            <h3 className="mb-4 text-lg font-bold text-red-400">⚠️ Overdue Claims</h3>
            <div className="flex flex-col gap-2">
              {overdue.map((item) => (
                <div key={item.student_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-4">
                    <Link href={`/students/${item.student_id}`} className="font-semibold text-red-300 hover:underline">
                      {item.full_name}
                    </Link>
                    <span className="text-white/70">{item.school_name}</span>
                    <span className="text-white/60 text-sm">Due: {new Date(item.claim_due_date).toLocaleDateString()}</span>
                    <span className="text-sm font-bold text-red-400">{item.days_overdue} days overdue</span>
                  </div>
                  <Link
                    href={`/students/${item.student_id}`}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-red-700"
                  >
                    Go to Claim →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {dueSoon.length > 0 && (
          <div className="mb-6 rounded-xl border border-yellow-500/50 bg-yellow-500/10 p-6">
            <h3 className="mb-4 text-lg font-bold text-yellow-400">⏰ Due Soon</h3>
            <div className="flex flex-col gap-2">
              {dueSoon.map((item) => (
                <div key={item.student_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-4">
                    <Link href={`/students/${item.student_id}`} className="font-semibold text-yellow-300 hover:underline">
                      {item.full_name}
                    </Link>
                    <span className="text-white/70">{item.school_name}</span>
                    <span className="text-white/60 text-sm">Due: {new Date(item.claim_due_date).toLocaleDateString()}</span>
                    <span className="text-sm font-bold text-yellow-400">in {-item.days_overdue} days</span>
                  </div>
                  <Link
                    href={`/students/${item.student_id}`}
                    className="rounded-lg bg-yellow-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-yellow-700"
                  >
                    Go to Claim →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending Claims table */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h3 className="mb-4 text-xl font-bold">Pending Claims</h3>
          {pendingClaims.length === 0 ? (
            <p className="py-8 text-center text-white/60">🎉 All commissions have been claimed!</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] border-collapse">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white/80">Student</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white/80">Department</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white/80">Year</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white/80">Amount</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white/80">Enrollment Date</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white/80"></th>
                  </tr>
                </thead>
                <tbody>
                  {pendingClaims.map((claim) => (
                    <tr key={claim.id} className="border-b border-white/10 last:border-b-0">
                      <td className="px-4 py-3">
                        <Link
                          href={`/students/${claim.student_id}`}
                          className="font-medium text-blue-400 hover:underline"
                        >
                          {claim.students?.full_name ?? "—"}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-white/90">
                        {claim.students?.department ? DEPT_LABELS[claim.students.department] ?? claim.students.department : "—"}
                      </td>
                      <td className="px-4 py-3 text-white/90">{claim.year}</td>
                      <td className="px-4 py-3 text-white/90">{claim.amount}</td>
                      <td className="px-4 py-3 text-white/90">
                        {claim.students?.enrollment_date
                          ? new Date(claim.students.enrollment_date).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/students/${claim.student_id}`}
                          className="inline-flex items-center rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700"
                        >
                          Go to Claim →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}