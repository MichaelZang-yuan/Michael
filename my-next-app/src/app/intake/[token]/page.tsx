"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

// ─── Supabase client (anon, public) ──────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── Types ────────────────────────────────────────────────────────────────────

type Language = "en" | "zh" | "th";
type MultiLang = { en: string; zh?: string; th?: string };

type TemplateField = {
  id: string;
  type: string;
  label: MultiLang;
  required?: boolean;
  placeholder?: MultiLang;
  helpText?: MultiLang;
  options?: { value: string; label: MultiLang }[];
  condition?: { field: string; operator?: "eq" | "neq" | "in"; value: string | string[] };
  subfields?: string[];
  content?: MultiLang;
};

type TemplateSection = {
  id: string;
  title: MultiLang;
  description?: MultiLang;
  fields: TemplateField[];
};

type FormTemplate = { sections: TemplateSection[] };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function t(ml: MultiLang | undefined, lang: Language): string {
  if (!ml) return "";
  return ml[lang] ?? ml.en ?? "";
}

function checkCondition(
  condition: TemplateField["condition"],
  formData: Record<string, unknown>
): boolean {
  if (!condition) return true;
  const rawVal = formData[condition.field];
  const fieldVal = rawVal !== null && rawVal !== undefined ? String(rawVal) : "";
  if (condition.operator === "in") {
    const vals = Array.isArray(condition.value) ? condition.value : [condition.value];
    return vals.includes(fieldVal);
  }
  if (condition.operator === "neq") {
    return fieldVal !== String(condition.value);
  }
  return fieldVal === String(condition.value);
}

function calcProgress(sections: TemplateSection[], formData: Record<string, unknown>): number {
  let total = 0;
  let filled = 0;
  for (const section of sections) {
    for (const field of section.fields) {
      if (field.type === "heading" || field.type === "paragraph") continue;
      if (!checkCondition(field.condition, formData)) continue;
      if (!field.required) continue;
      total++;
      const val = formData[field.id];
      if (field.type === "name") {
        const obj = val as Record<string, string> | undefined;
        if (obj && (obj.first_name || obj.last_name)) filled++;
      } else if (field.type === "checkbox") {
        if (val === true) filled++;
      } else if (val !== undefined && val !== null && val !== "") {
        filled++;
      }
    }
  }
  return total === 0 ? 0 : Math.round((filled / total) * 100);
}

// ─── Signature Field ──────────────────────────────────────────────────────────

function SignatureField({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (value && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = value;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    isDrawing.current = true;
    lastPos.current = getPos(e);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
  };

  const stopDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    isDrawing.current = false;
    lastPos.current = null;
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL());
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  };

  return (
    <div>
      <div className="border-2 border-gray-300 rounded-lg bg-white overflow-hidden" style={{ touchAction: "none" }}>
        <canvas
          ref={canvasRef}
          width={600}
          height={150}
          className="w-full cursor-crosshair"
          style={{ touchAction: "none" }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1">Sign above using your mouse or finger</p>
      <button type="button" onClick={clear} className="mt-1 text-xs text-red-500 hover:text-red-700 underline">
        Clear signature
      </button>
      {value && <p className="text-xs text-green-600 mt-1">✓ Signature captured</p>}
    </div>
  );
}

// ─── Field Renderer ───────────────────────────────────────────────────────────

function FieldRenderer({
  field,
  value,
  onChange,
  lang,
  errors,
}: {
  field: TemplateField;
  value: unknown;
  onChange: (id: string, val: unknown) => void;
  lang: Language;
  errors: Record<string, string>;
}) {
  const strVal = (value as string) ?? "";
  const hasErr = !!errors[field.id];

  const baseInput = `w-full rounded-lg border px-4 py-2.5 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${hasErr ? "border-red-400" : "border-gray-300"}`;
  const label = t(field.label, lang);
  const placeholder = t(field.placeholder, lang);

  switch (field.type) {
    case "heading":
      return <h3 className="text-lg font-bold text-gray-900 mt-2">{t(field.content, lang) || label}</h3>;

    case "paragraph":
      return <p className="text-sm text-gray-600">{t(field.content, lang) || label}</p>;

    case "text":
      return (
        <input
          type="text"
          value={strVal}
          onChange={e => onChange(field.id, e.target.value)}
          className={baseInput}
          placeholder={placeholder}
          id={field.id}
        />
      );

    case "email":
      return (
        <input
          type="email"
          value={strVal}
          onChange={e => onChange(field.id, e.target.value)}
          className={baseInput}
          placeholder={placeholder || "email@example.com"}
          id={field.id}
        />
      );

    case "phone":
      return (
        <input
          type="tel"
          value={strVal}
          onChange={e => onChange(field.id, e.target.value)}
          className={baseInput}
          placeholder={placeholder || "+64 21 000 0000"}
          id={field.id}
        />
      );

    case "number":
      return (
        <input
          type="number"
          value={strVal}
          onChange={e => onChange(field.id, e.target.value)}
          className={baseInput}
          placeholder={placeholder}
          id={field.id}
        />
      );

    case "date":
      return (
        <input
          type="date"
          value={strVal}
          onChange={e => onChange(field.id, e.target.value)}
          className={baseInput}
          id={field.id}
        />
      );

    case "textarea":
      return (
        <textarea
          value={strVal}
          onChange={e => onChange(field.id, e.target.value)}
          rows={3}
          className={`${baseInput} resize-none`}
          placeholder={placeholder}
          id={field.id}
        />
      );

    case "select":
      return (
        <select
          value={strVal}
          onChange={e => onChange(field.id, e.target.value)}
          className={baseInput}
          id={field.id}
        >
          <option value="">
            {lang === "zh" ? "请选择..." : lang === "th" ? "กรุณาเลือก..." : "Select..."}
          </option>
          {(field.options ?? []).map(opt => (
            <option key={opt.value} value={opt.value}>{t(opt.label, lang)}</option>
          ))}
        </select>
      );

    case "radio":
      return (
        <div className="space-y-2">
          {(field.options ?? []).map(opt => (
            <label
              key={opt.value}
              className="flex items-center gap-3 cursor-pointer p-2.5 rounded-lg border border-transparent hover:bg-blue-50 hover:border-blue-200 transition-colors"
            >
              <input
                type="radio"
                name={field.id}
                value={opt.value}
                checked={strVal === opt.value}
                onChange={() => onChange(field.id, opt.value)}
                className="w-4 h-4 accent-blue-600 shrink-0"
              />
              <span className="text-sm text-gray-700">{t(opt.label, lang)}</span>
            </label>
          ))}
        </div>
      );

    case "checkbox": {
      // Boolean checkbox (no options) — for terms/declarations
      if (!field.options || field.options.length === 0) {
        const checked = value === true;
        return (
          <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-transparent hover:bg-blue-50 hover:border-blue-200 transition-colors">
            <input
              type="checkbox"
              checked={checked}
              onChange={e => onChange(field.id, e.target.checked)}
              className="w-5 h-5 accent-blue-600 shrink-0 mt-0.5"
              id={field.id}
            />
            <span className="text-sm text-gray-700">{label}</span>
          </label>
        );
      }
      // Multi-checkbox
      const arrVal = (value as string[]) ?? [];
      return (
        <div className="space-y-2">
          {field.options.map(opt => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-blue-50 transition-colors">
              <input
                type="checkbox"
                checked={arrVal.includes(opt.value)}
                onChange={e => {
                  const newVal = e.target.checked
                    ? [...arrVal, opt.value]
                    : arrVal.filter(v => v !== opt.value);
                  onChange(field.id, newVal);
                }}
                className="w-4 h-4 accent-blue-600 shrink-0"
              />
              <span className="text-sm text-gray-700">{t(opt.label, lang)}</span>
            </label>
          ))}
        </div>
      );
    }

    case "name": {
      const subfields = field.subfields ?? ["first_name", "last_name"];
      const nameVal = (value as Record<string, string>) ?? {};
      const subfieldLabels: Record<string, MultiLang> = {
        first_name: { en: "First Name", zh: "名", th: "ชื่อ" },
        middle_name: { en: "Middle Name", zh: "中间名", th: "ชื่อกลาง" },
        last_name: { en: "Last Name / Family Name", zh: "姓", th: "นามสกุล" },
      };
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {subfields.map(sf => (
            <div key={sf}>
              <label className="block text-xs text-gray-500 mb-1">{t(subfieldLabels[sf] ?? { en: sf }, lang)}</label>
              <input
                type="text"
                value={nameVal[sf] ?? ""}
                onChange={e => onChange(field.id, { ...nameVal, [sf]: e.target.value })}
                className={`w-full rounded-lg border px-3 py-2 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${hasErr ? "border-red-400" : "border-gray-300"}`}
                placeholder={t(subfieldLabels[sf] ?? { en: sf }, lang)}
              />
            </div>
          ))}
        </div>
      );
    }

    case "signature":
      return (
        <SignatureField
          value={strVal}
          onChange={val => onChange(field.id, val)}
        />
      );

    case "file": {
      return (
        <div>
          {strVal && (
            <a href={strVal} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline block mb-2">
              ✓ File uploaded — click to view
            </a>
          )}
          <label className="cursor-pointer inline-block rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
            {strVal ? "Replace file" : "Choose file"}
            <input
              type="file"
              className="hidden"
              onChange={async e => {
                const file = e.target.files?.[0];
                if (!file) return;
                // Basic upload via existing /api/upload route
                const fd = new FormData();
                fd.append("file", file);
                fd.append("type", "intake_forms");
                fd.append("id", field.id);
                const res = await fetch("/api/upload", { method: "POST", body: fd });
                if (res.ok) {
                  const json = await res.json();
                  onChange(field.id, json.url);
                }
                e.target.value = "";
              }}
            />
          </label>
        </div>
      );
    }

    default:
      return null;
  }
}

// ─── Language labels ──────────────────────────────────────────────────────────

const LANG_LABELS: Record<Language, string> = {
  en: "English",
  zh: "中文",
  th: "ไทย",
};

const SUBMIT_SUCCESS: Record<Language, { title: string; body: string }> = {
  en: { title: "Form Submitted!", body: "Thank you for completing your information form. Your consultant will review the information and be in touch with next steps." },
  zh: { title: "表单已提交！", body: "感谢您完成信息表格。您的顾问将审核这些信息，并就后续步骤与您联系。" },
  th: { title: "ส่งแบบฟอร์มเรียบร้อย!", body: "ขอบคุณที่กรอกแบบฟอร์มข้อมูลของคุณ ที่ปรึกษาของคุณจะตรวจสอบข้อมูลและติดต่อกลับเกี่ยวกับขั้นตอนถัดไป" },
};

const PREV_LABEL: Record<Language, string> = { en: "Previous", zh: "上一步", th: "ก่อนหน้า" };
const NEXT_LABEL: Record<Language, string> = { en: "Next", zh: "下一步", th: "ถัดไป" };
const SUBMIT_LABEL: Record<Language, string> = { en: "Submit Form", zh: "提交表单", th: "ส่งแบบฟอร์ม" };
const STEP_LABEL: Record<Language, string> = { en: "Step", zh: "第", th: "ขั้นตอน" };
const OF_LABEL: Record<Language, string> = { en: "of", zh: "/ 共", th: "จาก" };
const SAVED_LABEL: Record<Language, string> = { en: "Last saved", zh: "上次保存", th: "บันทึกล่าสุด" };
const REQUIRED_ERROR: Record<Language, string> = {
  en: "This field is required",
  zh: "此字段为必填",
  th: "กรุณากรอกข้อมูลในช่องนี้",
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function IntakeFormPage() {
  const params = useParams();
  const token = params.token as string;

  const [lang, setLang] = useState<Language>("en");
  const [sections, setSections] = useState<TemplateSection[]>([]);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formId, setFormId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [dealNumber, setDealNumber] = useState("");
  const [langOptions, setLangOptions] = useState<Language[]>(["en"]);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Load form ────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function loadForm() {
      const res = await fetch(`/api/intake/${token}`);
      if (!res.ok) {
        if (res.status === 404) setLoadError("This form link is invalid or has expired.");
        else setLoadError("Failed to load the form. Please try again later.");
        setIsLoading(false);
        return;
      }
      const json = await res.json();

      if (json.status === "submitted" || json.status === "completed") {
        setIsSubmitted(true);
        setFormId(json.form?.id ?? null);
        setDealNumber(json.form?.deal?.deal_number ?? json.deal?.deal_number ?? "");
        setIsLoading(false);
        return;
      }

      const form = json.form;
      const template = json.template;
      const deal = json.deal;

      setFormId(form.id);
      setDealNumber(deal?.deal_number ?? "");

      if (form.language && ["en", "zh", "th"].includes(form.language)) {
        setLang(form.language as Language);
      }
      if (form.last_saved_at) setLastSavedAt(form.last_saved_at);

      // Set template structure
      if (template?.fields?.sections) {
        setSections(template.fields.sections as TemplateSection[]);
        setTemplateName(template.name ?? "");
        const opts = (template.language_options as Language[]) ?? ["en"];
        setLangOptions(opts);
      } else {
        // Fallback if no new-style template
        setSections([]);
        setTemplateName("");
      }

      // Load draft data (prefer draft_data over form_data)
      const savedData = form.draft_data || form.form_data || {};
      if (savedData && Object.keys(savedData).length > 0) {
        setFormData(savedData as Record<string, unknown>);
      }

      setIsLoading(false);
    }
    loadForm();
  }, [token]);

  // ── Save draft ───────────────────────────────────────────────────────────────

  const saveDraft = useCallback(async (data: Record<string, unknown>, currentLang: Language, sectionIdx: number) => {
    if (!formId) return;
    setIsSaving(true);
    const progress = sections.length > 0
      ? calcProgress(sections, data)
      : Math.round(((sectionIdx + 1) / Math.max(sections.length, 1)) * 100);

    const res = await fetch(`/api/intake/${token}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draft_data: data, language: currentLang, progress }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.last_saved_at) setLastSavedAt(json.last_saved_at);
    }
    setIsSaving(false);
  }, [formId, token, sections]);

  // ── Field change ─────────────────────────────────────────────────────────────

  const handleChange = useCallback((id: string, val: unknown) => {
    setFormData(prev => ({ ...prev, [id]: val }));
    setErrors(prev => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  // ── Validate current section ─────────────────────────────────────────────────

  const validateSection = useCallback((sectionIdx: number, data: Record<string, unknown>): Record<string, string> => {
    if (!sections[sectionIdx]) return {};
    const errs: Record<string, string> = {};
    for (const field of sections[sectionIdx].fields) {
      if (field.type === "heading" || field.type === "paragraph") continue;
      if (!field.required) continue;
      if (!checkCondition(field.condition, data)) continue;

      const val = data[field.id];
      let missing = false;

      if (field.type === "name") {
        const obj = val as Record<string, string> | undefined;
        if (!obj || (!obj.first_name && !obj.last_name)) missing = true;
      } else if (field.type === "checkbox" && (!field.options || field.options.length === 0)) {
        if (val !== true) missing = true;
      } else if (val === undefined || val === null || val === "") {
        missing = true;
      }

      if (missing) errs[field.id] = REQUIRED_ERROR[lang];
    }
    return errs;
  }, [sections, lang]);

  // ── Navigate ─────────────────────────────────────────────────────────────────

  const handleNext = async () => {
    const sectionErrs = validateSection(currentSectionIdx, formData);
    if (Object.keys(sectionErrs).length > 0) {
      setErrors(sectionErrs);
      // Scroll to first error
      const firstErrId = Object.keys(sectionErrs)[0];
      document.getElementById(firstErrId)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setErrors({});
    await saveDraft(formData, lang, currentSectionIdx + 1);
    setCurrentSectionIdx(i => i + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePrev = async () => {
    setErrors({});
    await saveDraft(formData, lang, currentSectionIdx - 1);
    setCurrentSectionIdx(i => i - 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Submit ───────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    // Validate all sections
    const allErrs: Record<string, string> = {};
    for (let i = 0; i < sections.length; i++) {
      const errs = validateSection(i, formData);
      Object.assign(allErrs, errs);
    }
    // Also validate current section specifically
    const currentErrs = validateSection(currentSectionIdx, formData);
    Object.assign(allErrs, currentErrs);

    if (Object.keys(allErrs).length > 0) {
      setErrors(allErrs);
      const firstErrId = Object.keys(allErrs)[0];
      document.getElementById(firstErrId)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const res = await fetch(`/api/intake/${token}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: formData, language: lang }),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setSubmitError(json.error ?? "Failed to submit. Please try again.");
      setIsSubmitting(false);
      return;
    }

    setIsSubmitted(true);
    setIsSubmitting(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Language switch ──────────────────────────────────────────────────────────

  const handleLangSwitch = (newLang: Language) => {
    setLang(newLang);
    // Save language preference (fire and forget)
    if (formId) {
      fetch(`/api/intake/${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: newLang }),
      }).catch(() => {});
    }
  };

  // ── Visible sections (skip empty after condition filtering) ──────────────────

  const visibleSections = sections; // All sections shown; fields may be hidden by conditions
  const totalSections = visibleSections.length;
  const currentSection = visibleSections[currentSectionIdx];
  const isLastSection = currentSectionIdx === totalSections - 1;
  const progress = totalSections > 0 ? Math.round(((currentSectionIdx + 1) / totalSections) * 100) : 0;

  // ── Render: Loading ───────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading form...</p>
        </div>
      </div>
    );
  }

  // ── Render: Error ─────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Form Not Found</h1>
          <p className="text-gray-600">{loadError}</p>
        </div>
      </div>
    );
  }

  // ── Render: Submitted ─────────────────────────────────────────────────────────

  if (isSubmitted) {
    const msg = SUBMIT_SUCCESS[lang];
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">{msg.title}</h1>
          <p className="text-gray-600 mb-4">{msg.body}</p>
          {dealNumber && <p className="text-sm text-gray-400">Case Reference: {dealNumber}</p>}
        </div>
      </div>
    );
  }

  // ── Render: No template ───────────────────────────────────────────────────────

  if (sections.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">📋</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Form Configuration Error</h1>
          <p className="text-gray-600">This form does not have a valid template configured. Please contact your consultant.</p>
        </div>
      </div>
    );
  }

  // ── Render: Form ──────────────────────────────────────────────────────────────

  const visibleFields = currentSection
    ? currentSection.fields.filter(f =>
        f.type !== "heading" && f.type !== "paragraph"
          ? checkCondition(f.condition, formData)
          : true
      )
    : [];

  const formatSavedAt = (iso: string | null) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-blue-900 text-white py-5 px-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold leading-tight">PJ Operation & Management</h1>
            {templateName && <p className="text-blue-300 text-xs mt-0.5">{templateName}</p>}
          </div>
          {/* Language switcher */}
          {langOptions.length > 1 && (
            <div className="flex gap-1">
              {langOptions.filter(l => ["en", "zh", "th"].includes(l)).map(l => (
                <button
                  key={l}
                  onClick={() => handleLangSwitch(l as Language)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${lang === l ? "bg-white text-blue-900" : "text-blue-200 hover:text-white hover:bg-white/10"}`}
                >
                  {LANG_LABELS[l as Language]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500">
              {STEP_LABEL[lang]} {currentSectionIdx + 1} {OF_LABEL[lang]} {totalSections}
              {currentSection && (
                <span className="ml-2 text-gray-700 font-medium">{t(currentSection.title, lang)}</span>
              )}
            </p>
            <p className="text-xs text-gray-400">{progress}%</p>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          {lastSavedAt && (
            <p className="text-xs text-gray-400 mt-1">
              {SAVED_LABEL[lang]}: {formatSavedAt(lastSavedAt)}
              {isSaving && <span className="ml-2 text-blue-500">saving...</span>}
            </p>
          )}
        </div>
      </div>

      {/* ── Form body ── */}
      <main className="max-w-2xl mx-auto px-4 py-6 pb-32">
        {currentSection && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Section header */}
            <div className="bg-blue-50 border-b border-blue-100 px-6 py-4">
              <h2 className="text-lg font-bold text-blue-900">{t(currentSection.title, lang)}</h2>
              {currentSection.description && (
                <p className="text-sm text-blue-700 mt-1">{t(currentSection.description, lang)}</p>
              )}
            </div>

            {/* Fields */}
            <div className="px-6 py-5 space-y-5">
              {submitError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
                  {submitError}
                </div>
              )}

              {visibleFields.map(field => {
                if (field.type === "heading") {
                  return (
                    <h3 key={field.id} className="text-base font-bold text-gray-900 pt-2 border-t border-gray-100">
                      {t(field.content ?? field.label, lang)}
                    </h3>
                  );
                }
                if (field.type === "paragraph") {
                  return (
                    <p key={field.id} className="text-sm text-gray-600 italic">
                      {t(field.content ?? field.label, lang)}
                    </p>
                  );
                }

                // For checkbox with no options — the label IS the checkbox text, render inline
                const isInlineCheckbox = field.type === "checkbox" && (!field.options || field.options.length === 0);

                return (
                  <div key={field.id} id={`field-wrap-${field.id}`}>
                    {!isInlineCheckbox && (
                      <label htmlFor={field.id} className="block text-sm font-medium text-gray-700 mb-1.5">
                        {t(field.label, lang)}
                        {field.required && <span className="text-red-500 ml-0.5">*</span>}
                      </label>
                    )}
                    {field.helpText && (
                      <p className="text-xs text-gray-500 mb-2">{t(field.helpText, lang)}</p>
                    )}
                    <FieldRenderer
                      field={field}
                      value={formData[field.id]}
                      onChange={handleChange}
                      lang={lang}
                      errors={errors}
                    />
                    {errors[field.id] && (
                      <p className="text-xs text-red-500 mt-1">{errors[field.id]}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Navigation ── */}
        <div className="mt-6 flex gap-3">
          {currentSectionIdx > 0 && (
            <button
              onClick={handlePrev}
              disabled={isSaving || isSubmitting}
              className="flex-1 sm:flex-none rounded-xl border-2 border-gray-300 bg-white py-3.5 px-6 text-base font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              ← {PREV_LABEL[lang]}
            </button>
          )}
          <button
            onClick={isLastSection ? handleSubmit : handleNext}
            disabled={isSaving || isSubmitting}
            className={`flex-1 rounded-xl py-3.5 px-6 text-base font-bold text-white transition-colors disabled:opacity-50 ${isLastSection ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"}`}
          >
            {isSubmitting
              ? (lang === "zh" ? "提交中..." : lang === "th" ? "กำลังส่ง..." : "Submitting...")
              : isLastSection
                ? SUBMIT_LABEL[lang]
                : `${NEXT_LABEL[lang]} →`}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          {lang === "zh"
            ? "您的信息将被安全传输，仅用于移民申请。"
            : lang === "th"
              ? "ข้อมูลของคุณถูกส่งอย่างปลอดภัยและใช้เพื่อการยื่นขอวีซ่าเท่านั้น"
              : "Your information is securely transmitted and used only for your immigration application."}
        </p>
      </main>
    </div>
  );
}
