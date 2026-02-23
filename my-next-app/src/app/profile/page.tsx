"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Profile = {
  full_name: string | null;
  email: string | null;
  role: string;
  department: string;
};

type MyStudent = {
  id: string;
  full_name: string | null;
  enrollment_date: string | null;
  status: string;
  department: string;
  schools: { name: string | null } | null;
};

type CommissionRow = {
  student_id: string;
  status: string;
  amount: number;
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

const inputClass =
  "rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none w-full";

function getYearRange() {
  const y = new Date().getFullYear();
  return {
    from: `${y}-01-01`,
    to: `${y}-12-31`,
  };
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const yearRange = getYearRange();
  const [dateFrom, setDateFrom] = useState(yearRange.from);
  const [dateTo, setDateTo] = useState(yearRange.to);

  const [myStudents, setMyStudents] = useState<MyStudent[]>([]);
  const [myStats, setMyStats] = useState({
    totalStudents: 0,
    activeStudents: 0,
    cancelledStudents: 0,
    totalPendingCommissions: 0,
    totalClaimedCommissions: 0,
  });
  const [commissionsByStudent, setCommissionsByStudent] = useState<Record<string, { pendingCount: number; claimedCount: number }>>({});
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/admin");
        return;
      }
      setUserId(session.user.id);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, email, role, department")
        .eq("id", session.user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
      } else {
        setProfile({
          full_name: session.user.user_metadata?.full_name ?? null,
          email: session.user.email ?? null,
          role: "sales",
          department: "china",
        });
      }
      setIsLoading(false);
    }

    init();
  }, [router]);

  useEffect(() => {
    async function fetchMyStudents() {
      if (!userId || profile?.role !== "sales") return;

      setIsLoadingStudents(true);
      const { data: studentsData } = await supabase
        .from("students")
        .select("id, full_name, enrollment_date, status, department, schools(name)")
        .eq("created_by", userId)
        .gte("enrollment_date", dateFrom)
        .lte("enrollment_date", dateTo)
        .order("enrollment_date", { ascending: true });

      const students = (studentsData ?? []) as MyStudent[];

      if (students.length === 0) {
        setMyStudents([]);
        setMyStats({
          totalStudents: 0,
          activeStudents: 0,
          cancelledStudents: 0,
          totalPendingCommissions: 0,
          totalClaimedCommissions: 0,
        });
        setCommissionsByStudent({});
        setIsLoadingStudents(false);
        return;
      }

      const studentIds = students.map((s) => s.id);

      const { data: commissionsData } = await supabase
        .from("commissions")
        .select("student_id, status, amount")
        .in("student_id", studentIds);

      const commissions = (commissionsData ?? []) as CommissionRow[];

      const byStudent: Record<string, { pendingCount: number; claimedCount: number }> = {};
      for (const id of studentIds) {
        byStudent[id] = { pendingCount: 0, claimedCount: 0 };
      }
      let totalPendingAmount = 0;
      let totalClaimedAmount = 0;
      for (const c of commissions) {
        if (c.status === "pending") {
          byStudent[c.student_id].pendingCount += 1;
          totalPendingAmount += c.amount;
        } else if (c.status === "claimed") {
          byStudent[c.student_id].claimedCount += 1;
          totalClaimedAmount += c.amount;
        }
      }

      setMyStudents(students);
      setMyStats({
        totalStudents: students.length,
        activeStudents: students.filter((s) => s.status === "active").length,
        cancelledStudents: students.filter((s) => s.status === "cancelled").length,
        totalPendingCommissions: totalPendingAmount,
        totalClaimedCommissions: totalClaimedAmount,
      });
      setCommissionsByStudent(byStudent);
      setIsLoadingStudents(false);
    }

    fetchMyStudents();
  }, [userId, profile?.role, dateFrom, dateTo]);

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordForm({ ...passwordForm, [e.target.name]: e.target.value });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage({ type: "error", text: "❌ Passwords do not match" });
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setMessage({ type: "error", text: "Password must be at least 8 characters" });
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase.auth.updateUser({ password: passwordForm.newPassword });

    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setMessage({ type: "success", text: "✅ Password changed successfully!" });
      setPasswordForm({ newPassword: "", confirmPassword: "" });
    }
    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-blue-950">
        <p className="text-white/60">Loading...</p>
      </div>
    );
  }

  const isSales = profile?.role === "sales";

  return (
    <div className="min-h-screen bg-blue-950 text-white">
      <nav className="border-b border-white/10 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <h1 className="text-xl font-bold">PJ Commission Management System</h1>
          <Link href="/dashboard" className="text-sm text-white/60 hover:text-white">
            ← Back to Dashboard
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="text-3xl font-bold mb-8">My Profile</h2>

        {/* 基本信息（只读） */}
        <div className="mb-10 rounded-xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-bold mb-4">Account Information</h3>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-white/70">Full Name</label>
              <input
                type="text"
                value={profile?.full_name ?? "—"}
                readOnly
                className="rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white/80 cursor-not-allowed"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-white/70">Email</label>
              <input
                type="email"
                value={profile?.email ?? "—"}
                readOnly
                className="rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white/80 cursor-not-allowed"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-white/70">Role</label>
              <input
                type="text"
                value={profile?.role ? ROLE_LABELS[profile.role] ?? profile.role : "—"}
                readOnly
                className="rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white/80 cursor-not-allowed"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-white/70">Department</label>
              <input
                type="text"
                value={profile?.department ? DEPT_LABELS[profile.department] ?? profile.department : "—"}
                readOnly
                className="rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white/80 cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* My Students（仅 sales 显示） */}
        {isSales && (
          <div className="mb-10 rounded-xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-lg font-bold mb-4">My Students</h3>

            {/* 时间段筛选 */}
            <div className="flex flex-wrap items-end gap-4 mb-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-white/70">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-white/70">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            {/* 统计区域 */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5 mb-6">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="mb-2 text-xs font-bold uppercase text-white/60">Total Students</div>
                <p className="text-2xl font-bold">{isLoadingStudents ? "…" : myStats.totalStudents}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="mb-2 text-xs font-bold uppercase text-white/60">Active Students</div>
                <p className="text-2xl font-bold text-green-400">{isLoadingStudents ? "…" : myStats.activeStudents}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="mb-2 text-xs font-bold uppercase text-white/60">Cancelled Students</div>
                <p className="text-2xl font-bold text-red-400">{isLoadingStudents ? "…" : myStats.cancelledStudents}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="mb-2 text-xs font-bold uppercase text-white/60">Total Pending Commissions</div>
                <p className="text-2xl font-bold text-yellow-400">
                  {isLoadingStudents ? "…" : `$${myStats.totalPendingCommissions.toLocaleString()} NZD`}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="mb-2 text-xs font-bold uppercase text-white/60">Total Claimed Commissions</div>
                <p className="text-2xl font-bold text-green-400">
                  {isLoadingStudents ? "…" : `$${myStats.totalClaimedCommissions.toLocaleString()} NZD`}
                </p>
              </div>
            </div>

            {/* 学生列表表格 */}
            <div className="overflow-x-auto rounded-xl border border-white/10">
              {isLoadingStudents ? (
                <p className="py-8 text-center text-white/60">Loading...</p>
              ) : myStudents.length === 0 ? (
                <p className="py-8 text-center text-white/60">No students in this date range.</p>
              ) : (
                <table className="w-full min-w-[600px] border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                      <th className="px-6 py-4 text-left text-sm font-semibold text-white/70">Student</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-white/70">School</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-white/70">Department</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-white/70">Enrollment Date</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-white/70">Commission Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myStudents.map((s) => {
                      const comm = commissionsByStudent[s.id] ?? { pendingCount: 0, claimedCount: 0 };
                      return (
                        <tr key={s.id} className="border-b border-white/10 hover:bg-white/5 last:border-b-0">
                          <td className="px-6 py-4">
                            <Link
                              href={`/students/${s.id}`}
                              className="font-semibold text-blue-400 hover:underline"
                            >
                              {s.full_name ?? "—"}
                            </Link>
                          </td>
                          <td className="px-6 py-4 text-white/70">{s.schools?.name ?? "—"}</td>
                          <td className="px-6 py-4 text-white/70">{DEPT_LABELS[s.department] ?? s.department}</td>
                          <td className="px-6 py-4 text-white/70">
                            {s.enrollment_date ? new Date(s.enrollment_date).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-6 py-4 text-white/70">
                            {comm.pendingCount > 0 || comm.claimedCount > 0 ? (
                              <>
                                <span className="text-yellow-400">{comm.pendingCount} pending</span>
                                {" / "}
                                <span className="text-green-400">{comm.claimedCount} claimed</span>
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* 修改密码表单 */}
        <form onSubmit={handleChangePassword} className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-bold mb-4">Change Password</h3>
          <div className="flex flex-col gap-5 max-w-md">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-white/70">New Password *</label>
              <input
                type="password"
                name="newPassword"
                value={passwordForm.newPassword}
                onChange={handlePasswordChange}
                required
                minLength={8}
                placeholder="At least 8 characters"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-white/70">Confirm New Password *</label>
              <input
                type="password"
                name="confirmPassword"
                value={passwordForm.confirmPassword}
                onChange={handlePasswordChange}
                required
                minLength={8}
                placeholder="Re-enter new password"
                className={inputClass}
              />
            </div>
            {message && (
              <p className={message.type === "success" ? "text-green-400" : "text-red-400"}>
                {message.text}
              </p>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50 w-fit"
            >
              {isSubmitting ? "Updating..." : "Change Password"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
