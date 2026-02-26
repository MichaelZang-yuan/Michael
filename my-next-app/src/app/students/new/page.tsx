"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import { logActivity } from "@/lib/activityLog";

type School = {
  id: string;
  name: string;
  course_type_a_rate?: number | null;
  course_type_b_rate?: number | null;
};

function findBestSchoolMatch(schoolName: string | null, schools: School[]): string {
  if (!schoolName?.trim() || schools.length === 0) return "";
  const q = schoolName.trim().toLowerCase();
  const exact = schools.find((s) => s.name.toLowerCase() === q);
  if (exact) return exact.id;
  const contains = schools.find((s) =>
    s.name.toLowerCase().includes(q) || q.includes(s.name.toLowerCase())
  );
  if (contains) return contains.id;
  const fuzzy = schools.find((s) =>
    s.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(q.slice(0, 3)))
  );
  return fuzzy?.id ?? "";
}

function processFile(file: File): Promise<{ name: string; base64: string; fileType: "pdf" | "image"; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const isPdf = file.type === "application/pdf";
    const isImage = file.type === "image/jpeg" || file.type === "image/png" || file.type === "image/jpg";
    if (!isPdf && !isImage) {
      reject(new Error("Please upload a PDF or image (jpg, png)."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.includes(",") ? result.split(",")[1]! : result;
      resolve({
        name: file.name,
        base64: base64Data,
        fileType: isPdf ? "pdf" : "image",
        mediaType: file.type,
      });
    };
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

export default function NewStudentPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [profile, setProfile] = useState<{ role: string; department: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractMessage, setExtractMessage] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; base64: string; fileType: "pdf" | "image"; mediaType: string } | null>(null);

  const [form, setForm] = useState({
    full_name: "",
    student_number: "",
    school_id: "",
    department: "",
    notes: "",
  });

  const [commissionForm, setCommissionForm] = useState({
    enrollment_date: "",
    tuition_fee: "",
    commission_rate: "",
    amount: "",
  });

  const isSales = profile?.role === "sales";
  const isDirty =
    !!form.full_name ||
    !!form.student_number ||
    !!form.school_id ||
    !!form.department ||
    !!form.notes ||
    !!uploadedFile ||
    !!commissionForm.enrollment_date ||
    !!commissionForm.tuition_fee ||
    !!commissionForm.amount;

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/admin");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("role, department")
        .eq("id", session.user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        if (profileData.role === "sales" && profileData.department) {
          setForm((prev) => ({ ...prev, department: profileData.department }));
        }
      }

      const { data: schoolsData } = await supabase
        .from("schools")
        .select("id, name, course_type_a_rate, course_type_b_rate")
        .order("name");
      if (schoolsData) setSchools(schoolsData);
    }
    init();
  }, [router]);

  useEffect(() => {
    if (!form.school_id) {
      setCommissionForm((prev) => ({ ...prev, commission_rate: "", amount: "" }));
      return;
    }
    const school = schools.find((s) => s.id === form.school_id);
    const rate = school?.course_type_a_rate ?? school?.course_type_b_rate ?? 0.1;
    setCommissionForm((prev) => {
      const tuition = parseFloat(prev.tuition_fee) || 0;
      const newAmount = tuition ? (tuition * rate).toFixed(2) : "";
      return {
        ...prev,
        commission_rate: String((rate * 100).toFixed(1)),
        amount: newAmount || prev.amount,
      };
    });
  }, [form.school_id, schools]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleCommissionChange = (field: "enrollment_date" | "tuition_fee" | "commission_rate" | "amount", value: string) => {
    setCommissionForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "tuition_fee" || field === "commission_rate") {
        const tuition = parseFloat(field === "tuition_fee" ? value : prev.tuition_fee) || 0;
        const rate = parseFloat(field === "commission_rate" ? value : prev.commission_rate) || 0;
        next.amount = (tuition * rate / 100).toFixed(2);
      }
      return next;
    });
  };

  const doExtract = async (fileData: { name: string; base64: string; fileType: "pdf" | "image"; mediaType: string }) => {
    setIsExtracting(true);
    setError(null);
    setExtractMessage(null);

    try {
      const res = await fetch("/api/extract-offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base64Data: fileData.base64,
          fileType: fileData.fileType,
          mediaType: fileData.mediaType,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Extraction failed.");
        return;
      }

      const schoolId = findBestSchoolMatch(data.school_name, schools);
      setForm((prev) => ({
        ...prev,
        full_name: data.student_name ?? prev.full_name,
        student_number: data.student_number ?? prev.student_number,
        school_id: schoolId || prev.school_id,
      }));

      const commissionUpdates: Partial<typeof commissionForm> = {};
      if (data.enrollment_date) {
        commissionUpdates.enrollment_date = data.enrollment_date;
      }
      if (data.tuition_fee != null) {
        const tuition = Number(data.tuition_fee);
        const school = schools.find((s) => s.id === (schoolId || form.school_id));
        const rate = school?.course_type_a_rate ?? school?.course_type_b_rate ?? 0.1;
        commissionUpdates.tuition_fee = String(tuition);
        commissionUpdates.commission_rate = String((rate * 100).toFixed(1));
        commissionUpdates.amount = (tuition * rate).toFixed(2);
      }
      if (Object.keys(commissionUpdates).length > 0) {
        setCommissionForm((prev) => ({ ...prev, ...commissionUpdates }));
      }

      setExtractMessage("✅ Information extracted! Please review before saving.");
    } catch {
      setError("Extraction failed.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtractMessage(null);
    setError(null);
    try {
      const data = await processFile(file);
      setUploadedFile(data);
      await doExtract(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file.");
    }
    e.target.value = "";
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isExtracting) return;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setExtractMessage(null);
    setError(null);
    try {
      const data = await processFile(file);
      setUploadedFile(data);
      await doExtract(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file.");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError("Session expired. Please log in again.");
      setIsSubmitting(false);
      return;
    }

    const enrollmentDate = commissionForm.enrollment_date?.trim() || null;
    let status: "active" | "enrolled" = "active";
    if (enrollmentDate) {
      const ed = new Date(enrollmentDate);
      ed.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (ed <= today) status = "enrolled";
    }

    const insertPayload: Record<string, unknown> = {
      full_name: form.full_name,
      student_number: form.student_number || null,
      school_id: form.school_id || null,
      department: form.department,
      status,
      notes: form.notes || null,
      created_by: session.user.id,
    };
    if (profile?.role === "sales") {
      insertPayload.assigned_sales_id = session.user.id;
    }

    const { data: newStudent, error: insertError } = await supabase
      .from("students")
      .insert(insertPayload)
      .select("id")
      .single();

    if (insertError) {
      setError("Failed to add student. Please try again.");
      setIsSubmitting(false);
      return;
    }

    const amount = parseFloat(commissionForm.amount);
    if (newStudent && amount > 0) {
      const tuition = parseFloat(commissionForm.tuition_fee) || null;
      const rate = parseFloat(commissionForm.commission_rate) ? parseFloat(commissionForm.commission_rate) / 100 : null;

      await supabase.from("commissions").insert({
        student_id: newStudent.id,
        year: 1,
        status: "pending",
        amount,
        tuition_fee: tuition,
        commission_rate: rate,
        enrollment_date: enrollmentDate,
      });
    }

    if (newStudent) {
      await logActivity(supabase, session.user.id, "created_student", "student", newStudent.id, { name: form.full_name });
    }

    if (newStudent && uploadedFile) {
      try {
        const byteChars = atob(uploadedFile.base64);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNumbers[i] = byteChars.charCodeAt(i);
        }
        const blob = new Blob([new Uint8Array(byteNumbers)], { type: uploadedFile.mediaType });
        const formData = new FormData();
        formData.append("file", blob, uploadedFile.name);
        formData.append("type", "students");
        formData.append("id", newStudent.id);
        await fetch("/api/upload", { method: "POST", body: formData });
      } catch (err) {
        console.error("[NewStudent] offer upload error:", err);
      }
    }

    router.push("/students");
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-blue-950 text-white">
      <Navbar hasUnsavedChanges={isDirty} />

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h2 className="text-2xl font-bold mb-8 sm:text-3xl">Add New Student</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full">

          {/* Upload Offer Letter - Drag & Drop */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6">
            <h3 className="text-sm font-semibold text-white/70 mb-3">Upload Offer Letter (Optional)</h3>
            <div
              onClick={() => !isExtracting && fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
                isExtracting
                  ? "cursor-wait border-amber-500/50 bg-amber-900/20"
                  : isDragging
                    ? "cursor-pointer border-blue-400 bg-blue-900/50"
                    : "cursor-pointer border-white/20 hover:border-white/40"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/jpeg,image/jpg,image/png"
                onChange={handleFileChange}
                className="hidden"
              />
              <p className="text-white/70 text-sm">
                Drag & drop your offer letter here, or click to browse
              </p>
              <p className="mt-1 text-xs text-white/50">PDF, JPG, PNG</p>
              {uploadedFile && (
                <p className="mt-3 text-sm">
                  {isExtracting ? (
                    <span className="text-amber-400">Extracting information...</span>
                  ) : (
                    <span className="text-green-400">Selected: {uploadedFile.name}</span>
                  )}
                </p>
              )}
            </div>
            {extractMessage && (
              <p className="mt-2 text-sm text-green-400">{extractMessage}</p>
            )}
          </div>

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-white/70">Full Name *</label>
            <input
              name="full_name"
              value={form.full_name}
              onChange={handleChange}
              required
              placeholder="e.g. Zhang Wei"
              className="rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none w-full"
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
              className="rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none w-full"
            />
          </div>

          {/* School */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-white/70">School</label>
            <select
              name="school_id"
              value={form.school_id}
              onChange={handleChange}
              className="rounded-lg border border-white/20 bg-blue-900 px-4 py-3 text-white focus:border-blue-400 focus:outline-none w-full"
            >
              <option value="" className="bg-blue-900 text-white">Select a school...</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id} className="bg-blue-900 text-white">{s.name}</option>
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
              disabled={isSales}
              className="rounded-lg border border-white/20 bg-blue-900 px-4 py-3 text-white focus:border-blue-400 focus:outline-none w-full disabled:cursor-not-allowed disabled:opacity-70"
            >
              <option value="" className="bg-blue-900 text-white">Select a department...</option>
              <option value="china" className="bg-blue-900 text-white">China</option>
              <option value="thailand" className="bg-blue-900 text-white">Thailand</option>
              <option value="myanmar" className="bg-blue-900 text-white">Myanmar</option>
              <option value="korea_japan" className="bg-blue-900 text-white">Korea & Japan</option>
            </select>
            {isSales && (
              <p className="text-xs text-white/50 mt-1">Department is locked to your profile.</p>
            )}
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
              className="rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none w-full"
            />
          </div>

          {/* Commission Details - Year 1 Optional */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6">
            <h3 className="text-sm font-semibold text-white/70 mb-3">Commission Details</h3>
            <p className="text-xs text-white/50 mb-4">Add Year 1 Commission (Optional)</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-white/60">Enrollment Date for Year 1</label>
                <input
                  type="date"
                  value={commissionForm.enrollment_date}
                  onChange={(e) => handleCommissionChange("enrollment_date", e.target.value)}
                  className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none w-full"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-white/60">Tuition Fee for Year 1</label>
                <input
                  type="number"
                  value={commissionForm.tuition_fee}
                  onChange={(e) => handleCommissionChange("tuition_fee", e.target.value)}
                  placeholder="e.g. 20000"
                  className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none w-full"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-white/60">Commission Rate (%)</label>
                <input
                  type="number"
                  value={commissionForm.commission_rate}
                  onChange={(e) => handleCommissionChange("commission_rate", e.target.value)}
                  placeholder="e.g. 15"
                  step="0.1"
                  className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none w-full"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-white/60">Amount</label>
                <input
                  type="number"
                  value={commissionForm.amount}
                  onChange={(e) => handleCommissionChange("amount", e.target.value)}
                  placeholder="Auto"
                  className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none w-full"
                />
              </div>
            </div>
          </div>

          {error && <p className="text-red-400">{error}</p>}

          <div className="flex flex-wrap gap-3 pt-2">
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
