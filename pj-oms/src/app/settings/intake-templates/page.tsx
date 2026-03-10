"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import { logActivity } from "@/lib/activityLog";
import { hasRole } from "@/lib/roles";

type FieldType = "text" | "textarea" | "date" | "email" | "phone" | "number" | "select" | "radio" | "checkbox" | "file";

type FormField = {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  section: string;
  placeholder?: string;
  options?: string[];
};

type Template = {
  id: string;
  created_at: string;
  name: string;
  form_type: string | null;
  language: string | null;
  fields: FormField[];
  is_active: boolean;
};

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Textarea" },
  { value: "date", label: "Date" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "number", label: "Number" },
  { value: "select", label: "Dropdown (Select)" },
  { value: "radio", label: "Radio Buttons" },
  { value: "checkbox", label: "Checkboxes" },
  { value: "file", label: "File Upload" },
];

const HAS_OPTIONS: FieldType[] = ["select", "radio", "checkbox"];
const EMPTY_FIELD: Omit<FormField, "id"> = { label: "", type: "text", required: false, section: "", placeholder: "", options: [] };

const EMPTY_FORM = { name: "", form_type: "individual_visa", language: "english", is_active: true };

function newField(): FormField {
  return { ...EMPTY_FIELD, id: crypto.randomUUID() };
}

export default function IntakeTemplatesPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fields, setFields] = useState<FormField[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  // Field editor modal
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [fieldForm, setFieldForm] = useState<Omit<FormField, "id">>(EMPTY_FIELD);
  const [optionsText, setOptionsText] = useState(""); // newline-separated options

  // Preview
  const [showPreview, setShowPreview] = useState(false);

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
    const { data } = await supabase.from("intake_form_templates").select("*").order("created_at", { ascending: false });
    if (data) setTemplates(data as unknown as Template[]);
  };

  const openNew = () => {
    setForm(EMPTY_FORM);
    setFields([]);
    setEditingId("new");
    setMessage(null);
    setShowPreview(false);
  };

  const openEdit = (t: Template) => {
    setForm({ name: t.name, form_type: t.form_type ?? "individual_visa", language: t.language ?? "english", is_active: t.is_active });
    setFields(t.fields ?? []);
    setEditingId(t.id);
    setMessage(null);
    setShowPreview(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setMessage({ type: "error", text: "Name is required." }); return; }
    setIsSaving(true); setMessage(null);
    const payload = { name: form.name.trim(), form_type: form.form_type, language: form.language, fields, is_active: form.is_active };

    if (editingId === "new") {
      const { error } = await supabase.from("intake_form_templates").insert({ ...payload, created_by: userId });
      if (error) { setMessage({ type: "error", text: error.message }); setIsSaving(false); return; }
      if (userId) await logActivity(supabase, userId, "created_intake_template", "intake_form_templates", undefined, { name: form.name });
    } else if (editingId) {
      const { error } = await supabase.from("intake_form_templates").update(payload).eq("id", editingId);
      if (error) { setMessage({ type: "error", text: error.message }); setIsSaving(false); return; }
      if (userId) await logActivity(supabase, userId, "updated_intake_template", "intake_form_templates", editingId, { name: form.name });
    }

    setMessage({ type: "success", text: "Template saved." });
    setIsSaving(false);
    setEditingId(null);
    await fetchTemplates();
  };

  const handleSeedTemplates = async () => {
    if (!window.confirm("Insert the 6 default intake templates? Existing templates with the same category will be updated.")) return;
    setIsSeeding(true);
    setMessage(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setMessage({ type: "error", text: "Not authenticated." }); return; }
      const res = await fetch("/api/seed-intake-templates", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: json.error ?? "Seed failed." });
      } else {
        const inserted = json.results?.filter((r: { action: string }) => r.action === "inserted").length ?? 0;
        const updated = json.results?.filter((r: { action: string }) => r.action === "updated").length ?? 0;
        setMessage({ type: "success", text: `Done — ${inserted} inserted, ${updated} updated.` });
        await fetchTemplates();
      }
    } catch {
      setMessage({ type: "error", text: "Network error." });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete template "${name}"?`)) return;
    await supabase.from("intake_form_templates").delete().eq("id", id);
    if (userId) await logActivity(supabase, userId, "deleted_intake_template", "intake_form_templates", id, { name });
    if (editingId === id) setEditingId(null);
    await fetchTemplates();
  };

  // Field editor
  const openAddField = () => {
    setEditingField({ id: "", label: "", type: "text", required: false, section: "", placeholder: "", options: [] });
    setFieldForm(EMPTY_FIELD);
    setOptionsText("");
  };

  const openEditField = (f: FormField) => {
    setEditingField(f);
    setFieldForm({ label: f.label, type: f.type, required: f.required, section: f.section, placeholder: f.placeholder ?? "", options: f.options ?? [] });
    setOptionsText((f.options ?? []).join("\n"));
  };

  const handleSaveField = () => {
    if (!fieldForm.label.trim()) return;
    const options = HAS_OPTIONS.includes(fieldForm.type) ? optionsText.split("\n").map(o => o.trim()).filter(Boolean) : [];
    const saved: FormField = { ...fieldForm, options, id: editingField?.id || crypto.randomUUID(), label: fieldForm.label.trim(), section: fieldForm.section.trim() };

    if (!editingField?.id) {
      setFields(f => [...f, saved]);
    } else {
      setFields(f => f.map(field => field.id === saved.id ? saved : field));
    }
    setEditingField(null);
  };

  const removeField = (id: string) => setFields(f => f.filter(field => field.id !== id));
  const moveField = (id: string, dir: -1 | 1) => {
    setFields(f => {
      const idx = f.findIndex(field => field.id === id);
      if (idx < 0) return f;
      const next = idx + dir;
      if (next < 0 || next >= f.length) return f;
      const arr = [...f];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
  };

  // Group fields by section for preview
  const sections = [...new Set(fields.map(f => f.section || "General"))];

  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-blue-950"><p className="text-white/60">Loading...</p></div>;

  const inputClass = "w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none";
  const selectClass = "w-full rounded-lg border border-white/20 bg-blue-900 px-4 py-2.5 text-white focus:border-blue-400 focus:outline-none";
  const labelClass = "block text-sm font-medium text-white/70 mb-1";
  const btnPrimary = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50";
  const btnSecondary = "rounded-lg border border-white/20 px-4 py-2 text-sm font-bold hover:bg-white/10";

  return (
    <div className="min-h-screen bg-blue-950 text-white">
      <Navbar />

      {/* Field editor modal */}
      {editingField !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-blue-900 p-6">
            <h4 className="text-lg font-bold mb-4">{editingField.id ? "Edit Field" : "Add Field"}</h4>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Section (group name)</label>
                <input value={fieldForm.section} onChange={e => setFieldForm(f => ({ ...f, section: e.target.value }))} className={inputClass} placeholder="e.g. Personal Information" />
              </div>
              <div>
                <label className={labelClass}>Field Label <span className="text-red-400">*</span></label>
                <input value={fieldForm.label} onChange={e => setFieldForm(f => ({ ...f, label: e.target.value }))} className={inputClass} placeholder="e.g. Full Legal Name" />
              </div>
              <div>
                <label className={labelClass}>Field Type</label>
                <select value={fieldForm.type} onChange={e => setFieldForm(f => ({ ...f, type: e.target.value as FieldType }))} className={selectClass}>
                  {FIELD_TYPES.map(t => <option key={t.value} value={t.value} className="bg-blue-900">{t.label}</option>)}
                </select>
              </div>
              {!HAS_OPTIONS.includes(fieldForm.type) && (
                <div>
                  <label className={labelClass}>Placeholder Text (optional)</label>
                  <input value={fieldForm.placeholder} onChange={e => setFieldForm(f => ({ ...f, placeholder: e.target.value }))} className={inputClass} placeholder="e.g. Enter your full name..." />
                </div>
              )}
              {HAS_OPTIONS.includes(fieldForm.type) && (
                <div>
                  <label className={labelClass}>Options (one per line)</label>
                  <textarea value={optionsText} onChange={e => setOptionsText(e.target.value)} rows={4} className={`${inputClass} resize-none`} placeholder={"Option 1\nOption 2\nOption 3"} />
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={fieldForm.required} onChange={e => setFieldForm(f => ({ ...f, required: e.target.checked }))} className="rounded" />
                <span className="text-sm text-white/70">Required field</span>
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={handleSaveField} disabled={!fieldForm.label.trim()} className={btnPrimary}>
                {editingField.id ? "Save Field" : "Add Field"}
              </button>
              <button onClick={() => setEditingField(null)} className={btnSecondary}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm text-white/50 mb-1">Settings</p>
            <h1 className="text-2xl font-bold">Intake Form Templates</h1>
          </div>
          {editingId === null && (
            <div className="flex gap-2">
              <button onClick={handleSeedTemplates} disabled={isSeeding} className="rounded-lg border border-white/20 px-4 py-2 text-sm font-bold hover:bg-white/10 disabled:opacity-50">
                {isSeeding ? "Seeding..." : "Seed Default Templates"}
              </button>
              <button onClick={openNew} className={btnPrimary}>+ New Template</button>
            </div>
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

            {/* Template meta */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div>
                <label className={labelClass}>Name <span className="text-red-400">*</span></label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputClass} placeholder="e.g. Individual Visa Form EN" />
              </div>
              <div>
                <label className={labelClass}>Form Type</label>
                <select value={form.form_type} onChange={e => setForm(f => ({ ...f, form_type: e.target.value }))} className={selectClass}>
                  <option value="individual_visa" className="bg-blue-900">Individual Visa</option>
                  <option value="company_accreditation" className="bg-blue-900">Company Accreditation</option>
                  <option value="job_check" className="bg-blue-900">Job Check</option>
                  <option value="school_application" className="bg-blue-900">School Application</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Language</label>
                <select value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))} className={selectClass}>
                  <option value="english" className="bg-blue-900">English</option>
                  <option value="chinese" className="bg-blue-900">Chinese</option>
                  <option value="thai" className="bg-blue-900">Thai</option>
                </select>
              </div>
            </div>

            {/* Field editor */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-white/80">Fields ({fields.length})</h4>
                <div className="flex gap-2">
                  <button onClick={() => setShowPreview(!showPreview)} className={btnSecondary}>
                    {showPreview ? "Hide Preview" : "Preview Form"}
                  </button>
                  <button onClick={openAddField} className={btnPrimary}>+ Add Field</button>
                </div>
              </div>

              {fields.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-center">
                  <p className="text-white/40 text-sm">No fields yet. Click &ldquo;+ Add Field&rdquo; to start building your form.</p>
                </div>
              ) : (
                <div className="rounded-lg border border-white/10 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5">
                        <th className="text-left px-4 py-2 text-white/50 font-medium">Section</th>
                        <th className="text-left px-4 py-2 text-white/50 font-medium">Label</th>
                        <th className="text-left px-4 py-2 text-white/50 font-medium">Type</th>
                        <th className="text-left px-4 py-2 text-white/50 font-medium">Required</th>
                        <th className="px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map((f, i) => (
                        <tr key={f.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-4 py-2 text-white/50 text-xs">{f.section || "—"}</td>
                          <td className="px-4 py-2 font-medium">{f.label}</td>
                          <td className="px-4 py-2 text-white/60 capitalize text-xs">{FIELD_TYPES.find(t => t.value === f.type)?.label ?? f.type}</td>
                          <td className="px-4 py-2">
                            {f.required && <span className="text-xs text-red-400">Required</span>}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-1 justify-end">
                              <button onClick={() => moveField(f.id, -1)} disabled={i === 0} className="text-xs text-white/40 hover:text-white disabled:opacity-20 px-1">↑</button>
                              <button onClick={() => moveField(f.id, 1)} disabled={i === fields.length - 1} className="text-xs text-white/40 hover:text-white disabled:opacity-20 px-1">↓</button>
                              <button onClick={() => openEditField(f)} className="text-xs text-blue-400 hover:underline px-1">Edit</button>
                              <button onClick={() => removeField(f.id)} className="text-xs text-red-400 hover:text-red-300 px-1">✕</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Preview */}
            {showPreview && fields.length > 0 && (
              <div className="rounded-xl border border-white/20 bg-white p-6 mb-4">
                <p className="text-sm font-bold text-gray-500 mb-4">Form Preview</p>
                {sections.map(section => (
                  <div key={section} className="mb-6">
                    <h4 className="text-base font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">{section}</h4>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {fields.filter(f => (f.section || "General") === section).map(f => (
                        <div key={f.id} className={(f.type === "textarea") ? "sm:col-span-2" : ""}>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
                          </label>
                          {f.type === "text" || f.type === "email" || f.type === "phone" || f.type === "number" || f.type === "date" ? (
                            <input type={f.type === "phone" ? "tel" : f.type} disabled className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-gray-50" placeholder={f.placeholder} />
                          ) : f.type === "textarea" ? (
                            <textarea disabled rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-gray-50 resize-none" placeholder={f.placeholder} />
                          ) : f.type === "select" ? (
                            <select disabled className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-gray-50">
                              <option>Select...</option>
                              {(f.options ?? []).map(o => <option key={o}>{o}</option>)}
                            </select>
                          ) : f.type === "radio" ? (
                            <div className="space-y-1">{(f.options ?? []).map(o => <label key={o} className="flex items-center gap-2 text-sm text-gray-700"><input type="radio" disabled />{o}</label>)}</div>
                          ) : f.type === "checkbox" ? (
                            <div className="space-y-1">{(f.options ?? []).map(o => <label key={o} className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" disabled />{o}</label>)}</div>
                          ) : f.type === "file" ? (
                            <div className="rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-gray-400">File Upload</div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-4">
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
            <p className="text-white/50 mb-4">No intake form templates yet.</p>
            <button onClick={openNew} className={btnPrimary}>Create your first template</button>
          </div>
        ) : templates.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Name</th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Form Type</th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Language</th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Fields</th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {templates.map(t => (
                  <tr key={t.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 font-medium">{t.name}</td>
                    <td className="px-4 py-3 text-white/70 capitalize text-sm">{t.form_type?.replace(/_/g, " ") ?? "—"}</td>
                    <td className="px-4 py-3 text-white/70 capitalize text-sm">{t.language ?? "—"}</td>
                    <td className="px-4 py-3 text-white/60 text-sm">{t.fields?.length ?? 0} fields</td>
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
