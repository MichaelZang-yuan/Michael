"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

type IntakeFormData = {
  id: string;
  deal_id: string;
  form_type: string | null;
  status: string;
  form_data: Record<string, unknown>;
  template_id: string | null;
  template?: {
    id: string;
    name: string;
    fields: FormField[];
    language: string | null;
  } | null;
  deals: {
    deal_number: string | null;
    visa_type: string | null;
    deal_type: string | null;
    contacts: { first_name: string; last_name: string } | null;
    companies: { company_name: string } | null;
  } | null;
};

// ─── Hardcoded fallback fields (used when no template) ──────────────────────

const FALLBACK_SECTIONS = [
  {
    section: "Personal Information",
    fields: [
      { id: "full_name", label: "Full Legal Name (as per passport)", type: "text" as FieldType, required: true, section: "Personal Information", placeholder: "e.g. ZHANG WEI" },
      { id: "date_of_birth", label: "Date of Birth", type: "date" as FieldType, required: true, section: "Personal Information" },
      { id: "gender", label: "Gender", type: "select" as FieldType, required: false, section: "Personal Information", options: ["Male", "Female", "Other / Prefer not to say"] },
      { id: "nationality", label: "Nationality", type: "text" as FieldType, required: true, section: "Personal Information", placeholder: "e.g. Chinese" },
      { id: "marital_status", label: "Marital Status", type: "select" as FieldType, required: false, section: "Personal Information", options: ["Single", "Married", "De Facto", "Divorced", "Widowed"] },
      { id: "number_of_children", label: "Number of Dependent Children", type: "number" as FieldType, required: false, section: "Personal Information", placeholder: "0" },
    ],
  },
  {
    section: "Passport Details",
    fields: [
      { id: "passport_number", label: "Passport Number", type: "text" as FieldType, required: true, section: "Passport Details", placeholder: "e.g. E12345678" },
      { id: "passport_issue_date", label: "Passport Issue Date", type: "date" as FieldType, required: false, section: "Passport Details" },
      { id: "passport_expiry_date", label: "Passport Expiry Date", type: "date" as FieldType, required: true, section: "Passport Details" },
    ],
  },
  {
    section: "Contact & Address",
    fields: [
      { id: "phone", label: "Phone Number", type: "phone" as FieldType, required: true, section: "Contact & Address", placeholder: "+64 21 000 0000" },
      { id: "email", label: "Email Address", type: "email" as FieldType, required: true, section: "Contact & Address", placeholder: "your@email.com" },
      { id: "nz_address", label: "Current Address in New Zealand (if onshore)", type: "textarea" as FieldType, required: false, section: "Contact & Address", placeholder: "Street, Suburb, City, Postcode" },
      { id: "overseas_address", label: "Overseas Address (if offshore)", type: "textarea" as FieldType, required: false, section: "Contact & Address", placeholder: "Full address including country" },
    ],
  },
];

const VISA_FALLBACK_FIELDS: FormField[] = [
  { id: "current_visa_type", label: "Current Visa Type", type: "text", required: false, section: "Visa & Immigration History", placeholder: "e.g. Work Visa, Student Visa" },
  { id: "current_visa_expiry", label: "Current Visa Expiry Date", type: "date", required: false, section: "Visa & Immigration History" },
  { id: "immigration_history", label: "Immigration History (any previous declines, cancellations or deportations?)", type: "textarea", required: false, section: "Visa & Immigration History", placeholder: "No previous issues / Please describe..." },
  { id: "health_declaration", label: "Health Declaration (any significant health conditions?)", type: "textarea", required: false, section: "Visa & Immigration History", placeholder: "No health conditions / Please describe..." },
  { id: "character_declaration", label: "Character Declaration (any criminal convictions in any country?)", type: "textarea", required: false, section: "Visa & Immigration History", placeholder: "No criminal convictions / Please describe..." },
  { id: "previous_countries", label: "Previous Countries Lived In (last 10 years, for PCC purposes)", type: "textarea", required: false, section: "Visa & Immigration History", placeholder: "e.g. China (2010-2020), New Zealand (2020-present)" },
];

// ─── Styles ──────────────────────────────────────────────────────────────────

const inputClass = "w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-sm";
const textareaClass = "w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white resize-none text-sm";
const selectClass = "w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-sm";

// ─── Field renderer ───────────────────────────────────────────────────────────

function FieldRenderer({
  field, value, onChange, onFileUpload, uploading,
}: {
  field: FormField;
  value: unknown;
  onChange: (id: string, val: unknown) => void;
  onFileUpload: (id: string, file: File) => void;
  uploading: string | null;
}) {
  const strVal = (value as string) ?? "";
  const arrVal = (value as string[]) ?? [];

  switch (field.type) {
    case "text":
    case "email":
    case "number":
      return (
        <input
          type={field.type}
          value={strVal}
          onChange={e => onChange(field.id, e.target.value)}
          className={inputClass}
          placeholder={field.placeholder}
          required={field.required}
        />
      );
    case "phone":
      return (
        <input
          type="tel"
          value={strVal}
          onChange={e => onChange(field.id, e.target.value)}
          className={inputClass}
          placeholder={field.placeholder}
          required={field.required}
        />
      );
    case "date":
      return <input type="date" value={strVal} onChange={e => onChange(field.id, e.target.value)} className={inputClass} required={field.required} />;
    case "textarea":
      return <textarea value={strVal} onChange={e => onChange(field.id, e.target.value)} rows={3} className={textareaClass} placeholder={field.placeholder} required={field.required} />;
    case "select":
      return (
        <select value={strVal} onChange={e => onChange(field.id, e.target.value)} className={selectClass} required={field.required}>
          <option value="">Select...</option>
          {(field.options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      );
    case "radio":
      return (
        <div className="space-y-2">
          {(field.options ?? []).map(opt => (
            <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="radio" name={field.id} value={opt} checked={strVal === opt} onChange={() => onChange(field.id, opt)} className="accent-blue-600" />
              {opt}
            </label>
          ))}
        </div>
      );
    case "checkbox":
      return (
        <div className="space-y-2">
          {(field.options ?? []).map(opt => (
            <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={arrVal.includes(opt)}
                onChange={e => {
                  const newVal = e.target.checked ? [...arrVal, opt] : arrVal.filter(v => v !== opt);
                  onChange(field.id, newVal);
                }}
                className="accent-blue-600"
              />
              {opt}
            </label>
          ))}
        </div>
      );
    case "file":
      return (
        <div>
          {strVal && (
            <div className="mb-2">
              <a href={strVal} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                ✓ File uploaded — click to view
              </a>
            </div>
          )}
          <label className={`cursor-pointer inline-block rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 ${uploading === field.id ? "opacity-60" : ""}`}>
            {uploading === field.id ? "Uploading..." : strVal ? "Replace file" : "Choose file"}
            <input
              type="file"
              className="hidden"
              disabled={uploading === field.id}
              onChange={e => { const f = e.target.files?.[0]; if (f) onFileUpload(field.id, f); e.target.value = ""; }}
            />
          </label>
          {field.required && !strVal && <p className="text-xs text-red-500 mt-1">A file is required.</p>}
        </div>
      );
    default:
      return null;
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function IntakeFormPage() {
  const params = useParams();
  const token = params.token as string;

  const [intakeForm, setIntakeForm] = useState<IntakeFormData | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [allFields, setAllFields] = useState<FormField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);

  useEffect(() => {
    async function fetchForm() {
      const { data } = await supabase
        .from("intake_forms")
        .select("id, deal_id, form_type, status, form_data, template_id, deals(deal_number, visa_type, deal_type, contacts(first_name, last_name), companies(company_name))")
        .eq("unique_token", token)
        .single();

      if (!data) { setError("This form link is invalid or has expired."); setIsLoading(false); return; }

      const form = data as unknown as IntakeFormData;

      // Load template if present
      if (form.template_id) {
        const { data: tmpl } = await supabase.from("intake_form_templates").select("id, name, fields, language").eq("id", form.template_id).single();
        if (tmpl) form.template = tmpl as IntakeFormData["template"];
      }

      setIntakeForm(form);

      // Set fields
      if (form.template?.fields && form.template.fields.length > 0) {
        setAllFields(form.template.fields);
      } else {
        // Fallback hardcoded fields
        const fallback: FormField[] = [
          ...FALLBACK_SECTIONS.flatMap(s => s.fields),
          ...(form.form_type === "individual_visa" ? VISA_FALLBACK_FIELDS : []),
        ];
        setAllFields(fallback);
      }

      // Pre-fill with saved data
      if (form.form_data && Object.keys(form.form_data).length > 0) {
        setFormData(form.form_data);
      }

      if (form.status === "completed") setIsSubmitted(true);
      setIsLoading(false);
    }
    fetchForm();
  }, [token]);

  const handleChange = useCallback((id: string, val: unknown) => {
    setFormData(f => ({ ...f, [id]: val }));
    setDraftSaved(false);
  }, []);

  const handleFileUpload = useCallback(async (fieldId: string, file: File) => {
    if (!intakeForm) return;
    setUploadingField(fieldId);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", "intake_forms");
    fd.append("id", intakeForm.id);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (res.ok) {
      const json = await res.json();
      setFormData(f => ({ ...f, [fieldId]: json.url }));
      setDraftSaved(false);
    }
    setUploadingField(null);
  }, [intakeForm]);

  const saveDraft = async () => {
    if (!intakeForm) return;
    setIsSavingDraft(true);
    await supabase.from("intake_forms").update({ form_data: formData, status: intakeForm.status === "sent" ? "in_progress" : intakeForm.status }).eq("id", intakeForm.id);
    setDraftSaved(true);
    setIsSavingDraft(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intakeForm) return;

    // Validate required fields
    const missing = allFields.filter(f => f.required && !formData[f.id] && formData[f.id] !== 0);
    if (missing.length > 0) {
      setError(`Please fill in required fields: ${missing.map(f => f.label).join(", ")}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setIsSubmitting(true);
    setError(null);
    const today = new Date().toISOString().split("T")[0];

    const { error: updateError } = await supabase.from("intake_forms")
      .update({ form_data: formData, status: "completed", completed_date: today })
      .eq("id", intakeForm.id);

    if (updateError) { setError("Failed to submit. Please try again."); setIsSubmitting(false); return; }

    // Notify via API (non-critical)
    try {
      await fetch("/api/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email_type: "intake_completed",
          deal_id: intakeForm.deal_id,
          recipient_email: "onboarding@resend.dev",
          recipient_name: "LIA Team",
          extra_data: { deal_number: intakeForm.deals?.deal_number },
        }),
      });
    } catch { /* non-critical */ }

    setIsSubmitted(true);
    setIsSubmitting(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <p className="text-gray-500">Loading form...</p>
    </div>
  );

  if (error && !intakeForm) return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-4">⚠️</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Form Not Found</h1>
        <p className="text-gray-600">{error}</p>
      </div>
    </div>
  );

  if (isSubmitted) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Form Submitted!</h1>
        <p className="text-gray-600 mb-4">Thank you for completing your information form. Your consultant will review the information and be in touch with next steps.</p>
        <p className="text-sm text-gray-400">Case Reference: {intakeForm?.deals?.deal_number ?? "—"}</p>
      </div>
    </div>
  );

  const dealNumber = intakeForm?.deals?.deal_number ?? "—";
  const caseLabel = intakeForm?.deals?.visa_type ?? intakeForm?.deals?.deal_type?.replace(/_/g, " ") ?? "Application";
  const templateName = intakeForm?.template?.name;

  // Group fields by section
  const sections = [...new Set(allFields.map(f => f.section || "General"))];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-900 text-white py-6 px-4 text-center">
        <h1 className="text-lg font-bold">PJ Operation & Management System</h1>
        <p className="text-blue-200 text-sm mt-1">Client Information Form</p>
        {templateName && <p className="text-blue-300 text-xs mt-0.5">{templateName}</p>}
      </div>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Form info */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <h2 className="font-bold text-blue-900 text-base">{caseLabel} — Case {dealNumber}</h2>
          <p className="text-blue-700 text-sm mt-1">
            Please complete all fields accurately. Fields marked with <span className="text-red-500">*</span> are required.
            You can save your progress and return later using the same link.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {sections.map(section => {
            const sectionFields = allFields.filter(f => (f.section || "General") === section);
            return (
              <div key={section} className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-base font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">{section}</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {sectionFields.map(field => {
                    const isWide = field.type === "textarea" || field.type === "checkbox" || field.type === "radio";
                    return (
                      <div key={field.id} className={isWide ? "sm:col-span-2" : ""}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-0.5">*</span>}
                        </label>
                        <FieldRenderer
                          field={field}
                          value={formData[field.id]}
                          onChange={handleChange}
                          onFileUpload={handleFileUpload}
                          uploading={uploadingField}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Declaration */}
          <div className="bg-gray-100 rounded-xl p-4 text-sm text-gray-600">
            <p><strong>Declaration:</strong> I declare that the information provided is true, accurate, and complete to the best of my knowledge. I understand that providing false or misleading information may result in the refusal or cancellation of my application.</p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-xl bg-blue-700 py-3.5 text-base font-bold text-white hover:bg-blue-800 disabled:opacity-60 transition-colors"
            >
              {isSubmitting ? "Submitting..." : "Submit Form"}
            </button>
            <button
              type="button"
              onClick={saveDraft}
              disabled={isSavingDraft}
              className="sm:w-auto rounded-xl border border-gray-300 bg-white py-3.5 px-6 text-base font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
            >
              {isSavingDraft ? "Saving..." : draftSaved ? "✓ Draft saved" : "Save Draft"}
            </button>
          </div>

          <p className="text-center text-xs text-gray-400">
            Your information is securely transmitted and used only for your immigration application.
          </p>
        </form>
      </main>
    </div>
  );
}
