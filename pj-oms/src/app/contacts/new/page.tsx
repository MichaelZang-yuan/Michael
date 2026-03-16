"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { hasRole } from "@/lib/roles";
import Navbar from "@/components/Navbar";
import { logActivity } from "@/lib/activityLog";

type Agent = { id: string; agent_name: string };
type PendingFile = { file: File; category: "passport" | "visa" | "other" };

const DEPT_LABELS: Record<string, string> = {
  china: "China",
  thailand: "Thailand",
  myanmar: "Myanmar",
  korea_japan: "Korea & Japan",
};

export default function NewContactPage() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isSales, setIsSales] = useState(false);
  const [userDept, setUserDept] = useState("");

  // Passport extraction
  const [isExtractingPassport, setIsExtractingPassport] = useState(false);
  const [passportExtraction, setPassportExtraction] = useState<{
    full_name: string | null; passport_number: string | null; nationality: string | null;
    date_of_birth: string | null; expiry_date: string | null; gender: string | null;
  } | null>(null);
  const [showPassportConfirm, setShowPassportConfirm] = useState(false);

  // Visa extraction
  const [isExtractingVisa, setIsExtractingVisa] = useState(false);
  const [visaExtraction, setVisaExtraction] = useState<{
    visa_type: string | null; visa_expiry_date: string | null; visa_conditions: string | null;
    visa_number: string | null; entry_permission: string | null;
  } | null>(null);
  const [showVisaConfirm, setShowVisaConfirm] = useState(false);

  // Pending files (saved after contact creation)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const otherFileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    // Basic
    first_name: "", last_name: "", gender: "", email: "", secondary_email: "",
    mobile: "", message_app: "", nationality: "", date_of_birth: "",
    preferred_language: "English",
    // Service
    type: "lead", service_required: "", on_offshore: "", lead_source: "",
    source_name: "", agent_id: "",
    // Personal
    address: "", marital_status: "", employer: "", school: "",
    currency: "NZD", client_number: "", description: "",
    // Visa
    current_visa_type: "", visa_expiry_date: "", travel_expiry_date: "",
    passport_number: "", passport_expiry_date: "", student_insurance_expiry_date: "",
    // OneDrive
    onedrive_folder_id: "", onedrive_folder_link: "",
    // Dept
    department: "",
  });

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/admin"); return; }

      const { data: profileData } = await supabase.from("profiles").select("role, roles, department").eq("id", session.user.id).single();
      const salesRole = hasRole(profileData, "sales");
      setIsSales(salesRole);
      if (profileData?.department) {
        setUserDept(profileData.department);
        if (salesRole) setForm(f => ({ ...f, department: profileData.department }));
      }

      const { data: agentsData } = await supabase.from("agents").select("id, agent_name").order("agent_name");
      if (agentsData) setAgents(agentsData as Agent[]);
    }
    init();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  // ── Helpers ──
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.readAsDataURL(file);
    });
  };

  // ── Passport extraction ──
  const handlePassportExtract = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsExtractingPassport(true);
    try {
      const base64Data = await readFileAsBase64(file);
      const isPdf = file.type === "application/pdf";
      const res = await fetch("/api/extract-passport", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base64Data,
          fileType: isPdf ? "pdf" : "image",
          mediaType: file.type || (isPdf ? "application/pdf" : "image/jpeg"),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage({ type: "error", text: data.error ?? "Passport extraction failed" }); return; }
      setPassportExtraction(data);
      setShowPassportConfirm(true);
      // Stage file for upload after contact creation
      setPendingFiles(pf => [...pf.filter(f => f.category !== "passport"), { file, category: "passport" }]);
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Passport extraction failed" });
    } finally {
      setIsExtractingPassport(false);
      e.target.value = "";
    }
  };

  const handleApplyPassportData = () => {
    if (!passportExtraction) return;
    setForm(f => {
      const updates: Partial<typeof f> = {};
      if (passportExtraction.passport_number) updates.passport_number = passportExtraction.passport_number;
      if (passportExtraction.date_of_birth) updates.date_of_birth = passportExtraction.date_of_birth;
      if (passportExtraction.nationality) updates.nationality = passportExtraction.nationality;
      if (passportExtraction.expiry_date) updates.passport_expiry_date = passportExtraction.expiry_date;
      if (passportExtraction.gender) updates.gender = passportExtraction.gender;
      if (passportExtraction.full_name) {
        const parts = passportExtraction.full_name.trim().split(/\s+/);
        if (parts.length >= 2) {
          updates.last_name = parts[0];
          updates.first_name = parts.slice(1).join(" ");
        } else {
          updates.first_name = passportExtraction.full_name;
        }
      }
      return { ...f, ...updates };
    });
    setShowPassportConfirm(false);
    setPassportExtraction(null);
    setMessage({ type: "success", text: "Passport data applied to form." });
  };

  // ── Visa extraction ──
  const handleVisaExtract = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsExtractingVisa(true);
    try {
      const base64Data = await readFileAsBase64(file);
      const isPdf = file.type === "application/pdf";
      const res = await fetch("/api/extract-visa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base64Data,
          fileType: isPdf ? "pdf" : "image",
          mediaType: file.type || (isPdf ? "application/pdf" : "image/jpeg"),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage({ type: "error", text: data.error ?? "Visa extraction failed" }); return; }
      setVisaExtraction(data);
      setShowVisaConfirm(true);
      // Stage file for upload after contact creation
      setPendingFiles(pf => [...pf.filter(f => f.category !== "visa"), { file, category: "visa" }]);
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Visa extraction failed" });
    } finally {
      setIsExtractingVisa(false);
      e.target.value = "";
    }
  };

  const handleApplyVisaData = () => {
    if (!visaExtraction) return;
    setForm(f => {
      const updates: Partial<typeof f> = {};
      if (visaExtraction.visa_type) updates.current_visa_type = visaExtraction.visa_type;
      if (visaExtraction.visa_expiry_date) updates.visa_expiry_date = visaExtraction.visa_expiry_date;
      return { ...f, ...updates };
    });
    setShowVisaConfirm(false);
    setVisaExtraction(null);
    setMessage({ type: "success", text: "Visa data applied to form." });
  };

  // ── Other files ──
  const handleOtherFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newFiles: PendingFile[] = Array.from(files).map(f => ({ file: f, category: "other" as const }));
    setPendingFiles(pf => [...pf, ...newFiles]);
    setMessage({ type: "success", text: `${files.length} file(s) queued. They will be uploaded when you save.` });
    e.target.value = "";
  };

  const removePendingFile = (idx: number) => {
    setPendingFiles(pf => pf.filter((_, i) => i !== idx));
  };

  // ── Upload pending files to storage ──
  const uploadPendingFiles = async (contactId: string) => {
    for (const pf of pendingFiles) {
      const fd = new FormData();
      fd.append("file", pf.file);
      fd.append("type", "contacts");
      fd.append("id", contactId);
      await fetch("/api/upload", { method: "POST", body: fd }).catch(() => {});
    }
  };

  // ── Submit ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setMessage({ type: "error", text: "First Name and Last Name are required." });
      return;
    }
    if (!form.department) {
      setMessage({ type: "error", text: "Department is required." });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push("/admin"); return; }

    const payload: Record<string, unknown> = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      gender: form.gender || null,
      email: form.email.trim() || null,
      secondary_email: form.secondary_email.trim() || null,
      mobile: form.mobile.trim() || null,
      message_app: form.message_app.trim() || null,
      nationality: form.nationality.trim() || null,
      date_of_birth: form.date_of_birth || null,
      preferred_language: form.preferred_language || "English",
      type: form.type || "lead",
      service_required: form.service_required.trim() || null,
      on_offshore: form.on_offshore || null,
      lead_source: form.lead_source || null,
      source_name: form.source_name.trim() || null,
      agent_id: form.agent_id || null,
      address: form.address.trim() || null,
      marital_status: form.marital_status || null,
      employer: form.employer.trim() || null,
      school: form.school.trim() || null,
      currency: form.currency || "NZD",
      client_number: form.client_number.trim() || null,
      description: form.description.trim() || null,
      current_visa_type: form.current_visa_type || null,
      visa_expiry_date: form.visa_expiry_date || null,
      travel_expiry_date: form.travel_expiry_date || null,
      passport_number: form.passport_number.trim() || null,
      passport_expiry_date: form.passport_expiry_date || null,
      student_insurance_expiry_date: form.student_insurance_expiry_date || null,
      onedrive_folder_id: form.onedrive_folder_id.trim() || null,
      onedrive_folder_link: form.onedrive_folder_link.trim() || null,
      department: form.department,
      assigned_sales_id: session.user.id,
      created_by: session.user.id,
    };

    const { data, error } = await supabase.from("contacts").insert(payload).select().single();

    if (error) {
      setMessage({ type: "error", text: error.message });
      setIsSaving(false);
      return;
    }

    // Upload pending files
    if (pendingFiles.length > 0) {
      await uploadPendingFiles(data.id);
    }

    await logActivity(supabase, session.user.id, "created_contact", "contacts", data.id, {
      name: `${form.first_name} ${form.last_name}`,
    });
    router.push(`/contacts/${data.id}`);
  };

  const inputClass = "w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none";
  const selectClass = "w-full rounded-lg border border-white/20 bg-blue-900 px-4 py-2.5 text-white focus:border-blue-400 focus:outline-none";
  const labelClass = "block text-sm font-medium text-white/70 mb-1";
  const sectionClass = "rounded-xl border border-white/10 bg-white/5 p-6 mb-6";
  const sectionTitle = "text-base font-bold mb-4 text-white/90";

  return (
    <div className="min-h-screen bg-blue-950 text-white">
      <Navbar hasUnsavedChanges />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="mb-8">
          <Link href="/contacts" className="text-sm text-white/50 hover:text-white/80 mb-2 inline-block">&larr; Contacts</Link>
          <h2 className="text-2xl font-bold sm:text-3xl">Add Contact</h2>
        </div>

        {message && (
          <div className={`mb-6 rounded-lg px-4 py-3 ${message.type === "error" ? "bg-red-500/20 text-red-300 border border-red-500/30" : "bg-green-500/20 text-green-300 border border-green-500/30"}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-0">

          {/* ── Quick Import from Documents ── */}
          <div className={`${sectionClass} border-dashed border-blue-400/40`}>
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <h3 className="text-base font-bold text-white/90">Quick Import from Documents</h3>
            </div>
            <div className="flex flex-wrap gap-3 mb-3">
              {/* Upload Passport */}
              <label className={`cursor-pointer inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition ${isExtractingPassport ? "opacity-50 pointer-events-none" : ""}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" /></svg>
                {isExtractingPassport ? "Extracting..." : "Upload Passport"}
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={handlePassportExtract} disabled={isExtractingPassport} />
              </label>
              {/* Upload Visa */}
              <label className={`cursor-pointer inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition ${isExtractingVisa ? "opacity-50 pointer-events-none" : ""}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                {isExtractingVisa ? "Extracting..." : "Upload Visa"}
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleVisaExtract} disabled={isExtractingVisa} />
              </label>
              {/* Upload Other */}
              <button type="button" onClick={() => otherFileRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2.5 text-sm font-bold text-white/70 hover:bg-white/10 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                Upload Other
              </button>
              <input ref={otherFileRef} type="file" multiple className="hidden" onChange={handleOtherFiles} />
            </div>
            <p className="text-xs text-white/40">Upload passport or visa to auto-extract information. All files will be saved as attachments.</p>

            {/* Pending files list */}
            {pendingFiles.length > 0 && (
              <div className="mt-3 space-y-1">
                {pendingFiles.map((pf, idx) => (
                  <div key={idx} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-sm">
                    <span className={`text-xs font-bold uppercase px-1.5 py-0.5 rounded ${
                      pf.category === "passport" ? "bg-blue-500/20 text-blue-400" :
                      pf.category === "visa" ? "bg-emerald-500/20 text-emerald-400" :
                      "bg-gray-500/20 text-gray-400"
                    }`}>{pf.category}</span>
                    <span className="text-white/70 truncate flex-1">{pf.file.name}</span>
                    <button type="button" onClick={() => removePendingFile(idx)} className="text-white/30 hover:text-red-400 text-xs">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Basic Information */}
          <div className={sectionClass}>
            <h3 className={sectionTitle}>Basic Information</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>First Name *</label>
                <input name="first_name" value={form.first_name} onChange={handleChange} required className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Last Name *</label>
                <input name="last_name" value={form.last_name} onChange={handleChange} required className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Gender</label>
                <select name="gender" value={form.gender} onChange={handleChange} className={selectClass}>
                  <option value="" className="bg-blue-900">Select...</option>
                  <option value="male" className="bg-blue-900">Male</option>
                  <option value="female" className="bg-blue-900">Female</option>
                  <option value="other" className="bg-blue-900">Other</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Date of Birth</label>
                <input name="date_of_birth" value={form.date_of_birth} onChange={handleChange} type="date" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input name="email" value={form.email} onChange={handleChange} type="email" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Secondary Email</label>
                <input name="secondary_email" value={form.secondary_email} onChange={handleChange} type="email" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Mobile</label>
                <input name="mobile" value={form.mobile} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Message App (WeChat/WhatsApp/Line)</label>
                <input name="message_app" value={form.message_app} onChange={handleChange} placeholder="e.g. WeChat: username" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Nationality</label>
                <input name="nationality" value={form.nationality} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Preferred Language</label>
                <input name="preferred_language" value={form.preferred_language} onChange={handleChange} className={inputClass} />
              </div>
            </div>
          </div>

          {/* Service Information */}
          <div className={sectionClass}>
            <h3 className={sectionTitle}>Service Information</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Type</label>
                <select name="type" value={form.type} onChange={handleChange} className={selectClass}>
                  <option value="lead" className="bg-blue-900">Lead</option>
                  <option value="client" className="bg-blue-900">Client</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>On/Offshore</label>
                <select name="on_offshore" value={form.on_offshore} onChange={handleChange} className={selectClass}>
                  <option value="" className="bg-blue-900">Select...</option>
                  <option value="onshore" className="bg-blue-900">Onshore</option>
                  <option value="offshore" className="bg-blue-900">Offshore</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Service Required</label>
                <input name="service_required" value={form.service_required} onChange={handleChange} placeholder="e.g. Student Visa, Work Visa" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Lead Source</label>
                <select name="lead_source" value={form.lead_source} onChange={handleChange} className={selectClass}>
                  <option value="" className="bg-blue-900">Select...</option>
                  <option value="referral" className="bg-blue-900">Referral</option>
                  <option value="walk-in" className="bg-blue-900">Walk-In</option>
                  <option value="online" className="bg-blue-900">Online</option>
                  <option value="social_media" className="bg-blue-900">Social Media</option>
                  <option value="agent" className="bg-blue-900">Agent</option>
                  <option value="other" className="bg-blue-900">Other</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Source Name</label>
                <input name="source_name" value={form.source_name} onChange={handleChange} placeholder="Who referred them?" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Agent</label>
                <select name="agent_id" value={form.agent_id} onChange={handleChange} className={selectClass}>
                  <option value="" className="bg-blue-900">No Agent</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id} className="bg-blue-900">{a.agent_name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Personal Details */}
          <div className={sectionClass}>
            <h3 className={sectionTitle}>Personal Details</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass}>Address</label>
                <input name="address" value={form.address} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Marital Status</label>
                <select name="marital_status" value={form.marital_status} onChange={handleChange} className={selectClass}>
                  <option value="" className="bg-blue-900">Select...</option>
                  <option value="single" className="bg-blue-900">Single</option>
                  <option value="married" className="bg-blue-900">Married</option>
                  <option value="partnered" className="bg-blue-900">Partnered</option>
                  <option value="divorced" className="bg-blue-900">Divorced</option>
                  <option value="widowed" className="bg-blue-900">Widowed</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Employer</label>
                <input name="employer" value={form.employer} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>School</label>
                <input name="school" value={form.school} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Currency</label>
                <input name="currency" value={form.currency} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Client Number</label>
                <input name="client_number" value={form.client_number} onChange={handleChange} className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Description / Notes</label>
                <textarea name="description" value={form.description} onChange={handleChange} rows={3} className={`${inputClass} resize-none`} />
              </div>
            </div>
          </div>

          {/* Visa & Passport */}
          <div className={sectionClass}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white/90">Visa & Passport</h3>
              <div className="flex gap-2">
                <label className={`cursor-pointer rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 ${isExtractingPassport ? "opacity-50 pointer-events-none" : ""}`}>
                  {isExtractingPassport ? "Extracting..." : "Extract from Passport"}
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={handlePassportExtract} disabled={isExtractingPassport} />
                </label>
                <label className={`cursor-pointer rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 ${isExtractingVisa ? "opacity-50 pointer-events-none" : ""}`}>
                  {isExtractingVisa ? "Extracting..." : "Extract from Visa"}
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleVisaExtract} disabled={isExtractingVisa} />
                </label>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Current Visa Type</label>
                <select name="current_visa_type" value={form.current_visa_type} onChange={handleChange} className={selectClass}>
                  <option value="" className="bg-blue-900">Select...</option>
                  <option value="Student Visa" className="bg-blue-900">Student Visa</option>
                  <option value="Work Visa" className="bg-blue-900">Work Visa</option>
                  <option value="Visitor Visa" className="bg-blue-900">Visitor Visa</option>
                  <option value="Resident Visa" className="bg-blue-900">Resident Visa</option>
                  <option value="Partnership Visa" className="bg-blue-900">Partnership Visa</option>
                  <option value="Other" className="bg-blue-900">Other</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Visa Expiry Date</label>
                <input name="visa_expiry_date" value={form.visa_expiry_date} onChange={handleChange} type="date" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Travel Document Expiry</label>
                <input name="travel_expiry_date" value={form.travel_expiry_date} onChange={handleChange} type="date" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Passport Number</label>
                <input name="passport_number" value={form.passport_number} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Passport Expiry Date</label>
                <input name="passport_expiry_date" value={form.passport_expiry_date} onChange={handleChange} type="date" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Student Insurance Expiry</label>
                <input name="student_insurance_expiry_date" value={form.student_insurance_expiry_date} onChange={handleChange} type="date" className={inputClass} />
              </div>
            </div>
          </div>

          {/* OneDrive (Reserved) */}
          <div className={sectionClass}>
            <h3 className={sectionTitle}>OneDrive (Reserved)</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>OneDrive Folder ID</label>
                <input name="onedrive_folder_id" value={form.onedrive_folder_id} onChange={handleChange} placeholder="Reserved for future integration" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>OneDrive Folder Link</label>
                <input name="onedrive_folder_link" value={form.onedrive_folder_link} onChange={handleChange} placeholder="Reserved for future integration" className={inputClass} />
              </div>
            </div>
          </div>

          {/* Department */}
          <div className={sectionClass}>
            <h3 className={sectionTitle}>Department *</h3>
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
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={isSaving} className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50">
              {isSaving ? (pendingFiles.length > 0 ? "Saving & Uploading..." : "Saving...") : "Save Contact"}
            </button>
            <button type="button" onClick={() => router.push("/contacts")} className="rounded-lg border border-white/20 px-6 py-3 font-bold hover:bg-white/10">
              Cancel
            </button>
          </div>
        </form>

        {/* Passport Extraction Confirm Modal */}
        {showPassportConfirm && passportExtraction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-lg rounded-xl border border-white/10 bg-blue-900 p-6">
              <h4 className="text-lg font-bold mb-4">Passport Data Extracted</h4>
              <p className="text-sm text-white/60 mb-4">Review the extracted data below. Click Apply to fill the form fields.</p>
              <div className="space-y-2 mb-5">
                {([
                  ["Full Name", passportExtraction.full_name, `${form.first_name} ${form.last_name}`.trim()],
                  ["Passport Number", passportExtraction.passport_number, form.passport_number],
                  ["Nationality", passportExtraction.nationality, form.nationality],
                  ["Date of Birth", passportExtraction.date_of_birth, form.date_of_birth],
                  ["Passport Expiry", passportExtraction.expiry_date, form.passport_expiry_date],
                  ["Gender", passportExtraction.gender, form.gender],
                ] as [string, string | null, string][]).map(([label, extracted, current]) => (
                  <div key={label} className="grid grid-cols-3 gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm">
                    <span className="text-white/50">{label}</span>
                    <span className="text-green-400">{extracted ?? "\u2014"}</span>
                    <span className="text-white/40">{current || "\u2014"}</span>
                  </div>
                ))}
                <div className="grid grid-cols-3 gap-2 px-3 text-xs text-white/30">
                  <span>Field</span>
                  <span>Extracted</span>
                  <span>Current</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleApplyPassportData} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700">
                  Apply
                </button>
                <button onClick={() => { setShowPassportConfirm(false); setPassportExtraction(null); }} className="rounded-lg border border-white/20 px-5 py-2 text-sm font-bold hover:bg-white/10">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Visa Extraction Confirm Modal */}
        {showVisaConfirm && visaExtraction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-lg rounded-xl border border-white/10 bg-blue-900 p-6">
              <h4 className="text-lg font-bold mb-4">Visa Data Extracted</h4>
              <p className="text-sm text-white/60 mb-4">Review the extracted data below. Click Apply to fill the form fields.</p>
              <div className="space-y-2 mb-5">
                {([
                  ["Visa Type", visaExtraction.visa_type, form.current_visa_type],
                  ["Visa Expiry", visaExtraction.visa_expiry_date, form.visa_expiry_date],
                  ["Conditions", visaExtraction.visa_conditions, null],
                  ["Visa Number", visaExtraction.visa_number, null],
                  ["Entry Permission", visaExtraction.entry_permission, null],
                ] as [string, string | null, string | null][]).map(([label, extracted, current]) => (
                  <div key={label} className="grid grid-cols-3 gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm">
                    <span className="text-white/50">{label}</span>
                    <span className="text-green-400">{extracted ?? "\u2014"}</span>
                    <span className="text-white/40">{current || "\u2014"}</span>
                  </div>
                ))}
                <div className="grid grid-cols-3 gap-2 px-3 text-xs text-white/30">
                  <span>Field</span>
                  <span>Extracted</span>
                  <span>Current</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleApplyVisaData} className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700">
                  Apply
                </button>
                <button onClick={() => { setShowVisaConfirm(false); setVisaExtraction(null); }} className="rounded-lg border border-white/20 px-5 py-2 text-sm font-bold hover:bg-white/10">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
