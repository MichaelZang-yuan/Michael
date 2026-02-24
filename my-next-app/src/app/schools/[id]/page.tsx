"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

type AttachmentFile = { name: string; url: string; createdAt: string | null };

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
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

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

      const attRes = await fetch(`/api/attachments?type=schools&id=${id}`);
      const attJson = await attRes.json().catch(() => ({ files: [] }));
      if (attJson.files) setAttachments(attJson.files);

      setIsLoading(false);
    }

    init();
  }, [id, router]);

  const fetchAttachments = useCallback(async () => {
    const res = await fetch(`/api/attachments?type=schools&id=${id}`);
    const json = await res.json().catch(() => ({ files: [] }));
    if (json.files) setAttachments(json.files);
  }, [id]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "schools");
      formData.append("id", id);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("[SchoolDetail] upload error:", data);
        return;
      }
      await fetchAttachments();
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const displayFileName = (name: string) => {
    const match = name.match(/^\d+-(.+)$/);
    return match ? match[1] : name;
  };

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
      <Navbar />

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
            <div className="md:col-span-2">
              <p className="text-sm text-white/50 mb-2">Attachments</p>
              <div className="flex flex-col gap-2">
                {attachments.length === 0 ? (
                  <p className="text-white/50 text-sm">No attachments yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {attachments.map((f) => (
                      <li key={f.url} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                        <span className="text-sm text-white/80 truncate flex-1 min-w-0">{displayFileName(f.name)}</span>
                        {f.createdAt && (
                          <span className="text-xs text-white/50">
                            {new Date(f.createdAt).toLocaleDateString()}
                          </span>
                        )}
                        <a
                          href={f.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg border border-white/20 px-3 py-1 text-xs font-bold hover:bg-white/10"
                        >
                          View / Download
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                <label className="inline-flex cursor-pointer">
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleUpload}
                    disabled={isUploading}
                  />
                  <span className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                    {isUploading ? "Uploading..." : "+ Upload"}
                  </span>
                </label>
              </div>
            </div>
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
                          s.status === "active" ? "bg-blue-500/20 text-blue-400"
                          : s.status === "enrolled" ? "bg-yellow-500/20 text-yellow-400"
                          : s.status === "pending" ? "bg-orange-500/20 text-orange-400"
                          : s.status === "claimed" ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/20 text-red-400"
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
