"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

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
  const [monthlyCommissions, setMonthlyCommissions] = useState<{ month: string; amount: number }[]>([]);
  const [studentsByDept, setStudentsByDept] = useState<{ name: string; value: number }[]>([]);

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

      // 2. 获取学生统计（admin: 全部；sales: 仅本部门），并自动将 active→enrolled
      let studentsQuery = supabase.from("students").select("id, status, commissions(enrollment_date)");
      if (isSales && profileData?.department) {
        studentsQuery = studentsQuery.eq("department", profileData.department);
      }
      const { data: studentsRaw } = await studentsQuery;
      const students = studentsRaw as { id: string; status: string; commissions: { enrollment_date: string | null }[] | null }[] | null;

      if (students) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const toEnroll: string[] = [];
        for (const s of students) {
          if (s.status !== "active") continue;
          const commissions = s.commissions ?? [];
          const dates = commissions.map((c) => c.enrollment_date).filter((d): d is string => !!d);
          if (dates.length === 0) continue;
          const earliest = dates.sort()[0];
          const ed = new Date(earliest);
          const cutoff = new Date(ed);
          cutoff.setDate(cutoff.getDate() + 14);
          cutoff.setHours(0, 0, 0, 0);
          if (cutoff <= today) toEnroll.push(s.id);
        }
        if (toEnroll.length > 0) {
          await supabase.from("students").update({ status: "enrolled" }).in("id", toEnroll);
        }

        setStats(prev => ({
          ...prev,
          totalStudents: students.length,
          activeStudents: students.filter(s => s.status === "active" && !toEnroll.includes(s.id)).length,
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

      // 4. 获取 claimed commissions（用于月度图表）
      let claimedData: { amount: number; claimed_at: string }[] | null = null;
      if (isSales && profileData?.department) {
        const deptStudentIds = (await supabase.from("students").select("id").eq("department", profileData.department)).data?.map((s) => s.id) ?? [];
        if (deptStudentIds.length > 0) {
          const { data } = await supabase
            .from("commissions")
            .select("amount, claimed_at")
            .eq("status", "claimed")
            .not("claimed_at", "is", null)
            .in("student_id", deptStudentIds);
          claimedData = data as { amount: number; claimed_at: string }[] | null;
        }
      } else {
        const { data } = await supabase
          .from("commissions")
          .select("amount, claimed_at")
          .eq("status", "claimed")
          .not("claimed_at", "is", null);
        claimedData = data as { amount: number; claimed_at: string }[] | null;
      }

      const now = new Date();
      const months: { month: string; amount: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
          month: d.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
          amount: 0,
        });
      }
      if (claimedData) {
        for (const c of claimedData) {
          const dt = new Date(c.claimed_at);
          const key = `${dt.getFullYear()}-${dt.getMonth()}`;
          for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const mKey = `${d.getFullYear()}-${d.getMonth()}`;
            if (key === mKey) {
              months[5 - i].amount += c.amount;
              break;
            }
          }
        }
      }
      setMonthlyCommissions(months);

      // 5. 获取按部门分组的学生数（用于饼图）
      let studentsDeptQuery = supabase.from("students").select("department");
      if (isSales && profileData?.department) {
        studentsDeptQuery = studentsDeptQuery.eq("department", profileData.department);
      }
      const { data: studentsDeptData } = await studentsDeptQuery;

      if (studentsDeptData) {
        const counts: Record<string, number> = { china: 0, thailand: 0, myanmar: 0, korea_japan: 0 };
        for (const s of studentsDeptData as { department: string }[]) {
          if (s.department && counts[s.department] !== undefined) counts[s.department]++;
        }
        setStudentsByDept([
          { name: "China", value: counts.china },
          { name: "Thailand", value: counts.thailand },
          { name: "Myanmar", value: counts.myanmar },
          { name: "Korea & Japan", value: counts.korea_japan },
        ].filter((d) => d.value > 0));
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

      {/* Main content */}
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">

        {/* Header */}
        <div className="flex flex-col gap-4 mb-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-1 sm:text-3xl">Dashboard</h2>
            <p className="text-sm text-white/50 sm:text-base">Welcome back, {profile?.full_name}!</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <Link
              href="/students"
              className="rounded-lg border border-white/20 bg-white/10 px-6 py-3 font-bold text-white hover:bg-white/20"
            >
              📋 View Students
            </Link>
            {profile?.role === "admin" && (
              <>
                <Link
                  href="/schools"
                  className="rounded-lg border border-white/20 bg-white/10 px-6 py-3 font-bold text-white hover:bg-white/20"
                >
                  🏫 Manage Schools
                </Link>
                <Link
                  href="/users"
                  className="rounded-lg border border-white/20 bg-white/10 px-6 py-3 font-bold text-white hover:bg-white/20"
                >
                  👥 Manage Users
                </Link>
              </>
            )}
            <Link
              href="/students/new"
              className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700"
            >
              <span className="text-xl font-bold">+</span> Add Student
            </Link>
          </div>
        </div>

        {/* Stats cards - 2x2 on mobile, 4 cols on lg */}
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4 mb-10">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6">
            <div className="mb-2 sm:mb-3 inline-block rounded-lg bg-blue-600 px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
              Total Students
            </div>
            <p className="text-3xl font-bold sm:text-5xl">{stats.totalStudents}</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6">
            <div className="mb-2 sm:mb-3 inline-block rounded-lg bg-green-600 px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
              Active
            </div>
            <p className="text-3xl font-bold sm:text-5xl">{stats.activeStudents}</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6">
            <div className="mb-2 sm:mb-3 inline-block rounded-lg bg-red-600 px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
              Cancelled
            </div>
            <p className="text-3xl font-bold sm:text-5xl">{stats.cancelledStudents}</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6">
            <div className="mb-2 sm:mb-3 inline-block rounded-lg bg-yellow-600 px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
              Pending Claims
            </div>
            <p className={`text-3xl font-bold sm:text-5xl ${pendingClaimsColor}`}>{stats.pendingClaims}</p>
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

        {/* Charts */}
        <div className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6">
            <h3 className="mb-4 text-lg font-bold sm:text-xl">Monthly Commissions</h3>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyCommissions}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="month" stroke="rgba(255,255,255,0.7)" tick={{ fill: "rgba(255,255,255,0.9)" }} />
                  <YAxis stroke="rgba(255,255,255,0.7)" tick={{ fill: "rgba(255,255,255,0.9)" }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "rgb(30 58 138)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "8px" }}
                    labelStyle={{ color: "white" }}
                    formatter={(value: number | undefined) => [`$${(value ?? 0).toLocaleString()} NZD`, "Claimed"]}
                  />
                  <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Claimed" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6">
            <h3 className="mb-4 text-lg font-bold sm:text-xl">Students by Department</h3>
            <div className="h-[280px] w-full">
              {studentsByDept.length === 0 ? (
                <p className="flex h-full items-center justify-center text-white/50">No students data</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={studentsByDept}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {studentsByDept.map((_, i) => (
                        <Cell key={i} fill={["#3b82f6", "#22c55e", "#f59e0b", "#a855f7"][i % 4]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: "rgb(30 58 138)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "8px" }}
                      formatter={(value: number | undefined) => [value ?? 0, "Students"]}
                    />
                    <Legend wrapperStyle={{ color: "white" }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Pending Claims table */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6">
          <h3 className="mb-4 text-lg font-bold sm:text-xl">Pending Claims</h3>
          {pendingClaims.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/60 sm:text-base">🎉 All commissions have been claimed!</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] border-collapse">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="px-3 py-2 sm:px-4 sm:py-3 text-left text-xs font-semibold text-white/80 sm:text-sm">Student</th>
                    <th className="px-3 py-2 sm:px-4 sm:py-3 text-left text-xs font-semibold text-white/80 sm:text-sm">Department</th>
                    <th className="px-3 py-2 sm:px-4 sm:py-3 text-left text-xs font-semibold text-white/80 sm:text-sm">Year</th>
                    <th className="px-3 py-2 sm:px-4 sm:py-3 text-left text-xs font-semibold text-white/80 sm:text-sm">Amount</th>
                    <th className="px-3 py-2 sm:px-4 sm:py-3 text-left text-xs font-semibold text-white/80 sm:text-sm">Enrollment Date</th>
                    <th className="px-3 py-2 sm:px-4 sm:py-3 text-left text-xs font-semibold text-white/80 sm:text-sm"></th>
                  </tr>
                </thead>
                <tbody>
                  {pendingClaims.map((claim) => (
                    <tr key={claim.id} className="border-b border-white/10 last:border-b-0">
                      <td className="px-3 py-2 sm:px-4 sm:py-3">
                        <Link
                          href={`/students/${claim.student_id}`}
                          className="font-medium text-blue-400 hover:underline"
                        >
                          {claim.students?.full_name ?? "—"}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-white/90 text-xs sm:px-4 sm:py-3 sm:text-base">
                        {claim.students?.department ? DEPT_LABELS[claim.students.department] ?? claim.students.department : "—"}
                      </td>
                      <td className="px-3 py-2 text-white/90 text-xs sm:px-4 sm:py-3 sm:text-base">{claim.year}</td>
                      <td className="px-3 py-2 text-white/90 text-xs sm:px-4 sm:py-3 sm:text-base">{claim.amount}</td>
                      <td className="px-3 py-2 text-white/90 text-xs sm:px-4 sm:py-3 sm:text-base">
                        {claim.students?.enrollment_date
                          ? new Date(claim.students.enrollment_date).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-3 py-2 sm:px-4 sm:py-3">
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