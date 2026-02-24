"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

const DEPT_LABELS: Record<string, string> = {
  china: "China",
  thailand: "Thailand",
  myanmar: "Myanmar",
  korea_japan: "Korea & Japan",
};

function getDateRange(preset: string): { from: string; to: string } {
  const now = new Date();
  let from: Date;
  let to: Date;

  switch (preset) {
    case "this_month":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case "last_month":
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      to = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    case "this_quarter": {
      const q = Math.floor(now.getMonth() / 3) + 1;
      from = new Date(now.getFullYear(), (q - 1) * 3, 1);
      to = new Date(now.getFullYear(), q * 3, 0);
      break;
    }
    case "this_year":
      from = new Date(now.getFullYear(), 0, 1);
      to = new Date(now.getFullYear(), 11, 31);
      break;
    default:
      from = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      to = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0);
  }

  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
}

type DeptRow = { department: string; totalStudents: number; pendingAmount: number; claimedAmount: number; totalAmount: number };
type SchoolRow = { school: string; totalStudents: number; pendingAmount: number; claimedAmount: number; totalAmount: number };
type SalesRow = { name: string; department: string; studentsAdded: number; pendingCommission: number; claimedCommission: number };

export default function ReportsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<{ role: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const defaultRange = getDateRange("this_quarter");
  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);
  const [deptRows, setDeptRows] = useState<DeptRow[]>([]);
  const [schoolRows, setSchoolRows] = useState<SchoolRow[]>([]);
  const [salesRows, setSalesRows] = useState<SalesRow[]>([]);

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

      const fromDate = `${dateFrom}T00:00:00`;
      const toDate = `${dateTo}T23:59:59`;

      const { data: commissionsData } = await supabase
        .from("commissions")
        .select("amount, status, created_at, student_id")
        .gte("created_at", fromDate)
        .lte("created_at", toDate);

      const commissions = commissionsData ?? [];

      const { data: studentsData } = await supabase
        .from("students")
        .select("id, department, school_id, created_by, assigned_sales_id, created_at");

      const students = studentsData ?? [];

      const { data: schoolsData } = await supabase.from("schools").select("id, name");
      const schoolMap = new Map((schoolsData ?? []).map((s: { id: string; name: string }) => [s.id, s.name ?? "—"]));

      const deptAgg: Record<string, { students: Set<string>; pending: number; claimed: number }> = {};
      const schoolAgg: Record<string, { students: Set<string>; pending: number; claimed: number }> = {};

      for (const c of commissions as { amount: number; status: string; student_id: string }[]) {
        const student = (students as { id: string; department: string; school_id: string }[]).find((s) => s.id === c.student_id);
        const dept = student?.department ?? "unknown";
        const schoolId = student?.school_id ?? "";
        const schoolName = schoolMap.get(schoolId) ?? "—";

        if (!deptAgg[dept]) deptAgg[dept] = { students: new Set(), pending: 0, claimed: 0 };
        deptAgg[dept].students.add(c.student_id);
        if (c.status === "pending") deptAgg[dept].pending += c.amount;
        else if (c.status === "claimed") deptAgg[dept].claimed += c.amount;

        if (!schoolAgg[schoolName]) schoolAgg[schoolName] = { students: new Set(), pending: 0, claimed: 0 };
        schoolAgg[schoolName].students.add(c.student_id);
        if (c.status === "pending") schoolAgg[schoolName].pending += c.amount;
        else if (c.status === "claimed") schoolAgg[schoolName].claimed += c.amount;
      }

      setDeptRows(
        Object.entries(deptAgg).map(([dept, a]) => ({
          department: DEPT_LABELS[dept] ?? dept,
          totalStudents: a.students.size,
          pendingAmount: a.pending,
          claimedAmount: a.claimed,
          totalAmount: a.pending + a.claimed,
        }))
      );

      setSchoolRows(
        Object.entries(schoolAgg).map(([school, a]) => ({
          school,
          totalStudents: a.students.size,
          pendingAmount: a.pending,
          claimedAmount: a.claimed,
          totalAmount: a.pending + a.claimed,
        }))
      );

      const { data: salesProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, department")
        .eq("role", "sales");

      const salesList: SalesRow[] = [];
      for (const p of salesProfiles ?? []) {
        const pid = (p as { id: string }).id;
        const myStudents = (students as { id: string; created_by: string | null; assigned_sales_id?: string | null }[]).filter(
          (s) => s.created_by === pid || s.assigned_sales_id === pid
        );
        const myStudentIds = new Set(myStudents.map((s) => s.id));

        let pending = 0;
        let claimed = 0;
        for (const c of commissions as { amount: number; status: string; student_id: string }[]) {
          if (myStudentIds.has(c.student_id)) {
            if (c.status === "pending") pending += c.amount;
            else if (c.status === "claimed") claimed += c.amount;
          }
        }

        const addedBySales = myStudents.filter((s) => s.created_by === pid);
        const studentsInRange = addedBySales.filter((s) => {
          const created = (s as { created_at?: string }).created_at;
          if (!created) return false;
          return new Date(created) >= new Date(fromDate) && new Date(created) <= new Date(toDate);
        }).length;

        salesList.push({
          name: (p as { full_name: string | null }).full_name ?? "Unknown",
          department: DEPT_LABELS[(p as { department: string }).department] ?? (p as { department: string }).department ?? "—",
          studentsAdded: studentsInRange,
          pendingCommission: pending,
          claimedCommission: claimed,
        });
      }

      salesList.sort((a, b) => b.claimedCommission - a.claimedCommission);
      setSalesRows(salesList);

      setIsLoading(false);
    }

    init();
  }, [router, dateFrom, dateTo]);

  const setPreset = (preset: string) => {
    const { from, to } = getDateRange(preset);
    setDateFrom(from);
    setDateTo(to);
  };

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

  const tableClass = "w-full min-w-[500px] border-collapse";
  const thClass = "px-4 py-3 text-left text-sm font-semibold text-white/80 border-b border-white/20";
  const tdClass = "px-4 py-3 text-white/90 border-b border-white/10";

  return (
    <div className="min-h-screen bg-blue-950 text-white">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h2 className="text-2xl font-bold mb-8 sm:text-3xl">Reports</h2>

        {/* Date range filter */}
        <div className="mb-10 flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-semibold text-white/70">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
            />
            <label className="text-sm font-semibold text-white/70">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { key: "this_month", label: "This Month" },
              { key: "last_month", label: "Last Month" },
              { key: "this_quarter", label: "This Quarter" },
              { key: "this_year", label: "This Year" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPreset(key)}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm font-bold hover:bg-white/10"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Commission Summary */}
        <div className="mb-10 rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6">
          <h3 className="mb-4 text-lg font-bold sm:text-xl">Commission Summary</h3>
          <p className="text-sm text-white/50 mb-4">By department (commissions created in date range)</p>
          <div className="overflow-x-auto mb-8">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Department</th>
                  <th className={thClass}>Total Students</th>
                  <th className={thClass}>Pending Amount</th>
                  <th className={thClass}>Claimed Amount</th>
                  <th className={thClass}>Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {deptRows.map((r) => (
                  <tr key={r.department}>
                    <td className={tdClass}>{r.department}</td>
                    <td className={tdClass}>{r.totalStudents}</td>
                    <td className={tdClass}>${r.pendingAmount.toLocaleString()} NZD</td>
                    <td className={tdClass}>${r.claimedAmount.toLocaleString()} NZD</td>
                    <td className={tdClass}>${r.totalAmount.toLocaleString()} NZD</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-white/50 mb-4">By school</p>
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>School</th>
                  <th className={thClass}>Total Students</th>
                  <th className={thClass}>Pending Amount</th>
                  <th className={thClass}>Claimed Amount</th>
                  <th className={thClass}>Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {schoolRows.map((r) => (
                  <tr key={r.school}>
                    <td className={tdClass}>{r.school}</td>
                    <td className={tdClass}>{r.totalStudents}</td>
                    <td className={tdClass}>${r.pendingAmount.toLocaleString()} NZD</td>
                    <td className={tdClass}>${r.claimedAmount.toLocaleString()} NZD</td>
                    <td className={tdClass}>${r.totalAmount.toLocaleString()} NZD</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sales Performance */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6">
          <h3 className="mb-4 text-lg font-bold sm:text-xl">Sales Performance</h3>
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Name</th>
                  <th className={thClass}>Department</th>
                  <th className={thClass}>Students Added</th>
                  <th className={thClass}>Pending Commission</th>
                  <th className={thClass}>Claimed Commission</th>
                </tr>
              </thead>
              <tbody>
                {salesRows.map((r, i) => (
                  <tr key={`${r.name}-${i}`}>
                    <td className={tdClass}>{r.name}</td>
                    <td className={tdClass}>{r.department}</td>
                    <td className={tdClass}>{r.studentsAdded}</td>
                    <td className={tdClass}>${r.pendingCommission.toLocaleString()} NZD</td>
                    <td className={tdClass}>${r.claimedCommission.toLocaleString()} NZD</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
