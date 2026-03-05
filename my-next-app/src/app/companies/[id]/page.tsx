"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import { logActivity } from "@/lib/activityLog";

type AttachmentFile = { name: string; url: string; createdAt: string | null };
type ActivityLog = { id: string; action: string; details: Record<string, unknown> | null; created_at: string; user_id: string };
type CompanyDeal = { id: string; deal_number: string | null; deal_type: string | null; status: string; total_amount: number | null; created_at: string };

const DEPT_LABELS: Record<string, string> = {
  china: "China", thailand: "Thailand", myanmar: "Myanmar", korea_japan: "Korea & Japan",
};

const DEAL_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-500/20 text-gray-400", quoted: "bg-blue-500/20 text-blue-400",
  contracted: "bg-purple-500/20 text-purple-400", in_progress: "bg-yellow-500/20 text-yellow-400",
  submitted: "bg-orange-500/20 text-orange-400", approved: "bg-green-500/20 text-green-400",
  declined: "bg-red-500/20 text-red-400", completed: "bg-green-600/20 text-green-300",
  cancelled: "bg-red-600/20 text-red-300",
};

export default function CompanyDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [profile, setProfile] = useState<{ role: string; department: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [form, setForm] = useState({
    company_name: "", trading_name: "", nzbn: "", region: "", email: "", phone: "", address: "",
    key_person_name: "", key_person_last_name: "", key_person_gender: "",
    key_person_passport_no: "", key_person_dob: "", key_person_visa_status: "", key_person_role: "",
    accreditation_status: "none", accreditation_expiry: "",
    job_title: "", job_check_expiry: "",
    notes: "", department: "", assigned_sales_id: "",
  });
  const [initialForm, setInitialForm] = useState("");
  const [deals, setDeals] = useState<CompanyDeal[]>([]);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  const fetchAttachments = useCallback(async () => {
    const res = await fetch(`/api/attachments?type=companies&id=${id}`);
    const json = await res.json().catch(() => ({ files: [] }));
    if (json.files) setAttachments(json.files);
  }, [id]);

  const fetchLogs = useCallback(async () => {
    const { data } = await supabase.from("activity_logs")
      .select("id, action, details, created_at, user_id").eq("entity_id", id).order("created_at", { ascending: false });
    if (data) {
      setActivityLogs(data as unknown as ActivityLog[]);
      const uids = [...new Set((data as { user_id: string }[]).map(l => l.user_id))];
      if (uids.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", uids);
        const map: Record<string, string> = {};
        for (const p of profs ?? []) map[(p as { id: string; full_name: string }).id] = (p as { id: string; full_name: string }).full_name ?? "Unknown";
        setUserNames(map);
      }
    }
  }, [id]);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/admin"); return; }

      const { data: profileData } = await supabase.from("profiles").select("role, department").eq("id", session.user.id).single();
      if (profileData) setProfile(profileData);

      const { data: companyData } = await supabase.from("companies").select("*").eq("id", id).single();
      if (!companyData) { router.push("/companies"); return; }

      const lf = {
        company_name: companyData.company_name ?? "",
        trading_name: companyData.trading_name ?? "",
        nzbn: companyData.nzbn ?? "",
        region: companyData.region ?? "",
        email: companyData.email ?? "",
        phone: companyData.phone ?? "",
        address: companyData.address ?? "",
        key_person_name: companyData.key_person_name ?? "",
        key_person_last_name: companyData.key_person_last_name ?? "",
        key_person_gender: companyData.key_person_gender ?? "",
        key_person_passport_no: companyData.key_person_passport_no ?? "",
        key_person_dob: companyData.key_person_dob ?? "",
        key_person_visa_status: companyData.key_person_visa_status ?? "",
        key_person_role: companyData.key_person_role ?? "",
        accreditation_status: companyData.accreditation_status ?? "none",
        accreditation_expiry: companyData.accreditation_expiry ?? "",
        job_title: companyData.job_title ?? "",
        job_check_expiry: companyData.job_check_expiry ?? "",
        notes: companyData.notes ?? "",
        department: companyData.department ?? "",
        assigned_sales_id: companyData.assigned_sales_id ?? "",
      };
      setForm(lf);
      setInitialForm(JSON.stringify(lf));

      const { data: dealsData } = await supabase.from("deals")
        .select("id, deal_number, deal_type, status, total_amount, created_at").eq("company_id", id).order("created_at", { ascending: false });
      if (dealsData) setDeals(dealsData as CompanyDeal[]);

      await fetchAttachments();
      await fetchLogs();
      setIsLoading(false);
    }
    init();
  }, [id, router, fetchAttachments, fetchLogs]);

  const hasUnsavedChanges = JSON.stringify(form) !== initialForm;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const isAdmin = profile?.role === "admin";
  const isSales = profile?.role === "sales";

  const handleSave = async () => {
    if (!form.company_name.trim()) { setMessage({ type: "error", text: "Company name is required." }); return; }
    setIsSaving(true); setMessage(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

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
      department: form.department || null,
      assigned_sales_id: form.assigned_sales_id || null,
    };

    const { error } = await supabase.from("companies").update(payload).eq("id", id);
    if (error) { setMessage({ type: "error", text: error.message }); }
    else {
      setInitialForm(JSON.stringify(form));
      setMessage({ type: "success", text: "Company saved." });
      await logActivity(supabase, session.user.id, "updated_company", "companies", id, { company_name: form.company_name });
      await fetchLogs();
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete company "${form.company_name}"?`)) return;
    setIsDeleting(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { error } = await supabase.from("companies").delete().eq("id", id);
    if (error) { setMessage({ type: "error", text: error.message }); setIsDeleting(false); return; }
    await logActivity(supabase, session.user.id, "deleted_company", "companies", id, { company_name: form.company_name });
    router.push("/companies");
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const fd = new FormData();
    fd.append("file", file); fd.append("type", "companies"); fd.append("id", id);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (res.ok) await fetchAttachments();
    setIsUploading(false);
    e.target.value = "";
  };

  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-blue-950"><p className="text-white/60">Loading...</p></div>;

  const inputClass = "w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none";
  const selectClass = "w-full rounded-lg border border-white/20 bg-blue-900 px-4 py-2.5 text-white focus:border-blue-400 focus:outline-none";
  const labelClass = "block text-sm font-medium text-white/70 mb-1";
  const sectionClass = "rounded-xl border border-white/10 bg-white/5 p-6 mb-6";

  return (
    <div className="min-h-screen bg-blue-950 text-white">
      <Navbar hasUnsavedChanges={hasUnsavedChanges} />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">

        {/* Header */}
        <div className="flex flex-col gap-4 mb-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href="/companies" className="text-sm text-white/50 hover:text-white/80 mb-2 inline-block">← Companies</Link>
            <h2 className="text-2xl font-bold sm:text-3xl">{form.company_name}</h2>
            {form.department && <span className="mt-2 inline-block rounded-full bg-blue-500/20 px-3 py-0.5 text-xs font-bold text-blue-400">{DEPT_LABELS[form.department] ?? form.department}</span>}
          </div>
          {isAdmin && (
            <button onClick={handleDelete} disabled={isDeleting} className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-400 hover:bg-red-500/20 disabled:opacity-50">
              {isDeleting ? "Deleting..." : "Delete Company"}
            </button>
          )}
        </div>

        {message && (
          <div className={`mb-6 rounded-lg px-4 py-3 ${message.type === "error" ? "bg-red-500/20 text-red-300 border border-red-500/30" : "bg-green-500/20 text-green-300 border border-green-500/30"}`}>
            {message.text}
          </div>
        )}

        {/* Company Information */}
        <div className={sectionClass}>
          <h3 className="text-lg font-bold mb-4">Company Information</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className={labelClass}>Company Name *</label><input name="company_name" value={form.company_name} onChange={handleChange} className={inputClass} /></div>
            <div><label className={labelClass}>Trading Name</label><input name="trading_name" value={form.trading_name} onChange={handleChange} className={inputClass} /></div>
            <div><label className={labelClass}>NZBN</label><input name="nzbn" value={form.nzbn} onChange={handleChange} className={inputClass} /></div>
            <div><label className={labelClass}>Region</label><input name="region" value={form.region} onChange={handleChange} className={inputClass} /></div>
            <div><label className={labelClass}>Email</label><input name="email" value={form.email} onChange={handleChange} type="email" className={inputClass} /></div>
            <div><label className={labelClass}>Phone</label><input name="phone" value={form.phone} onChange={handleChange} className={inputClass} /></div>
            <div className="sm:col-span-2"><label className={labelClass}>Address</label><input name="address" value={form.address} onChange={handleChange} className={inputClass} /></div>
            {!isSales && (
              <div>
                <label className={labelClass}>Department</label>
                <select name="department" value={form.department} onChange={handleChange} className={selectClass}>
                  <option value="" className="bg-blue-900">Select...</option>
                  <option value="china" className="bg-blue-900">China</option>
                  <option value="thailand" className="bg-blue-900">Thailand</option>
                  <option value="myanmar" className="bg-blue-900">Myanmar</option>
                  <option value="korea_japan" className="bg-blue-900">Korea & Japan</option>
                </select>
              </div>
            )}
            <div className="sm:col-span-2"><label className={labelClass}>Notes</label><textarea name="notes" value={form.notes} onChange={handleChange} rows={3} className={`${inputClass} resize-none`} /></div>
          </div>
          <div className="mt-4 flex gap-3">
            <button onClick={handleSave} disabled={isSaving || !hasUnsavedChanges} className="rounded-lg bg-blue-600 px-6 py-2.5 font-bold text-white hover:bg-blue-700 disabled:opacity-50">
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        {/* Key Person Information */}
        <div className={sectionClass}>
          <h3 className="text-lg font-bold mb-4">Key Person Information</h3>
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
          <div className="mt-4 flex gap-3">
            <button onClick={handleSave} disabled={isSaving || !hasUnsavedChanges} className="rounded-lg bg-blue-600 px-6 py-2.5 font-bold text-white hover:bg-blue-700 disabled:opacity-50">
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        {/* Accreditation & Job Check */}
        <div className={sectionClass}>
          <h3 className="text-lg font-bold mb-4">Accreditation & Job Check Information</h3>
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
            <div><label className={labelClass}>Job Title</label><input name="job_title" value={form.job_title} onChange={handleChange} className={inputClass} /></div>
            <div><label className={labelClass}>Job Check Expiry</label><input name="job_check_expiry" value={form.job_check_expiry} onChange={handleChange} type="date" className={inputClass} /></div>
          </div>
          <div className="mt-4 flex gap-3">
            <button onClick={handleSave} disabled={isSaving || !hasUnsavedChanges} className="rounded-lg bg-blue-600 px-6 py-2.5 font-bold text-white hover:bg-blue-700 disabled:opacity-50">
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        {/* Deals */}
        <div className={sectionClass}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Deals ({deals.length})</h3>
            <Link href={`/deals/new?company_id=${id}`} className="rounded-lg border border-white/20 px-3 py-1.5 text-sm font-bold hover:bg-white/10">+ New Deal</Link>
          </div>
          {deals.length === 0 ? (
            <p className="text-white/50 text-sm">No deals yet.</p>
          ) : (
            <div className="space-y-2">
              {deals.map(d => (
                <Link key={d.id} href={`/deals/${d.id}`} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 hover:bg-white/10">
                  <div>
                    <span className="font-medium text-blue-400">{d.deal_number ?? "—"}</span>
                    <span className="ml-3 text-sm text-white/70">{d.deal_type?.replace(/_/g, " ") ?? ""}</span>
                    <span className="ml-3 text-xs text-white/40">{new Date(d.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {d.total_amount != null && <span className="text-sm text-white/70">${d.total_amount.toLocaleString()}</span>}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${DEAL_STATUS_COLORS[d.status] ?? "bg-gray-500/20 text-gray-400"}`}>{d.status}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Attachments */}
        <div className={sectionClass}>
          <h3 className="text-lg font-bold mb-4">Attachments</h3>
          <div className="mb-3">
            <label className="cursor-pointer rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20">
              {isUploading ? "Uploading..." : "Upload File"}
              <input type="file" className="hidden" onChange={handleUpload} disabled={isUploading} />
            </label>
          </div>
          {attachments.length === 0 ? <p className="text-white/50 text-sm">No attachments.</p> : (
            <ul className="space-y-2">
              {attachments.map(f => (
                <li key={f.name} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-2">
                  <span className="text-sm text-white/90 truncate mr-4">{f.name.replace(/^\d+-/, "")}</span>
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline whitespace-nowrap">View</a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Activity Timeline */}
        <div className={sectionClass}>
          <h3 className="text-lg font-bold mb-4">Activity Timeline</h3>
          {activityLogs.length === 0 ? <p className="text-white/50 text-sm">No activity yet.</p> : (
            <ul className="space-y-3">
              {activityLogs.map(log => (
                <li key={log.id} className="flex gap-3 text-sm">
                  <span className="text-white/40 whitespace-nowrap">{new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="text-white/60">{userNames[log.user_id] ?? "Unknown"}</span>
                  <span className="text-white/90">{log.action.replace(/_/g, " ")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
