"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type School = {
  id: string;
  name: string;
};

export default function NewStudentPage() {
  const router = useRouter();
  const [schools, setSchools] = useState<School[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    full_name: "",
    student_number: "",
    school_id: "",
    department: "",
    enrollment_date: "",
    tuition_fee: "",
    notes: "",
  });

  useEffect(() => {
    // 检查是否登录
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push("/admin");
    });

    // 加载学校列表
    supabase.from("schools").select("id, name").order("name").then(({ data }) => {
      if (data) setSchools(data);
    });
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { data: { session } } = await supabase.auth.getSession();

    const { error: insertError } = await supabase.from("students").insert({
      full_name: form.full_name,
      student_number: form.student_number || null,
      school_id: form.school_id || null,
      department: form.department,
      enrollment_date: form.enrollment_date || null,
      tuition_fee: form.tuition_fee ? parseFloat(form.tuition_fee) : 0,
      notes: form.notes || null,
      created_by: session?.user.id,
    });

    if (insertError) {
      setError("Failed to add student. Please try again.");
    } else {
      router.push("/students");
    }

    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-blue-950 text-white">
      <nav className="border-b border-white/10 px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <h1 className="text-xl font-bold">Commission Management System</h1>
          <Link href="/dashboard" className="text-sm text-white/60 hover:text-white">
            ← Back to Dashboard
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <h2 className="text-3xl font-bold mb-8">Add New Student</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-white/70">Full Name *</label>
            <input
              name="full_name"
              value={form.full_name}
              onChange={handleChange}
              required
              placeholder="e.g. Zhang Wei"
              className="rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none"
            />
          </div>

          {/* Student Number */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-white/70">Student Number</label>
            <input
              name="student_number"
              value={form.student_number}
              onChange={handleChange}
              placeholder="e.g. ST123456"
              className="rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none"
            />
          </div>

          {/* School */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-white/70">School</label>
            <select
              name="school_id"
              value={form.school_id}
              onChange={handleChange}
              className="rounded-lg border border-white/20 bg-blue-900 px-4 py-3 text-white focus:border-blue-400 focus:outline-none"
            >
              <option value="">Select a school...</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Department */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-white/70">Department *</label>
            <select
              name="department"
              value={form.department}
              onChange={handleChange}
              required
              className="rounded-lg border border-white/20 bg-blue-900 px-4 py-3 text-white focus:border-blue-400 focus:outline-none"
            >
              <option value="">Select a department...</option>
              <option value="china">China</option>
              <option value="thailand">Thailand</option>
              <option value="myanmar">Myanmar</option>
              <option value="korea_japan">Korea & Japan</option>
            </select>
          </div>

          {/* Enrollment Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-white/70">Enrollment Date</label>
            <input
              type="date"
              name="enrollment_date"
              value={form.enrollment_date}
              onChange={handleChange}
              className="rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white focus:border-blue-400 focus:outline-none"
            />
          </div>

          {/* Tuition Fee */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-white/70">Tuition Fee (NZD)</label>
            <input
              type="number"
              name="tuition_fee"
              value={form.tuition_fee}
              onChange={handleChange}
              placeholder="e.g. 20000"
              className="rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none"
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-white/70">Notes</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              placeholder="Any additional notes..."
              rows={3}
              className="rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none"
            />
          </div>

          {error && <p className="text-red-400">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-blue-600 px-8 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Add Student"}
            </button>
            <Link
              href="/students"
              className="rounded-lg border border-white/20 px-8 py-3 font-bold text-white hover:bg-white/10"
            >
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}