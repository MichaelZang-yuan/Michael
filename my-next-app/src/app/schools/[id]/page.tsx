"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type School = {
  id: string;
  name: string;
  course_type_a_name: string | null;
  course_type_a_rate: number | null;
  course_type_b_name: string | null;
  course_type_b_rate: number | null;
  contact_email: string | null;
  notes: string | null;
};

type Student = {
  id: string;
  full_name: string;
  department: string;
  enrollment_date: string | null;
  tuition_fee: number;
  status: string;
};

type Commission = {
  id: string;
  status: string;
  amount: number;
};

const DEPT_LABELS: Record<string, string> = {
  china: "China",
  thailand: "Thailand",
  myanmar: "Myanmar",
  korea_japan: "Korea & Japan",
};

export default function SchoolDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [school, setSchool] = useState<School | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/admin");
        return;
      }

      const { data: schoolData, error: schoolError } = await supabase
        .from("schools")
        .select("id, name, course_type_a_name, course_type_a_rate, course_type_b_name, course_type_b_rate, contact_email, notes")
        .eq("id", id)
        .single();

      if (schoolError) {
        console.error("[SchoolDetail] fetch school error:", schoolError);
        setIsLoading(false);
        return;
      }
      if (schoolData) setSchool(schoolData as unknown as School);

      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select("id, full_name, department, enrollment_date, tuition_fee, status")
        .eq("school_id", id)
        .order("full_name");

      if (studentsError) {
        console.error("[SchoolDetail] fetch students error:", studentsError);
      }
      if (studentsData) setStudents(studentsData as unknown as Student[]);

      const studentIds = studentsData?.map((s) => s.id) ?? [];
      if (studentIds.length > 0) {
        const { data: commissionsData, error: commissionsError } = await supabase
          .from("commissions")
          .select("id, status, amount")
          .in("student_id", studentIds);

        if (commissionsError) {
          console.error("[SchoolDetail] fetch commissions error:", commissionsError);
        }
        if (commissionsData) setCommissions(commissionsData as unknown as Commission[]);
      }

      setIsLoading(false);
    }

    init();
  }, [id, router]);

  const formatRate = (rate: number | null) => {
    if (rate == null) return "—";
    return `${(rate * 100).toFixed(0)}%`;
  };

  const pendingCommissions = commissions.filter((c) => c.status === "pending");
  const claimedCommissions = commissions.filter((c) => c.status === "claimed");
  const pendingCount = pendingCommissions.length;
  const pendingTotal = pendingCommissions.reduce((sum, c) => sum + c.amount, 0);
  const claimedCount = claimedCommissions.length;
  const claimedTotal = claimedCommissions.reduce((sum, c) => sum + c.amount, 0);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-blue-950">
        <p className="text-white/60">Loading...</p>
      </div>
    );
  }

  if (!school) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-blue-950">
        <p className="text-white/60 mb-4">School not found.</p>
        <Link href="/schools" className="text-blue-400 hover:underline">← Back to Schools</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-950 text-white">
      <nav className="border-b border-white/10 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <h1 className="text-xl font-bold">PJ Commission Management System</h1>
          <Link href="/schools" className="text-sm text-white/60 hover:text-white">
            ← Back to Schools
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <h2 className="text-3xl font-bold">{school.name}</h2>
          <Link
            href={`/schools/${id}/edit`}
            className="rounded-lg border border-white/20 px-4 py-2 text-sm font-bold hover:bg-white/10"
          >
            Edit School
          </Link>
        </div>

        {/* School Info */}
        <div className="mb-10 rounded-xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-bold mb-4">School Information</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-white/50 mb-1">Course Type A</p>
              <p className="font-semibold">{school.course_type_a_name ?? "—"}</p>
              <p className="text-white/70 text-sm">{formatRate(school.course_type_a_rate)}</p>
            </div>
            <div>
              <p className="text-sm text-white/50 mb-1">Course Type B</p>
              <p className="font-semibold">{school.course_type_b_name ?? "—"}</p>
              <p className="text-white/70 text-sm">{formatRate(school.course_type_b_rate)}</p>
            </div>
            <div>
              <p className="text-sm text-white/50 mb-1">Contact Email</p>
              <p className="font-semibold">{school.contact_email ?? "—"}</p>
            </div>
            {school.notes && (
              <div className="md:col-span-2">
                <p className="text-sm text-white/50 mb-1">Notes</p>
                <p className="text-white/70 whitespace-pre-wrap">{school.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-10">
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <div className="mb-2 text-sm font-semibold text-white/70">Total Students</div>
            <p className="text-3xl font-bold">{students.length}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <div className="mb-2 text-sm font-semibold text-white/70">Pending Commissions</div>
            <p className="text-3xl font-bold">{pendingCount}</p>
            <p className="text-white/60 text-sm">${pendingTotal.toLocaleString()} NZD total</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <div className="mb-2 text-sm font-semibold text-white/70">Claimed Commissions</div>
            <p className="text-3xl font-bold">{claimedCount}</p>
            <p className="text-white/60 text-sm">${claimedTotal.toLocaleString()} NZD total</p>
          </div>
        </div>

        {/* Students List */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-bold mb-4">Students</h3>
          {students.length === 0 ? (
            <p className="text-white/50 py-8 text-center">No students at this school yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] border-collapse">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white/70">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white/70">Department</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white/70">Enrollment Date</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white/70">Tuition Fee</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white/70">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id} className="border-b border-white/10 last:border-b-0 hover:bg-white/5">
                      <td className="px-4 py-3">
                        <Link href={`/students/${s.id}`} className="font-semibold text-blue-400 hover:underline">
                          {s.full_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-white/70">{DEPT_LABELS[s.department] ?? s.department}</td>
                      <td className="px-4 py-3 text-white/70">{s.enrollment_date ?? "—"}</td>
                      <td className="px-4 py-3 text-white/70">
                        {s.tuition_fee ? `$${s.tuition_fee.toLocaleString()}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                          s.status === "active" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                        }`}>
                          {s.status}
                        </span>
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
