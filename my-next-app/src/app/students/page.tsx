"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Student = {
  id: string;
  full_name: string;
  student_number: string | null;
  school_id: string | null;
  department: string;
  enrollment_date: string | null;
  tuition_fee: number;
  status: string;
  created_at: string;
  schools: { name: string | null } | null;
};

const DEPT_LABELS: Record<string, string> = {
  china: "China",
  thailand: "Thailand",
  myanmar: "Myanmar",
  korea_japan: "Korea & Japan",
};

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
        .select("id, full_name, student_number, school_id, department, enrollment_date, tuition_fee, status, created_at, schools(name)")
        .order("created_at", { ascending: false });

      const { data: schoolsData } = await supabase
        .from("schools")
        .select("id, name")
        .order("name");

      if (studentsData) setStudents(studentsData as unknown as Student[]);
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
    const headers = ["Full Name", "Student Number", "School", "Department", "Enrollment Date", "Tuition Fee", "Status"];
    const rows = filteredStudents.map((s) => [
      escapeCsvValue(s.full_name),
      escapeCsvValue(s.student_number ?? ""),
      escapeCsvValue(s.schools?.name ?? ""),
      escapeCsvValue(DEPT_LABELS[s.department] ?? s.department),
      escapeCsvValue(s.enrollment_date ?? ""),
      escapeCsvValue(s.tuition_fee?.toString() ?? ""),
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

      {/* Nav */}
      <nav className="border-b border-white/10 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <h1 className="text-xl font-bold">PJ Commission Management System</h1>
          <Link href="/dashboard" className="text-sm text-white/60 hover:text-white">
            ← Back to Dashboard
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-6 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold">Students</h2>
            <p className="text-white/50 mt-1">{filteredStudents.length} total</p>
          </div>
          <div className="flex gap-3">
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
            <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
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
                className={`${filterInputClass} min-w-[180px]`}
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
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white/70">Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white/70">School</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white/70">Department</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white/70">Enrollment Date</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white/70">Tuition Fee</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white/70">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="border-b border-white/10 hover:bg-white/5 last:border-b-0">
                    <td className="px-6 py-4 font-semibold">
  <Link href={`/students/${student.id}`} className="hover:text-blue-400 hover:underline">
    {student.full_name}
  </Link>
</td>
                    <td className="px-6 py-4 text-white/70">{student.schools?.name ?? "—"}</td>
                    <td className="px-6 py-4 text-white/70">{DEPT_LABELS[student.department] ?? student.department}</td>
                    <td className="px-6 py-4 text-white/70">{student.enrollment_date ?? "—"}</td>
                    <td className="px-6 py-4 text-white/70">
                      {student.tuition_fee ? `$${student.tuition_fee.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                        student.status === "active"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/20 text-red-400"
                      }`}>
                        {student.status}
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