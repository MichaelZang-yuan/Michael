"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { hasRole } from "@/lib/roles";
import Navbar from "@/components/Navbar";
import { logActivity } from "@/lib/activityLog";

const DEPT_LABELS: Record<string, string> = {
  china: "China", thailand: "Thailand", myanmar: "Myanmar", korea_japan: "Korea & Japan",
};

export default function NewCompanyPage() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSales, setIsSales] = useState(false);
  const [userDept, setUserDept] = useState("");
  const [form, setForm] = useState({
    // Company
    company_name: "", trading_name: "", nzbn: "", region: "", email: "", phone: "", address: "",
    // Key Person
    key_person_name: "", key_person_last_name: "", key_person_gender: "",
    key_person_passport_no: "", key_person_dob: "", key_person_visa_status: "", key_person_role: "",
    // Accreditation
    accreditation_status: "none", accreditation_expiry: "",
    // Job Check
    job_title: "", job_check_expiry: "",
    // Notes & Dept
    notes: "", department: "",
  });

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/admin"); return; }
      const { data: profileData } = await supabase.from("profiles").select("role, roles, department").eq("id", session.user.id).single();
      const sales = hasRole(profileData, "sales");
      setIsSales(sales);
      if (profileData?.department) {
        setUserDept(profileData.department);
        if (sales) setForm(f => ({ ...f, department: profileData.department }));
      }
    }
    init();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_name.trim()) { setMessage({ type: "error", text: "Company Name is required." }); return; }
    if (!form.department) { setMessage({ type: "error", text: "Department is required." }); return; }

    setIsSaving(true); setMessage(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push("/admin"); return; }

    const clean = (v: string) => v.trim() || null;
    const cleanDate = (v: string) => v || null;

    const payload = {
      company_name: form.company_name.trim(),
      trading_name: clean(form.trading_name),
      nzbn: clean(form.nzbn),
      region: clean(form.region),
      email: clean(form.email),
      phone: clean(form.phone),
      address: clean(form.address),
      key_person_name: clean(form.key_person_name),
      key_person_last_name: clean(form.key_person_last_name),
      key_person_gender: clean(form.key_person_gender),
      key_person_passport_no: clean(form.key_person_passport_no),
      key_person_dob: cleanDate(form.key_person_dob),
      key_person_visa_status: clean(form.key_person_visa_status),
      key_person_role: clean(form.key_person_role),
      accreditation_status: form.accreditation_status || "none",
      accreditation_expiry: cleanDate(form.accreditation_expiry),
      job_title: clean(form.job_title),
      job_check_expiry: cleanDate(form.job_check_expiry),
      notes: clean(form.notes),
      department: form.department,
      assigned_sales_id: session.user.id,
      created_by: session.user.id,
    };

    const { data, error } = await supabase.from("companies").insert(payload).select().single();
    if (error) { setMessage({ type: "error", text: error.message }); setIsSaving(false); return; }

    await logActivity(supabase, session.user.id, "created_company", "companies", data.id, { company_name: form.company_name });
    router.push(`/companies/${data.id}`);
  };

  const inputClass = "w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none";
  const selectClass = "w-full rounded-lg border border-white/20 bg-blue-900 px-4 py-2.5 text-white focus:border-blue-400 focus:outline-none";
  const labelClass = "block text-sm font-medium text-white/70 mb-1";
  const sectionClass = "rounded-xl border border-white/10 bg-white/5 p-6 mb-6";

  return (
    <div className="min-h-screen bg-blue-950 text-white">
      <Navbar hasUnsavedChanges />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="mb-8">
          <Link href="/companies" className="text-sm text-white/50 hover:text-white/80 mb-2 inline-block">← Companies</Link>
          <h2 className="text-2xl font-bold sm:text-3xl">Add Company</h2>
        </div>

        {message && (
          <div className={`mb-6 rounded-lg px-4 py-3 ${message.type === "error" ? "bg-red-500/20 text-red-300 border border-red-500/30" : "bg-green-500/20 text-green-300 border border-green-500/30"}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-0">

          {/* Company Information */}
          <div className={sectionClass}>
            <h3 className="text-base font-bold mb-4">Company Information</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><label className={labelClass}>Company Name *</label><input name="company_name" value={form.company_name} onChange={handleChange} required className={inputClass} /></div>
              <div><label className={labelClass}>Trading Name</label><input name="trading_name" value={form.trading_name} onChange={handleChange} className={inputClass} /></div>
              <div><label className={labelClass}>NZBN</label><input name="nzbn" value={form.nzbn} onChange={handleChange} className={inputClass} /></div>
              <div><label className={labelClass}>Region</label><input name="region" value={form.region} onChange={handleChange} className={inputClass} /></div>
              <div><label className={labelClass}>Email</label><input name="email" value={form.email} onChange={handleChange} type="email" className={inputClass} /></div>
              <div><label className={labelClass}>Phone</label><input name="phone" value={form.phone} onChange={handleChange} className={inputClass} /></div>
              <div className="sm:col-span-2"><label className={labelClass}>Address</label><input name="address" value={form.address} onChange={handleChange} className={inputClass} /></div>
            </div>
          </div>

          {/* Key Person */}
          <div className={sectionClass}>
            <h3 className="text-base font-bold mb-4">Key Person</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><label className={labelClass}>First Name</label><input name="key_person_name" value={form.key_person_name} onChange={handleChange} className={inputClass} /></div>
              <div><label className={labelClass}>Last Name</label><input name="key_person_last_name" value={form.key_person_last_name} onChange={handleChange} className={inputClass} /></div>
              <div>
                <label className={labelClass}>Gender</label>
                <select name="key_person_gender" value={form.key_person_gender} onChange={handleChange} className={selectClass}>
                  <option value="" className="bg-blue-900">Select...</option>
                  <option value="male" className="bg-blue-900">Male</option>
                  <option value="female" className="bg-blue-900">Female</option>
                  <option value="other" className="bg-blue-900">Other</option>
                </select>
              </div>
              <div><label className={labelClass}>Passport No</label><input name="key_person_passport_no" value={form.key_person_passport_no} onChange={handleChange} className={inputClass} /></div>
              <div><label className={labelClass}>Date of Birth</label><input name="key_person_dob" value={form.key_person_dob} onChange={handleChange} type="date" className={inputClass} /></div>
              <div><label className={labelClass}>Visa Status</label><input name="key_person_visa_status" value={form.key_person_visa_status} onChange={handleChange} className={inputClass} /></div>
              <div><label className={labelClass}>Role / Position</label><input name="key_person_role" value={form.key_person_role} onChange={handleChange} className={inputClass} /></div>
            </div>
          </div>

          {/* Accreditation */}
          <div className={sectionClass}>
            <h3 className="text-base font-bold mb-4">Accreditation</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Accreditation Status</label>
                <select name="accreditation_status" value={form.accreditation_status} onChange={handleChange} className={selectClass}>
                  <option value="none" className="bg-blue-900">None</option>
                  <option value="standard" className="bg-blue-900">Standard</option>
                  <option value="high_volume" className="bg-blue-900">High Volume</option>
                </select>
              </div>
              <div><label className={labelClass}>Accreditation Expiry</label><input name="accreditation_expiry" value={form.accreditation_expiry} onChange={handleChange} type="date" className={inputClass} /></div>
            </div>
          </div>

          {/* Job Check */}
          <div className={sectionClass}>
            <h3 className="text-base font-bold mb-4">Job Check</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><label className={labelClass}>Job Title</label><input name="job_title" value={form.job_title} onChange={handleChange} className={inputClass} /></div>
              <div><label className={labelClass}>Job Check Expiry</label><input name="job_check_expiry" value={form.job_check_expiry} onChange={handleChange} type="date" className={inputClass} /></div>
            </div>
          </div>

          {/* Notes & Department */}
          <div className={sectionClass}>
            <h3 className="text-base font-bold mb-4">Department *</h3>
            {isSales ? (
              <p className="text-white/70">{DEPT_LABELS[userDept] ?? userDept}</p>
            ) : (
              <select name="department" value={form.department} onChange={handleChange} required className={`${selectClass} max-w-xs`}>
                <option value="" className="bg-blue-900">Select Department *</option>
                <option value="china" className="bg-blue-900">China</option>
                <option value="thailand" className="bg-blue-900">Thailand</option>
                <option value="myanmar" className="bg-blue-900">Myanmar</option>
                <option value="korea_japan" className="bg-blue-900">Korea & Japan</option>
              </select>
            )}
            <div className="mt-4">
              <label className={labelClass}>Notes</label>
              <textarea name="notes" value={form.notes} onChange={handleChange} rows={3} className={`${inputClass} resize-none`} />
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={isSaving} className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50">
              {isSaving ? "Saving..." : "Save Company"}
            </button>
            <button type="button" onClick={() => router.push("/companies")} className="rounded-lg border border-white/20 px-6 py-3 font-bold hover:bg-white/10">
              Cancel
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
