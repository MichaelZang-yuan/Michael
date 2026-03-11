"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { hasRole, hasAnyRole } from "@/lib/roles";
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
  created_at: string;
  stage_name: string | null;
  stage_details: string | null;
  service_fee_amount: number;
  inz_fee_amount: number;
  other_fee_amount: number;
  gst_type: string | null;
  currency: string | null;
  amount: number;
  is_paid: boolean;
  paid_at: string | null;
  paid_marked_by: string | null;
  // backward compat fields
  description: string | null;
  payment_type: string | null;
  status: string;
  paid_date: string | null;
  payment_method: string | null;
  receipt_sent: boolean;
};

type EditStageRow = { id: string; stage_name: string; stage_details: string; service_fee: string; inz_fee: string; other_fee: string; gst_type: string; currency: string; is_paid: boolean; };
const STAGE_NAMES_DETAIL = ["Stage I", "Stage II", "Stage III", "Stage IV", "Stage V", "Stage VI"];
const GST_TYPES_DETAIL = ["Exclusive", "Inclusive", "Zero Rated"];
const CURRENCIES_DETAIL = ["NZD", "CNY", "THB"];
const newEditRow = (): EditStageRow => ({ id: `new-${Math.random().toString(36).slice(2)}`, stage_name: "Stage I", stage_details: "", service_fee: "", inz_fee: "", other_fee: "", gst_type: "Exclusive", currency: "NZD", is_paid: false });

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
  education_consultation: "Education Consultation", school_application: "School Application",
  offer_received: "Offer Received", education_only: "Education Only",
};

const DEAL_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-500/20 text-gray-400", quoted: "bg-blue-500/20 text-blue-400",
  contracted: "bg-purple-500/20 text-purple-400", in_progress: "bg-yellow-500/20 text-yellow-400",
  submitted: "bg-orange-500/20 text-orange-400", approved: "bg-green-500/20 text-green-400",
  declined: "bg-red-500/20 text-red-400", completed: "bg-green-600/20 text-green-300",
  cancelled: "bg-red-600/20 text-red-300",
  education_consultation: "bg-teal-500/20 text-teal-400", school_application: "bg-indigo-500/20 text-indigo-400",
  offer_received: "bg-cyan-500/20 text-cyan-400", education_only: "bg-teal-600/20 text-teal-300",
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
  contract_review_lia: "Contract Review (LIA)",
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
  // Myanmar-specific undo paths
  education_consultation: "draft",
  school_application: "education_consultation",
  offer_received: "school_application",
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

const MYANMAR_WORKFLOW_STEPS = [
  { key: "draft", label: "Draft" },
  { key: "education_consultation", label: "Edu Consult" },
  { key: "school_application", label: "School App" },
  { key: "offer_received", label: "Offer Received" },
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

function computeMyanmarWorkflowStep(dealStatus: string, contract: DealContract | null, intake: IntakeForm | null): number {
  if (dealStatus === "education_only") return 3; // special terminal at offer_received
  if (["approved", "declined", "completed", "cancelled"].includes(dealStatus)) return 9;
  if (dealStatus === "submitted") return 8;
  if (dealStatus === "in_progress") return 7;
  if (intake && ["sent", "in_progress", "completed", "submitted"].includes(intake.status)) return 6;
  if (contract && contract.status === "completed") return 5;
  if (contract && ["sent_to_lia", "lia_signed", "sent_to_client"].includes(contract.status)) return 4;
  if (dealStatus === "contracted") return 4;
  if (dealStatus === "offer_received") return 3;
  if (dealStatus === "school_application") return 2;
  if (dealStatus === "education_consultation") return 1;
  return 0;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DealDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  // Core deal state
  const [profile, setProfile] = useState<{ role: string; roles?: string[]; id: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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

  // Invoice state
  type InvoiceRecord = {
    id: string; invoice_number: string; currency: string; status: string;
    total: number; issue_date: string; due_date: string | null;
    pdf_url: string | null; payment_stage_ids: string[];
  };
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceSelectedStages, setInvoiceSelectedStages] = useState<string[]>([]);
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [invoiceIssueDate, setInvoiceIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [invoiceDueDate, setInvoiceDueDate] = useState("");
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [invoiceActionLoading, setInvoiceActionLoading] = useState<string | null>(null);

  // UI state — Payment stages edit
  const [editingStages, setEditingStages] = useState(false);
  const [editStageRows, setEditStageRows] = useState<EditStageRow[]>([]);
  const [isSavingStages, setIsSavingStages] = useState(false);
  const [showMarkPaidModal, setShowMarkPaidModal] = useState<string | null>(null);
  const [markPaidForm, setMarkPaidForm] = useState({ paid_date: new Date().toISOString().split("T")[0], payment_method: "bank_transfer" });

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
  const [isGeneratingChecklist, setIsGeneratingChecklist] = useState(false);
  const [aiChecklistPreview, setAiChecklistPreview] = useState<{ item_name: string; required: boolean; notes: string }[]>([]);
  const [showAiChecklistModal, setShowAiChecklistModal] = useState(false);

  // UI state — Applicants
  const [showApplicantModal, setShowApplicantModal] = useState(false);
  const [applicantSearch, setApplicantSearch] = useState("");
  const [applicantResults, setApplicantResults] = useState<ContactSearch[]>([]);
  const [newApplicant, setNewApplicant] = useState({ contact_id: "", relationship: "main", notes: "" });

  // Cover letter state
  const [coverLetter, setCoverLetter] = useState<{ id: string; content: string; status: string; pdf_url: string | null } | null>(null);
  const [coverLetterDraft, setCoverLetterDraft] = useState("");
  const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState(false);
  const [showCoverLetterModal, setShowCoverLetterModal] = useState(false);
  const [coverLetterNotes, setCoverLetterNotes] = useState("");
  const [isSavingCoverLetter, setIsSavingCoverLetter] = useState(false);
  const [isExportingCoverLetterPdf, setIsExportingCoverLetterPdf] = useState(false);

  // Agent commission state
  const [agentCommission, setAgentCommission] = useState<{
    id: string; commission_type: string; commission_rate: number; base_amount: number;
    commission_amount: number; status: string; paid_date: string | null;
    invoice_number: string | null; notes: string | null;
  } | null>(null);
  const [agentCommissionForm, setAgentCommissionForm] = useState({
    commission_type: "percentage", commission_rate: "", invoice_number: "", notes: "",
  });
  const [isSavingAgentCommission, setIsSavingAgentCommission] = useState(false);
  const [showMarkCommissionPaidModal, setShowMarkCommissionPaidModal] = useState(false);
  const [commissionPaidDate, setCommissionPaidDate] = useState(new Date().toISOString().split("T")[0]);
  const [agentName, setAgentName] = useState("");

  // School application state (Myanmar)
  const [schoolsList, setSchoolsList] = useState<{ id: string; name: string }[]>([]);
  const [schoolAppForm, setSchoolAppForm] = useState({
    school_id: "", course: "", status: "pending", application_date: "",
    offer_date: "", tuition_fee: "", enrollment_date: "", notes: "",
  });
  const [isSavingSchoolApp, setIsSavingSchoolApp] = useState(false);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [isStatusChanging, setIsStatusChanging] = useState(false);

  // Email confirm modal
  const [emailConfirm, setEmailConfirm] = useState<EmailConfirm | null>(null);

  // ─── Computed values ─────────────────────────────────────────────────────────

  const stageServiceTotal = payments.reduce((s, p) => s + (p.service_fee_amount || 0), 0);
  const stageInzTotal = payments.reduce((s, p) => s + (p.inz_fee_amount || 0), 0);
  const stageOtherTotal = payments.reduce((s, p) => s + (p.other_fee_amount || 0), 0);
  const stageTotalAmount = stageServiceTotal + stageInzTotal + stageOtherTotal;
  const totalPaidAmount = payments.filter(p => p.is_paid).reduce((s, p) => s + (p.service_fee_amount || 0) + (p.inz_fee_amount || 0) + (p.other_fee_amount || 0), 0);
  const outstandingAmount = stageTotalAmount - totalPaidAmount;

  const currentStatus = deal?.status ?? "draft";
  const isMyanmar = form.department === "myanmar";
  const workflowStep = isMyanmar
    ? computeMyanmarWorkflowStep(currentStatus, contract, intakeForm)
    : computeWorkflowStep(currentStatus, contract, intakeForm);
  const activeWorkflowSteps = isMyanmar ? MYANMAR_WORKFLOW_STEPS : WORKFLOW_STEPS;
  const isTerminal = ["approved", "declined", "completed", "cancelled", "education_only"].includes(currentStatus);
  const isAdmin = hasRole(profile, "admin");
  const canChangeStatus = isAdmin || (deal?.assigned_lia_id === profile?.id);

  const clientName = deal?.contacts
    ? `${deal.contacts.first_name} ${deal.contacts.last_name}`
    : deal?.companies?.company_name ?? "—";
  const clientEmail = deal?.contacts?.email ?? deal?.companies?.email ?? "";


  // ─── Fetch functions ─────────────────────────────────────────────────────────

  const fetchPayments = useCallback(async () => {
    const { data, error } = await supabase.from("deal_payments").select("*").eq("deal_id", id).order("created_at");
    if (error) {
      setMessage({ type: "error", text: `Failed to load payment stages: ${error.message}` });
      return;
    }
    setPayments((data ?? []) as DealPayment[]);
  }, [id]);

  const fetchInvoices = useCallback(async () => {
    const { data } = await supabase.from("invoices").select("id, invoice_number, currency, status, total, issue_date, due_date, pdf_url, payment_stage_ids").eq("deal_id", id).order("created_at", { ascending: false });
    setInvoices((data ?? []) as InvoiceRecord[]);
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

  const fetchCoverLetter = useCallback(async () => {
    const { data } = await supabase.from("cover_letters")
      .select("id, content, status, pdf_url")
      .eq("deal_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      setCoverLetter(data as { id: string; content: string; status: string; pdf_url: string | null });
      setCoverLetterDraft(data.content ?? "");
    } else {
      setCoverLetter(null);
      setCoverLetterDraft("");
    }
  }, [id]);

  const fetchAgentCommission = useCallback(async () => {
    const { data } = await supabase.from("agent_commissions")
      .select("id, commission_type, commission_rate, base_amount, commission_amount, status, paid_date, invoice_number, notes")
      .eq("deal_id", id)
      .limit(1)
      .maybeSingle();
    if (data) {
      setAgentCommission(data as typeof agentCommission);
      setAgentCommissionForm({
        commission_type: data.commission_type ?? "percentage",
        commission_rate: data.commission_rate != null ? String(data.commission_rate) : "",
        invoice_number: data.invoice_number ?? "",
        notes: data.notes ?? "",
      });
    } else {
      setAgentCommission(null);
    }
  }, [id]);

  // ─── Init ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/admin"); return; }

      const { data: profileData } = await supabase.from("profiles").select("id, role, roles").eq("id", session.user.id).single();
      if (profileData) setProfile(profileData);

      const { data: salesData } = await supabase.from("profiles").select("id, full_name").overlaps("roles", ["admin", "sales", "lia"]).order("full_name");
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

      // Fetch agent name if deal has an agent
      if (dealData.agent_id) {
        const { data: agentData } = await supabase.from("agents").select("agent_name").eq("id", dealData.agent_id).single();
        if (agentData) setAgentName(agentData.agent_name ?? "");
      }

      // Load school application data (Myanmar workflow)
      if (dealData.department === "myanmar") {
        setSchoolAppForm({
          school_id: dealData.school_application_school_id ?? "",
          course: dealData.school_application_course ?? "",
          status: dealData.school_application_status ?? "pending",
          application_date: dealData.school_application_date ?? "",
          offer_date: dealData.school_application_offer_date ?? "",
          tuition_fee: dealData.school_application_tuition_fee != null ? String(dealData.school_application_tuition_fee) : "",
          enrollment_date: dealData.school_application_enrollment_date ?? "",
          notes: dealData.school_application_notes ?? "",
        });
        const { data: schoolsData } = await supabase.from("schools").select("id, name").order("name");
        if (schoolsData) setSchoolsList(schoolsData as { id: string; name: string }[]);
      }

      await Promise.all([
        fetchPayments(), fetchContract(), fetchIntakeForm(), fetchChecklist(),
        fetchEmailLogs(), fetchApplicants(), fetchAttachments(), fetchLogs(),
        fetchCoverLetter(), fetchAgentCommission(), fetchInvoices(),
      ]);
      setIsLoading(false);
    }
    init();
  }, [id, router, fetchPayments, fetchContract, fetchIntakeForm, fetchChecklist, fetchEmailLogs, fetchApplicants, fetchAttachments, fetchLogs, fetchCoverLetter, fetchAgentCommission, fetchInvoices]);

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
    const fmtAmt = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const paymentStagesHtml = payments.length > 0
      ? `<table style="width:100%;border-collapse:collapse;font-size:13px;margin:8px 0;">
          <thead><tr>
            <th style="text-align:left;padding:4px 8px;border-bottom:2px solid #ccc;">Stage</th>
            <th style="text-align:left;padding:4px 8px;border-bottom:2px solid #ccc;">Details</th>
            <th style="text-align:right;padding:4px 8px;border-bottom:2px solid #ccc;">Service Fee</th>
            <th style="text-align:right;padding:4px 8px;border-bottom:2px solid #ccc;">INZ Fee</th>
            <th style="text-align:right;padding:4px 8px;border-bottom:2px solid #ccc;">Other Fee</th>
            <th style="text-align:left;padding:4px 8px;border-bottom:2px solid #ccc;">GST</th>
            <th style="text-align:right;padding:4px 8px;border-bottom:2px solid #ccc;">Total</th>
          </tr></thead>
          <tbody>
            ${payments.map(p => {
              const t = (p.service_fee_amount || 0) + (p.inz_fee_amount || 0) + (p.other_fee_amount || 0);
              return `<tr>
                <td style="padding:4px 8px;border-bottom:1px solid #eee;">${p.stage_name ?? ""}</td>
                <td style="padding:4px 8px;border-bottom:1px solid #eee;">${p.stage_details ?? p.description ?? ""}</td>
                <td style="text-align:right;padding:4px 8px;border-bottom:1px solid #eee;">${p.service_fee_amount ? fmtAmt(p.service_fee_amount) : "-"}</td>
                <td style="text-align:right;padding:4px 8px;border-bottom:1px solid #eee;">${p.inz_fee_amount ? fmtAmt(p.inz_fee_amount) : "-"}</td>
                <td style="text-align:right;padding:4px 8px;border-bottom:1px solid #eee;">${p.other_fee_amount ? fmtAmt(p.other_fee_amount) : "-"}</td>
                <td style="padding:4px 8px;border-bottom:1px solid #eee;">${p.gst_type ?? ""}</td>
                <td style="text-align:right;padding:4px 8px;border-bottom:1px solid #eee;font-weight:600;">${fmtAmt(t)}</td>
              </tr>`;
            }).join("")}
            <tr style="font-weight:bold;border-top:2px solid #ccc;">
              <td style="padding:4px 8px;" colspan="2">Total</td>
              <td style="text-align:right;padding:4px 8px;">${fmtAmt(stageServiceTotal)}</td>
              <td style="text-align:right;padding:4px 8px;">${fmtAmt(stageInzTotal)}</td>
              <td style="text-align:right;padding:4px 8px;">${fmtAmt(stageOtherTotal)}</td>
              <td style="padding:4px 8px;"></td>
              <td style="text-align:right;padding:4px 8px;">${fmtAmt(stageTotalAmount)}</td>
            </tr>
          </tbody>
        </table>`
      : "(No payment stages defined)";
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
      service_fee: stageServiceTotal > 0 ? fmtAmt(stageServiceTotal) : "",
      total_service_fee: stageServiceTotal > 0 ? fmtAmt(stageServiceTotal) : "",
      inz_application_fee: stageInzTotal > 0 ? fmtAmt(stageInzTotal) : "TBA",
      government_fee: stageInzTotal > 0 ? fmtAmt(stageInzTotal) : "TBA",
      total_amount: stageTotalAmount > 0 ? fmtAmt(stageTotalAmount) : "",
      currency: "NZ",
      refund_percentage: form.refund_percentage || "50",
      payment_stages_table: paymentStagesHtml,
      lia_name: liaPerson?.full_name ?? "",
      sales_name: salesPerson?.full_name ?? "",
      date_today: today,
      signature_client: "________________________",
      signature_lia: "________________________",
      adviser_signature: "<!-- [adviser-sig] -->",
      client_signature: "<!-- [client-sig] -->",
      adviser_sign_date: "<!-- [adviser-date] -->___________________",
      client_sign_date: "<!-- [client-date] -->___________________",
    };
  };

  // ─── School Application (Myanmar) ────────────────────────────────────────

  const handleSaveSchoolApp = async () => {
    setIsSavingSchoolApp(true);
    setMessage(null);
    const { error } = await supabase.from("deals").update({
      school_application_school_id: schoolAppForm.school_id || null,
      school_application_course: schoolAppForm.course.trim() || null,
      school_application_status: schoolAppForm.status || null,
      school_application_date: schoolAppForm.application_date || null,
      school_application_offer_date: schoolAppForm.offer_date || null,
      school_application_tuition_fee: schoolAppForm.tuition_fee ? parseFloat(schoolAppForm.tuition_fee) : null,
      school_application_enrollment_date: schoolAppForm.enrollment_date || null,
      school_application_notes: schoolAppForm.notes.trim() || null,
    }).eq("id", id);
    if (error) {
      setMessage({ type: "error", text: "Failed to save school application: " + error.message });
    } else {
      setMessage({ type: "success", text: "School application saved." });
    }
    setIsSavingSchoolApp(false);
  };

  // ─── Deal CRUD ────────────────────────────────────────────────────────────

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

  // ─── Payment stage handlers ────────────────────────────────────────────────

  const handleOpenEditStages = () => {
    setEditStageRows(payments.map(p => ({
      id: p.id,
      stage_name: p.stage_name ?? "Stage I",
      stage_details: p.stage_details ?? p.description ?? "",
      service_fee: String(p.service_fee_amount || 0),
      inz_fee: String(p.inz_fee_amount || 0),
      other_fee: String(p.other_fee_amount || 0),
      gst_type: p.gst_type ?? "Exclusive",
      currency: p.currency ?? "NZD",
      is_paid: p.is_paid,
    })));
    setEditingStages(true);
  };

  const handleSaveStages = async () => {
    setIsSavingStages(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Delete removed stages (only unpaid ones can be deleted; paid ones are locked in UI)
    const existingIds = payments.map(p => p.id);
    const keptIds = editStageRows.filter(r => !r.id.startsWith("new-")).map(r => r.id);
    const deletedIds = existingIds.filter(id => !keptIds.includes(id));
    if (deletedIds.length) {
      await supabase.from("deal_payments").delete().in("id", deletedIds);
    }

    // Update existing / insert new
    for (const row of editStageRows) {
      const svc = parseFloat(row.service_fee) || 0;
      const inz = parseFloat(row.inz_fee) || 0;
      const other = parseFloat(row.other_fee) || 0;
      const vals = {
        stage_name: row.stage_name,
        stage_details: row.stage_details.trim() || null,
        service_fee_amount: svc,
        inz_fee_amount: inz,
        other_fee_amount: other,
        amount: svc + inz + other,
        gst_type: row.gst_type,
        currency: row.currency,
      };
      if (row.id.startsWith("new-")) {
        await supabase.from("deal_payments").insert({ ...vals, deal_id: id, is_paid: false, status: "pending", created_by: session.user.id });
      } else {
        await supabase.from("deal_payments").update(vals).eq("id", row.id);
      }
    }

    // Sync deals table totals
    const newSvcTotal = editStageRows.reduce((s, r) => s + (parseFloat(r.service_fee) || 0), 0);
    const newInzTotal = editStageRows.reduce((s, r) => s + (parseFloat(r.inz_fee) || 0), 0);
    const newOtherTotal = editStageRows.reduce((s, r) => s + (parseFloat(r.other_fee) || 0), 0);
    await supabase.from("deals").update({
      service_fee: newSvcTotal || null,
      inz_application_fee: newInzTotal || null,
      other_fee: newOtherTotal || null,
      total_amount: (newSvcTotal + newInzTotal + newOtherTotal) || null,
    }).eq("id", id);

    await logActivity(supabase, session.user.id, "updated_payment_stages", "deals", id, { stage_count: editStageRows.length });
    setEditingStages(false);
    setIsSavingStages(false);
    await fetchPayments();
    await fetchLogs();
  };

  const handleMarkPaid = async () => {
    if (!showMarkPaidModal) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const p = payments.find(p => p.id === showMarkPaidModal);
    await supabase.from("deal_payments").update({
      is_paid: true,
      paid_at: new Date().toISOString(),
      paid_marked_by: session.user.id,
      status: "paid",
      paid_date: markPaidForm.paid_date,
      payment_method: markPaidForm.payment_method,
    }).eq("id", showMarkPaidModal);
    await logActivity(supabase, session.user.id, "marked_payment_paid", "deals", id, { paid_date: markPaidForm.paid_date });
    setShowMarkPaidModal(null);
    await fetchPayments();
    await fetchLogs();

    // Offer to send receipt email
    if (p && clientEmail) {
      const stageTotal = (p.service_fee_amount || 0) + (p.inz_fee_amount || 0) + (p.other_fee_amount || 0);
      requestEmailConfirm({
        recipientName: clientName, recipientEmail: clientEmail,
        emailType: "payment_received",
        extraData: { amount: stageTotal, description: p.stage_details ?? p.stage_name ?? "", paid_date: markPaidForm.paid_date },
        onConfirm: async () => {
          await sendNotification("payment_received", clientEmail, clientName, { amount: stageTotal, description: p.stage_details ?? p.stage_name ?? "", paid_date: markPaidForm.paid_date });
          await supabase.from("deal_payments").update({ receipt_sent: true }).eq("id", p.id);
          await fetchPayments();
          setMessage({ type: "success", text: "Receipt sent." });
        },
      });
    }
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
    const { data: contractData, error } = await supabase.from("deal_contracts").insert({
      deal_id: id, contract_number: contractNumber, contract_type: contractType,
      status: "draft", created_by: session.user.id,
      template_id: selectedContractTemplateId || null,
      content: contractContent || null,
      contract_html: contractContent || null,
    }).select().single();
    if (error) { setMessage({ type: "error", text: error.message }); setIsContractCreating(false); return; }

    // Generate draft PDF in background (non-blocking)
    if (contractData?.id && contractContent) {
      fetch(`/api/contracts/${contractData.id}/generate-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "draft" }),
      }).catch(e => console.error("[contractPdf] draft:", e));
    }

    await logActivity(supabase, session.user.id, "created_contract", "deals", id, { contract_number: contractNumber });
    await fetchContract();
    await fetchLogs();
    setShowContractCreateModal(false);
    setIsContractCreating(false);

    // Send email to assigned LIA for contract review
    if (deal?.assigned_lia_id && contractData?.id) {
      console.log("[contract] LIA assigned, fetching LIA profile:", deal.assigned_lia_id);
      const liaUser = salesUsers.find(s => s.id === deal.assigned_lia_id);
      if (liaUser) {
        const { data: liaProfile } = await supabase.from("profiles").select("email").eq("id", deal.assigned_lia_id).single();
        console.log("[contract] LIA profile fetched:", { name: liaUser.full_name, email: liaProfile?.email });
        if (liaProfile?.email) {
          const previewSignUrl = `https://www.pjcommission.com/contract/preview/${contractData.id}`;
          const liaClientName = deal.contacts
            ? `${deal.contacts.first_name} ${deal.contacts.last_name}`.trim()
            : deal.companies?.company_name ?? "";
          console.log("[contract] Sending contract_review_lia email to:", liaProfile.email);
          try {
            await sendNotification("contract_review_lia", liaProfile.email, liaUser.full_name ?? "LIA", {
              client_name: liaClientName,
              deal_type: form.deal_type ?? "",
              visa_type: form.visa_type ?? "",
              preview_sign_url: previewSignUrl,
            });
            console.log("[contract] LIA email sent successfully");
            setMessage({ type: "success", text: `Contract created. LIA notification sent to ${liaUser.full_name}.` });
          } catch (err) {
            console.error("[contract] LIA email failed:", err);
            setMessage({ type: "error", text: "Contract created, but failed to send LIA notification." });
          }
        } else {
          console.warn("[contract] LIA has no email address");
          setMessage({ type: "error", text: "Contract created. LIA has no email address — notification skipped." });
        }
      } else {
        console.warn("[contract] LIA user not found in salesUsers list");
      }
    } else {
      console.log("[contract] No LIA assigned to this deal, skipping email");
      setMessage({ type: "success", text: "Contract created. No LIA assigned — email notification skipped." });
    }
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

  // ─── AI Checklist generation ────────────────────────────────────────────

  const handleAiGenerateChecklist = async () => {
    if (!form.visa_type) { setMessage({ type: "error", text: "Set a visa type first." }); return; }
    setIsGeneratingChecklist(true);
    try {
      const res = await fetch("/api/generate-checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visa_type: form.visa_type,
          description: form.description || undefined,
          deal_type: form.deal_type || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage({ type: "error", text: data.error ?? "Checklist generation failed" }); return; }
      setAiChecklistPreview(data.items ?? []);
      setShowAiChecklistModal(true);
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Checklist generation failed" });
    } finally {
      setIsGeneratingChecklist(false);
    }
  };

  const handleAddAiChecklistItems = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const rows = aiChecklistPreview.map(item => ({
      deal_id: id,
      item_name: item.item_name,
      required: item.required,
      notes: item.notes || null,
      created_by: session.user.id,
    }));
    await supabase.from("document_checklists").insert(rows);
    await fetchChecklist();
    setShowAiChecklistModal(false);
    setAiChecklistPreview([]);
    setMessage({ type: "success", text: `${rows.length} AI-generated items added.` });
  };

  // ─── Cover letter handlers ─────────────────────────────────────────────

  const handleGenerateCoverLetter = async (additionalNotes?: string) => {
    setIsGeneratingCoverLetter(true);
    setShowCoverLetterModal(false);
    try {
      const res = await fetch("/api/generate-cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deal_id: id, additional_notes: additionalNotes || "" }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage({ type: "error", text: data.error ?? "Cover letter generation failed" }); return; }
      setCoverLetterDraft(data.content ?? "");
      setMessage({ type: "success", text: "Cover letter generated. Edit and save when ready." });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Cover letter generation failed" });
    } finally {
      setIsGeneratingCoverLetter(false);
    }
  };

  const handleSaveCoverLetter = async () => {
    if (!coverLetterDraft.trim()) return;
    setIsSavingCoverLetter(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    try {
      if (coverLetter) {
        await supabase.from("cover_letters").update({ content: coverLetterDraft, status: "draft" }).eq("id", coverLetter.id);
      } else {
        await supabase.from("cover_letters").insert({
          deal_id: id, content: coverLetterDraft, status: "draft", created_by: session.user.id,
        });
      }
      await fetchCoverLetter();
      setMessage({ type: "success", text: "Cover letter saved." });
    } catch {
      setMessage({ type: "error", text: "Failed to save cover letter." });
    } finally {
      setIsSavingCoverLetter(false);
    }
  };

  const handleExportCoverLetterPdf = async () => {
    if (!coverLetter) return;
    setIsExportingCoverLetterPdf(true);
    try {
      const res = await fetch(`/api/cover-letter/${coverLetter.id}/export-pdf`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setMessage({ type: "error", text: data.error ?? "PDF export failed" }); return; }
      window.open(data.url, "_blank");
      await fetchCoverLetter();
      setMessage({ type: "success", text: "PDF exported." });
    } catch {
      setMessage({ type: "error", text: "PDF export failed." });
    } finally {
      setIsExportingCoverLetterPdf(false);
    }
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
      <Navbar />
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
          <div className="flex gap-2 shrink-0">
            {hasAnyRole(profile, ["admin", "accountant"]) && (
              <button onClick={() => router.push(`/deals/${id}/edit`)} className={btnSecondary}>Edit Deal</button>
            )}
            {isAdmin && (
              <button onClick={handleDelete} disabled={isDeleting} className={btnDanger}>
                {isDeleting ? "Deleting..." : "Delete Deal"}
              </button>
            )}
          </div>
        </div>

        {message && (
          <div className={`mb-6 rounded-lg px-4 py-3 ${message.type === "error" ? "bg-red-500/20 text-red-300 border border-red-500/30" : "bg-green-500/20 text-green-300 border border-green-500/30"}`}>
            {message.text}
          </div>
        )}

        {/* ── Workflow Progress Bar ───────────────────────────────────────── */}
        <div className="mb-6 rounded-xl border border-white/10 bg-white/5 px-6 py-5">
          {currentStatus === "education_only" && (
            <div className="mb-3 rounded-lg border border-teal-500 bg-teal-500/20 px-4 py-2.5 text-center">
              <span className="text-sm font-bold text-teal-300">Education Only — Visa Service Not Proceeded</span>
            </div>
          )}
          <div className="flex items-center gap-0">
            {activeWorkflowSteps.map((step, i) => {
              const isCompleted = i < workflowStep;
              const isActive = i === workflowStep;
              const totalSteps = activeWorkflowSteps.length;
              const isDeclined = currentStatus === "declined" && i === totalSteps;
              const isEdOnly = currentStatus === "education_only" && i === workflowStep;
              return (
                <div key={step.key} className="flex items-center flex-1 min-w-0">
                  <div className="flex flex-col items-center min-w-0">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border-2 transition-all ${
                      isCompleted ? "bg-blue-500 border-blue-500 text-white" :
                      isEdOnly ? "bg-teal-500 border-teal-500 text-white" :
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
                  {i < totalSteps - 1 && (
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
            {/* Myanmar-specific workflow buttons */}
            {isMyanmar && currentStatus === "draft" && (
              <button onClick={() => handleStatusChange("education_consultation")} disabled={isStatusChanging} className="rounded-lg bg-teal-600 px-5 py-2.5 font-bold text-white hover:bg-teal-700 disabled:opacity-50 text-sm">
                Start Education Consultation
              </button>
            )}
            {isMyanmar && currentStatus === "education_consultation" && (
              <>
                <button onClick={() => handleStatusChange("school_application")} disabled={isStatusChanging} className="rounded-lg bg-indigo-600 px-5 py-2.5 font-bold text-white hover:bg-indigo-700 disabled:opacity-50 text-sm">
                  Proceed to School Application
                </button>
                <button onClick={() => handleStatusChange("contracted")} disabled={isStatusChanging} className="rounded-lg bg-purple-600 px-5 py-2.5 font-bold text-white hover:bg-purple-700 disabled:opacity-50 text-sm">
                  Skip to Contract
                </button>
              </>
            )}
            {isMyanmar && currentStatus === "school_application" && (
              <button
                onClick={() => {
                  if (schoolAppForm.status !== "offer_received") {
                    setMessage({ type: "error", text: "Please update the School Application status to 'Offer Received' before proceeding." });
                    return;
                  }
                  handleStatusChange("offer_received");
                }}
                disabled={isStatusChanging}
                className="rounded-lg bg-cyan-600 px-5 py-2.5 font-bold text-white hover:bg-cyan-700 disabled:opacity-50 text-sm"
              >
                Mark Offer Received
              </button>
            )}
            {isMyanmar && currentStatus === "offer_received" && (
              <>
                <button onClick={() => handleStatusChange("contracted")} disabled={isStatusChanging} className="rounded-lg bg-purple-600 px-5 py-2.5 font-bold text-white hover:bg-purple-700 disabled:opacity-50 text-sm">
                  Proceed to Contract
                </button>
                <button onClick={() => handleStatusChange("education_only")} disabled={isStatusChanging} className="rounded-lg bg-teal-600 px-5 py-2.5 font-bold text-white hover:bg-teal-700 disabled:opacity-50 text-sm">
                  Mark as Education Only
                </button>
              </>
            )}

            {/* Standard workflow buttons */}
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
            {isTerminal && currentStatus === "education_only" && isAdmin && (
              <button onClick={() => handleStatusChange("offer_received")} disabled={isStatusChanging} className={`${btnSecondary} text-sm`}>
                Reopen to Offer Received
              </button>
            )}
            {!isTerminal && (
              <button onClick={() => handleStatusChange("cancelled")} disabled={isStatusChanging} className={`${btnDanger} text-sm`}>
                Cancel Deal
              </button>
            )}
            {currentStatus !== "draft" && !isTerminal && STATUS_PREV[currentStatus] && (
              <button onClick={() => handleStatusChange(STATUS_PREV[currentStatus])} disabled={isStatusChanging} className={`${btnSecondary} text-sm`}>
                ↩ Undo to {DEAL_STATUS_LABELS[STATUS_PREV[currentStatus]] ?? "Previous"}
              </button>
            )}
          </div>
        )}

        {/* ── Section: School Application (Myanmar only) ──────────────────── */}
        {isMyanmar && !["draft"].includes(currentStatus) && currentStatus !== "education_only" && (
          <div className={sectionClass}>
            <h3 className="text-lg font-bold mb-4">School Application</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>School</label>
                <select value={schoolAppForm.school_id} onChange={e => setSchoolAppForm(f => ({ ...f, school_id: e.target.value }))} className={selectClass}>
                  <option value="" className="bg-blue-900">Select school...</option>
                  {schoolsList.map(s => <option key={s.id} value={s.id} className="bg-blue-900">{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Course Name</label>
                <input value={schoolAppForm.course} onChange={e => setSchoolAppForm(f => ({ ...f, course: e.target.value }))} placeholder="e.g. Bachelor of IT" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Application Status</label>
                <select value={schoolAppForm.status} onChange={e => setSchoolAppForm(f => ({ ...f, status: e.target.value }))} className={selectClass}>
                  <option value="pending" className="bg-blue-900">Pending</option>
                  <option value="submitted" className="bg-blue-900">Submitted</option>
                  <option value="offer_received" className="bg-blue-900">Offer Received</option>
                  <option value="rejected" className="bg-blue-900">Rejected</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Application Date</label>
                <input type="date" value={schoolAppForm.application_date} onChange={e => setSchoolAppForm(f => ({ ...f, application_date: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Offer Date</label>
                <input type="date" value={schoolAppForm.offer_date} onChange={e => setSchoolAppForm(f => ({ ...f, offer_date: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Tuition Fee ($)</label>
                <input type="number" step="0.01" min="0" value={schoolAppForm.tuition_fee} onChange={e => setSchoolAppForm(f => ({ ...f, tuition_fee: e.target.value }))} placeholder="0.00" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Enrollment Date</label>
                <input type="date" value={schoolAppForm.enrollment_date} onChange={e => setSchoolAppForm(f => ({ ...f, enrollment_date: e.target.value }))} className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Notes</label>
                <textarea value={schoolAppForm.notes} onChange={e => setSchoolAppForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={`${inputClass} resize-none`} />
              </div>
            </div>
            <button onClick={handleSaveSchoolApp} disabled={isSavingSchoolApp} className={`mt-4 ${btnPrimary}`}>
              {isSavingSchoolApp ? "Saving..." : "Save School Application"}
            </button>
          </div>
        )}

        {/* ── Section: Pricing & Payments ────────────────────────────────── */}
        <div className={sectionClass}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Pricing & Payment Stages</h3>
            {!editingStages && hasAnyRole(profile, ["admin", "accountant"]) && (
              <button onClick={handleOpenEditStages} className={btnSecondary}>Edit Stages</button>
            )}
          </div>

          {/* Totals summary */}
          <div className="grid grid-cols-2 gap-3 mb-4 sm:grid-cols-4">
            <div className="rounded-lg bg-white/5 px-3 py-2.5 text-center"><p className="text-xs text-white/50 mb-0.5">Service Fee</p><p className="font-bold">${fmt(stageServiceTotal)}</p></div>
            <div className="rounded-lg bg-white/5 px-3 py-2.5 text-center"><p className="text-xs text-white/50 mb-0.5">INZ Fee</p><p className="font-bold">${fmt(stageInzTotal)}</p></div>
            <div className="rounded-lg bg-white/5 px-3 py-2.5 text-center"><p className="text-xs text-white/50 mb-0.5">Other Fee</p><p className="font-bold">${fmt(stageOtherTotal)}</p></div>
            <div className="rounded-lg bg-blue-600/20 px-3 py-2.5 text-center"><p className="text-xs text-white/50 mb-0.5">Total</p><p className="font-bold text-blue-300">${fmt(stageTotalAmount)}</p></div>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-lg bg-white/5 px-3 py-2 text-center"><p className="text-xs text-white/50 mb-0.5">Total Due</p><p className="font-semibold text-sm">${fmt(stageTotalAmount)}</p></div>
            <div className="rounded-lg bg-green-500/10 px-3 py-2 text-center"><p className="text-xs text-white/50 mb-0.5">Paid</p><p className="font-semibold text-sm text-green-400">${fmt(totalPaidAmount)}</p></div>
            <div className="rounded-lg bg-white/5 px-3 py-2 text-center"><p className="text-xs text-white/50 mb-0.5">Outstanding</p><p className={`font-semibold text-sm ${outstandingAmount > 0 ? "text-yellow-400" : "text-green-400"}`}>${fmt(outstandingAmount)}</p></div>
          </div>

          {/* View mode: stages table */}
          {!editingStages && payments.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-white/10">
                  <th className="text-left py-2 px-2 text-white/50 font-medium">Stage</th>
                  <th className="text-left py-2 px-2 text-white/50 font-medium">Details</th>
                  <th className="text-right py-2 px-2 text-white/50 font-medium">Svc Fee</th>
                  <th className="text-right py-2 px-2 text-white/50 font-medium">INZ Fee</th>
                  <th className="text-right py-2 px-2 text-white/50 font-medium">Other</th>
                  <th className="text-left py-2 px-2 text-white/50 font-medium">GST</th>
                  <th className="text-left py-2 px-2 text-white/50 font-medium">Ccy</th>
                  <th className="text-right py-2 px-2 text-white/50 font-medium">Total</th>
                  <th className="text-left py-2 px-2 text-white/50 font-medium">Status</th>
                  {hasAnyRole(profile, ["admin", "accountant"]) && <th className="py-2 px-2"></th>}
                </tr></thead>
                <tbody>
                  {payments.map(p => {
                    const stageTotal = (p.service_fee_amount || 0) + (p.inz_fee_amount || 0) + (p.other_fee_amount || 0);
                    return (
                      <tr key={p.id} className={`border-b border-white/5 ${p.is_paid ? "opacity-60" : ""}`}>
                        <td className="py-2 px-2 font-medium text-white/80">{p.stage_name ?? "—"}</td>
                        <td className="py-2 px-2 text-white/60 text-xs">{p.stage_details ?? p.description ?? "—"}</td>
                        <td className="py-2 px-2 text-right text-white/80">{p.service_fee_amount ? `$${fmt(p.service_fee_amount)}` : "-"}</td>
                        <td className="py-2 px-2 text-right text-white/80">{p.inz_fee_amount ? `$${fmt(p.inz_fee_amount)}` : "-"}</td>
                        <td className="py-2 px-2 text-right text-white/80">{p.other_fee_amount ? `$${fmt(p.other_fee_amount)}` : "-"}</td>
                        <td className="py-2 px-2 text-white/60 text-xs">{p.gst_type ?? "—"}</td>
                        <td className="py-2 px-2 text-white/60 text-xs">{p.currency ?? "NZD"}</td>
                        <td className="py-2 px-2 text-right font-semibold">${fmt(stageTotal)}</td>
                        <td className="py-2 px-2">
                          {p.is_paid
                            ? <span className="rounded-full px-2 py-0.5 text-xs font-bold bg-green-500/20 text-green-400">Paid</span>
                            : <span className="rounded-full px-2 py-0.5 text-xs font-bold bg-yellow-500/20 text-yellow-400">Unpaid</span>
                          }
                        </td>
                        {hasAnyRole(profile, ["admin", "accountant"]) && (
                          <td className="py-2 px-2">
                            {!p.is_paid && (
                              <button onClick={() => { setShowMarkPaidModal(p.id); setMarkPaidForm({ paid_date: new Date().toISOString().split("T")[0], payment_method: "bank_transfer" }); }}
                                className="text-xs text-green-400 hover:text-green-300 whitespace-nowrap">Mark Paid</button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!editingStages && payments.length === 0 && (
            <div className="text-center py-6 text-white/40 text-sm">
              No payment stages defined.
              {hasAnyRole(profile, ["admin", "accountant"]) && (
                <button onClick={handleOpenEditStages} className="ml-2 text-blue-400 hover:text-blue-300 underline">Add stages</button>
              )}
            </div>
          )}

          {/* Edit mode: inline stage editor */}
          {editingStages && (
            <div className="mt-2">
              <div className="space-y-3 mb-4">
                {editStageRows.map((row, idx) => (
                  <div key={row.id} className={`rounded-lg border p-4 ${row.is_paid ? "border-green-500/30 bg-green-500/5 opacity-70" : "border-white/10 bg-white/5"}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white/50 uppercase tracking-wider">Stage {idx + 1}</span>
                        {row.is_paid && <span className="text-xs text-green-400 bg-green-500/20 rounded-full px-2 py-0.5">Paid — locked</span>}
                      </div>
                      {!row.is_paid && editStageRows.length > 1 && (
                        <button type="button" onClick={() => setEditStageRows(rs => rs.filter(r => r.id !== row.id))}
                          className="text-xs text-red-400 hover:text-red-300">Remove</button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-3">
                      <div>
                        <label className={labelClass}>Stage Name</label>
                        {row.is_paid
                          ? <p className="text-sm text-white/70 px-1">{row.stage_name}</p>
                          : <select value={row.stage_name} onChange={e => setEditStageRows(rs => rs.map(r => r.id === row.id ? { ...r, stage_name: e.target.value } : r))} className={selectClass}>
                              {STAGE_NAMES_DETAIL.map(n => <option key={n} value={n} className="bg-blue-900">{n}</option>)}
                            </select>
                        }
                      </div>
                      <div>
                        <label className={labelClass}>Stage Details</label>
                        {row.is_paid
                          ? <p className="text-sm text-white/70 px-1">{row.stage_details || "—"}</p>
                          : <input value={row.stage_details} onChange={e => setEditStageRows(rs => rs.map(r => r.id === row.id ? { ...r, stage_details: e.target.value } : r))}
                              placeholder="e.g. Signing agreement" className={inputClass} />
                        }
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                      <div>
                        <label className={labelClass}>Service Fee</label>
                        {row.is_paid
                          ? <p className="text-sm font-semibold px-1">${fmt(parseFloat(row.service_fee) || 0)}</p>
                          : <input value={row.service_fee} onChange={e => setEditStageRows(rs => rs.map(r => r.id === row.id ? { ...r, service_fee: e.target.value } : r))}
                              type="number" step="0.01" min="0" placeholder="0.00" className={inputClass} />
                        }
                      </div>
                      <div>
                        <label className={labelClass}>INZ Fee</label>
                        {row.is_paid
                          ? <p className="text-sm font-semibold px-1">${fmt(parseFloat(row.inz_fee) || 0)}</p>
                          : <input value={row.inz_fee} onChange={e => setEditStageRows(rs => rs.map(r => r.id === row.id ? { ...r, inz_fee: e.target.value } : r))}
                              type="number" step="0.01" min="0" placeholder="0.00" className={inputClass} />
                        }
                      </div>
                      <div>
                        <label className={labelClass}>Other Fee</label>
                        {row.is_paid
                          ? <p className="text-sm font-semibold px-1">${fmt(parseFloat(row.other_fee) || 0)}</p>
                          : <input value={row.other_fee} onChange={e => setEditStageRows(rs => rs.map(r => r.id === row.id ? { ...r, other_fee: e.target.value } : r))}
                              type="number" step="0.01" min="0" placeholder="0.00" className={inputClass} />
                        }
                      </div>
                      <div>
                        <label className={labelClass}>GST</label>
                        {row.is_paid
                          ? <p className="text-sm text-white/70 px-1">{row.gst_type}</p>
                          : <select value={row.gst_type} onChange={e => setEditStageRows(rs => rs.map(r => r.id === row.id ? { ...r, gst_type: e.target.value } : r))} className={selectClass}>
                              {GST_TYPES_DETAIL.map(g => <option key={g} value={g} className="bg-blue-900">{g}</option>)}
                            </select>
                        }
                      </div>
                      <div>
                        <label className={labelClass}>Currency</label>
                        {row.is_paid
                          ? <p className="text-sm text-white/70 px-1">{row.currency}</p>
                          : <select value={row.currency} onChange={e => setEditStageRows(rs => rs.map(r => r.id === row.id ? { ...r, currency: e.target.value } : r))} className={selectClass}>
                              {CURRENCIES_DETAIL.map(c => <option key={c} value={c} className="bg-blue-900">{c}</option>)}
                            </select>
                        }
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {editStageRows.length < 6 && (
                <button type="button" onClick={() => setEditStageRows(rs => [...rs, newEditRow()])}
                  className="mb-4 text-sm text-blue-400 hover:text-blue-300 border border-blue-400/30 rounded-lg px-4 py-2 hover:bg-blue-400/10 transition-colors">
                  + Add Payment Stage
                </button>
              )}

              {/* Edit mode totals preview */}
              <div className="rounded-lg border border-white/10 bg-white/5 p-3 mb-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-sm">
                  <div><p className="text-white/50 text-xs">Service Fee</p><p className="font-bold">${fmt(editStageRows.reduce((s, r) => s + (parseFloat(r.service_fee) || 0), 0))}</p></div>
                  <div><p className="text-white/50 text-xs">INZ Fee</p><p className="font-bold">${fmt(editStageRows.reduce((s, r) => s + (parseFloat(r.inz_fee) || 0), 0))}</p></div>
                  <div><p className="text-white/50 text-xs">Other Fee</p><p className="font-bold">${fmt(editStageRows.reduce((s, r) => s + (parseFloat(r.other_fee) || 0), 0))}</p></div>
                  <div><p className="text-white/50 text-xs">Total</p><p className="font-bold text-blue-300">${fmt(editStageRows.reduce((s, r) => s + (parseFloat(r.service_fee) || 0) + (parseFloat(r.inz_fee) || 0) + (parseFloat(r.other_fee) || 0), 0))}</p></div>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={handleSaveStages} disabled={isSavingStages} className={btnPrimary}>
                  {isSavingStages ? "Saving..." : "Save Payment Stages"}
                </button>
                <button onClick={() => setEditingStages(false)} className={btnSecondary}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* ── Mark Paid Modal ─────────────────────────────────────────────── */}
        {showMarkPaidModal && (() => {
          const mp = payments.find(p => p.id === showMarkPaidModal);
          const mpTotal = mp ? (mp.service_fee_amount || 0) + (mp.inz_fee_amount || 0) + (mp.other_fee_amount || 0) : 0;
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
              <div className="w-full max-w-sm rounded-xl border border-white/10 bg-blue-900 p-6">
                <h4 className="text-lg font-bold mb-1">Mark as Paid</h4>
                {mp && (
                  <p className="text-sm text-white/60 mb-4">{mp.stage_name}{mp.stage_details ? ` — ${mp.stage_details}` : ""}</p>
                )}
                {/* Payment amount display */}
                <div className="rounded-lg bg-green-500/10 border border-green-500/30 px-4 py-3 mb-4">
                  <p className="text-xs text-green-400/80 mb-1">Payment Amount</p>
                  <p className="text-2xl font-bold text-green-300">${fmt(mpTotal)}</p>
                  {mp && (mp.service_fee_amount > 0 || mp.inz_fee_amount > 0 || mp.other_fee_amount > 0) && (
                    <div className="mt-1.5 flex gap-3 text-xs text-white/50">
                      {mp.service_fee_amount > 0 && <span>Svc: ${fmt(mp.service_fee_amount)}</span>}
                      {mp.inz_fee_amount > 0 && <span>INZ: ${fmt(mp.inz_fee_amount)}</span>}
                      {mp.other_fee_amount > 0 && <span>Other: ${fmt(mp.other_fee_amount)}</span>}
                    </div>
                  )}
                </div>
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
          );
        })()}

        {/* ── Section: Invoices ──────────────────────────────────────────── */}
        {hasAnyRole(profile, ["admin", "accountant"]) && (
          <div className={sectionClass}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Invoices</h3>
              {payments.length > 0 && (
                <button onClick={() => { setShowInvoiceModal(true); setInvoiceSelectedStages([]); setInvoiceNotes(""); setInvoiceIssueDate(new Date().toISOString().split("T")[0]); setInvoiceDueDate(""); }} className={btnSecondary}>
                  + Create Invoice
                </button>
              )}
            </div>
            {invoices.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-white/10">
                    <th className="text-left py-2 px-2 text-white/50 font-medium">Invoice #</th>
                    <th className="text-left py-2 px-2 text-white/50 font-medium">Date</th>
                    <th className="text-left py-2 px-2 text-white/50 font-medium">Ccy</th>
                    <th className="text-right py-2 px-2 text-white/50 font-medium">Amount</th>
                    <th className="text-left py-2 px-2 text-white/50 font-medium">Status</th>
                    <th className="py-2 px-2"></th>
                  </tr></thead>
                  <tbody>
                    {invoices.map(inv => (
                      <tr key={inv.id} className="border-b border-white/5">
                        <td className="py-2 px-2 font-medium text-white/80">{inv.invoice_number}</td>
                        <td className="py-2 px-2 text-white/60 text-xs">{inv.issue_date}</td>
                        <td className="py-2 px-2 text-white/60">{inv.currency}</td>
                        <td className="py-2 px-2 text-right font-semibold">${fmt(inv.total)}</td>
                        <td className="py-2 px-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                            inv.status === "paid" ? "bg-green-500/20 text-green-400" :
                            inv.status === "sent" ? "bg-blue-500/20 text-blue-400" :
                            inv.status === "cancelled" ? "bg-red-500/20 text-red-400" :
                            "bg-gray-500/20 text-gray-400"
                          }`}>{inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}</span>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex gap-2 text-xs">
                            {inv.pdf_url ? (
                              <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">PDF</a>
                            ) : (
                              <button disabled={invoiceActionLoading === inv.id} onClick={async () => {
                                setInvoiceActionLoading(inv.id);
                                const res = await fetch(`/api/invoices/${inv.id}/generate-pdf`, { method: "POST" });
                                if (res.ok) { const d = await res.json(); if (d.url) window.open(d.url, "_blank"); }
                                await fetchInvoices(); setInvoiceActionLoading(null);
                              }} className="text-blue-400 hover:text-blue-300 disabled:opacity-50">Gen PDF</button>
                            )}
                            {inv.status === "draft" && (
                              <button disabled={invoiceActionLoading === inv.id} onClick={async () => {
                                setInvoiceActionLoading(inv.id);
                                await fetch(`/api/invoices/${inv.id}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
                                await fetchInvoices(); setInvoiceActionLoading(null);
                              }} className="text-green-400 hover:text-green-300 disabled:opacity-50">Send</button>
                            )}
                            {(inv.status === "draft" || inv.status === "sent") && (
                              <button disabled={invoiceActionLoading === inv.id} onClick={async () => {
                                setInvoiceActionLoading(inv.id);
                                await supabase.from("invoices").update({ status: "paid" }).eq("id", inv.id);
                                await fetchInvoices(); setInvoiceActionLoading(null);
                              }} className="text-green-400 hover:text-green-300 disabled:opacity-50">Paid</button>
                            )}
                            {inv.status !== "cancelled" && inv.status !== "paid" && (
                              <button disabled={invoiceActionLoading === inv.id} onClick={async () => {
                                setInvoiceActionLoading(inv.id);
                                await supabase.from("invoices").update({ status: "cancelled" }).eq("id", inv.id);
                                await fetchInvoices(); setInvoiceActionLoading(null);
                              }} className="text-red-400 hover:text-red-300 disabled:opacity-50">Cancel</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-white/40 text-center py-4">No invoices yet.</p>
            )}
          </div>
        )}

        {/* ── Invoice Create Modal ─────────────────────────────────────────── */}
        {showInvoiceModal && (() => {
          const unpaidStages = payments.filter(p => !p.is_paid || true); // show all stages
          const selectedStagesData = unpaidStages.filter(s => invoiceSelectedStages.includes(s.id));
          const currencies = [...new Set(selectedStagesData.map(s => s.currency ?? "NZD"))];
          const invoiceCurrency = currencies.length === 1 ? currencies[0] : (currencies[0] ?? "NZD");
          const currencyMismatch = currencies.length > 1;
          const subtotal = selectedStagesData.reduce((sum, s) => sum + (s.service_fee_amount || 0) + (s.inz_fee_amount || 0) + (s.other_fee_amount || 0), 0);
          const hasExcGst = selectedStagesData.some(s => s.gst_type === "Exclusive");
          const gst = hasExcGst ? Math.round(subtotal * 0.15 * 100) / 100 : 0;
          const invTotal = subtotal + gst;

          const handleCreateInvoice = async () => {
            if (invoiceSelectedStages.length === 0 || currencyMismatch) return;
            setIsCreatingInvoice(true);
            try {
              const res = await fetch("/api/invoices", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  deal_id: id,
                  currency: invoiceCurrency,
                  payment_stage_ids: invoiceSelectedStages,
                  notes: invoiceNotes.trim() || undefined,
                  issue_date: invoiceIssueDate,
                  due_date: invoiceDueDate || undefined,
                  contact_id: deal?.contact_id || undefined,
                  company_id: deal?.company_id || undefined,
                  created_by: profile?.id,
                }),
              });
              if (res.ok) {
                setShowInvoiceModal(false);
                await fetchInvoices();
                setMessage({ type: "success", text: "Invoice created." });
              } else {
                const d = await res.json();
                setMessage({ type: "error", text: d.error || "Failed to create invoice." });
              }
            } catch {
              setMessage({ type: "error", text: "Network error creating invoice." });
            }
            setIsCreatingInvoice(false);
          };

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
              <div className="w-full max-w-lg rounded-xl border border-white/10 bg-blue-900 p-6 max-h-[90vh] overflow-y-auto">
                <h4 className="text-lg font-bold mb-4">Create Invoice</h4>

                <p className={labelClass}>Select Payment Stages</p>
                <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                  {unpaidStages.map(s => {
                    const total = (s.service_fee_amount || 0) + (s.inz_fee_amount || 0) + (s.other_fee_amount || 0);
                    const checked = invoiceSelectedStages.includes(s.id);
                    return (
                      <label key={s.id} className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${checked ? "border-blue-400 bg-blue-600/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
                        <input type="checkbox" checked={checked} onChange={() => setInvoiceSelectedStages(prev => checked ? prev.filter(x => x !== s.id) : [...prev, s.id])} className="accent-blue-500" />
                        <div className="flex-1">
                          <span className="text-sm font-medium">{s.stage_name}</span>
                          {s.stage_details && <span className="text-xs text-white/50 ml-2">{s.stage_details}</span>}
                          <span className="text-xs text-white/40 ml-2">({s.currency ?? "NZD"})</span>
                        </div>
                        <span className="text-sm font-semibold">${fmt(total)}</span>
                      </label>
                    );
                  })}
                </div>

                {currencyMismatch && (
                  <div className="mb-4 rounded-lg bg-red-500/20 border border-red-500/30 px-3 py-2 text-sm text-red-300">
                    Selected stages have different currencies. All stages in an invoice must use the same currency.
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className={labelClass}>Issue Date</label>
                    <input type="date" value={invoiceIssueDate} onChange={e => setInvoiceIssueDate(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Due Date (optional)</label>
                    <input type="date" value={invoiceDueDate} onChange={e => setInvoiceDueDate(e.target.value)} className={inputClass} />
                  </div>
                </div>

                <div className="mb-4">
                  <label className={labelClass}>Notes</label>
                  <textarea value={invoiceNotes} onChange={e => setInvoiceNotes(e.target.value)} rows={2} className={`${inputClass} resize-none`} placeholder="Optional notes..." />
                </div>

                {/* Preview */}
                {invoiceSelectedStages.length > 0 && !currencyMismatch && (
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3 mb-4">
                    <p className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Preview</p>
                    <div className="flex justify-between text-sm mb-1"><span className="text-white/60">Currency</span><span>{invoiceCurrency}</span></div>
                    <div className="flex justify-between text-sm mb-1"><span className="text-white/60">Subtotal</span><span>${fmt(subtotal)}</span></div>
                    <div className="flex justify-between text-sm mb-1"><span className="text-white/60">GST (15%)</span><span>${fmt(gst)}</span></div>
                    <div className="flex justify-between text-sm font-bold border-t border-white/10 pt-1 mt-1"><span>Total</span><span>${fmt(invTotal)}</span></div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button onClick={handleCreateInvoice} disabled={isCreatingInvoice || invoiceSelectedStages.length === 0 || currencyMismatch} className={`${btnPrimary} disabled:opacity-50`}>
                    {isCreatingInvoice ? "Creating..." : "Create Invoice"}
                  </button>
                  <button onClick={() => setShowInvoiceModal(false)} className={btnSecondary}>Cancel</button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Contract Create Modal ──────────────────────────────────────── */}
        {showContractCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-3xl rounded-xl border border-white/10 bg-blue-900 p-6 max-h-[90vh] overflow-y-auto">
              <h4 className="text-lg font-bold mb-5">Create Contract</h4>
              <div className="mb-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                {(() => {
                  const matched = contractTemplates.find(t => t.id === selectedContractTemplateId);
                  return matched
                    ? <><span className="text-white/40">Template: </span><span className="font-medium text-white">{matched.name}</span><span className="ml-2 text-white/40 text-xs">(auto-matched to deal language)</span></>
                    : <span className="text-yellow-400/80">No matching template found for this language/type. Content will be blank.</span>;
                })()}
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
        {currentStatus !== "education_only" && <div className={sectionClass}>
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
        </div>}

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
        {currentStatus !== "education_only" && <div className={sectionClass}>
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
                <button
                  onClick={() => handleStatusChange("in_progress")}
                  disabled={isStatusChanging}
                  className="rounded-lg px-5 py-2.5 font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  Start Processing
                </button>
              )}
              {currentStatus === "in_progress" && (
                <button
                  onClick={() => {
                    if (clientEmail) { requestEmailConfirm({ recipientName: clientName, recipientEmail: clientEmail, emailType: "application_submitted", extraData: { submitted_date: new Date().toISOString().split("T")[0] }, onConfirm: () => sendNotification("application_submitted", clientEmail, clientName, { submitted_date: new Date().toISOString().split("T")[0] }) }); }
                    handleStatusChange("submitted");
                  }}
                  disabled={isStatusChanging}
                  className="rounded-lg px-5 py-2.5 font-bold text-sm text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
                >
                  Mark as Submitted
                </button>
              )}
            </div>
          )}
        </div>}

        {/* ── Section: Document Checklist ─────────────────────────────────── */}
        {currentStatus !== "education_only" && <div className={sectionClass}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Document Checklist ({checklist.length})</h3>
            <div className="flex gap-2">
              {form.visa_type && (
                <button onClick={handleAiGenerateChecklist} disabled={isGeneratingChecklist} className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-bold text-white hover:bg-purple-700 disabled:opacity-50">
                  {isGeneratingChecklist ? "Generating..." : "AI Generate"}
                </button>
              )}
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
                      <div className="flex gap-2">
                        {item.required && <span className="text-xs text-white/30">Required</span>}
                        {item.notes && <span className="text-xs text-white/40 italic">{item.notes}</span>}
                      </div>
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

          {/* AI Checklist Preview Modal */}
          {showAiChecklistModal && aiChecklistPreview.length > 0 && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
              <div className="w-full max-w-lg rounded-xl border border-white/10 bg-blue-900 p-6 max-h-[80vh] overflow-y-auto">
                <h4 className="text-lg font-bold mb-2">AI Generated Checklist</h4>
                <p className="text-sm text-white/60 mb-4">{aiChecklistPreview.length} documents suggested for {form.visa_type} visa</p>
                <div className="space-y-2 mb-5">
                  {aiChecklistPreview.map((item, idx) => (
                    <div key={idx} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{item.item_name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${item.required ? "bg-red-500/20 text-red-400" : "bg-white/10 text-white/40"}`}>
                          {item.required ? "Required" : "Optional"}
                        </span>
                      </div>
                      {item.notes && <p className="text-xs text-white/50 mt-1">{item.notes}</p>}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddAiChecklistItems} className={btnPrimary}>Add All ({aiChecklistPreview.length})</button>
                  <button onClick={() => { setShowAiChecklistModal(false); setAiChecklistPreview([]); }} className={btnSecondary}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>}

        {/* ── Section: Cover Letter ─────────────────────────────────────── */}
        {currentStatus !== "education_only" && <div className={sectionClass}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Cover Letter</h3>
            <div className="flex gap-2">
              {coverLetter?.pdf_url && (
                <a href={coverLetter.pdf_url} target="_blank" rel="noopener noreferrer" className={btnSecondary}>
                  View PDF
                </a>
              )}
              {coverLetter && (
                <button onClick={handleExportCoverLetterPdf} disabled={isExportingCoverLetterPdf} className={btnSecondary}>
                  {isExportingCoverLetterPdf ? "Exporting..." : "Export PDF"}
                </button>
              )}
            </div>
          </div>

          <div className="mb-4">
            <textarea
              value={coverLetterDraft}
              onChange={e => setCoverLetterDraft(e.target.value)}
              rows={16}
              className={`${inputClass} font-serif text-sm resize-y leading-relaxed`}
              placeholder="Generate or type a cover letter..."
            />
          </div>

          <div className="flex gap-2">
            <button onClick={() => setShowCoverLetterModal(true)} disabled={isGeneratingCoverLetter} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-bold text-white hover:bg-purple-700 disabled:opacity-50">
              {isGeneratingCoverLetter ? "Generating..." : (coverLetterDraft ? "Regenerate" : "Generate Cover Letter")}
            </button>
            <button onClick={handleSaveCoverLetter} disabled={isSavingCoverLetter || !coverLetterDraft.trim()} className={btnPrimary}>
              {isSavingCoverLetter ? "Saving..." : "Save Draft"}
            </button>
          </div>

          {/* Generate Cover Letter Modal */}
          {showCoverLetterModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
              <div className="w-full max-w-lg rounded-xl border border-white/10 bg-blue-950 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                <h4 className="text-lg font-bold mb-4">Generate Cover Letter</h4>

                <div className="mb-4">
                  <label className={labelClass}>Additional Notes for AI</label>
                  <textarea
                    value={coverLetterNotes}
                    onChange={e => setCoverLetterNotes(e.target.value)}
                    rows={6}
                    className={`${inputClass} resize-y text-sm`}
                    placeholder="Describe the client's special circumstances, key strengths, reasons for application, any points you want emphasized in the cover letter..."
                  />
                </div>

                <div className="mb-5 rounded-lg border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-medium text-white/50 mb-2">Auto-included information:</p>
                  <ul className="space-y-1 text-xs text-white/40">
                    <li>Client: <span className="text-white/60">{clientName}</span></li>
                    {deal?.contacts?.nationality && <li>Nationality: <span className="text-white/60">{deal.contacts.nationality}</span></li>}
                    {form.visa_type && <li>Visa Type: <span className="text-white/60">{form.visa_type}</span></li>}
                    {form.deal_type && <li>Deal Type: <span className="text-white/60">{form.deal_type.replace(/_/g, " ")}</span></li>}
                    {form.description && <li>Description: <span className="text-white/60">{form.description.length > 80 ? form.description.slice(0, 80) + "..." : form.description}</span></li>}
                    {applicants.length > 0 && <li>Family Members / Applicants: <span className="text-white/60">{applicants.length}</span></li>}
                    {intakeForm && intakeForm.status !== "draft" && <li>Intake Form data: <span className="text-white/60">included</span></li>}
                  </ul>
                </div>

                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowCoverLetterModal(false)} className={btnSecondary}>Cancel</button>
                  <button
                    onClick={() => handleGenerateCoverLetter(coverLetterNotes)}
                    className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-bold text-white hover:bg-purple-700"
                  >
                    Generate
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>}

        {/* ── Section: Agent Commission ─────────────────────────────────── */}
        {deal?.agent_id && (
          <div className={sectionClass}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">
                Agent Commission
                {agentName && (
                  <Link href={`/agents/${deal.agent_id}`} className="ml-2 text-sm font-normal text-blue-400 hover:underline">
                    ({agentName})
                  </Link>
                )}
              </h3>
              {agentCommission && (
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${
                  agentCommission.status === "paid" ? "bg-green-500/20 text-green-400" :
                  agentCommission.status === "approved" ? "bg-blue-500/20 text-blue-400" :
                  "bg-yellow-500/20 text-yellow-400"
                }`}>{agentCommission.status}</span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-4">
              <div>
                <label className={labelClass}>Commission Type</label>
                <select
                  value={agentCommissionForm.commission_type}
                  onChange={e => setAgentCommissionForm(f => ({ ...f, commission_type: e.target.value }))}
                  className={selectClass}
                  disabled={agentCommission?.status === "paid"}
                >
                  <option value="percentage" className="bg-blue-900">Percentage</option>
                  <option value="fixed" className="bg-blue-900">Fixed Amount</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>
                  {agentCommissionForm.commission_type === "percentage" ? "Rate (%)" : "Fixed Amount ($)"}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={agentCommissionForm.commission_rate}
                  onChange={e => setAgentCommissionForm(f => ({ ...f, commission_rate: e.target.value }))}
                  className={inputClass}
                  disabled={agentCommission?.status === "paid"}
                />
              </div>
              <div>
                <label className={labelClass}>Base Amount (Service Fees)</label>
                <p className="text-white/90 font-medium py-2">${stageServiceTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div>
                <label className={labelClass}>Commission Amount</label>
                <p className="text-lg font-bold text-green-400 py-1">
                  ${(agentCommissionForm.commission_type === "percentage"
                    ? (stageServiceTotal * (parseFloat(agentCommissionForm.commission_rate) || 0) / 100)
                    : (parseFloat(agentCommissionForm.commission_rate) || 0)
                  ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <label className={labelClass}>Invoice Number</label>
                <input
                  value={agentCommissionForm.invoice_number}
                  onChange={e => setAgentCommissionForm(f => ({ ...f, invoice_number: e.target.value }))}
                  className={inputClass}
                  placeholder="Optional"
                  disabled={agentCommission?.status === "paid"}
                />
              </div>
              <div>
                <label className={labelClass}>Notes</label>
                <input
                  value={agentCommissionForm.notes}
                  onChange={e => setAgentCommissionForm(f => ({ ...f, notes: e.target.value }))}
                  className={inputClass}
                  placeholder="Optional"
                  disabled={agentCommission?.status === "paid"}
                />
              </div>
            </div>

            {agentCommission?.status === "paid" && agentCommission.paid_date && (
              <p className="text-sm text-white/60 mb-4">Paid on {agentCommission.paid_date}</p>
            )}

            <div className="flex flex-wrap gap-2">
              {agentCommission?.status !== "paid" && (
                <button
                  onClick={async () => {
                    setIsSavingAgentCommission(true);
                    const rate = parseFloat(agentCommissionForm.commission_rate) || 0;
                    const baseAmount = stageServiceTotal;
                    const commissionAmount = agentCommissionForm.commission_type === "percentage" ? (baseAmount * rate / 100) : rate;
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session) { setIsSavingAgentCommission(false); return; }

                    if (agentCommission) {
                      await supabase.from("agent_commissions").update({
                        commission_type: agentCommissionForm.commission_type,
                        commission_rate: rate,
                        base_amount: baseAmount,
                        commission_amount: commissionAmount,
                        invoice_number: agentCommissionForm.invoice_number || null,
                        notes: agentCommissionForm.notes || null,
                      }).eq("id", agentCommission.id);
                    } else {
                      await supabase.from("agent_commissions").insert({
                        agent_id: deal.agent_id,
                        deal_id: id,
                        commission_type: agentCommissionForm.commission_type,
                        commission_rate: rate,
                        base_amount: baseAmount,
                        commission_amount: commissionAmount,
                        invoice_number: agentCommissionForm.invoice_number || null,
                        notes: agentCommissionForm.notes || null,
                        status: "pending",
                        created_by: session.user.id,
                      });
                    }
                    await logActivity(supabase, session.user.id, "saved_agent_commission", "deals", id, { agent_name: agentName, commission_amount: commissionAmount });
                    await fetchAgentCommission();
                    setIsSavingAgentCommission(false);
                    setMessage({ type: "success", text: "Agent commission saved." });
                  }}
                  disabled={isSavingAgentCommission}
                  className={btnPrimary}
                >
                  {isSavingAgentCommission ? "Saving..." : "Save"}
                </button>
              )}

              {agentCommission?.status === "pending" && hasAnyRole(profile, ["admin", "accountant"]) && (
                <button
                  onClick={async () => {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session) return;
                    await supabase.from("agent_commissions").update({ status: "approved" }).eq("id", agentCommission.id);
                    await logActivity(supabase, session.user.id, "approved_agent_commission", "deals", id, { agent_name: agentName });
                    await fetchAgentCommission();
                    setMessage({ type: "success", text: "Commission approved." });
                  }}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
                >
                  Approve
                </button>
              )}

              {agentCommission?.status === "approved" && hasAnyRole(profile, ["admin", "accountant"]) && (
                <button
                  onClick={() => setShowMarkCommissionPaidModal(true)}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700"
                >
                  Mark as Paid
                </button>
              )}
            </div>

            {/* Mark as Paid modal */}
            {showMarkCommissionPaidModal && agentCommission && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
                <div className="w-full max-w-sm rounded-xl border border-white/10 bg-blue-950 p-6 shadow-2xl">
                  <h4 className="text-lg font-bold mb-4">Mark Commission as Paid</h4>
                  <div className="mb-4">
                    <label className={labelClass}>Paid Date</label>
                    <input
                      type="date"
                      value={commissionPaidDate}
                      onChange={e => setCommissionPaidDate(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowMarkCommissionPaidModal(false)} className={btnSecondary}>Cancel</button>
                    <button
                      onClick={async () => {
                        const { data: { session } } = await supabase.auth.getSession();
                        if (!session) return;
                        await supabase.from("agent_commissions").update({
                          status: "paid",
                          paid_date: commissionPaidDate,
                          paid_by: session.user.id,
                        }).eq("id", agentCommission.id);
                        await logActivity(supabase, session.user.id, "paid_agent_commission", "deals", id, { agent_name: agentName, paid_date: commissionPaidDate });
                        setShowMarkCommissionPaidModal(false);
                        await fetchAgentCommission();
                        setMessage({ type: "success", text: "Commission marked as paid." });
                      }}
                      className={btnPrimary}
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

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
