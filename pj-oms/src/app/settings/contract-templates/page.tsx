"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import { logActivity } from "@/lib/activityLog";
import { hasRole } from "@/lib/roles";

type Template = {
  id: string;
  created_at: string;
  name: string;
  language: string | null;
  target_type: string | null;
  content: string | null;
  is_active: boolean;
  created_by: string | null;
};

const PLACEHOLDERS = [
  { key: "{{client_name}}", desc: "Client full name" },
  { key: "{{client_email}}", desc: "Client email" },
  { key: "{{client_phone}}", desc: "Client phone" },
  { key: "{{client_address}}", desc: "Client address" },
  { key: "{{client_passport}}", desc: "Passport number" },
  { key: "{{client_nationality}}", desc: "Nationality" },
  { key: "{{client_dob}}", desc: "Date of birth" },
  { key: "{{company_name}}", desc: "Company name" },
  { key: "{{company_address}}", desc: "Company address" },
  { key: "{{deal_number}}", desc: "Deal/case number" },
  { key: "{{deal_type}}", desc: "Deal type" },
  { key: "{{visa_type}}", desc: "Visa type" },
  { key: "{{service_fee}}", desc: "Service fee amount" },
  { key: "{{inz_application_fee}}", desc: "INZ Application Fee" },
  { key: "{{total_amount}}", desc: "Total amount" },
  { key: "{{lia_name}}", desc: "LIA consultant name" },
  { key: "{{sales_name}}", desc: "Sales person name" },
  { key: "{{date_today}}", desc: "Today's date" },
  { key: "{{signature_client}}", desc: "Client signature line" },
  { key: "{{signature_lia}}", desc: "LIA signature line" },
];

const SAMPLE_DATA: Record<string, string> = {
  client_name: "Zhang Wei",
  client_email: "zhang.wei@example.com",
  client_phone: "+64 21 123 4567",
  client_address: "123 Queen Street, Auckland 1010",
  client_passport: "E12345678",
  client_nationality: "Chinese",
  client_dob: "1990-01-15",
  company_name: "ABC Limited",
  company_address: "456 Main Street, Wellington",
  deal_number: "PJ-2026-001",
  deal_type: "Individual Visa",
  visa_type: "AEWV",
  service_fee: "$2,500.00",
  inz_application_fee: "$700.00",
  total_amount: "$3,200.00",
  lia_name: "Sarah Johnson",
  sales_name: "Mike Chen",
  date_today: new Date().toLocaleDateString("en-NZ", { year: "numeric", month: "long", day: "numeric" }),
  signature_client: "________________________",
  signature_lia: "________________________",
};

function fillPlaceholders(content: string, data: Record<string, string>): string {
  return content.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? `{{${key}}}`);
}

const EMPTY_FORM = { name: "", language: "english", target_type: "individual", content: "", is_active: true };

export default function ContractTemplatesPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/admin"); return; }
      const { data: profile } = await supabase.from("profiles").select("role, roles").eq("id", session.user.id).single();
      if (!profile || !hasRole(profile, "admin")) { router.push("/crm"); return; }
      setUserId(session.user.id);
      await fetchTemplates();
      setIsLoading(false);
    }
    init();
  }, [router]);

  const fetchTemplates = async () => {
    const { data } = await supabase.from("contract_templates").select("*").order("created_at", { ascending: false });
    if (data) setTemplates(data as Template[]);
  };

  const openNew = () => {
    setForm(EMPTY_FORM);
    setEditingId("new");
    setShowPreview(false);
    setMessage(null);
  };

  const openEdit = (t: Template) => {
    setForm({ name: t.name, language: t.language ?? "english", target_type: t.target_type ?? "individual", content: t.content ?? "", is_active: t.is_active });
    setEditingId(t.id);
    setShowPreview(false);
    setMessage(null);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setMessage({ type: "error", text: "Name is required." }); return; }
    setIsSaving(true); setMessage(null);
    const payload = { name: form.name.trim(), language: form.language || null, target_type: form.target_type || null, content: form.content || null, is_active: form.is_active };

    if (editingId === "new") {
      const { error } = await supabase.from("contract_templates").insert({ ...payload, created_by: userId });
      if (error) { setMessage({ type: "error", text: error.message }); setIsSaving(false); return; }
      if (userId) await logActivity(supabase, userId, "created_contract_template", "contract_templates", undefined, { name: form.name });
    } else if (editingId) {
      const { error } = await supabase.from("contract_templates").update(payload).eq("id", editingId);
      if (error) { setMessage({ type: "error", text: error.message }); setIsSaving(false); return; }
      if (userId) await logActivity(supabase, userId, "updated_contract_template", "contract_templates", editingId, { name: form.name });
    }

    setMessage({ type: "success", text: "Template saved." });
    setIsSaving(false);
    setEditingId(null);
    await fetchTemplates();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete template "${name}"?`)) return;
    await supabase.from("contract_templates").delete().eq("id", id);
    if (userId) await logActivity(supabase, userId, "deleted_contract_template", "contract_templates", id, { name });
    if (editingId === id) setEditingId(null);
    await fetchTemplates();
  };

  const insertPlaceholder = (key: string) => {
    setForm(f => ({ ...f, content: f.content + key }));
  };

  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-blue-950"><p className="text-white/60">Loading...</p></div>;

  const inputClass = "w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none";
  const selectClass = "w-full rounded-lg border border-white/20 bg-blue-900 px-4 py-2.5 text-white focus:border-blue-400 focus:outline-none";
  const labelClass = "block text-sm font-medium text-white/70 mb-1";
  const btnPrimary = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50";
  const btnSecondary = "rounded-lg border border-white/20 px-4 py-2 text-sm font-bold hover:bg-white/10";

  const previewHtml = form.content ? fillPlaceholders(form.content, SAMPLE_DATA) : "";

  return (
    <div className="min-h-screen bg-blue-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm text-white/50 mb-1">Settings</p>
            <h1 className="text-2xl font-bold">Contract Templates</h1>
          </div>
          {editingId === null && (
            <button onClick={openNew} className={btnPrimary}>+ New Template</button>
          )}
        </div>

        {message && (
          <div className={`mb-6 rounded-lg px-4 py-3 ${message.type === "error" ? "bg-red-500/20 text-red-300 border border-red-500/30" : "bg-green-500/20 text-green-300 border border-green-500/30"}`}>
            {message.text}
          </div>
        )}

        {/* Editor */}
        {editingId !== null && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 mb-8">
            <h3 className="text-lg font-bold mb-5">{editingId === "new" ? "New Template" : "Edit Template"}</h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className={labelClass}>Name <span className="text-red-400">*</span></label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputClass} placeholder="e.g. Individual AEWV Contract EN" />
              </div>
              <div>
                <label className={labelClass}>Language</label>
                <select value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))} className={selectClass}>
                  <option value="english" className="bg-blue-900">English</option>
                  <option value="chinese" className="bg-blue-900">Chinese</option>
                  <option value="thai" className="bg-blue-900">Thai</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Target Type</label>
                <select value={form.target_type} onChange={e => setForm(f => ({ ...f, target_type: e.target.value }))} className={selectClass}>
                  <option value="individual" className="bg-blue-900">Individual</option>
                  <option value="company" className="bg-blue-900">Company</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Content editor */}
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className={labelClass}>Contract Content (HTML)</label>
                  <div className="flex gap-2">
                    <button onClick={() => setShowPreview(false)} className={`text-xs px-3 py-1 rounded ${!showPreview ? "bg-blue-600 text-white" : "border border-white/20 text-white/60 hover:text-white"}`}>Edit</button>
                    <button onClick={() => setShowPreview(true)} className={`text-xs px-3 py-1 rounded ${showPreview ? "bg-blue-600 text-white" : "border border-white/20 text-white/60 hover:text-white"}`}>Preview</button>
                  </div>
                </div>
                {showPreview ? (
                  <div className="rounded-lg border border-white/20 bg-white p-6 min-h-64 prose max-w-none" style={{ color: "#111" }}>
                    {previewHtml ? (
                      <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                    ) : (
                      <p className="text-gray-400 italic">No content to preview.</p>
                    )}
                    <p className="text-xs text-gray-400 mt-4 border-t pt-2">Preview uses sample data.</p>
                  </div>
                ) : (
                  <textarea
                    value={form.content}
                    onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                    rows={20}
                    className={`${inputClass} font-mono text-xs resize-y`}
                    placeholder="<p>This Service Agreement is entered into on {{date_today}}...</p>"
                  />
                )}
              </div>

              {/* Placeholders sidebar */}
              <div>
                <label className={labelClass}>Available Placeholders</label>
                <div className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
                  {PLACEHOLDERS.map(p => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => insertPlaceholder(p.key)}
                      className="w-full text-left px-3 py-2 hover:bg-white/10 border-b border-white/5 last:border-0 group"
                    >
                      <p className="text-xs font-mono text-blue-300 group-hover:text-blue-200">{p.key}</p>
                      <p className="text-xs text-white/40">{p.desc}</p>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-white/30 mt-2">Click to insert at cursor position.</p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-4">
              <button onClick={handleSave} disabled={isSaving} className={btnPrimary}>{isSaving ? "Saving..." : "Save Template"}</button>
              <button onClick={() => { setEditingId(null); setMessage(null); }} className={btnSecondary}>Cancel</button>
              <label className="flex items-center gap-2 ml-auto cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
                <span className="text-sm text-white/70">Active</span>
              </label>
            </div>
          </div>
        )}

        {/* Template list */}
        {templates.length === 0 && editingId === null ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-10 text-center">
            <p className="text-white/50 mb-4">No contract templates yet.</p>
            <button onClick={openNew} className={btnPrimary}>Create your first template</button>
          </div>
        ) : templates.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Name</th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Language</th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Type</th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {templates.map(t => (
                  <tr key={t.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 font-medium">{t.name}</td>
                    <td className="px-4 py-3 text-white/70 capitalize">{t.language ?? "—"}</td>
                    <td className="px-4 py-3 text-white/70 capitalize">{t.target_type ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${t.is_active ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"}`}>
                        {t.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 justify-end">
                        <button onClick={() => openEdit(t)} className="text-xs text-blue-400 hover:underline">Edit</button>
                        <button onClick={() => handleDelete(t.id, t.name)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                      </div>
                    </td>
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
