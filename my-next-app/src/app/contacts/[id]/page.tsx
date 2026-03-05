"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import { logActivity } from "@/lib/activityLog";

type Agent = { id: string; agent_name: string };
type SalesUser = { id: string; full_name: string | null };
type AttachmentFile = { name: string; url: string; createdAt: string | null };
type ActivityLog = { id: string; action: string; details: Record<string, unknown> | null; created_at: string; user_id: string };

type MedicalPcc = {
  id: string;
  item: string | null;
  country: string | null;
  issue_date: string | null;
  expiry_date: string | null;
};

type FamilyLink = {
  id: string;
  related_contact_id: string;
  relationship: string | null;
  notes: string | null;
  related_contact: { first_name: string; last_name: string } | null;
};

type ContactDeal = {
  id: string;
  deal_number: string | null;
  deal_type: string | null;
  status: string;
  total_amount: number | null;
  created_at: string;
};

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

export default function ContactDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [profile, setProfile] = useState<{ role: string; department: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [form, setForm] = useState({
    first_name: "", last_name: "", gender: "", email: "", secondary_email: "",
    mobile: "", message_app: "", nationality: "", date_of_birth: "",
    preferred_language: "English", type: "lead", service_required: "", on_offshore: "",
    lead_source: "", source_name: "", agent_id: "", address: "", marital_status: "",
    employer: "", school: "", currency: "NZD", client_number: "", description: "",
    current_visa_type: "", visa_expiry_date: "", travel_expiry_date: "",
    passport_number: "", passport_expiry_date: "", student_insurance_expiry_date: "",
    onedrive_folder_id: "", onedrive_folder_link: "",
    department: "", assigned_sales_id: "",
  });
  const [initialForm, setInitialForm] = useState("");

  // Medical & PCC
  const [medicalRows, setMedicalRows] = useState<MedicalPcc[]>([]);
  const [newMedical, setNewMedical] = useState({ item: "medical", country: "", issue_date: "", expiry_date: "" });
  const [showMedicalForm, setShowMedicalForm] = useState(false);

  // Family Links
  const [familyLinks, setFamilyLinks] = useState<FamilyLink[]>([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [familySearch, setFamilySearch] = useState("");
  const [familySearchResults, setFamilySearchResults] = useState<{ id: string; first_name: string; last_name: string }[]>([]);
  const [linkForm, setLinkForm] = useState({ related_contact_id: "", relationship: "spouse", notes: "" });

  // Deals
  const [deals, setDeals] = useState<ContactDeal[]>([]);

  // Attachments & Logs
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  const fetchAttachments = useCallback(async () => {
    const res = await fetch(`/api/attachments?type=contacts&id=${id}`);
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

  const fetchFamilyLinks = useCallback(async () => {
    const { data } = await supabase
      .from("contact_family_links")
      .select("id, related_contact_id, relationship, notes, related_contact:contacts!contact_family_links_related_contact_id_fkey(first_name, last_name)")
      .eq("contact_id", id);
    if (data) setFamilyLinks(data as unknown as FamilyLink[]);
  }, [id]);

  const fetchMedical = useCallback(async () => {
    const { data } = await supabase.from("contact_medical_pcc").select("*").eq("contact_id", id).order("created_at" as string, { ascending: false });
    if (data) setMedicalRows(data as MedicalPcc[]);
  }, [id]);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/admin"); return; }

      const { data: profileData } = await supabase.from("profiles").select("role, department").eq("id", session.user.id).single();
      if (profileData) setProfile(profileData);

      const { data: agentsData } = await supabase.from("agents").select("id, agent_name").order("agent_name");
      if (agentsData) setAgents(agentsData as Agent[]);

      const { data: salesData } = await supabase.from("profiles").select("id, full_name").in("role", ["admin", "sales"]).order("full_name");
      if (salesData) setSalesUsers(salesData as SalesUser[]);

      const { data: contactData } = await supabase.from("contacts").select("*").eq("id", id).single();
      if (!contactData) { router.push("/contacts"); return; }

      const lf = {
        first_name: contactData.first_name ?? "",
        last_name: contactData.last_name ?? "",
        gender: contactData.gender ?? "",
        email: contactData.email ?? "",
        secondary_email: contactData.secondary_email ?? "",
        mobile: contactData.mobile ?? "",
        message_app: contactData.message_app ?? "",
        nationality: contactData.nationality ?? "",
        date_of_birth: contactData.date_of_birth ?? "",
        preferred_language: contactData.preferred_language ?? "English",
        type: contactData.type ?? "lead",
        service_required: contactData.service_required ?? "",
        on_offshore: contactData.on_offshore ?? "",
        lead_source: contactData.lead_source ?? "",
        source_name: contactData.source_name ?? "",
        agent_id: contactData.agent_id ?? "",
        address: contactData.address ?? "",
        marital_status: contactData.marital_status ?? "",
        employer: contactData.employer ?? "",
        school: contactData.school ?? "",
        currency: contactData.currency ?? "NZD",
        client_number: contactData.client_number ?? "",
        description: contactData.description ?? "",
        current_visa_type: contactData.current_visa_type ?? "",
        visa_expiry_date: contactData.visa_expiry_date ?? "",
        travel_expiry_date: contactData.travel_expiry_date ?? "",
        passport_number: contactData.passport_number ?? "",
        passport_expiry_date: contactData.passport_expiry_date ?? "",
        student_insurance_expiry_date: contactData.student_insurance_expiry_date ?? "",
        onedrive_folder_id: contactData.onedrive_folder_id ?? "",
        onedrive_folder_link: contactData.onedrive_folder_link ?? "",
        department: contactData.department ?? "",
        assigned_sales_id: contactData.assigned_sales_id ?? "",
      };
      setForm(lf);
      setInitialForm(JSON.stringify(lf));

      // Direct deals (contact_id = id)
      const { data: directDeals } = await supabase
        .from("deals")
        .select("id, deal_number, deal_type, status, total_amount, created_at")
        .eq("contact_id", id);

      // Deals via deal_applicants
      const { data: appData } = await supabase
        .from("deal_applicants")
        .select("deals(id, deal_number, deal_type, status, total_amount, created_at)")
        .eq("contact_id", id);

      // Merge + deduplicate by id
      const merged: ContactDeal[] = [...((directDeals ?? []) as ContactDeal[])];
      const seen = new Set(merged.map(d => d.id));
      for (const app of appData ?? []) {
        const d = (app as unknown as { deals: ContactDeal }).deals;
        if (d && !seen.has(d.id)) { merged.push(d); seen.add(d.id); }
      }
      setDeals(merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));

      await fetchAttachments();
      await fetchLogs();
      await fetchFamilyLinks();
      await fetchMedical();
      setIsLoading(false);
    }
    init();
  }, [id, router, fetchAttachments, fetchLogs, fetchFamilyLinks, fetchMedical]);

  const hasUnsavedChanges = JSON.stringify(form) !== initialForm;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const isAdmin = profile?.role === "admin";
  const isSales = profile?.role === "sales";

  const handleSave = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) { setMessage({ type: "error", text: "First and last name are required." }); return; }
    setIsSaving(true); setMessage(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const payload: Record<string, unknown> = { ...form };
    // Convert empty strings to null for optional fields
    for (const k of Object.keys(payload)) {
      if (k !== "first_name" && k !== "last_name" && payload[k] === "") payload[k] = null;
    }

    const { error } = await supabase.from("contacts").update(payload).eq("id", id);
    if (error) { setMessage({ type: "error", text: error.message }); }
    else {
      setInitialForm(JSON.stringify(form));
      setMessage({ type: "success", text: "Contact saved." });
      await logActivity(supabase, session.user.id, "updated_contact", "contacts", id, { name: `${form.first_name} ${form.last_name}` });
      await fetchLogs();
    }
    setIsSaving(false);
  };

  const handleConvertToClient = async () => {
    if (form.type === "client") return;
    if (!window.confirm("Convert this lead to a client?")) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { error } = await supabase.from("contacts").update({ type: "client" }).eq("id", id);
    if (!error) {
      setForm(f => ({ ...f, type: "client" }));
      setInitialForm(prev => JSON.stringify({ ...JSON.parse(prev), type: "client" }));
      setMessage({ type: "success", text: "Contact converted to Client." });
      await logActivity(supabase, session.user.id, "lead_to_client", "contacts", id, { name: `${form.first_name} ${form.last_name}` });
      await fetchLogs();
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete contact "${form.first_name} ${form.last_name}"? This cannot be undone.`)) return;
    setIsDeleting(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { error } = await supabase.from("contacts").delete().eq("id", id);
    if (error) { setMessage({ type: "error", text: error.message }); setIsDeleting(false); return; }
    await logActivity(supabase, session.user.id, "deleted_contact", "contacts", id, { name: `${form.first_name} ${form.last_name}` });
    router.push("/contacts");
  };

  // Medical & PCC
  const handleAddMedical = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { error } = await supabase.from("contact_medical_pcc").insert({
      contact_id: id,
      item: newMedical.item || null,
      country: newMedical.country.trim() || null,
      issue_date: newMedical.issue_date || null,
      expiry_date: newMedical.expiry_date || null,
    });
    if (!error) {
      setNewMedical({ item: "medical", country: "", issue_date: "", expiry_date: "" });
      setShowMedicalForm(false);
      await fetchMedical();
      await logActivity(supabase, session.user.id, "added_medical_pcc", "contacts", id, { item: newMedical.item });
      await fetchLogs();
    }
  };

  const handleDeleteMedical = async (rowId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from("contact_medical_pcc").delete().eq("id", rowId);
    await fetchMedical();
    await logActivity(supabase, session.user.id, "removed_medical_pcc", "contacts", id, {});
    await fetchLogs();
  };

  // Family Links
  const handleFamilySearch = async (q: string) => {
    setFamilySearch(q);
    if (!q.trim() || q.length < 2) { setFamilySearchResults([]); return; }
    const { data } = await supabase.from("contacts")
      .select("id, first_name, last_name")
      .neq("id", id)
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
      .limit(10);
    if (data) setFamilySearchResults(data as { id: string; first_name: string; last_name: string }[]);
  };

  const handleAddFamilyLink = async () => {
    if (!linkForm.related_contact_id) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { error } = await supabase.from("contact_family_links").insert({
      contact_id: id,
      related_contact_id: linkForm.related_contact_id,
      relationship: linkForm.relationship || null,
      notes: linkForm.notes.trim() || null,
    });
    if (!error) {
      setShowLinkModal(false);
      setFamilySearch("");
      setFamilySearchResults([]);
      setLinkForm({ related_contact_id: "", relationship: "spouse", notes: "" });
      await fetchFamilyLinks();
      await logActivity(supabase, session.user.id, "added_family_link", "contacts", id, { relationship: linkForm.relationship });
      await fetchLogs();
    }
  };

  const handleDeleteFamilyLink = async (linkId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from("contact_family_links").delete().eq("id", linkId);
    await fetchFamilyLinks();
    await logActivity(supabase, session.user.id, "removed_family_link", "contacts", id, {});
    await fetchLogs();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const fd = new FormData();
    fd.append("file", file); fd.append("type", "contacts"); fd.append("id", id);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (res.ok) await fetchAttachments();
    setIsUploading(false);
    e.target.value = "";
  };

  if (isLoading) return (
    <div className="flex min-h-screen items-center justify-center bg-blue-950"><p className="text-white/60">Loading...</p></div>
  );

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
            <Link href="/contacts" className="text-sm text-white/50 hover:text-white/80 mb-2 inline-block">← Contacts</Link>
            <h2 className="text-2xl font-bold sm:text-3xl">{form.first_name} {form.last_name}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className={`rounded-full px-3 py-0.5 text-xs font-bold uppercase ${form.type === "client" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                {form.type}
              </span>
              {form.department && (
                <span className="rounded-full bg-blue-500/20 px-3 py-0.5 text-xs font-bold text-blue-400">
                  {DEPT_LABELS[form.department] ?? form.department}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {form.type === "lead" && (
              <button onClick={handleConvertToClient} className="rounded-lg border border-green-500/50 bg-green-500/10 px-4 py-2 text-sm font-bold text-green-400 hover:bg-green-500/20">
                Convert to Client
              </button>
            )}
            {isAdmin && (
              <button onClick={handleDelete} disabled={isDeleting} className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-400 hover:bg-red-500/20 disabled:opacity-50">
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            )}
          </div>
        </div>

        {message && (
          <div className={`mb-6 rounded-lg px-4 py-3 ${message.type === "error" ? "bg-red-500/20 text-red-300 border border-red-500/30" : "bg-green-500/20 text-green-300 border border-green-500/30"}`}>
            {message.text}
          </div>
        )}

        {/* Contact Information */}
        <div className={sectionClass}>
          <h3 className="text-lg font-bold mb-4">Contact Information</h3>

          {/* Basic */}
          <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">Basic</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
            <div><label className={labelClass}>First Name *</label><input name="first_name" value={form.first_name} onChange={handleChange} className={inputClass} /></div>
            <div><label className={labelClass}>Last Name *</label><input name="last_name" value={form.last_name} onChange={handleChange} className={inputClass} /></div>
            <div>
              <label className={labelClass}>Gender</label>
              <select name="gender" value={form.gender} onChange={handleChange} className={selectClass}>
                <option value="" className="bg-blue-900">Select...</option>
                <option value="male" className="bg-blue-900">Male</option>
                <option value="female" className="bg-blue-900">Female</option>
                <option value="other" className="bg-blue-900">Other</option>
              </select>
            </div>
            <div><label className={labelClass}>Date of Birth</label><input name="date_of_birth" value={form.date_of_birth} onChange={handleChange} type="date" className={inputClass} /></div>
            <div><label className={labelClass}>Email</label><input name="email" value={form.email} onChange={handleChange} type="email" className={inputClass} /></div>
            <div><label className={labelClass}>Secondary Email</label><input name="secondary_email" value={form.secondary_email} onChange={handleChange} type="email" className={inputClass} /></div>
            <div><label className={labelClass}>Mobile</label><input name="mobile" value={form.mobile} onChange={handleChange} className={inputClass} /></div>
            <div><label className={labelClass}>Message App</label><input name="message_app" value={form.message_app} onChange={handleChange} className={inputClass} /></div>
            <div><label className={labelClass}>Nationality</label><input name="nationality" value={form.nationality} onChange={handleChange} className={inputClass} /></div>
            <div><label className={labelClass}>Preferred Language</label><input name="preferred_language" value={form.preferred_language} onChange={handleChange} className={inputClass} /></div>
          </div>

          {/* Service */}
          <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">Service Information</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
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
            <div><label className={labelClass}>Service Required</label><input name="service_required" value={form.service_required} onChange={handleChange} className={inputClass} /></div>
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
            <div><label className={labelClass}>Source Name</label><input name="source_name" value={form.source_name} onChange={handleChange} className={inputClass} /></div>
            <div>
              <label className={labelClass}>Agent</label>
              <select name="agent_id" value={form.agent_id} onChange={handleChange} className={selectClass}>
                <option value="" className="bg-blue-900">No Agent</option>
                {agents.map(a => <option key={a.id} value={a.id} className="bg-blue-900">{a.agent_name}</option>)}
              </select>
            </div>
          </div>

          {/* Personal */}
          <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">Personal Details</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
            <div className="sm:col-span-2"><label className={labelClass}>Address</label><input name="address" value={form.address} onChange={handleChange} className={inputClass} /></div>
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
            <div><label className={labelClass}>Employer</label><input name="employer" value={form.employer} onChange={handleChange} className={inputClass} /></div>
            <div><label className={labelClass}>School</label><input name="school" value={form.school} onChange={handleChange} className={inputClass} /></div>
            <div><label className={labelClass}>Currency</label><input name="currency" value={form.currency} onChange={handleChange} className={inputClass} /></div>
            <div><label className={labelClass}>Client Number</label><input name="client_number" value={form.client_number} onChange={handleChange} className={inputClass} /></div>
            <div className="sm:col-span-2"><label className={labelClass}>Description / Notes</label><textarea name="description" value={form.description} onChange={handleChange} rows={3} className={`${inputClass} resize-none`} /></div>
          </div>

          {/* Visa & Passport */}
          <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">Visa & Passport</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
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
            <div><label className={labelClass}>Visa Expiry</label><input name="visa_expiry_date" value={form.visa_expiry_date} onChange={handleChange} type="date" className={inputClass} /></div>
            <div><label className={labelClass}>Travel Doc Expiry</label><input name="travel_expiry_date" value={form.travel_expiry_date} onChange={handleChange} type="date" className={inputClass} /></div>
            <div><label className={labelClass}>Passport Number</label><input name="passport_number" value={form.passport_number} onChange={handleChange} className={inputClass} /></div>
            <div><label className={labelClass}>Passport Expiry</label><input name="passport_expiry_date" value={form.passport_expiry_date} onChange={handleChange} type="date" className={inputClass} /></div>
            <div><label className={labelClass}>Student Insurance Expiry</label><input name="student_insurance_expiry_date" value={form.student_insurance_expiry_date} onChange={handleChange} type="date" className={inputClass} /></div>
          </div>

          {/* OneDrive */}
          <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">OneDrive (Reserved)</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
            <div><label className={labelClass}>Folder ID</label><input name="onedrive_folder_id" value={form.onedrive_folder_id} onChange={handleChange} className={inputClass} /></div>
            <div><label className={labelClass}>Folder Link</label><input name="onedrive_folder_link" value={form.onedrive_folder_link} onChange={handleChange} className={inputClass} /></div>
          </div>

          {/* Department & Sales */}
          <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">Assignment</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Department</label>
              {isSales ? (
                <p className="text-white/70 py-2.5">{DEPT_LABELS[form.department] ?? form.department}</p>
              ) : (
                <select name="department" value={form.department} onChange={handleChange} className={selectClass}>
                  <option value="" className="bg-blue-900">Select...</option>
                  <option value="china" className="bg-blue-900">China</option>
                  <option value="thailand" className="bg-blue-900">Thailand</option>
                  <option value="myanmar" className="bg-blue-900">Myanmar</option>
                  <option value="korea_japan" className="bg-blue-900">Korea & Japan</option>
                </select>
              )}
            </div>
            <div>
              <label className={labelClass}>Assigned Sales</label>
              {isSales ? (
                <p className="text-white/70 py-2.5">{salesUsers.find(s => s.id === form.assigned_sales_id)?.full_name ?? "—"}</p>
              ) : (
                <select name="assigned_sales_id" value={form.assigned_sales_id} onChange={handleChange} className={selectClass}>
                  <option value="" className="bg-blue-900">Select...</option>
                  {salesUsers.map(s => <option key={s.id} value={s.id} className="bg-blue-900">{s.full_name ?? s.id}</option>)}
                </select>
              )}
            </div>
          </div>

          <div className="mt-5 flex gap-3">
            <button onClick={handleSave} disabled={isSaving || !hasUnsavedChanges} className="rounded-lg bg-blue-600 px-6 py-2.5 font-bold text-white hover:bg-blue-700 disabled:opacity-50">
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        {/* Medical & PCC */}
        <div className={sectionClass}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Medical & PCC</h3>
            <button onClick={() => setShowMedicalForm(!showMedicalForm)} className="rounded-lg border border-white/20 px-3 py-1.5 text-sm font-bold hover:bg-white/10">
              + Add Row
            </button>
          </div>

          {showMedicalForm && (
            <div className="mb-4 rounded-lg border border-white/10 bg-white/5 p-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className={labelClass}>Item</label>
                <select value={newMedical.item} onChange={e => setNewMedical(f => ({ ...f, item: e.target.value }))} className={selectClass}>
                  <option value="medical" className="bg-blue-900">Medical</option>
                  <option value="pcc" className="bg-blue-900">PCC</option>
                  <option value="chest_xray" className="bg-blue-900">Chest X-Ray</option>
                  <option value="other" className="bg-blue-900">Other</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Country</label>
                <input value={newMedical.country} onChange={e => setNewMedical(f => ({ ...f, country: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Issue Date</label>
                <input type="date" value={newMedical.issue_date} onChange={e => setNewMedical(f => ({ ...f, issue_date: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Expiry Date</label>
                <input type="date" value={newMedical.expiry_date} onChange={e => setNewMedical(f => ({ ...f, expiry_date: e.target.value }))} className={inputClass} />
              </div>
              <div className="col-span-2 sm:col-span-4 flex gap-2">
                <button onClick={handleAddMedical} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">Add</button>
                <button onClick={() => setShowMedicalForm(false)} className="rounded-lg border border-white/20 px-4 py-2 text-sm font-bold hover:bg-white/10">Cancel</button>
              </div>
            </div>
          )}

          {medicalRows.length === 0 ? (
            <p className="text-white/50 text-sm">No records yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px] border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-white/70">Item</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-white/70">Country</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-white/70">Issue Date</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-white/70">Expiry Date</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {medicalRows.map((row) => (
                    <tr key={row.id} className="border-b border-white/10 last:border-b-0">
                      <td className="px-3 py-2 text-sm capitalize">{row.item?.replace("_", " ") ?? "—"}</td>
                      <td className="px-3 py-2 text-sm text-white/70">{row.country ?? "—"}</td>
                      <td className="px-3 py-2 text-sm text-white/70">{row.issue_date ?? "—"}</td>
                      <td className="px-3 py-2 text-sm text-white/70">{row.expiry_date ?? "—"}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => handleDeleteMedical(row.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Family Relationships */}
        <div className={sectionClass}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Family Relationships</h3>
            <button onClick={() => setShowLinkModal(true)} className="rounded-lg border border-white/20 px-3 py-1.5 text-sm font-bold hover:bg-white/10">
              Link Family Member
            </button>
          </div>

          {showLinkModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
              <div className="w-full max-w-md rounded-xl border border-white/10 bg-blue-900 p-6">
                <h4 className="text-lg font-bold mb-4">Link Family Member</h4>
                <div className="mb-3">
                  <label className={labelClass}>Search Contact</label>
                  <input
                    value={familySearch}
                    onChange={e => handleFamilySearch(e.target.value)}
                    placeholder="Type name to search..."
                    className={inputClass}
                  />
                  {familySearchResults.length > 0 && (
                    <ul className="mt-1 rounded-lg border border-white/10 bg-blue-950 max-h-40 overflow-y-auto">
                      {familySearchResults.map(c => (
                        <li key={c.id}>
                          <button
                            onClick={() => { setLinkForm(f => ({ ...f, related_contact_id: c.id })); setFamilySearch(`${c.first_name} ${c.last_name}`); setFamilySearchResults([]); }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-white/10 ${linkForm.related_contact_id === c.id ? "bg-white/10" : ""}`}
                          >
                            {c.first_name} {c.last_name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="mb-3">
                  <label className={labelClass}>Relationship</label>
                  <select value={linkForm.relationship} onChange={e => setLinkForm(f => ({ ...f, relationship: e.target.value }))} className={selectClass}>
                    <option value="spouse" className="bg-blue-900">Spouse</option>
                    <option value="child" className="bg-blue-900">Child</option>
                    <option value="parent" className="bg-blue-900">Parent</option>
                    <option value="sibling" className="bg-blue-900">Sibling</option>
                    <option value="partner" className="bg-blue-900">Partner</option>
                    <option value="other" className="bg-blue-900">Other</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label className={labelClass}>Notes</label>
                  <input value={linkForm.notes} onChange={e => setLinkForm(f => ({ ...f, notes: e.target.value }))} className={inputClass} />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddFamilyLink} disabled={!linkForm.related_contact_id} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                    Link
                  </button>
                  <button onClick={() => { setShowLinkModal(false); setFamilySearch(""); setFamilySearchResults([]); setLinkForm({ related_contact_id: "", relationship: "spouse", notes: "" }); }} className="rounded-lg border border-white/20 px-5 py-2 text-sm font-bold hover:bg-white/10">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {familyLinks.length === 0 ? (
            <p className="text-white/50 text-sm">No family links yet.</p>
          ) : (
            <ul className="space-y-2">
              {familyLinks.map((link) => (
                <li key={link.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-2.5">
                  <div>
                    <Link href={`/contacts/${link.related_contact_id}`} className="font-medium text-blue-400 hover:underline">
                      {link.related_contact?.first_name} {link.related_contact?.last_name}
                    </Link>
                    <span className="ml-2 text-sm text-white/60 capitalize">{link.relationship ?? ""}</span>
                    {link.notes && <span className="ml-2 text-xs text-white/40">{link.notes}</span>}
                  </div>
                  <button onClick={() => handleDeleteFamilyLink(link.id)} className="text-xs text-red-400 hover:text-red-300 ml-4">Remove</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Deals */}
        <div className={sectionClass}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Deals ({deals.length})</h3>
            <Link href={`/deals/new?contact_id=${id}`} className="rounded-lg border border-white/20 px-3 py-1.5 text-sm font-bold hover:bg-white/10">
              + New Deal
            </Link>
          </div>
          {deals.length === 0 ? (
            <p className="text-white/50 text-sm">No deals linked to this contact.</p>
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
          {attachments.length === 0 ? (
            <p className="text-white/50 text-sm">No attachments yet.</p>
          ) : (
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
          {activityLogs.length === 0 ? (
            <p className="text-white/50 text-sm">No activity yet.</p>
          ) : (
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
