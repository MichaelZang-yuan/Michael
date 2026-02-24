"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

type CommissionRow = {
  year: number;
  status: string;
  enrollment_date: string | null;
};

type Student = {
  id: string;
  full_name: string;
  student_number: string | null;
  school_id: string | null;
  department: string;
  status: string;
  created_at: string;
  schools: { name: string | null } | null;
  commissions?: CommissionRow[] | null;
  profiles?: { full_name: string | null } | null;
};

function getDisplayEnrollmentDate(commissions: CommissionRow[] | null | undefined): string {
  if (!commissions || commissions.length === 0) return "—";
  const pending = commissions.filter((c) => c.status === "pending");
  if (pending.length > 0) {
    const sorted = [...pending].sort((a, b) => a.year - b.year);
    return sorted[0].enrollment_date ?? "—";
  }
  const sorted = [...commissions].sort((a, b) => b.year - a.year);
  return sorted[0].enrollment_date ?? "—";
}

const DEPT_LABELS: Record<string, string> = {
  china: "China",
  thailand: "Thailand",
  myanmar: "Myanmar",
  korea_japan: "Korea & Japan",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  enrolled: "Enrolled",
  pending: "Pending",
  claimed: "Claimed",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-blue-500/20 text-blue-400",
  enrolled: "bg-yellow-500/20 text-yellow-400",
  pending: "bg-orange-500/20 text-orange-400",
  claimed: "bg-green-500/20 text-green-400",
  cancelled: "bg-red-500/20 text-red-400",
};

function getStatusBadgeClass(status: string): string {
  return STATUS_COLORS[status] ?? "bg-gray-500/20 text-gray-400";
}

function escapeCsvValue(val: string): string {
  const str = String(val ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default function StudentsPage() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    department: "all",
    status: "all",
    school: "all",
    search: "",
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push("/admin");
    });

    async function fetchData() {
      const { data: studentsData } = await supabase
        .from("students")
        .select("id, full_name, student_number, school_id, department, status, created_at, schools(name), commissions(year, status, enrollment_date), profiles!students_assigned_sales_id_fkey(full_name)")
        .order("created_at", { ascending: false });

      let studentsList = (studentsData ?? []) as unknown as Student[];

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const toEnroll: string[] = [];
      for (const s of studentsList) {
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
        studentsList = studentsList.map((s) =>
          toEnroll.includes(s.id) ? { ...s, status: "enrolled" } : s
        );
      }

      setStudents(studentsList);
      const { data: schoolsData } = await supabase
        .from("schools")
        .select("id, name")
        .order("name");
      if (schoolsData) setSchools(schoolsData);
      setIsLoading(false);
    }

    fetchData();
  }, [router]);

  const filteredStudents = students.filter((s) => {
    if (filters.department !== "all" && s.department !== filters.department) return false;
    if (filters.status !== "all" && s.status !== filters.status) return false;
    if (filters.school !== "all" && s.school_id !== filters.school) return false;
    if (filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      if (!s.full_name?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const handleClearFilters = () => {
    setFilters({ department: "all", status: "all", school: "all", search: "" });
  };

  const filterSelectClass = "rounded-lg border border-white/20 bg-blue-900 px-4 py-3 text-white focus:border-blue-400 focus:outline-none";
  const filterInputClass = "rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none";

  const handleExportCsv = () => {
    const headers = ["Full Name", "Student Number", "School", "Department", "Sales", "Enrollment Date", "Status"];
    const rows = filteredStudents.map((s) => [
      escapeCsvValue(s.full_name),
      escapeCsvValue(s.student_number ?? ""),
      escapeCsvValue(s.schools?.name ?? ""),
      escapeCsvValue(DEPT_LABELS[s.department] ?? s.department),
      escapeCsvValue(s.profiles?.full_name ?? ""),
      escapeCsvValue(getDisplayEnrollmentDate(s.commissions)),
      escapeCsvValue(s.status),
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "students-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-blue-950 text-white">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">

        {/* Header */}
        <div className="flex flex-col gap-4 mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">Students</h2>
            <p className="text-sm text-white/50 mt-1 sm:text-base">{filteredStudents.length} total</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <button
              onClick={handleExportCsv}
              disabled={filteredStudents.length === 0}
              className="rounded-lg border border-white/20 px-6 py-3 font-bold text-white hover:bg-white/10 disabled:opacity-50"
            >
              Export CSV
            </button>
            <Link
              href="/students/new"
              className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700"
            >
              + Add Student
            </Link>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <p className="text-white/50 text-center py-20">Loading...</p>
        ) : students.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center">
            <p className="text-xl font-bold mb-2">No students yet</p>
            <p className="text-white/50 mb-6">Add your first student to get started.</p>
            <Link
              href="/students/new"
              className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700"
            >
              + Add Student
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              <select
                value={filters.department}
                onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))}
                className={filterSelectClass}
              >
                <option value="all" className="bg-blue-900 text-white">All Departments</option>
                <option value="china" className="bg-blue-900 text-white">China</option>
                <option value="thailand" className="bg-blue-900 text-white">Thailand</option>
                <option value="myanmar" className="bg-blue-900 text-white">Myanmar</option>
                <option value="korea_japan" className="bg-blue-900 text-white">Korea & Japan</option>
              </select>
              <select
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                className={filterSelectClass}
              >
                <option value="all" className="bg-blue-900 text-white">All Status</option>
                <option value="active" className="bg-blue-900 text-white">Active</option>
                <option value="enrolled" className="bg-blue-900 text-white">Enrolled</option>
                <option value="pending" className="bg-blue-900 text-white">Pending</option>
                <option value="claimed" className="bg-blue-900 text-white">Claimed</option>
                <option value="cancelled" className="bg-blue-900 text-white">Cancelled</option>
              </select>
              <select
                value={filters.school}
                onChange={(e) => setFilters((f) => ({ ...f, school: e.target.value }))}
                className={filterSelectClass}
              >
                <option value="all" className="bg-blue-900 text-white">All Schools</option>
                {schools.map((sc) => (
                  <option key={sc.id} value={sc.id} className="bg-blue-900 text-white">{sc.name}</option>
                ))}
              </select>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                placeholder="Search by name..."
                className={`${filterInputClass} w-full min-w-0 sm:min-w-[180px]`}
              />
              <button
                onClick={handleClearFilters}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm font-bold hover:bg-white/10"
              >
                Clear Filters
              </button>
            </div>
          {filteredStudents.length === 0 ? (
            <p className="py-8 text-center text-white/50">No students match the current filters.</p>
          ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[500px] border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 sm:text-sm">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 sm:text-sm">School</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 sm:text-sm">Department</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 sm:text-sm">Sales</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 sm:text-sm">Enrollment Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 sm:text-sm">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="border-b border-white/10 hover:bg-white/5 last:border-b-0">
                    <td className="px-4 py-3 text-sm font-semibold sm:text-base">
  <Link href={`/students/${student.id}`} className="hover:text-blue-400 hover:underline">
    {student.full_name}
  </Link>
</td>
                    <td className="px-4 py-3 text-white/70 text-xs sm:text-base">{student.schools?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-white/70 text-xs sm:text-base">{DEPT_LABELS[student.department] ?? student.department}</td>
                    <td className="px-4 py-3 text-white/70 text-xs sm:text-base">{student.profiles?.full_name ?? "—"}</td>
                    <td className="px-4 py-3 text-white/70 text-xs sm:text-base">{getDisplayEnrollmentDate(student.commissions)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${getStatusBadgeClass(student.status)}`}>
                        {STATUS_LABELS[student.status] ?? student.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
          </>
        )}
      </main>
    </div>
  );
}