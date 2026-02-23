"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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

const emptyForm = {
  name: "",
  course_type_a_name: "",
  course_type_a_rate: "",
  course_type_b_name: "",
  course_type_b_rate: "",
  contact_email: "",
  notes: "",
};

export default function SchoolsPage() {
  const router = useRouter();
  const [schools, setSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);

  const fetchSchools = useCallback(async () => {
    const { data, error } = await supabase
      .from("schools")
      .select("id, name, course_type_a_name, course_type_a_rate, course_type_b_name, course_type_b_rate, contact_email, notes")
      .order("name");
    if (error) {
      console.error("[fetchSchools] error:", error);
      return;
    }
    if (data) setSchools(data as unknown as School[]);
  }, []);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/admin");
        return;
      }
      await fetchSchools();
      setIsLoading(false);
    }

    init();
  }, [router, fetchSchools]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleAddSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const rateA = parseFloat(form.course_type_a_rate);
    const rateB = parseFloat(form.course_type_b_rate);

    const payload = {
      name: form.name.trim(),
      course_type_a_name: form.course_type_a_name.trim() || null,
      course_type_a_rate: isNaN(rateA) ? null : rateA / 100,
      course_type_b_name: form.course_type_b_name.trim() || null,
      course_type_b_rate: isNaN(rateB) ? null : rateB / 100,
      contact_email: form.contact_email.trim() || null,
      notes: form.notes.trim() || null,
    };

    const { data, error } = await supabase
      .from("schools")
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error("[handleAddSchool] insert error:", error);
      setIsSubmitting(false);
      return;
    }

    if (data) {
      setForm(emptyForm);
      await fetchSchools();
    }
    setIsSubmitting(false);
  };

  const startEdit = (school: School) => {
    setEditingId(school.id);
    setEditForm({
      name: school.name,
      course_type_a_name: school.course_type_a_name ?? "",
      course_type_a_rate: school.course_type_a_rate != null ? String((school.course_type_a_rate * 100).toFixed(1)) : "",
      course_type_b_name: school.course_type_b_name ?? "",
      course_type_b_rate: school.course_type_b_rate != null ? String((school.course_type_b_rate * 100).toFixed(1)) : "",
      contact_email: school.contact_email ?? "",
      notes: school.notes ?? "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setIsSubmitting(true);

    const rateA = parseFloat(editForm.course_type_a_rate);
    const rateB = parseFloat(editForm.course_type_b_rate);

    const { data, error } = await supabase
      .from("schools")
      .update({
        name: editForm.name.trim(),
        course_type_a_name: editForm.course_type_a_name.trim() || null,
        course_type_a_rate: isNaN(rateA) ? null : rateA / 100,
        course_type_b_name: editForm.course_type_b_name.trim() || null,
        course_type_b_rate: isNaN(rateB) ? null : rateB / 100,
        contact_email: editForm.contact_email.trim() || null,
        notes: editForm.notes.trim() || null,
      })
      .eq("id", editingId)
      .select()
      .single();

    if (error) {
      console.error("[handleSaveEdit] update error:", error);
    } else if (data) {
      setSchools(schools.map((s) => (s.id === editingId ? (data as unknown as School) : s)));
      setEditingId(null);
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this school?")) return;

    const { error } = await supabase.from("schools").delete().eq("id", id);

    if (error) {
      console.error("[handleDelete] delete error:", error);
      return;
    }

    setSchools((prev) => prev.filter((s) => s.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const formatRate = (rate: number | null) => {
    if (rate == null) return "—";
    return `${(rate * 100).toFixed(0)}%`;
  };

  const inputClass = "rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none w-full";

  return (
    <div className="min-h-screen bg-blue-950 text-white">
      <nav className="border-b border-white/10 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-base font-bold sm:text-xl">PJ Commission Management System</h1>
          <Link href="/dashboard" className="text-sm text-white/60 hover:text-white">
            ← Back to Dashboard
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-8">
          <h2 className="text-2xl font-bold sm:text-3xl">Schools</h2>
          <p className="text-white/50 mt-1">{schools.length} total</p>
        </div>

        <form onSubmit={handleAddSchool} className="mb-10 rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6">
          <h3 className="text-lg font-bold mb-4">Add School</h3>
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
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-4 rounded-lg bg-blue-600 px-6 py-2.5 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? "Adding..." : "Add School"}
          </button>
        </form>

        {isLoading ? (
          <p className="text-white/50 text-center py-20">Loading...</p>
        ) : schools.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center">
            <p className="text-xl font-bold mb-2">No schools yet</p>
            <p className="text-white/50">Add your first school above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[600px] border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-3 py-2 sm:px-4 sm:py-3 text-left text-xs font-semibold text-white/70 sm:text-sm">Name</th>
                  <th className="px-3 py-2 sm:px-4 sm:py-3 text-left text-xs font-semibold text-white/70 sm:text-sm">Course Type A</th>
                  <th className="px-3 py-2 sm:px-4 sm:py-3 text-left text-xs font-semibold text-white/70 sm:text-sm">Rate A</th>
                  <th className="px-3 py-2 sm:px-4 sm:py-3 text-left text-xs font-semibold text-white/70 sm:text-sm">Course Type B</th>
                  <th className="px-3 py-2 sm:px-4 sm:py-3 text-left text-xs font-semibold text-white/70 sm:text-sm">Rate B</th>
                  <th className="px-3 py-2 sm:px-4 sm:py-3 text-left text-xs font-semibold text-white/70 sm:text-sm">Contact Email</th>
                  <th className="px-3 py-2 sm:px-4 sm:py-3 text-left text-xs font-semibold text-white/70 sm:text-sm">Notes</th>
                  <th className="px-3 py-2 sm:px-4 sm:py-3 text-left text-xs font-semibold text-white/70 sm:text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {schools.map((school) => (
                  <tr key={school.id} className="border-b border-white/10 hover:bg-white/5 last:border-b-0">
                    {editingId === school.id ? (
                      <>
                        <td className="px-3 py-2 sm:px-4 sm:py-3">
                          <input name="name" value={editForm.name} onChange={handleEditChange} required className={inputClass} />
                        </td>
                        <td className="px-3 py-2 sm:px-4 sm:py-3">
                          <input name="course_type_a_name" value={editForm.course_type_a_name} onChange={handleEditChange} className={inputClass} />
                        </td>
                        <td className="px-3 py-2 sm:px-4 sm:py-3">
                          <input type="number" name="course_type_a_rate" value={editForm.course_type_a_rate} onChange={handleEditChange} placeholder="15" min="0" max="100" step="0.1" className={inputClass} />
                        </td>
                        <td className="px-3 py-2 sm:px-4 sm:py-3">
                          <input name="course_type_b_name" value={editForm.course_type_b_name} onChange={handleEditChange} className={inputClass} />
                        </td>
                        <td className="px-3 py-2 sm:px-4 sm:py-3">
                          <input type="number" name="course_type_b_rate" value={editForm.course_type_b_rate} onChange={handleEditChange} placeholder="10" min="0" max="100" step="0.1" className={inputClass} />
                        </td>
                        <td className="px-3 py-2 sm:px-4 sm:py-3">
                          <input type="email" name="contact_email" value={editForm.contact_email} onChange={handleEditChange} className={inputClass} />
                        </td>
                        <td className="px-3 py-2 sm:px-4 sm:py-3">
                          <textarea name="notes" value={editForm.notes} onChange={handleEditChange} rows={2} className={inputClass} />
                        </td>
                        <td className="px-3 py-2 sm:px-4 sm:py-3">
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={handleSaveEdit} disabled={isSubmitting} className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50">Save</button>
                            <button type="button" onClick={cancelEdit} className="rounded-lg border border-white/20 px-3 py-1.5 text-sm font-bold hover:bg-white/10">Cancel</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2 font-semibold text-xs sm:px-4 sm:py-3 sm:text-base">
                            <Link href={`/schools/${school.id}`} className="text-blue-400 hover:underline">
                              {school.name}
                            </Link>
                          </td>
                        <td className="px-3 py-2 text-white/70 text-xs sm:px-4 sm:py-3 sm:text-base">{school.course_type_a_name ?? "—"}</td>
                        <td className="px-3 py-2 text-white/70 text-xs sm:px-4 sm:py-3 sm:text-base">{formatRate(school.course_type_a_rate)}</td>
                        <td className="px-3 py-2 text-white/70 text-xs sm:px-4 sm:py-3 sm:text-base">{school.course_type_b_name ?? "—"}</td>
                        <td className="px-3 py-2 text-white/70 text-xs sm:px-4 sm:py-3 sm:text-base">{formatRate(school.course_type_b_rate)}</td>
                        <td className="px-3 py-2 text-white/70 text-xs sm:px-4 sm:py-3 sm:text-base max-w-[120px] sm:max-w-[150px] truncate">{school.contact_email ?? "—"}</td>
                        <td className="px-3 py-2 text-white/70 text-xs sm:px-4 sm:py-3 sm:text-base max-w-[100px] sm:max-w-[150px] truncate" title={school.notes ?? undefined}>{school.notes ?? "—"}</td>
                        <td className="px-3 py-2 sm:px-4 sm:py-3">
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => startEdit(school)} className="rounded-lg border border-white/20 px-3 py-1.5 text-sm font-bold hover:bg-white/10">Edit</button>
                            <button onClick={() => handleDelete(school.id)} className="rounded-lg border border-red-500/50 px-3 py-1.5 text-sm font-bold text-red-400 hover:bg-red-500/20">Delete</button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
