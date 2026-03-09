"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import { logActivity } from "@/lib/activityLog";

// ─── Types ───────────────────────────────────────────────────────────────────

type AttachmentFile = { name: string; url: string; createdAt: string | null };
type ActivityLog = { id: string; action: string; details: Record<string, unknown> | null; created_at: string; user_id: string };
type Applicant = { id: string; contact_id: string; relationship: string | null; notes: string | null; contacts: { first_name: string; last_name: string } | null };
type ContactSearch = { id: string; first_name: string; last_name: string };
type SalesUser = { id: string; full_name: string | null };
type Agent = { id: string; agent_name: string };

type DealPayment = {
  id: string;
  payment_type: string | null;
  description: string | null;
  amount: number;
  due_date: string | null;
  status: string;
  paid_date: string | null;
  payment_method: string | null;
  receipt_sent: boolean;
  notes: string | null;
};

type DealContract = {
  id: string;
  contract_number: string | null;
  contract_type: string | null;
  status: string;
  sent_date: string | null;
  client_signed_date: string | null;
  lia_signed_date: string | null;
  completed_date: string | null;
  contract_file_url: string | null;
  signed_file_url: string | null;
  notes: string | null;
  content: string | null;
  template_id: string | null;
  rejected_reason: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  adviser_signature: string | null;
  adviser_signed_at: string | null;
  adviser_signed_by: string | null;
  client_signature: string | null;
  client_signed_at: string | null;
  client_sign_token: string | null;
  language: string | null;
  contract_html: string | null;
};

type ContractTemplate = {
  id: string;
  name: string;
  language: string | null;
  target_type: string | null;
  content: string | null;
  is_active: boolean;
};

type IntakeTemplate = {
  id: string;
  name: string;
  form_type: string | null;
  language: string | null;
  category: string | null;
  is_active: boolean;
};

type IntakeForm = {
  id: string;
  form_type: string | null;
  unique_token: string | null;
  status: string;
  sent_date: string | null;
  completed_date: string | null;
  submitted_at: string | null;
  last_saved_at: string | null;
  form_data: Record<string, unknown>;
  draft_data: Record<string, unknown> | null;
  contact_id: string | null;
  company_id: string | null;
  template_id: string | null;
  client_name: string | null;
  client_email: string | null;
  progress: number | null;
  language: string | null;
};

type ChecklistItem = {
  id: string;
  item_name: string | null;
  required: boolean;
  uploaded: boolean;
  file_url: string | null;
  notes: string | null;
};

type EmailLog = {
  id: string;
  created_at: string;
  email_type: string | null;
  recipient_email: string | null;
  recipient_name: string | null;
  subject: string | null;
  status: string | null;
};

type PaymentForm = {
  payment_type: string;
  description: string;
  amount: string;
  due_date: string;
  notes: string;
};

type EmailConfirm = {
  recipientName: string;
  recipientEmail: string;
  emailType: string;
  extraData?: Record<string, unknown>;
  onConfirm: () => void;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const DEAL_STATUS_LABELS: Record<string, string> = {
  draft: "Draft", quoted: "Quoted", contracted: "Contracted", in_progress: "In Progress",
  submitted: "Submitted", approved: "Approved", declined: "Declined",
  completed: "Completed", cancelled: "Cancelled",
};

const DEAL_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-500/20 text-gray-400", quoted: "bg-blue-500/20 text-blue-400",
  contracted: "bg-purple-500/20 text-purple-400", in_progress: "bg-yellow-500/20 text-yellow-400",
  submitted: "bg-orange-500/20 text-orange-400", approved: "bg-green-500/20 text-green-400",
  declined: "bg-red-500/20 text-red-400", completed: "bg-green-600/20 text-green-300",
  cancelled: "bg-red-600/20 text-red-300",
};

const CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent_to_lia: "Pending LIA Review",
  lia_signed: "LIA Approved",
  rejected: "Rejected by LIA",
  sent_to_client: "Sent to Client",
  completed: "Signed & Completed",
  cancelled: "Cancelled",
};

const INTAKE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft", sent: "Sent to Client", in_progress: "In Progress", completed: "Completed", submitted: "Submitted",
};

const INTAKE_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-500/20 text-gray-400",
  sent: "bg-blue-500/20 text-blue-400",
  in_progress: "bg-yellow-500/20 text-yellow-400",
  submitted: "bg-green-500/20 text-green-400",
  completed: "bg-green-500/20 text-green-400",
};

const EMAIL_TYPE_LABELS: Record<string, string> = {
  welcome: "Welcome", contract_sent: "Contract Sent", contract_signed: "Contract Signed",
  intake_form_sent: "Intake Form Sent", intake_completed: "Intake Completed",
  payment_received: "Payment Received", application_submitted: "Application Submitted",
  application_approved: "Application Approved", application_declined: "Application Declined",
};

const CHECKLIST_PRESETS: Record<string, string[]> = {
  AEWV: ["Passport", "Job Offer Letter", "Employment Agreement", "Qualification Certificate", "English Test Result", "Medical Certificate"],
  SV: ["Passport", "Offer Letter", "Financial Evidence", "Health Insurance", "English Test Result"],
  RV: ["Passport", "Employment Evidence", "Tax Records", "Character Certificate", "Medical Certificate"],
  WV: ["Passport", "Job Offer Letter", "Employment Agreement"],
  Partnership: ["Passport", "Relationship Evidence", "Shared Financial Evidence", "Photos Together"],
  SMC: ["Passport", "Skills Assessment", "IELTS/English Test", "Employment Records", "Qualifications"],
};

const STATUS_PREV: Record<string, string> = {
  quoted: "draft", contracted: "draft", in_progress: "contracted",
  submitted: "in_progress", approved: "submitted", declined: "submitted",
};

// ─── Workflow step computation ────────────────────────────────────────────────

const WORKFLOW_STEPS = [
  { key: "draft", label: "Draft" },
  { key: "contract_sent", label: "Contract Sent" },
  { key: "contract_signed", label: "Contract Signed" },
  { key: "intake_sent", label: "Intake Sent" },
  { key: "in_progress", label: "In Progress" },
  { key: "submitted", label: "Submitted" },
  { key: "resolved", label: "Approved / Declined" },
];

function computeWorkflowStep(dealStatus: string, contract: DealContract | null, intake: IntakeForm | null): number {
  if (["approved", "declined", "completed", "cancelled"].includes(dealStatus)) return 6;
  if (dealStatus === "submitted") return 5;
  if (dealStatus === "in_progress") return 4;
  if (intake && ["sent", "in_progress", "completed", "submitted"].includes(intake.status)) return 3;
  if (contract && contract.status === "completed") return 2;
  if (contract && ["sent_to_lia", "lia_signed", "sent_to_client"].includes(contract.status)) return 1;
  if (dealStatus === "contracted") return 1;
  return 0;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DealDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  // Core deal state
  const [profile, setProfile] = useState<{ role: string; id: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);

  const [deal, setDeal] = useState<{
    deal_number: string | null;
    deal_type: string | null;
    status: string;
    payment_status: string;
    contact_id: string | null;
    company_id: string | null;
    agent_id: string | null;
    assigned_lia_id: string | null;
    assigned_sales_id: string | null;
    contacts: { first_name: string; last_name: string; email: string | null; phone: string | null; address: string | null; passport_number: string | null; nationality: string | null; date_of_birth: string | null } | null;
    companies: { company_name: string; email: string | null; address: string | null } | null;
  } | null>(null);

  const [form, setForm] = useState({
    deal_type: "individual_visa", visa_type: "", description: "", service_fee: "",
    inz_application_fee: "", other_fee: "", payment_status: "unpaid",
    assigned_sales_id: "", assigned_lia_id: "", agent_id: "", department: "",
    submitted_date: "", approved_date: "", declined_date: "", notes: "",
    preferred_language: "en", refund_percentage: "50",
  });
  const [initialForm, setInitialForm] = useState("");

  // New section data
  const [payments, setPayments] = useState<DealPayment[]>([]);
  const [contract, setContract] = useState<DealContract | null>(null);
  const [intakeForm, setIntakeForm] = useState<IntakeForm | null>(null);
  const [intakeForms, setIntakeForms] = useState<IntakeForm[]>([]);
  const [viewingIntakeFormId, setViewingIntakeFormId] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);

  // Existing section data
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  // UI state — Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editPayment, setEditPayment] = useState<DealPayment | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>({ payment_type: "service_fee", description: "", amount: "", due_date: "", notes: "" });
  const [showMarkPaidModal, setShowMarkPaidModal] = useState<string | null>(null);
  const [markPaidForm, setMarkPaidForm] = useState({ paid_date: new Date().toISOString().split("T")[0], payment_method: "bank_transfer" });
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  // UI state — Contract
  const [isContractChanging, setIsContractChanging] = useState(false);
  const [showContractIntakePrompt, setShowContractIntakePrompt] = useState(false);
  const [contractTemplates, setContractTemplates] = useState<ContractTemplate[]>([]);
  const [intakeTemplates, setIntakeTemplates] = useState<IntakeTemplate[]>([]);
  const [showContractCreateModal, setShowContractCreateModal] = useState(false);
  const [selectedContractTemplateId, setSelectedContractTemplateId] = useState("");
  const [contractContent, setContractContent] = useState("");
  const [contractPreviewMode, setContractPreviewMode] = useState(false);
  const [isContractCreating, setIsContractCreating] = useState(false);
  const [showIntakeCreateModal, setShowIntakeCreateModal] = useState(false);
  const [selectedIntakeTemplateId, setSelectedIntakeTemplateId] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // UI state — Checklist
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [checklistName, setChecklistName] = useState("");
  const [checklistRequired, setChecklistRequired] = useState(true);
  const [uploadingChecklist, setUploadingChecklist] = useState<string | null>(null);

  // UI state — Applicants
  const [showApplicantModal, setShowApplicantModal] = useState(false);
  const [applicantSearch, setApplicantSearch] = useState("");
  const [applicantResults, setApplicantResults] = useState<ContactSearch[]>([]);
  const [newApplicant, setNewApplicant] = useState({ contact_id: "", relationship: "main", notes: "" });

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [isStatusChanging, setIsStatusChanging] = useState(false);

  // Email confirm modal
  const [emailConfirm, setEmailConfirm] = useState<EmailConfirm | null>(null);

  // ─── Computed values ─────────────────────────────────────────────────────────

  const totalFees = (parseFloat(form.service_fee) || 0) + (parseFloat(form.inz_application_fee) || 0) + (parseFloat(form.other_fee) || 0);
  const totalDuePayments = payments.reduce((s, p) => s + p.amount, 0);
  const totalPaidPayments = payments.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const outstanding = totalDuePayments - totalPaidPayments;

  const pendingServiceFee = payments.some(p => p.payment_type === "service_fee" && p.status === "pending");
  const pendingGovFee = payments.some(p => p.payment_type === "inz_application_fee" && p.status === "pending");

  const currentStatus = deal?.status ?? "draft";
  const workflowStep = computeWorkflowStep(currentStatus, contract, intakeForm);
  const isTerminal = ["approved", "declined", "completed", "cancelled"].includes(currentStatus);
  const isAdmin = profile?.role === "admin";
  const canChangeStatus = isAdmin || (deal?.assigned_lia_id === profile?.id);

  const clientName = deal?.contacts
    ? `${deal.contacts.first_name} ${deal.contacts.last_name}`
    : deal?.companies?.company_name ?? "—";
  const clientEmail = deal?.contacts?.email ?? deal?.companies?.email ?? "";

  const hasUnsavedChanges = JSON.stringify(form) !== initialForm;

  // ─── Fetch functions ─────────────────────────────────────────────────────────

  const fetchPayments = useCallback(async () => {
    const { data } = await supabase.from("deal_payments").select("*").eq("deal_id", id).order("created_at");
    if (data) setPayments(data as DealPayment[]);
  }, [id]);

  const fetchContract = useCallback(async () => {
    const { data } = await supabase.from("deal_contracts").select("*").eq("deal_id", id).order("created_at").limit(1).maybeSingle();
    setContract(data as DealContract | null);
  }, [id]);

  const fetchIntakeForm = useCallback(async () => {
    const { data } = await supabase.from("intake_forms").select("*").eq("deal_id", id).order("created_at", { ascending: false });
    if (data && data.length > 0) {
      setIntakeForm(data[0] as IntakeForm);
      setIntakeForms(data as IntakeForm[]);
    } else {
      setIntakeForm(null);
      setIntakeForms([]);
    }
  }, [id]);

  const fetchChecklist = useCallback(async () => {
    const { data } = await supabase.from("document_checklists").select("*").eq("deal_id", id).order("created_at");
    if (data) setChecklist(data as ChecklistItem[]);
  }, [id]);

  const fetchEmailLogs = useCallback(async () => {
    const { data } = await supabase.from("email_logs")
      .select("id, created_at, email_type, recipient_email, recipient_name, subject, status")
      .eq("deal_id", id).order("created_at", { ascending: false });
    if (data) setEmailLogs(data as EmailLog[]);
  }, [id]);

  const fetchAttachments = useCallback(async () => {
    const res = await fetch(`/api/attachments?type=deals&id=${id}`);
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

  const fetchApplicants = useCallback(async () => {
    const { data } = await supabase.from("deal_applicants")
      .select("id, contact_id, relationship, notes, contacts(first_name, last_name)").eq("deal_id", id);
    if (data) setApplicants(data as unknown as Applicant[]);
  }, [id]);

  // ─── Init ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/admin"); return; }

      const { data: profileData } = await supabase.from("profiles").select("id, role").eq("id", session.user.id).single();
      if (profileData) setProfile(profileData);

      const { data: salesData } = await supabase.from("profiles").select("id, full_name").in("role", ["admin", "sales", "lia"]).order("full_name");
      if (salesData) setSalesUsers(salesData as SalesUser[]);

      const { data: agentsData } = await supabase.from("agents").select("id, agent_name").order("agent_name");
      if (agentsData) setAgents(agentsData as Agent[]);

      const { data: ctData } = await supabase.from("contract_templates").select("id, name, language, target_type, content, is_active").eq("is_active", true).order("name");
      if (ctData) setContractTemplates(ctData as ContractTemplate[]);

      const { data: itData } = await supabase.from("intake_form_templates").select("id, name, form_type, language, category, is_active").eq("is_active", true).order("name");
      if (itData) setIntakeTemplates(itData as IntakeTemplate[]);

      // Try full query first (with extended contact fields for placeholder filling)
      let { data: dealData, error: dealError } = await supabase.from("deals")
        .select("*, contacts(first_name, last_name, email, phone, address, passport_number, nationality, date_of_birth), companies(company_name, email, address)")
        .eq("id", id).single();

      // If query errored (not just "no rows"), fall back to a minimal select
      if (!dealData && dealError && dealError.code !== "PGRST116") {
        const fallback = await supabase.from("deals")
          .select("*, contacts(first_name, last_name, email), companies(company_name, email)")
          .eq("id", id).single();
        dealData = fallback.data;
        dealError = fallback.error;
      }

      // Only redirect for genuine "not found" — show error for everything else
      if (!dealData) {
        if (dealError?.code === "PGRST116") {
          router.push("/deals"); return;
        }
        setMessage({ type: "error", text: dealError?.message ?? "Failed to load deal data." });
        setIsLoading(false);
        return;
      }

      setDeal({
        deal_number: dealData.deal_number,
        deal_type: dealData.deal_type,
        status: dealData.status,
        payment_status: dealData.payment_status,
        contact_id: dealData.contact_id,
        company_id: dealData.company_id,
        agent_id: dealData.agent_id,
        assigned_lia_id: dealData.assigned_lia_id,
        assigned_sales_id: dealData.assigned_sales_id,
        contacts: dealData.contacts as { first_name: string; last_name: string; email: string | null; phone: string | null; address: string | null; passport_number: string | null; nationality: string | null; date_of_birth: string | null } | null,
        companies: dealData.companies as { company_name: string; email: string | null; address: string | null } | null,
      });

      const lf = {
        deal_type: dealData.deal_type ?? "individual_visa",
        visa_type: dealData.visa_type ?? "",
        description: dealData.description ?? "",
        service_fee: dealData.service_fee != null ? String(dealData.service_fee) : "",
        inz_application_fee: dealData.inz_application_fee != null ? String(dealData.inz_application_fee) : "",
        other_fee: dealData.other_fee != null ? String(dealData.other_fee) : "",
        payment_status: dealData.payment_status ?? "unpaid",
        assigned_sales_id: dealData.assigned_sales_id ?? "",
        assigned_lia_id: dealData.assigned_lia_id ?? "",
        agent_id: dealData.agent_id ?? "",
        department: dealData.department ?? "",
        submitted_date: dealData.submitted_date ?? "",
        approved_date: dealData.approved_date ?? "",
        declined_date: dealData.declined_date ?? "",
        notes: dealData.notes ?? "",
        preferred_language: dealData.preferred_language ?? "en",
        refund_percentage: dealData.refund_percentage != null ? String(dealData.refund_percentage) : "50",
      };
      setForm(lf);
      setInitialForm(JSON.stringify(lf));

      await Promise.all([
        fetchPayments(), fetchContract(), fetchIntakeForm(), fetchChecklist(),
        fetchEmailLogs(), fetchApplicants(), fetchAttachments(), fetchLogs(),
      ]);
      setIsLoading(false);
    }
    init();
  }, [id, router, fetchPayments, fetchContract, fetchIntakeForm, fetchChecklist, fetchEmailLogs, fetchApplicants, fetchAttachments, fetchLogs]);

  // ─── Helper: send notification ────────────────────────────────────────────

  const sendNotification = async (emailType: string, recipientEmail: string, recipientName: string, extraData?: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    await fetch("/api/send-notification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email_type: emailType,
        deal_id: id,
        recipient_email: recipientEmail,
        recipient_name: recipientName,
        extra_data: { deal_number: deal?.deal_number, ...extraData },
        sent_by: session?.user.id,
      }),
    });
    await fetchEmailLogs();
  };

  const requestEmailConfirm = (config: EmailConfirm) => setEmailConfirm(config);

  // ─── Placeholder helpers ──────────────────────────────────────────────────

  const fillPlaceholders = (content: string, data: Record<string, string>): string =>
    content.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? `{{${key}}}`);

  const buildPlaceholderData = (): Record<string, string> => {
    const today = new Date().toLocaleDateString("en-NZ", { year: "numeric", month: "long", day: "numeric" });
    const contact = deal?.contacts;
    const company = deal?.companies;
    const salesPerson = salesUsers.find(s => s.id === form.assigned_sales_id);
    const liaPerson = salesUsers.find(s => s.id === form.assigned_lia_id);
    const totalAmount = (parseFloat(form.service_fee) || 0) + (parseFloat(form.inz_application_fee) || 0) + (parseFloat(form.other_fee) || 0);
    const fmtAmt = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const paymentStagesHtml = payments.length > 0
      ? `<table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr><th style="text-align:left;padding:4px 8px;border-bottom:1px solid #ccc;">Stage</th><th style="text-align:right;padding:4px 8px;border-bottom:1px solid #ccc;">Amount</th></tr></thead><tbody>${payments.map(p => `<tr><td style="padding:4px 8px;">${p.description ?? p.payment_type ?? "Payment"}</td><td style="text-align:right;padding:4px 8px;">${fmtAmt(p.amount)}</td></tr>`).join("")}</tbody></table>`
      : "";
    return {
      date: today,
      client_name: contact ? `${contact.first_name} ${contact.last_name}` : (company?.company_name ?? ""),
      client_email: contact?.email ?? company?.email ?? "",
      client_mobile: contact?.phone ?? "",
      client_phone: contact?.phone ?? "",
      client_address: contact?.address ?? company?.address ?? "",
      client_family_name: contact?.last_name ?? "",
      client_first_name: contact?.first_name ?? "",
      client_family_members: "",
      client_passport: contact?.passport_number ?? "",
      client_nationality: contact?.nationality ?? "",
      client_dob: contact?.date_of_birth ?? "",
      company_name: company?.company_name ?? "",
      company_address: company?.address ?? "",
      deal_number: deal?.deal_number ?? "",
      deal_type: form.deal_type?.replace(/_/g, " ") ?? "",
      service_type: form.visa_type ? `${form.visa_type} Visa` : (form.deal_type?.replace(/_/g, " ") ?? ""),
      visa_type: form.visa_type ?? "",
      service_fee: form.service_fee ? fmtAmt(parseFloat(form.service_fee)) : "",
      total_service_fee: form.service_fee ? fmtAmt(parseFloat(form.service_fee)) : "",
      inz_application_fee: form.inz_application_fee ? fmtAmt(parseFloat(form.inz_application_fee)) : "TBA",
      government_fee: form.inz_application_fee ? fmtAmt(parseFloat(form.inz_application_fee)) : "TBA",
      total_amount: totalAmount > 0 ? fmtAmt(totalAmount) : "",
      currency: "NZ",
      refund_percentage: form.refund_percentage || "50",
      payment_stages_table: paymentStagesHtml,
      lia_name: liaPerson?.full_name ?? "",
      sales_name: salesPerson?.full_name ?? "",
      date_today: today,
      signature_client: "________________________",
      signature_lia: "________________________",
      adviser_sign_date: "___________________",
      client_sign_date: "___________________",
    };
  };

  // ─── Deal CRUD ────────────────────────────────────────────────────────────

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    setIsSaving(true); setMessage(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const clean = (v: string) => v.trim() || null;
    const payload = {
      deal_type: form.deal_type || null,
      visa_type: form.deal_type === "individual_visa" ? (clean(form.visa_type)) : null,
      description: clean(form.description),
      service_fee: form.service_fee ? parseFloat(form.service_fee) : null,
      inz_application_fee: form.inz_application_fee ? parseFloat(form.inz_application_fee) : null,
      other_fee: form.other_fee ? parseFloat(form.other_fee) : null,
      preferred_language: form.preferred_language || "en",
      refund_percentage: form.refund_percentage ? parseInt(form.refund_percentage) : 50,
      total_amount: totalFees > 0 ? totalFees : null,
      payment_status: form.payment_status,
      assigned_sales_id: form.assigned_sales_id || null,
      assigned_lia_id: form.assigned_lia_id || null,
      agent_id: form.agent_id || null,
      department: form.department || null,
      submitted_date: form.submitted_date || null,
      approved_date: form.approved_date || null,
      declined_date: form.declined_date || null,
      notes: clean(form.notes),
    };
    const { error } = await supabase.from("deals").update(payload).eq("id", id);
    if (error) { setMessage({ type: "error", text: error.message }); }
    else {
      setInitialForm(JSON.stringify(form));
      setMessage({ type: "success", text: "Deal saved." });
      await logActivity(supabase, session.user.id, "updated_deal", "deals", id, { deal_number: deal?.deal_number });
      await fetchLogs();
    }
    setIsSaving(false);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!canChangeStatus) { setMessage({ type: "error", text: "You do not have permission to change deal status." }); return; }
    setIsStatusChanging(true); setMessage(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const extra: Record<string, unknown> = {};
    const today = new Date().toISOString().split("T")[0];
    if (newStatus === "submitted") extra.submitted_date = today;
    if (newStatus === "approved") extra.approved_date = today;
    if (newStatus === "declined") extra.declined_date = today;
    const { error } = await supabase.from("deals").update({ status: newStatus, ...extra }).eq("id", id);
    if (error) { setMessage({ type: "error", text: error.message }); }
    else {
      setDeal(d => d ? { ...d, status: newStatus } : d);
      if (newStatus === "submitted") setForm(f => ({ ...f, submitted_date: today }));
      if (newStatus === "approved") setForm(f => ({ ...f, approved_date: today }));
      if (newStatus === "declined") setForm(f => ({ ...f, declined_date: today }));
      setMessage({ type: "success", text: `Status updated to ${DEAL_STATUS_LABELS[newStatus]}.` });
      await logActivity(supabase, session.user.id, "deal_status_changed", "deals", id, { from: currentStatus, to: newStatus, deal_number: deal?.deal_number });
      await fetchLogs();
    }
    setIsStatusChanging(false);
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete deal ${deal?.deal_number ?? id}?`)) return;
    setIsDeleting(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { error } = await supabase.from("deals").delete().eq("id", id);
    if (error) { setMessage({ type: "error", text: error.message }); setIsDeleting(false); return; }
    await logActivity(supabase, session.user.id, "deleted_deal", "deals", id, { deal_number: deal?.deal_number });
    router.push("/deals");
  };

  // ─── Payment handlers ─────────────────────────────────────────────────────

  const openAddPayment = () => {
    setEditPayment(null);
    setPaymentForm({ payment_type: "service_fee", description: "", amount: "", due_date: "", notes: "" });
    setShowPaymentModal(true);
  };

  const openEditPayment = (p: DealPayment) => {
    setEditPayment(p);
    setPaymentForm({ payment_type: p.payment_type ?? "other", description: p.description ?? "", amount: String(p.amount), due_date: p.due_date ?? "", notes: p.notes ?? "" });
    setShowPaymentModal(true);
  };

  const handleSavePayment = async () => {
    if (!paymentForm.amount) return;
    setIsSavingPayment(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const payload = {
      payment_type: paymentForm.payment_type || null,
      description: paymentForm.description.trim() || null,
      amount: parseFloat(paymentForm.amount),
      due_date: paymentForm.due_date || null,
      notes: paymentForm.notes.trim() || null,
    };
    if (editPayment) {
      await supabase.from("deal_payments").update(payload).eq("id", editPayment.id);
      await logActivity(supabase, session.user.id, "updated_payment", "deals", id, { payment_type: payload.payment_type, amount: payload.amount });
    } else {
      await supabase.from("deal_payments").insert({ ...payload, deal_id: id, status: "pending", created_by: session.user.id });
      await logActivity(supabase, session.user.id, "added_payment", "deals", id, { payment_type: payload.payment_type, amount: payload.amount });
    }
    setShowPaymentModal(false);
    setIsSavingPayment(false);
    await fetchPayments();
    await fetchLogs();
  };

  const handleDeletePayment = async (pid: string) => {
    if (!window.confirm("Delete this payment?")) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from("deal_payments").delete().eq("id", pid);
    await logActivity(supabase, session.user.id, "deleted_payment", "deals", id, {});
    await fetchPayments();
    await fetchLogs();
  };

  const handleMarkPaid = async () => {
    if (!showMarkPaidModal) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from("deal_payments").update({ status: "paid", paid_date: markPaidForm.paid_date, payment_method: markPaidForm.payment_method }).eq("id", showMarkPaidModal);
    await logActivity(supabase, session.user.id, "marked_payment_paid", "deals", id, { paid_date: markPaidForm.paid_date });
    setShowMarkPaidModal(null);
    await fetchPayments();
    await fetchLogs();

    // Offer to send receipt email
    const p = payments.find(p => p.id === showMarkPaidModal);
    if (p && clientEmail) {
      requestEmailConfirm({
        recipientName: clientName, recipientEmail: clientEmail,
        emailType: "payment_received",
        extraData: { amount: p.amount, description: p.description ?? "", paid_date: markPaidForm.paid_date },
        onConfirm: async () => {
          await sendNotification("payment_received", clientEmail, clientName, { amount: p.amount, description: p.description ?? "", paid_date: markPaidForm.paid_date });
          await supabase.from("deal_payments").update({ receipt_sent: true }).eq("id", p.id);
          await fetchPayments();
          setMessage({ type: "success", text: "Receipt sent." });
        },
      });
    }
  };

  const handleSendReceipt = (p: DealPayment) => {
    if (!clientEmail) { setMessage({ type: "error", text: "No client email on file." }); return; }
    requestEmailConfirm({
      recipientName: clientName, recipientEmail: clientEmail,
      emailType: "payment_received",
      extraData: { amount: p.amount, description: p.description ?? "", paid_date: p.paid_date ?? "" },
      onConfirm: async () => {
        await sendNotification("payment_received", clientEmail, clientName, { amount: p.amount, description: p.description ?? "", paid_date: p.paid_date ?? "" });
        await supabase.from("deal_payments").update({ receipt_sent: true }).eq("id", p.id);
        await fetchPayments();
        setMessage({ type: "success", text: "Receipt sent." });
      },
    });
  };

  // ─── Contract handlers ────────────────────────────────────────────────────

  const handleCreateContract = () => {
    // Auto-select template matching deal's preferred_language (Issue 1)
    const lang = form.preferred_language || "en";
    const targetType = deal?.contact_id ? "individual" : "company";
    const matchingTemplate = contractTemplates.find(
      t => t.language === lang && (!t.target_type || t.target_type === targetType)
    );
    if (matchingTemplate) {
      setSelectedContractTemplateId(matchingTemplate.id);
      setContractContent(fillPlaceholders(matchingTemplate.content ?? "", buildPlaceholderData()));
    } else {
      setSelectedContractTemplateId("");
      setContractContent("");
    }
    setContractPreviewMode(true); // Default to preview mode (Issue 4)
    setShowContractCreateModal(true);
  };

  const handleContractTemplateSelect = (templateId: string) => {
    setSelectedContractTemplateId(templateId);
    if (!templateId) { setContractContent(""); return; }
    const template = contractTemplates.find(t => t.id === templateId);
    if (!template?.content) { setContractContent(""); return; }
    setContractContent(fillPlaceholders(template.content, buildPlaceholderData()));
  };

  const handleConfirmContractCreate = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setIsContractCreating(true);
    const year = new Date().getFullYear();
    const { count } = await supabase.from("deal_contracts").select("*", { count: "exact", head: true });
    const num = String((count ?? 0) + 1).padStart(3, "0");
    const contractNumber = `CON-${year}-${num}`;
    const contractType = deal?.contact_id ? "individual" : "company";
    const { error } = await supabase.from("deal_contracts").insert({
      deal_id: id, contract_number: contractNumber, contract_type: contractType,
      status: "draft", created_by: session.user.id,
      template_id: selectedContractTemplateId || null,
      content: contractContent || null,
      contract_html: contractContent || null,
    });
    if (error) { setMessage({ type: "error", text: error.message }); setIsContractCreating(false); return; }
    await logActivity(supabase, session.user.id, "created_contract", "deals", id, { contract_number: contractNumber });
    await fetchContract();
    await fetchLogs();
    setShowContractCreateModal(false);
    setIsContractCreating(false);
  };

  const handleContractStatusChange = async (newStatus: string) => {
    if (!contract) return;
    setIsContractChanging(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const today = new Date().toISOString().split("T")[0];
    const extra: Record<string, string> = {};
    if (newStatus === "sent_to_lia") extra.sent_date = today;
    if (newStatus === "lia_signed") extra.lia_signed_date = today;
    if (newStatus === "completed") extra.completed_date = today;

    await supabase.from("deal_contracts").update({ status: newStatus, ...extra }).eq("id", contract.id);

    // Auto-advance deal status when contract is sent to client
    if (newStatus === "sent_to_client" && !["contracted", "in_progress", "submitted", "approved", "declined"].includes(currentStatus)) {
      await supabase.from("deals").update({ status: "contracted" }).eq("id", id);
      setDeal(d => d ? { ...d, status: "contracted" } : d);
      await logActivity(supabase, session.user.id, "deal_status_changed", "deals", id, { from: currentStatus, to: "contracted", reason: "contract_sent_to_client" });
    }

    // When contract completed → prompt to create intake form
    if (newStatus === "completed") {
      setShowContractIntakePrompt(true);
      if (clientEmail) {
        requestEmailConfirm({
          recipientName: clientName, recipientEmail: clientEmail,
          emailType: "contract_signed",
          onConfirm: () => sendNotification("contract_signed", clientEmail, clientName),
        });
      }
    }

    // Send email when contract is sent to client
    if (newStatus === "sent_to_client" && clientEmail) {
      const contractLink = `${window.location.origin}/contract/view/${contract.id}`;
      requestEmailConfirm({
        recipientName: clientName, recipientEmail: clientEmail,
        emailType: "contract_sent",
        extraData: { contract_link: contractLink },
        onConfirm: () => sendNotification("contract_sent", clientEmail, clientName, { contract_link: contractLink }),
      });
    }

    await logActivity(supabase, session.user.id, "contract_status_changed", "deals", id, { from: contract.status, to: newStatus });
    await fetchContract();
    await fetchLogs();
    setIsContractChanging(false);
  };

  const handleRejectContract = async () => {
    if (!contract || !rejectReason.trim()) return;
    setIsContractChanging(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from("deal_contracts").update({
      status: "rejected",
      rejected_reason: rejectReason.trim(),
      rejected_at: new Date().toISOString(),
      rejected_by: session.user.id,
    }).eq("id", contract.id);
    await logActivity(supabase, session.user.id, "contract_rejected", "deals", id, { reason: rejectReason.trim() });
    await fetchContract();
    await fetchLogs();
    setShowRejectModal(false);
    setRejectReason("");
    setIsContractChanging(false);
  };

  const handleContractSendToClient = async () => {
    if (!contract) return;
    setIsContractChanging(true);
    try {
      const res = await fetch(`/api/contracts/${contract.id}/send`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) { setMessage({ type: "error", text: json.error ?? "Failed to send contract." }); return; }
      await fetchContract();
      await fetchLogs();
      if (clientEmail) {
        const signLink = `${window.location.origin}/contract/sign/${json.token}`;
        requestEmailConfirm({
          recipientName: clientName, recipientEmail: clientEmail,
          emailType: "contract_sent",
          extraData: { contract_link: signLink },
          onConfirm: () => sendNotification("contract_sent", clientEmail, clientName, { contract_link: signLink }),
        });
      }
      if (!["contracted", "in_progress", "submitted", "approved", "declined"].includes(currentStatus)) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase.from("deals").update({ status: "contracted" }).eq("id", id);
          setDeal(d => d ? { ...d, status: "contracted" } : d);
        }
      }
      setMessage({ type: "success", text: "Contract sent to client." });
    } finally {
      setIsContractChanging(false);
    }
  };

  const handleResendContractEmail = () => {
    if (!contract?.client_sign_token || !clientEmail) {
      setMessage({ type: "error", text: "No client email or sign token available." });
      return;
    }
    const signLink = `${window.location.origin}/contract/sign/${contract.client_sign_token}`;
    requestEmailConfirm({
      recipientName: clientName, recipientEmail: clientEmail,
      emailType: "contract_sent",
      extraData: { contract_link: signLink },
      onConfirm: () => sendNotification("contract_sent", clientEmail, clientName, { contract_link: signLink }),
    });
  };

  const handleContractFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: "contract_file_url" | "signed_file_url") => {
    const file = e.target.files?.[0];
    if (!file || !contract) return;
    const fd = new FormData();
    fd.append("file", file); fd.append("type", "deals"); fd.append("id", id);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (res.ok) {
      const json = await res.json();
      await supabase.from("deal_contracts").update({ [field]: json.url }).eq("id", contract.id);
      await fetchContract();
    }
    e.target.value = "";
  };

  // ─── Intake form handlers ─────────────────────────────────────────────────

  const handleCreateIntakeForm = () => {
    setSelectedIntakeTemplateId("");
    setShowIntakeCreateModal(true);
  };

  const handleConfirmIntakeCreate = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const token = crypto.randomUUID();
    const { error } = await supabase.from("intake_forms").insert({
      deal_id: id,
      contact_id: deal?.contact_id ?? null,
      company_id: deal?.company_id ?? null,
      form_type: form.deal_type,
      unique_token: token,
      status: "draft",
      created_by: session.user.id,
      template_id: selectedIntakeTemplateId || null,
    });
    if (error) { setMessage({ type: "error", text: error.message }); return; }
    await logActivity(supabase, session.user.id, "created_intake_form", "deals", id, {});
    await fetchIntakeForm();
    await fetchLogs();
    setShowContractIntakePrompt(false);
    setShowIntakeCreateModal(false);
  };

  const handleSendIntakeForm = async () => {
    if (!intakeForm || !clientEmail) { setMessage({ type: "error", text: "No client email on file." }); return; }
    const origin = window.location.origin;
    const intakeLink = `${origin}/intake/${intakeForm.unique_token}`;
    requestEmailConfirm({
      recipientName: clientName, recipientEmail: clientEmail,
      emailType: "intake_form_sent",
      extraData: { intake_link: intakeLink },
      onConfirm: async () => {
        const today = new Date().toISOString().split("T")[0];
        await supabase.from("intake_forms").update({ status: "sent", sent_date: today }).eq("id", intakeForm.id);
        await sendNotification("intake_form_sent", clientEmail, clientName, { intake_link: intakeLink });
        await logActivity(supabase, (await supabase.auth.getSession()).data.session!.user.id, "sent_intake_form", "deals", id, { intake_link: intakeLink });
        await fetchIntakeForm();
        await fetchLogs();
        setMessage({ type: "success", text: "Intake form sent to client." });
      },
    });
  };

  // ─── Checklist handlers ───────────────────────────────────────────────────

  const handleAddChecklistItem = async () => {
    if (!checklistName.trim()) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from("document_checklists").insert({
      deal_id: id, item_name: checklistName.trim(), required: checklistRequired, created_by: session.user.id,
    });
    await logActivity(supabase, session.user.id, "added_checklist_item", "deals", id, { item: checklistName.trim() });
    setChecklistName(""); setChecklistRequired(true); setShowChecklistModal(false);
    await fetchChecklist();
    await fetchLogs();
  };

  const handlePresetChecklist = async () => {
    const visaType = form.visa_type;
    const presets = CHECKLIST_PRESETS[visaType] ?? [];
    if (presets.length === 0) { setMessage({ type: "error", text: "No preset for this visa type." }); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const rows = presets.map(name => ({ deal_id: id, item_name: name, required: true, created_by: session.user.id }));
    await supabase.from("document_checklists").insert(rows);
    await fetchChecklist();
    setMessage({ type: "success", text: `${presets.length} preset items added.` });
  };

  const handleDeleteChecklistItem = async (cid: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from("document_checklists").delete().eq("id", cid);
    await fetchChecklist();
    await logActivity(supabase, session.user.id, "deleted_checklist_item", "deals", id, {});
    await fetchLogs();
  };

  const handleChecklistUpload = async (e: React.ChangeEvent<HTMLInputElement>, cid: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingChecklist(cid);
    const fd = new FormData();
    fd.append("file", file); fd.append("type", "deals"); fd.append("id", id);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (res.ok) {
      const json = await res.json();
      await supabase.from("document_checklists").update({ file_url: json.url, uploaded: true }).eq("id", cid);
      await fetchChecklist();
    }
    setUploadingChecklist(null);
    e.target.value = "";
  };

  // ─── Applicant handlers ───────────────────────────────────────────────────

  const searchApplicants = async (q: string) => {
    setApplicantSearch(q);
    if (q.length < 2) { setApplicantResults([]); return; }
    const { data } = await supabase.from("contacts").select("id, first_name, last_name")
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`).limit(8);
    if (data) setApplicantResults(data as ContactSearch[]);
  };

  const handleAddApplicant = async () => {
    if (!newApplicant.contact_id) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { error } = await supabase.from("deal_applicants").insert({
      deal_id: id, contact_id: newApplicant.contact_id,
      relationship: newApplicant.relationship || null, notes: newApplicant.notes.trim() || null,
    });
    if (!error) {
      setShowApplicantModal(false);
      setApplicantSearch(""); setApplicantResults([]);
      setNewApplicant({ contact_id: "", relationship: "main", notes: "" });
      await fetchApplicants();
      await logActivity(supabase, session.user.id, "added_deal_applicant", "deals", id, { relationship: newApplicant.relationship });
      await fetchLogs();
    }
  };

  const handleRemoveApplicant = async (appId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from("deal_applicants").delete().eq("id", appId);
    await fetchApplicants();
    await logActivity(supabase, session.user.id, "removed_deal_applicant", "deals", id, {});
    await fetchLogs();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const fd = new FormData();
    fd.append("file", file); fd.append("type", "deals"); fd.append("id", id);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (res.ok) await fetchAttachments();
    setIsUploading(false);
    e.target.value = "";
  };

  // ─── Render helpers ───────────────────────────────────────────────────────

  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-blue-950"><p className="text-white/60">Loading...</p></div>;

  const inputClass = "w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none";
  const selectClass = "w-full rounded-lg border border-white/20 bg-blue-900 px-4 py-2.5 text-white focus:border-blue-400 focus:outline-none";
  const labelClass = "block text-sm font-medium text-white/70 mb-1";
  const sectionClass = "rounded-xl border border-white/10 bg-white/5 p-6 mb-6";
  const btnPrimary = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50";
  const btnSecondary = "rounded-lg border border-white/20 px-4 py-2 text-sm font-bold hover:bg-white/10 disabled:opacity-50";
  const btnDanger = "rounded-lg border border-red-500/50 px-4 py-2 text-sm font-bold text-red-400 hover:bg-red-500/10 disabled:opacity-50";

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="min-h-screen bg-blue-950 text-white">
      <Navbar hasUnsavedChanges={hasUnsavedChanges} />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">

        {/* ── Email Confirm Modal ─────────────────────────────────────────── */}
        {emailConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-sm rounded-xl border border-white/10 bg-blue-900 p-6">
              <h4 className="text-base font-bold mb-2">Send Email?</h4>
              <p className="text-sm text-white/70 mb-1">
                Type: <span className="text-white">{EMAIL_TYPE_LABELS[emailConfirm.emailType] ?? emailConfirm.emailType}</span>
              </p>
              <p className="text-sm text-white/70 mb-1">
                To: <span className="text-white">{emailConfirm.recipientName}</span>
              </p>
              <p className="text-sm text-white/70 mb-4">
                Email: <span className="text-white">{emailConfirm.recipientEmail}</span>
              </p>
              <div className="flex gap-2">
                <button onClick={() => { emailConfirm.onConfirm(); setEmailConfirm(null); }} className={btnPrimary}>
                  Send
                </button>
                <button onClick={() => setEmailConfirm(null)} className={btnSecondary}>Skip</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href="/deals" className="text-sm text-white/50 hover:text-white/80 mb-2 inline-block">← Deals</Link>
            <h2 className="text-2xl font-bold sm:text-3xl">{deal?.deal_number ?? "Deal"}</h2>
            <div className="mt-2 flex flex-wrap gap-2 items-center">
              <span className={`rounded-full px-3 py-0.5 text-xs font-bold uppercase ${DEAL_STATUS_COLORS[currentStatus] ?? "bg-gray-500/20 text-gray-400"}`}>
                {DEAL_STATUS_LABELS[currentStatus] ?? currentStatus}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-0.5 text-xs font-bold uppercase text-white/60">
                {form.visa_type || form.deal_type?.replace(/_/g, " ")}
              </span>
              {deal?.contacts ? (
                <Link href={`/contacts/${deal.contact_id}`} className="text-sm text-blue-400 hover:underline">{clientName}</Link>
              ) : deal?.companies ? (
                <Link href={`/companies/${deal.company_id}`} className="text-sm text-blue-400 hover:underline">{clientName}</Link>
              ) : null}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-white/50">
              {form.assigned_sales_id && <span>Sales: {salesUsers.find(s => s.id === form.assigned_sales_id)?.full_name ?? "—"}</span>}
              {form.assigned_lia_id && <span>LIA: {salesUsers.find(s => s.id === form.assigned_lia_id)?.full_name ?? "—"}</span>}
            </div>
          </div>
          {isAdmin && (
            <button onClick={handleDelete} disabled={isDeleting} className={`${btnDanger} shrink-0`}>
              {isDeleting ? "Deleting..." : "Delete Deal"}
            </button>
          )}
        </div>

        {message && (
          <div className={`mb-6 rounded-lg px-4 py-3 ${message.type === "error" ? "bg-red-500/20 text-red-300 border border-red-500/30" : "bg-green-500/20 text-green-300 border border-green-500/30"}`}>
            {message.text}
          </div>
        )}

        {/* ── Workflow Progress Bar ───────────────────────────────────────── */}
        <div className="mb-6 rounded-xl border border-white/10 bg-white/5 px-6 py-5">
          <div className="flex items-center gap-0">
            {WORKFLOW_STEPS.map((step, i) => {
              const isCompleted = i < workflowStep;
              const isActive = i === workflowStep;
              const isDeclined = currentStatus === "declined" && i === 7;
              return (
                <div key={step.key} className="flex items-center flex-1 min-w-0">
                  <div className="flex flex-col items-center min-w-0">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border-2 transition-all ${
                      isCompleted ? "bg-blue-500 border-blue-500 text-white" :
                      isActive && !isTerminal ? "bg-blue-500/20 border-blue-400 text-blue-300" :
                      isActive && currentStatus === "approved" ? "bg-green-500 border-green-500 text-white" :
                      isActive && isDeclined ? "bg-red-500 border-red-500 text-white" :
                      "bg-white/5 border-white/20 text-white/30"
                    }`}>
                      {isCompleted ? "✓" : i + 1}
                    </div>
                    <span className={`text-xs mt-1 text-center leading-tight hidden sm:block ${isCompleted || isActive ? "text-white/80" : "text-white/30"}`} style={{ fontSize: "0.6rem" }}>
                      {step.label}
                    </span>
                  </div>
                  {i < WORKFLOW_STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 ${i < workflowStep ? "bg-blue-500" : "bg-white/10"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Status action buttons (terminal/cancel/approve-decline) ──────── */}
        {canChangeStatus && (
          <div className="mb-6 flex flex-wrap gap-2">
            {currentStatus === "submitted" && (
              <>
                <button onClick={() => { if (clientEmail) { requestEmailConfirm({ recipientName: clientName, recipientEmail: clientEmail, emailType: "application_approved", onConfirm: () => sendNotification("application_approved", clientEmail, clientName) }); } handleStatusChange("approved"); }} disabled={isStatusChanging} className="rounded-lg bg-green-600 px-5 py-2.5 font-bold text-white hover:bg-green-700 disabled:opacity-50 text-sm">
                  Mark as Approved
                </button>
                <button onClick={() => { if (clientEmail) { requestEmailConfirm({ recipientName: clientName, recipientEmail: clientEmail, emailType: "application_declined", onConfirm: () => sendNotification("application_declined", clientEmail, clientName) }); } handleStatusChange("declined"); }} disabled={isStatusChanging} className="rounded-lg bg-red-600 px-5 py-2.5 font-bold text-white hover:bg-red-700 disabled:opacity-50 text-sm">
                  Mark as Declined
                </button>
              </>
            )}
            {isTerminal && currentStatus === "cancelled" && isAdmin && (
              <button onClick={() => handleStatusChange("draft")} disabled={isStatusChanging} className={`${btnSecondary} text-sm`}>
                Reopen as Draft
              </button>
            )}
            {!isTerminal && (
              <button onClick={() => handleStatusChange("cancelled")} disabled={isStatusChanging} className={`${btnDanger} text-sm`}>
                Cancel Deal
              </button>
            )}
            {currentStatus !== "draft" && !isTerminal && (
              <button onClick={() => handleStatusChange(STATUS_PREV[currentStatus])} disabled={isStatusChanging} className={`${btnSecondary} text-sm`}>
                ↩ Undo to {DEAL_STATUS_LABELS[STATUS_PREV[currentStatus]] ?? "Previous"}
              </button>
            )}
          </div>
        )}

        {/* ── Section: Pricing & Payments ────────────────────────────────── */}
        <div className={sectionClass}>
          <h3 className="text-lg font-bold mb-4">Pricing & Payments</h3>

          {/* Fee inputs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-4">
            <div><label className={labelClass}>Service Fee ($)</label><input name="service_fee" value={form.service_fee} onChange={handleChange} type="number" step="0.01" min="0" className={inputClass} /></div>
            <div><label className={labelClass}>INZ Application Fee ($)</label><input name="inz_application_fee" value={form.inz_application_fee} onChange={handleChange} type="number" step="0.01" min="0" className={inputClass} /></div>
            <div><label className={labelClass}>Other Fee ($)</label><input name="other_fee" value={form.other_fee} onChange={handleChange} type="number" step="0.01" min="0" className={inputClass} /></div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3 mb-4">
            <span className="text-sm text-white/60">Total (Quoted)</span>
            <span className="text-xl font-bold">${fmt(totalFees)}</span>
          </div>

          {/* Payment gating warnings */}
          {pendingServiceFee && (
            <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 mb-3 text-sm text-yellow-300">
              ⚠ Service fee payment pending — Cannot start processing
            </div>
          )}
          {pendingGovFee && (
            <div className="rounded-lg border border-orange-500/40 bg-orange-500/10 px-4 py-3 mb-3 text-sm text-orange-300">
              ⚠ INZ application fee payment pending — Cannot submit application
            </div>
          )}

          {/* Payment schedule */}
          {payments.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="rounded-lg bg-white/5 px-3 py-2.5 text-center"><p className="text-xs text-white/50 mb-0.5">Total Due</p><p className="font-bold">${fmt(totalDuePayments)}</p></div>
                <div className="rounded-lg bg-green-500/10 px-3 py-2.5 text-center"><p className="text-xs text-white/50 mb-0.5">Total Paid</p><p className="font-bold text-green-400">${fmt(totalPaidPayments)}</p></div>
                <div className="rounded-lg bg-white/5 px-3 py-2.5 text-center"><p className="text-xs text-white/50 mb-0.5">Outstanding</p><p className={`font-bold ${outstanding > 0 ? "text-yellow-400" : "text-green-400"}`}>${fmt(outstanding)}</p></div>
              </div>
              <div className="overflow-x-auto mb-3">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-white/10">
                    <th className="text-left py-2 text-white/50 font-medium">Description</th>
                    <th className="text-left py-2 text-white/50 font-medium">Type</th>
                    <th className="text-right py-2 text-white/50 font-medium">Amount</th>
                    <th className="text-left py-2 text-white/50 font-medium">Due</th>
                    <th className="text-left py-2 text-white/50 font-medium">Status</th>
                    <th className="text-left py-2 text-white/50 font-medium">Paid</th>
                    <th className="py-2"></th>
                  </tr></thead>
                  <tbody>
                    {payments.map(p => (
                      <tr key={p.id} className="border-b border-white/5">
                        <td className="py-2 pr-2 text-white/80">{p.description ?? "—"}</td>
                        <td className="py-2 pr-2 text-white/60 text-xs capitalize">{p.payment_type?.replace(/_/g, " ") ?? "—"}</td>
                        <td className="py-2 pr-2 text-right font-medium">${fmt(p.amount)}</td>
                        <td className="py-2 pr-2 text-white/60 text-xs">{p.due_date ?? "—"}</td>
                        <td className="py-2 pr-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${p.status === "paid" ? "bg-green-500/20 text-green-400" : p.status === "overdue" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="py-2 pr-2 text-white/60 text-xs">{p.paid_date ?? "—"}</td>
                        <td className="py-2">
                          <div className="flex items-center gap-1 justify-end">
                            {p.status === "pending" && (
                              <button onClick={() => { setShowMarkPaidModal(p.id); setMarkPaidForm({ paid_date: new Date().toISOString().split("T")[0], payment_method: "bank_transfer" }); }}
                                className="text-xs text-green-400 hover:text-green-300 whitespace-nowrap">Mark Paid</button>
                            )}
                            {p.status === "paid" && (
                              <button onClick={() => handleSendReceipt(p)} className={`text-xs ${p.receipt_sent ? "text-white/30" : "text-blue-400 hover:text-blue-300"} whitespace-nowrap`}>
                                {p.receipt_sent ? "Receipt ✓" : "Send Receipt"}
                              </button>
                            )}
                            <button onClick={() => openEditPayment(p)} className="text-xs text-white/40 hover:text-white">Edit</button>
                            <button onClick={() => handleDeletePayment(p.id)} className="text-xs text-red-400 hover:text-red-300">✕</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="flex flex-wrap gap-2">
            <button onClick={openAddPayment} className={btnSecondary}>+ Add Payment</button>
            <button onClick={handleSave} disabled={isSaving || !hasUnsavedChanges} className={`${btnPrimary} ml-auto`}>
              {isSaving ? "Saving..." : "Save Fees"}
            </button>
          </div>
        </div>

        {/* ── Payment Modal ───────────────────────────────────────────────── */}
        {showPaymentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-md rounded-xl border border-white/10 bg-blue-900 p-6">
              <h4 className="text-lg font-bold mb-4">{editPayment ? "Edit Payment" : "Add Payment"}</h4>
              <div className="space-y-3">
                <div><label className={labelClass}>Type</label>
                  <select value={paymentForm.payment_type} onChange={e => setPaymentForm(f => ({ ...f, payment_type: e.target.value }))} className={selectClass}>
                    <option value="service_fee" className="bg-blue-900">Service Fee</option>
                    <option value="inz_application_fee" className="bg-blue-900">INZ Application Fee</option>
                    <option value="other" className="bg-blue-900">Other</option>
                  </select>
                </div>
                <div><label className={labelClass}>Description</label><input value={paymentForm.description} onChange={e => setPaymentForm(f => ({ ...f, description: e.target.value }))} className={inputClass} placeholder="e.g. Initial service fee deposit" /></div>
                <div><label className={labelClass}>Amount ($) <span className="text-red-400">*</span></label><input value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))} type="number" step="0.01" min="0" className={inputClass} /></div>
                <div><label className={labelClass}>Due Date</label><input value={paymentForm.due_date} onChange={e => setPaymentForm(f => ({ ...f, due_date: e.target.value }))} type="date" className={inputClass} /></div>
                <div><label className={labelClass}>Notes</label><input value={paymentForm.notes} onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))} className={inputClass} /></div>
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={handleSavePayment} disabled={isSavingPayment || !paymentForm.amount} className={btnPrimary}>{isSavingPayment ? "Saving..." : "Save"}</button>
                <button onClick={() => setShowPaymentModal(false)} className={btnSecondary}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Mark Paid Modal ─────────────────────────────────────────────── */}
        {showMarkPaidModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-sm rounded-xl border border-white/10 bg-blue-900 p-6">
              <h4 className="text-lg font-bold mb-4">Mark as Paid</h4>
              <div className="space-y-3">
                <div><label className={labelClass}>Paid Date</label><input value={markPaidForm.paid_date} onChange={e => setMarkPaidForm(f => ({ ...f, paid_date: e.target.value }))} type="date" className={inputClass} /></div>
                <div><label className={labelClass}>Payment Method</label>
                  <select value={markPaidForm.payment_method} onChange={e => setMarkPaidForm(f => ({ ...f, payment_method: e.target.value }))} className={selectClass}>
                    <option value="bank_transfer" className="bg-blue-900">Bank Transfer</option>
                    <option value="credit_card" className="bg-blue-900">Credit Card</option>
                    <option value="cash" className="bg-blue-900">Cash</option>
                    <option value="other" className="bg-blue-900">Other</option>
                  </select>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={handleMarkPaid} className={btnPrimary}>Confirm Paid</button>
                <button onClick={() => setShowMarkPaidModal(null)} className={btnSecondary}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Contract Create Modal ──────────────────────────────────────── */}
        {showContractCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-3xl rounded-xl border border-white/10 bg-blue-900 p-6 max-h-[90vh] overflow-y-auto">
              <h4 className="text-lg font-bold mb-5">Create Contract</h4>
              <div className="mb-4">
                <label className={labelClass}>Select Template</label>
                <select
                  value={selectedContractTemplateId}
                  onChange={e => handleContractTemplateSelect(e.target.value)}
                  className={selectClass}
                >
                  <option value="" className="bg-blue-900">No template (blank)</option>
                  {contractTemplates
                    .filter(t => !t.target_type || t.target_type === (deal?.contact_id ? "individual" : "company"))
                    .map(t => (
                      <option key={t.id} value={t.id} className="bg-blue-900">
                        {t.name}{t.language ? ` (${t.language})` : ""}
                      </option>
                    ))
                  }
                </select>
              </div>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <label className={labelClass}>Contract Content</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setContractPreviewMode(false)} className={`text-xs px-3 py-1 rounded ${!contractPreviewMode ? "bg-blue-600 text-white" : "border border-white/20 text-white/60 hover:text-white"}`}>Edit</button>
                    <button type="button" onClick={() => setContractPreviewMode(true)} className={`text-xs px-3 py-1 rounded ${contractPreviewMode ? "bg-blue-600 text-white" : "border border-white/20 text-white/60 hover:text-white"}`}>Preview</button>
                  </div>
                </div>
                {contractPreviewMode ? (
                  <div className="rounded-lg border border-white/20 bg-white p-6 prose prose-sm max-w-none overflow-y-auto" style={{ color: "#111", maxHeight: "400px" }}>
                    {contractContent ? (
                      <div dangerouslySetInnerHTML={{ __html: contractContent }} />
                    ) : (
                      <p className="text-gray-400 italic">No content to preview.</p>
                    )}
                  </div>
                ) : (
                  <textarea
                    value={contractContent}
                    onChange={e => setContractContent(e.target.value)}
                    rows={16}
                    className={`${inputClass} font-mono text-xs resize-y`}
                    placeholder="Paste or type HTML contract content here..."
                  />
                )}
              </div>
              <p className="text-xs text-white/40 mb-4">
                Template placeholders are auto-filled with deal and client data. You can edit the content before saving.
              </p>
              <div className="flex gap-2">
                <button onClick={handleConfirmContractCreate} disabled={isContractCreating} className={btnPrimary}>
                  {isContractCreating ? "Creating..." : "Save as Draft"}
                </button>
                <button onClick={() => setShowContractCreateModal(false)} className={btnSecondary}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Reject Contract Modal ──────────────────────────────────────── */}
        {showRejectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-sm rounded-xl border border-white/10 bg-blue-900 p-6">
              <h4 className="text-lg font-bold mb-4">Reject Contract</h4>
              <div className="mb-4">
                <label className={labelClass}>Reason for rejection <span className="text-red-400">*</span></label>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  rows={3}
                  className={`${inputClass} resize-none`}
                  placeholder="Explain why the contract is being rejected..."
                />
              </div>
              <div className="flex gap-2">
                <button onClick={handleRejectContract} disabled={isContractChanging || !rejectReason.trim()} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">
                  {isContractChanging ? "Rejecting..." : "Confirm Reject"}
                </button>
                <button onClick={() => { setShowRejectModal(false); setRejectReason(""); }} className={btnSecondary}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Section: Contract ───────────────────────────────────────────── */}
        <div className={sectionClass}>
          <h3 className="text-lg font-bold mb-4">Contract</h3>

          {!contract ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-white/50 text-sm">No contract created yet.</p>
              <button onClick={handleCreateContract} className={btnPrimary}>Create Contract</button>
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-2 gap-3 mb-4 sm:grid-cols-4">
                <div className="rounded-lg bg-white/5 px-3 py-2"><p className="text-xs text-white/50">Number</p><p className="font-medium text-sm">{contract.contract_number}</p></div>
                <div className="rounded-lg bg-white/5 px-3 py-2"><p className="text-xs text-white/50">Status</p>
                  <p className={`font-medium text-sm ${contract.status === "completed" ? "text-green-400" : ["rejected", "cancelled"].includes(contract.status) ? "text-red-400" : "text-white"}`}>
                    {CONTRACT_STATUS_LABELS[contract.status] ?? contract.status}
                  </p>
                </div>
                {contract.sent_date && <div className="rounded-lg bg-white/5 px-3 py-2"><p className="text-xs text-white/50">Sent to LIA</p><p className="font-medium text-sm">{contract.sent_date}</p></div>}
                {contract.lia_signed_date && <div className="rounded-lg bg-white/5 px-3 py-2"><p className="text-xs text-white/50">LIA Approved</p><p className="font-medium text-sm">{contract.lia_signed_date}</p></div>}
                {contract.completed_date && <div className="rounded-lg bg-white/5 px-3 py-2"><p className="text-xs text-white/50">Completed</p><p className="font-medium text-sm">{contract.completed_date}</p></div>}
              </div>

              {/* Rejection reason */}
              {contract.status === "rejected" && contract.rejected_reason && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 mb-4">
                  <p className="text-xs text-red-400 font-medium mb-1">Rejection Reason:</p>
                  <p className="text-sm text-red-300">{contract.rejected_reason}</p>
                </div>
              )}

              {/* LIA Preview & Sign link */}
              {!["completed", "cancelled"].includes(contract.status) && (contract.contract_html || contract.content) && (
                <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 px-3 py-2.5 mb-4">
                  <p className="text-xs text-blue-300 mb-1 font-medium">LIA — Review & Sign</p>
                  <div className="flex items-center gap-2">
                    <a href={`/contract/preview/${contract.id}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-300 hover:underline truncate flex-1">
                      {typeof window !== "undefined" ? window.location.origin : ""}/contract/preview/{contract.id}
                    </a>
                    <a href={`/contract/preview/${contract.id}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded px-2 py-1 shrink-0">
                      Preview & Sign →
                    </a>
                  </div>
                </div>
              )}

              {/* Client sign link (when sent_to_client) */}
              {contract.status === "sent_to_client" && contract.client_sign_token && (
                <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 mb-4">
                  <p className="text-xs text-white/50 mb-1">Client Sign Link</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-green-300 truncate flex-1">
                      {typeof window !== "undefined" ? window.location.origin : ""}/contract/sign/{contract.client_sign_token}
                    </code>
                    <button
                      onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/contract/sign/${contract.client_sign_token}`); setMessage({ type: "success", text: "Link copied!" }); }}
                      className="text-xs text-white/50 hover:text-white border border-white/20 rounded px-2 py-0.5 shrink-0"
                    >Copy</button>
                  </div>
                </div>
              )}

              {/* Signature status */}
              {(contract.adviser_signed_at || contract.client_signed_at) && (
                <div className="flex gap-4 mb-4 text-xs text-white/60">
                  {contract.adviser_signed_at && <span className="text-green-400">✓ LIA signed {new Date(contract.adviser_signed_at).toLocaleDateString()}</span>}
                  {contract.client_signed_at && <span className="text-green-400">✓ Client signed {new Date(contract.client_signed_at).toLocaleDateString()}</span>}
                </div>
              )}

              {/* Contract status flow buttons */}
              {!["completed", "cancelled"].includes(contract.status) && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {contract.status === "draft" && (
                    <button onClick={() => handleContractStatusChange("sent_to_lia")} disabled={isContractChanging} className={btnPrimary}>
                      Send to LIA for Review
                    </button>
                  )}
                  {contract.status === "sent_to_lia" && (
                    <>
                      <button onClick={() => handleContractStatusChange("lia_signed")} disabled={isContractChanging} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50">
                        Mark LIA Approved
                      </button>
                      <button onClick={() => setShowRejectModal(true)} disabled={isContractChanging} className={btnDanger}>
                        Reject
                      </button>
                    </>
                  )}
                  {contract.status === "lia_signed" && (
                    <button onClick={() => handleContractSendToClient()} disabled={isContractChanging} className={btnPrimary}>
                      Send Contract Email to Client
                    </button>
                  )}
                  {contract.status === "sent_to_client" && (
                    <>
                      <button onClick={handleResendContractEmail} disabled={isContractChanging} className={btnPrimary}>
                        Resend Contract Email
                      </button>
                      <button onClick={() => handleContractStatusChange("completed")} disabled={isContractChanging} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50">
                        Mark as Client Signed
                      </button>
                    </>
                  )}
                  {contract.status === "rejected" && (
                    <button onClick={handleCreateContract} className={btnPrimary}>
                      Create New Contract
                    </button>
                  )}
                  {["sent_to_lia", "lia_signed", "sent_to_client"].includes(contract.status) && (
                    <button onClick={() => {
                      const prev: Record<string, string> = { sent_to_lia: "draft", lia_signed: "sent_to_lia", sent_to_client: "lia_signed" };
                      if (prev[contract.status]) handleContractStatusChange(prev[contract.status]);
                    }} disabled={isContractChanging} className={btnSecondary}>↩ Undo</button>
                  )}
                  {contract.status !== "rejected" && (
                    <button onClick={() => handleContractStatusChange("cancelled")} disabled={isContractChanging} className={btnDanger}>Cancel</button>
                  )}
                </div>
              )}

              {/* Contract files */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <p className="text-xs text-white/50 mb-2">Contract File</p>
                  {contract.contract_file_url ? (
                    <div className="flex items-center gap-2">
                      <a href={contract.contract_file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline truncate">View File</a>
                    </div>
                  ) : <p className="text-xs text-white/30 mb-2">Not uploaded</p>}
                  <label className="cursor-pointer text-xs text-white/60 hover:text-white border border-white/20 rounded px-2 py-1 inline-block">
                    Upload
                    <input type="file" className="hidden" onChange={e => handleContractFileUpload(e, "contract_file_url")} />
                  </label>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <p className="text-xs text-white/50 mb-2">Signed Contract</p>
                  {contract.signed_file_url ? (
                    <div className="flex items-center gap-2">
                      <a href={contract.signed_file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline truncate">View File</a>
                    </div>
                  ) : <p className="text-xs text-white/30 mb-2">Not uploaded</p>}
                  <label className="cursor-pointer text-xs text-white/60 hover:text-white border border-white/20 rounded px-2 py-1 inline-block">
                    Upload
                    <input type="file" className="hidden" onChange={e => handleContractFileUpload(e, "signed_file_url")} />
                  </label>
                </div>
              </div>

              {/* Prompt to create intake form after contract completion */}
              {showContractIntakePrompt && !intakeForm && (
                <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 flex items-center justify-between gap-3">
                  <p className="text-sm text-blue-300">Contract completed. Create and send intake form now?</p>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={handleCreateIntakeForm} className={btnPrimary}>Yes</button>
                    <button onClick={() => setShowContractIntakePrompt(false)} className={btnSecondary}>Later</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Intake Create Modal ────────────────────────────────────────── */}
        {showIntakeCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-md rounded-xl border border-white/10 bg-blue-900 p-6">
              <h4 className="text-lg font-bold mb-5">Create Intake Form</h4>
              <div className="mb-5">
                <label className={labelClass}>Select Template <span className="text-white/40">(optional)</span></label>
                <select
                  value={selectedIntakeTemplateId}
                  onChange={e => setSelectedIntakeTemplateId(e.target.value)}
                  className={selectClass}
                >
                  <option value="" className="bg-blue-900">No template (blank form)</option>
                  {intakeTemplates.map(t => (
                    <option key={t.id} value={t.id} className="bg-blue-900">
                      {t.name}{t.category ? ` [${t.category.replace(/_/g, " ")}]` : ""}
                    </option>
                  ))}
                </select>
                {selectedIntakeTemplateId && (
                  <p className="text-xs text-white/40 mt-1.5">The selected template will define the form fields shown to the client.</p>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={handleConfirmIntakeCreate} className={btnPrimary}>Create</button>
                <button onClick={() => setShowIntakeCreateModal(false)} className={btnSecondary}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Section: Intake Forms ──────────────────────────────────────── */}
        <div className={sectionClass}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Intake Forms ({intakeForms.length})</h3>
            <button onClick={handleCreateIntakeForm} className={btnSecondary}>+ Create</button>
          </div>

          {intakeForms.length === 0 ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-white/50 text-sm">No intake form created yet.</p>
              <button onClick={handleCreateIntakeForm} className={btnPrimary}>Create Intake Form</button>
            </div>
          ) : (
            <div className="space-y-3">
              {intakeForms.map(iForm => {
                const isViewing = viewingIntakeFormId === iForm.id;
                const formLink = iForm.unique_token
                  ? `${typeof window !== "undefined" ? window.location.origin : "https://pjcommission.com"}/intake/${iForm.unique_token}`
                  : null;
                const isDone = iForm.status === "submitted" || iForm.status === "completed";
                const formData = isDone ? (iForm.form_data ?? iForm.draft_data ?? {}) : null;

                return (
                  <div key={iForm.id} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                    {/* Form header row */}
                    <div className="px-4 py-3">
                      <div className="flex flex-wrap items-start gap-2 mb-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${INTAKE_STATUS_COLORS[iForm.status] ?? "bg-gray-500/20 text-gray-400"}`}>
                          {INTAKE_STATUS_LABELS[iForm.status] ?? iForm.status}
                        </span>
                        {iForm.progress !== null && iForm.progress !== undefined && iForm.progress > 0 && !isDone && (
                          <span className="text-xs text-white/40">{iForm.progress}% complete</span>
                        )}
                        {isDone && iForm.client_name && (
                          <span className="text-xs text-green-400">by {iForm.client_name}</span>
                        )}
                      </div>

                      {/* Dates row */}
                      <div className="flex flex-wrap gap-3 text-xs text-white/40 mb-3">
                        {iForm.sent_date && <span>Sent: {iForm.sent_date}</span>}
                        {iForm.last_saved_at && !isDone && (
                          <span>Last saved: {new Date(iForm.last_saved_at).toLocaleDateString()}</span>
                        )}
                        {(iForm.submitted_at ?? iForm.completed_date) && (
                          <span>Submitted: {iForm.submitted_at
                            ? new Date(iForm.submitted_at).toLocaleDateString()
                            : iForm.completed_date}</span>
                        )}
                      </div>

                      {/* Progress bar */}
                      {!isDone && iForm.progress !== null && (iForm.progress ?? 0) > 0 && (
                        <div className="h-1 bg-white/10 rounded-full overflow-hidden mb-3">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${iForm.progress}%` }} />
                        </div>
                      )}

                      {/* Link */}
                      {formLink && (
                        <div className="rounded-lg bg-black/20 px-3 py-2 mb-2">
                          <p className="text-xs text-white/40 mb-1">Client link</p>
                          <div className="flex items-center gap-2">
                            <code className="text-xs text-blue-300 truncate flex-1">{formLink}</code>
                            <button
                              onClick={() => { navigator.clipboard.writeText(formLink); setMessage({ type: "success", text: "Link copied!" }); }}
                              className="text-xs text-white/50 hover:text-white border border-white/20 rounded px-2 py-0.5 shrink-0"
                            >Copy</button>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 mt-1">
                        {(iForm.status === "draft" || iForm.status === "sent") && clientEmail && (
                          <button
                            onClick={() => {
                              if (!formLink) return;
                              requestEmailConfirm({
                                recipientName: clientName, recipientEmail: clientEmail,
                                emailType: "intake_form_sent",
                                extraData: { intake_link: formLink },
                                onConfirm: async () => {
                                  const today = new Date().toISOString().split("T")[0];
                                  await supabase.from("intake_forms").update({ status: "sent", sent_date: today }).eq("id", iForm.id);
                                  await sendNotification("intake_form_sent", clientEmail, clientName, { intake_link: formLink });
                                  await logActivity(supabase, (await supabase.auth.getSession()).data.session!.user.id, "sent_intake_form", "deals", id, { intake_link: formLink });
                                  await fetchIntakeForm();
                                  await fetchLogs();
                                  setMessage({ type: "success", text: "Intake form sent to client." });
                                },
                              });
                            }}
                            className={btnPrimary}
                          >Send to Client</button>
                        )}
                        {isDone && (
                          <button
                            onClick={() => setViewingIntakeFormId(isViewing ? null : iForm.id)}
                            className={btnSecondary}
                          >{isViewing ? "Hide data ▴" : "View data ▾"}</button>
                        )}
                      </div>
                    </div>

                    {/* Submitted data viewer */}
                    {isViewing && isDone && formData && Object.keys(formData).length > 0 && (
                      <div className="border-t border-white/10 px-4 py-3">
                        <p className="text-xs text-white/50 mb-3 font-medium">Submitted Information</p>
                        <div className="grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2">
                          {Object.entries(formData).filter(([, v]) => v !== null && v !== undefined && v !== "").map(([k, v]) => {
                            let displayVal = "";
                            if (typeof v === "object" && v !== null && !Array.isArray(v)) {
                              displayVal = Object.values(v as Record<string, string>).filter(Boolean).join(" ");
                            } else if (Array.isArray(v)) {
                              displayVal = v.join(", ");
                            } else if (typeof v === "string" && v.startsWith("data:image")) {
                              displayVal = "[Signature]";
                            } else {
                              displayVal = String(v);
                            }
                            if (!displayVal) return null;
                            return (
                              <div key={k} className="rounded bg-white/5 px-2 py-1.5">
                                <span className="text-white/40 block capitalize">{k.replace(/_/g, " ")}</span>
                                <span className="text-white/80 break-words">{displayVal}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Workflow actions (based on primary intake form) */}
          {intakeForm && (
            <div className="mt-4 space-y-3">
              {(intakeForm.status === "submitted" || intakeForm.status === "completed") && currentStatus === "contracted" && (
                <div>
                  <button
                    onClick={() => {
                      if (pendingServiceFee) { setMessage({ type: "error", text: "Cannot start processing: service fee payment is still pending." }); return; }
                      handleStatusChange("in_progress");
                    }}
                    disabled={pendingServiceFee || isStatusChanging}
                    title={pendingServiceFee ? "Service fee payment must be paid first" : ""}
                    className={`rounded-lg px-5 py-2.5 font-bold text-sm text-white disabled:opacity-50 ${pendingServiceFee ? "bg-gray-600 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
                  >
                    {pendingServiceFee ? "⚠ Start Processing (blocked)" : "Start Processing"}
                  </button>
                  {pendingServiceFee && <p className="text-xs text-yellow-400 mt-1.5">Service fee payment must be marked as paid before starting.</p>}
                </div>
              )}
              {currentStatus === "in_progress" && (
                <div>
                  <button
                    onClick={() => {
                      if (pendingGovFee) { setMessage({ type: "error", text: "Cannot submit: government fee payment is still pending." }); return; }
                      if (clientEmail) { requestEmailConfirm({ recipientName: clientName, recipientEmail: clientEmail, emailType: "application_submitted", extraData: { submitted_date: new Date().toISOString().split("T")[0] }, onConfirm: () => sendNotification("application_submitted", clientEmail, clientName, { submitted_date: new Date().toISOString().split("T")[0] }) }); }
                      handleStatusChange("submitted");
                    }}
                    disabled={pendingGovFee || isStatusChanging}
                    title={pendingGovFee ? "INZ application fee must be paid first" : ""}
                    className={`rounded-lg px-5 py-2.5 font-bold text-sm text-white disabled:opacity-50 ${pendingGovFee ? "bg-gray-600 cursor-not-allowed" : "bg-orange-600 hover:bg-orange-700"}`}
                  >
                    {pendingGovFee ? "⚠ Mark as Submitted (blocked)" : "Mark as Submitted"}
                  </button>
                  {pendingGovFee && <p className="text-xs text-orange-400 mt-1.5">INZ application fee payment must be marked as paid before submitting.</p>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Section: Document Checklist ─────────────────────────────────── */}
        <div className={sectionClass}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Document Checklist ({checklist.length})</h3>
            <div className="flex gap-2">
              {form.visa_type && CHECKLIST_PRESETS[form.visa_type] && checklist.length === 0 && (
                <button onClick={handlePresetChecklist} className={btnSecondary}>Load {form.visa_type} Preset</button>
              )}
              <button onClick={() => setShowChecklistModal(true)} className={btnSecondary}>+ Add</button>
            </div>
          </div>

          {checklist.length === 0 ? (
            <p className="text-white/50 text-sm">No documents in checklist yet.</p>
          ) : (
            <div className="space-y-2">
              {checklist.map(item => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 ${item.uploaded ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/30"}`}>
                      {item.uploaded ? "✓" : "○"}
                    </span>
                    <div className="min-w-0">
                      <p className={`text-sm ${item.uploaded ? "text-white" : "text-white/70"}`}>{item.item_name}</p>
                      {item.required && <span className="text-xs text-white/30">Required</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.file_url ? (
                      <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">View</a>
                    ) : (
                      <label className="cursor-pointer text-xs text-white/50 hover:text-white border border-white/20 rounded px-2 py-0.5">
                        {uploadingChecklist === item.id ? "Uploading..." : "Upload"}
                        <input type="file" className="hidden" onChange={e => handleChecklistUpload(e, item.id)} disabled={uploadingChecklist === item.id} />
                      </label>
                    )}
                    <button onClick={() => handleDeleteChecklistItem(item.id)} className="text-xs text-red-400 hover:text-red-300">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add checklist item modal */}
          {showChecklistModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
              <div className="w-full max-w-sm rounded-xl border border-white/10 bg-blue-900 p-6">
                <h4 className="text-lg font-bold mb-4">Add Document</h4>
                <div className="space-y-3">
                  <div><label className={labelClass}>Document Name</label><input value={checklistName} onChange={e => setChecklistName(e.target.value)} className={inputClass} placeholder="e.g. Passport Copy" /></div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={checklistRequired} onChange={e => setChecklistRequired(e.target.checked)} className="rounded" />
                    <span className="text-sm text-white/70">Required document</span>
                  </label>
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={handleAddChecklistItem} disabled={!checklistName.trim()} className={btnPrimary}>Add</button>
                  <button onClick={() => { setShowChecklistModal(false); setChecklistName(""); }} className={btnSecondary}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Section: Applicants ─────────────────────────────────────────── */}
        {(form.deal_type === "individual_visa" || deal?.contact_id) && (
          <div className={sectionClass}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Applicants ({applicants.length})</h3>
              <button onClick={() => setShowApplicantModal(true)} className={btnSecondary}>+ Add Applicant</button>
            </div>

            {showApplicantModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                <div className="w-full max-w-md rounded-xl border border-white/10 bg-blue-900 p-6">
                  <h4 className="text-lg font-bold mb-4">Add Applicant</h4>
                  <div className="mb-3">
                    <label className={labelClass}>Search Contact</label>
                    <input value={applicantSearch} onChange={e => searchApplicants(e.target.value)} placeholder="Type name..." className={inputClass} />
                    {applicantResults.length > 0 && (
                      <ul className="mt-1 rounded-lg border border-white/10 bg-blue-950 max-h-40 overflow-y-auto">
                        {applicantResults.map(c => (
                          <li key={c.id}>
                            <button type="button" onClick={() => { setNewApplicant(f => ({ ...f, contact_id: c.id })); setApplicantSearch(`${c.first_name} ${c.last_name}`); setApplicantResults([]); }}
                              className={`w-full text-left px-4 py-2 text-sm hover:bg-white/10 ${newApplicant.contact_id === c.id ? "bg-white/10" : ""}`}>
                              {c.first_name} {c.last_name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="mb-3">
                    <label className={labelClass}>Relationship</label>
                    <select value={newApplicant.relationship} onChange={e => setNewApplicant(f => ({ ...f, relationship: e.target.value }))} className={selectClass}>
                      <option value="main" className="bg-blue-900">Main</option>
                      <option value="spouse" className="bg-blue-900">Spouse</option>
                      <option value="child" className="bg-blue-900">Child</option>
                      <option value="parent" className="bg-blue-900">Parent</option>
                      <option value="other" className="bg-blue-900">Other</option>
                    </select>
                  </div>
                  <div className="mb-4"><label className={labelClass}>Notes</label><input value={newApplicant.notes} onChange={e => setNewApplicant(f => ({ ...f, notes: e.target.value }))} className={inputClass} /></div>
                  <div className="flex gap-2">
                    <button onClick={handleAddApplicant} disabled={!newApplicant.contact_id} className={btnPrimary}>Add</button>
                    <button onClick={() => { setShowApplicantModal(false); setApplicantSearch(""); setApplicantResults([]); setNewApplicant({ contact_id: "", relationship: "main", notes: "" }); }} className={btnSecondary}>Cancel</button>
                  </div>
                </div>
              </div>
            )}

            {applicants.length === 0 ? (
              <p className="text-white/50 text-sm">No applicants yet.</p>
            ) : (
              <ul className="space-y-2">
                {applicants.map(a => (
                  <li key={a.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-2.5">
                    <div>
                      <Link href={`/contacts/${a.contact_id}`} className="font-medium text-blue-400 hover:underline">
                        {a.contacts?.first_name} {a.contacts?.last_name}
                      </Link>
                      <span className="ml-2 text-sm text-white/60 capitalize">{a.relationship ?? ""}</span>
                      {a.notes && <span className="ml-2 text-xs text-white/40">{a.notes}</span>}
                    </div>
                    <button onClick={() => handleRemoveApplicant(a.id)} className="text-xs text-red-400 hover:text-red-300 ml-4">Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── Section: Deal Information ───────────────────────────────────── */}
        <div className={sectionClass}>
          <h3 className="text-lg font-bold mb-4">Deal Information</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Deal Type</label>
              <select name="deal_type" value={form.deal_type} onChange={handleChange} className={selectClass}>
                <option value="individual_visa" className="bg-blue-900">Individual Visa</option>
                <option value="accreditation" className="bg-blue-900">Accreditation</option>
                <option value="job_check" className="bg-blue-900">Job Check</option>
                <option value="school_application" className="bg-blue-900">School Application</option>
              </select>
            </div>
            {form.deal_type === "individual_visa" && (
              <div>
                <label className={labelClass}>Visa Type</label>
                <select name="visa_type" value={form.visa_type} onChange={handleChange} className={selectClass}>
                  <option value="" className="bg-blue-900">Select...</option>
                  <option value="AEWV" className="bg-blue-900">AEWV</option>
                  <option value="SV" className="bg-blue-900">SV (Student Visa)</option>
                  <option value="RV" className="bg-blue-900">RV (Resident Visa)</option>
                  <option value="WV" className="bg-blue-900">WV (Work Visa)</option>
                  <option value="Visitor" className="bg-blue-900">Visitor</option>
                  <option value="Partnership" className="bg-blue-900">Partnership</option>
                  <option value="SMC" className="bg-blue-900">SMC (Skilled Migrant)</option>
                  <option value="Other" className="bg-blue-900">Other</option>
                </select>
              </div>
            )}
            <div className="sm:col-span-2">
              <label className={labelClass}>Description</label>
              <textarea name="description" value={form.description} onChange={handleChange} rows={2} className={`${inputClass} resize-none`} />
            </div>
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
            <div>
              <label className={labelClass}>Agent</label>
              <select name="agent_id" value={form.agent_id} onChange={handleChange} className={selectClass}>
                <option value="" className="bg-blue-900">No Agent</option>
                {agents.map(a => <option key={a.id} value={a.id} className="bg-blue-900">{a.agent_name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Assigned Sales</label>
              <select name="assigned_sales_id" value={form.assigned_sales_id} onChange={handleChange} className={selectClass}>
                <option value="" className="bg-blue-900">Select...</option>
                {salesUsers.map(s => <option key={s.id} value={s.id} className="bg-blue-900">{s.full_name ?? s.id}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Assigned LIA</label>
              <select name="assigned_lia_id" value={form.assigned_lia_id} onChange={handleChange} className={selectClass}>
                <option value="" className="bg-blue-900">No LIA Assigned</option>
                {salesUsers.map(s => <option key={s.id} value={s.id} className="bg-blue-900">{s.full_name ?? s.id}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Status {!isAdmin && <span className="text-white/30">(Admin only)</span>}</label>
              <select name="status" value={currentStatus} onChange={e => isAdmin && handleStatusChange(e.target.value)} disabled={!isAdmin} className={`${selectClass} max-w-xs`}>
                {Object.entries(DEAL_STATUS_LABELS).map(([v, l]) => <option key={v} value={v} className="bg-blue-900">{l}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Payment Status {!isAdmin && <span className="text-white/30">(Admin only)</span>}</label>
              <select name="payment_status" value={form.payment_status} onChange={handleChange} disabled={!isAdmin} className={`${selectClass} max-w-xs`}>
                <option value="unpaid" className="bg-blue-900">Unpaid</option>
                <option value="partial" className="bg-blue-900">Partial</option>
                <option value="paid" className="bg-blue-900">Paid</option>
              </select>
            </div>
            <div><label className={labelClass}>Submitted Date</label><input name="submitted_date" value={form.submitted_date} onChange={handleChange} type="date" className={inputClass} /></div>
            <div><label className={labelClass}>Approved Date</label><input name="approved_date" value={form.approved_date} onChange={handleChange} type="date" className={inputClass} /></div>
            <div><label className={labelClass}>Declined Date</label><input name="declined_date" value={form.declined_date} onChange={handleChange} type="date" className={inputClass} /></div>
            <div className="sm:col-span-2"><label className={labelClass}>Notes</label><textarea name="notes" value={form.notes} onChange={handleChange} rows={2} className={`${inputClass} resize-none`} /></div>
          </div>
          <div className="mt-4">
            <button onClick={handleSave} disabled={isSaving || !hasUnsavedChanges} className={btnPrimary}>
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        {/* ── Section: Activity Timeline ──────────────────────────────────── */}
        <div className={sectionClass}>
          <h3 className="text-lg font-bold mb-4">Activity Timeline</h3>
          {activityLogs.length === 0 ? <p className="text-white/50 text-sm">No activity yet.</p> : (
            <ul className="space-y-3">
              {activityLogs.map(log => (
                <li key={log.id} className="flex gap-3 text-sm">
                  <span className="text-white/40 whitespace-nowrap shrink-0">
                    {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="text-white/60 shrink-0">{userNames[log.user_id] ?? "Unknown"}</span>
                  <span className="text-white/90">
                    {log.action.replace(/_/g, " ")}
                    {log.details && (log.details as { from?: string }).from && (
                      <span className="ml-1 text-white/50"> ({(log.details as { from?: string }).from} → {(log.details as { to?: string }).to})</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Section: Attachments ────────────────────────────────────────── */}
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

        {/* ── Section: Email History ──────────────────────────────────────── */}
        <div className={sectionClass}>
          <h3 className="text-lg font-bold mb-4">Email History</h3>
          {emailLogs.length === 0 ? <p className="text-white/50 text-sm">No emails sent for this deal.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-white/10">
                  <th className="text-left py-2 text-white/50 font-medium">Date</th>
                  <th className="text-left py-2 text-white/50 font-medium">Type</th>
                  <th className="text-left py-2 text-white/50 font-medium">Recipient</th>
                  <th className="text-left py-2 text-white/50 font-medium">Subject</th>
                  <th className="text-left py-2 text-white/50 font-medium">Status</th>
                </tr></thead>
                <tbody>
                  {emailLogs.map(log => (
                    <tr key={log.id} className="border-b border-white/5">
                      <td className="py-2 pr-3 text-white/60 whitespace-nowrap text-xs">
                        {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="py-2 pr-3">
                        <span className="text-xs bg-blue-500/20 text-blue-300 rounded-full px-2 py-0.5">
                          {EMAIL_TYPE_LABELS[log.email_type ?? ""] ?? log.email_type ?? "—"}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-white/70 text-xs">{log.recipient_name}<br /><span className="text-white/40">{log.recipient_email}</span></td>
                      <td className="py-2 pr-3 text-white/70 text-xs max-w-xs truncate">{log.subject}</td>
                      <td className="py-2">
                        <span className={`text-xs rounded-full px-2 py-0.5 font-bold ${log.status === "sent" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
