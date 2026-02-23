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

const inputClass =
  "rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none w-full";

export default function EditSchoolPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [school, setSchool] = useState<School | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [form, setForm] = useState({
    name: "",
    course_type_a_name: "",
    course_type_a_rate: "",
    course_type_b_name: "",
    course_type_b_rate: "",
    contact_email: "",
    notes: "",
  });

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/admin");
        return;
      }

      const { data: schoolData, error } = await supabase
        .from("schools")
        .select("id, name, course_type_a_name, course_type_a_rate, course_type_b_name, course_type_b_rate, contact_email, notes")
        .eq("id", id)
        .single();

      if (error) {
        console.error("[EditSchool] fetch error:", error);
        setIsLoading(false);
        return;
      }

      if (schoolData) {
        const s = schoolData as unknown as School;
        setSchool(s);
        setForm({
          name: s.name ?? "",
          course_type_a_name: s.course_type_a_name ?? "",
          course_type_a_rate: s.course_type_a_rate != null ? String((s.course_type_a_rate * 100).toFixed(1)) : "",
          course_type_b_name: s.course_type_b_name ?? "",
          course_type_b_rate: s.course_type_b_rate != null ? String((s.course_type_b_rate * 100).toFixed(1)) : "",
          contact_email: s.contact_email ?? "",
          notes: s.notes ?? "",
        });
      }
      setIsLoading(false);
    }

    init();
  }, [id, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    const rateA = parseFloat(form.course_type_a_rate);
    const rateB = parseFloat(form.course_type_b_rate);

    const { error } = await supabase
      .from("schools")
      .update({
        name: form.name.trim(),
        course_type_a_name: form.course_type_a_name.trim() || null,
        course_type_a_rate: isNaN(rateA) ? null : rateA / 100,
        course_type_b_name: form.course_type_b_name.trim() || null,
        course_type_b_rate: isNaN(rateB) ? null : rateB / 100,
        contact_email: form.contact_email.trim() || null,
        notes: form.notes.trim() || null,
      })
      .eq("id", id);

    if (error) {
      console.error("[EditSchool] update error:", error);
      setMessage({ type: "error", text: "Failed to save. Please try again." });
    } else {
      setMessage({ type: "success", text: "✅ School updated successfully!" });
    }
    setIsSaving(false);
  };

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
          <Link href={`/schools/${id}`} className="text-sm text-white/60 hover:text-white">
            ← Back to School
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="text-3xl font-bold mb-8">Edit School</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-white/70">School Name *</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                placeholder="e.g. Auckland University"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-white/70">Contact Email</label>
              <input
                type="email"
                name="contact_email"
                value={form.contact_email}
                onChange={handleChange}
                placeholder="contact@school.edu"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-white/70">Course Type A Name</label>
              <input
                name="course_type_a_name"
                value={form.course_type_a_name}
                onChange={handleChange}
                placeholder="e.g. Bachelor, Diploma"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-white/70">Course Type A Commission Rate (%)</label>
              <input
                type="number"
                name="course_type_a_rate"
                value={form.course_type_a_rate}
                onChange={handleChange}
                placeholder="15"
                min="0"
                max="100"
                step="0.1"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-white/70">Course Type B Name</label>
              <input
                name="course_type_b_name"
                value={form.course_type_b_name}
                onChange={handleChange}
                placeholder="e.g. Master, Certificate"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-white/70">Course Type B Commission Rate (%)</label>
              <input
                type="number"
                name="course_type_b_rate"
                value={form.course_type_b_rate}
                onChange={handleChange}
                placeholder="10"
                min="0"
                max="100"
                step="0.1"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-sm font-semibold text-white/70">Notes</label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                placeholder="Additional notes..."
                rows={3}
                className={inputClass}
              />
            </div>
          </div>

          {message && (
            <p className={message.type === "success" ? "text-green-400" : "text-red-400"}>
              {message.text}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-blue-600 px-8 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
            <Link
              href={`/schools/${id}`}
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
