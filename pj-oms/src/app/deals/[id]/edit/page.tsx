"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { hasAnyRole } from "@/lib/roles";
import Navbar from "@/components/Navbar";
import { logActivity } from "@/lib/activityLog";

type AgentOption = { id: string; agent_name: string };
type SalesUser = { id: string; full_name: string | null };

type StageRow = {
  id: string; // "new-xxxx" for new rows, actual DB UUID for existing
  stage_name: string;
  stage_details: string;
  service_fee: string;
  inz_fee: string;
  other_fee: string;
  gst_type: string;
  currency: string;
  is_paid: boolean;
};

const STAGE_NAMES = ["Stage I", "Stage II", "Stage III", "Stage IV", "Stage V", "Stage VI"];
const GST_TYPES = ["Exclusive", "Inclusive", "Zero Rated"];
const CURRENCIES = ["NZD", "CNY", "THB"];
const newStageRow = (): StageRow => ({
  id: `new-${Math.random().toString(36).slice(2)}`,
  stage_name: "Stage I", stage_details: "", service_fee: "",
  inz_fee: "", other_fee: "", gst_type: "Exclusive", currency: "NZD", is_paid: false,
});

const DEPT_LABELS: Record<string, string> = {
  china: "China", thailand: "Thailand", myanmar: "Myanmar", korea_japan: "Korea & Japan",
};

export default function EditDealPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [dealNumber, setDealNumber] = useState<string | null>(null);
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);

  // Client info (read-only — cannot change client on an existing deal)
  const [contactInfo, setContactInfo] = useState<{ id: string; first_name: string; last_name: string; email: string | null; department: string | null } | null>(null);
  const [companyInfo, setCompanyInfo] = useState<{ id: string; company_name: string; email: string | null; department: string | null } | null>(null);

  // Agent (editable)
  const [agentSearch, setAgentSearch] = useState("");
  const [agentResults, setAgentResults] = useState<AgentOption[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentOption | null>(null);

  const [form, setForm] = useState({
    deal_type: "individual_visa",
    visa_type: "",
    description: "",
    notes: "",
    department: "",
    preferred_language: "en",
    refund_percentage: "50",
    assigned_sales_id: "",
    assigned_lia_id: "",
  });

  const [paymentStages, setPaymentStages] = useState<StageRow[]>([newStageRow()]);
  const [refPrices, setRefPrices] = useState<{ service_name: string; service_fee: number; inz_fee: number }[]>([]);

  const VISA_TYPE_CATEGORY: Record<string, string> = {
    SV: "Student Visa", AEWV: "AEWV", WV: "Work Visa", RV: "Residence",
    Visitor: "Visitor Visa", Partnership: "Partnership", SMC: "Residence",
  };
  useEffect(() => {
    async function fetchPrices() {
      const cat = VISA_TYPE_CATEGORY[form.visa_type];
      if (!cat) { setRefPrices([]); return; }
      const { data } = await supabase.from("service_price_list")
        .select("service_name, service_fee, inz_fee")
        .eq("category", cat).eq("is_active", true)
        .order("display_order");
      setRefPrices((data as { service_name: string; service_fee: number; inz_fee: number }[]) ?? []);
    }
    fetchPrices();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.visa_type]);

  const stageServiceTotal = paymentStages.reduce((s, r) => s + (parseFloat(r.service_fee) || 0), 0);
  const stageInzTotal = paymentStages.reduce((s, r) => s + (parseFloat(r.inz_fee) || 0), 0);
  const stageOtherTotal = paymentStages.reduce((s, r) => s + (parseFloat(r.other_fee) || 0), 0);
  const stageTotalAmount = stageServiceTotal + stageInzTotal + stageOtherTotal;

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/admin"); return; }

      const { data: profileData } = await supabase.from("profiles").select("role, roles, department").eq("id", session.user.id).single();

      // Only admin and accountant can edit deals
      if (!profileData || !hasAnyRole(profileData, ["admin", "accountant"])) {
        router.push(`/deals/${id}`);
        return;
      }

      const [{ data: salesData }, { data: dealData }, { data: stagesData }] = await Promise.all([
        supabase.from("profiles").select("id, full_name").overlaps("roles", ["admin", "sales", "lia"]).order("full_name"),
        supabase.from("deals")
          .select("*, contacts(id, first_name, last_name, email, department), companies(id, company_name, email, department)")
          .eq("id", id).single(),
        supabase.from("deal_payments").select("*").eq("deal_id", id).order("created_at"),
      ]);

      if (salesData) setSalesUsers(salesData as SalesUser[]);

      if (!dealData) { router.push("/deals"); return; }

      setDealNumber(dealData.deal_number);
      setContactInfo(dealData.contacts as { id: string; first_name: string; last_name: string; email: string | null; department: string | null } | null);
      setCompanyInfo(dealData.companies as { id: string; company_name: string; email: string | null; department: string | null } | null);

      // Load current agent if any
      if (dealData.agent_id) {
        const { data: agentData } = await supabase.from("agents").select("id, agent_name").eq("id", dealData.agent_id).single();
        if (agentData) setSelectedAgent({ id: agentData.id as string, agent_name: agentData.agent_name as string });
      }

      setForm({
        deal_type: dealData.deal_type ?? "individual_visa",
        visa_type: dealData.visa_type ?? "",
        description: dealData.description ?? "",
        notes: dealData.notes ?? "",
        department: dealData.department ?? "",
        preferred_language: dealData.preferred_language ?? "en",
        refund_percentage: dealData.refund_percentage != null ? String(dealData.refund_percentage) : "50",
        assigned_sales_id: dealData.assigned_sales_id ?? "",
        assigned_lia_id: dealData.assigned_lia_id ?? "",
      });

      // Load payment stages from DB
      if (stagesData && stagesData.length > 0) {
        const rows: StageRow[] = (stagesData as Record<string, unknown>[]).map(s => ({
          id: s.id as string,
          stage_name: (s.stage_name as string) ?? "Stage I",
          stage_details: ((s.stage_details as string | null) ?? (s.description as string | null)) ?? "",
          service_fee: String(s.service_fee_amount ?? 0),
          inz_fee: String(s.inz_fee_amount ?? 0),
          other_fee: String(s.other_fee_amount ?? 0),
          gst_type: (s.gst_type as string) ?? "Exclusive",
          currency: (s.currency as string) ?? "NZD",
          is_paid: (s.is_paid as boolean) ?? false,
        }));
        setPaymentStages(rows);
      } else {
        setPaymentStages([newStageRow()]);
      }

      setIsLoading(false);
    }
    init();
  }, [id, router]);

  const searchAgents = async (q: string) => {
    setAgentSearch(q);
    if (q.length < 2) { setAgentResults([]); return; }
    const { data } = await supabase.from("agents").select("id, agent_name").ilike("agent_name", `%${q}%`).limit(8);
    if (data) setAgentResults(data as AgentOption[]);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push("/admin"); return; }

    const clean = (v: string) => v.trim() || null;

    // 1) Update deals table
    const { error: dealError } = await supabase.from("deals").update({
      deal_type: form.deal_type || null,
      visa_type: form.deal_type === "individual_visa" ? clean(form.visa_type) : null,
      description: clean(form.description),
      department: form.department || null,
      assigned_sales_id: form.assigned_sales_id || null,
      assigned_lia_id: form.assigned_lia_id || null,
      agent_id: selectedAgent?.id ?? null,
      preferred_language: form.preferred_language || "en",
      refund_percentage: form.refund_percentage ? parseInt(form.refund_percentage) : 50,
      notes: clean(form.notes),
      service_fee: stageServiceTotal > 0 ? stageServiceTotal : null,
      inz_application_fee: stageInzTotal > 0 ? stageInzTotal : null,
      other_fee: stageOtherTotal > 0 ? stageOtherTotal : null,
      total_amount: stageTotalAmount > 0 ? stageTotalAmount : null,
    }).eq("id", id);

    if (dealError) {
      setMessage({ type: "error", text: dealError.message });
      setIsSaving(false);
      return;
    }

    // 2) Sync payment stages
    // Get IDs of kept existing stages (non-new rows)
    const keptIds = paymentStages.filter(r => !r.id.startsWith("new-")).map(r => r.id);

    // Fetch current DB stages to find which ones were removed
    const { data: currentDbStages } = await supabase.from("deal_payments").select("id, is_paid").eq("deal_id", id);
    const toDelete = (currentDbStages ?? []).filter(
      (s: { id: string; is_paid: boolean }) => !keptIds.includes(s.id) && !s.is_paid
    );
    if (toDelete.length > 0) {
      await supabase.from("deal_payments").delete().in("id", toDelete.map((s: { id: string }) => s.id));
    }

    // Update existing stages and insert new ones
    for (const row of paymentStages) {
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
        const { error: insertErr } = await supabase.from("deal_payments").insert({
          ...vals, deal_id: id, is_paid: false, status: "pending", created_by: session.user.id,
        });
        if (insertErr) {
          setMessage({ type: "error", text: `Failed to save stage "${row.stage_name}": ${insertErr.message}` });
          setIsSaving(false);
          return;
        }
      } else if (!row.is_paid) {
        // Paid rows are locked — skip updating to preserve payment records
        await supabase.from("deal_payments").update(vals).eq("id", row.id);
      }
    }

    await logActivity(supabase, session.user.id, "updated_deal", "deals", id, { deal_number: dealNumber });
    router.push(`/deals/${id}`);
  };

  const inputClass = "w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none";
  const selectClass = "w-full rounded-lg border border-white/20 bg-blue-900 px-4 py-2.5 text-white focus:border-blue-400 focus:outline-none";
  const labelClass = "block text-sm font-medium text-white/70 mb-1";
  const sectionClass = "rounded-xl border border-white/10 bg-white/5 p-6 mb-6";

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-blue-950">
        <p className="text-white/60">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-950 text-white">
      <Navbar hasUnsavedChanges />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">

        <div className="mb-8">
          <Link href={`/deals/${id}`} className="text-sm text-white/50 hover:text-white/80 mb-2 inline-block">
            ← Back to Deal
          </Link>
          <h2 className="text-2xl font-bold sm:text-3xl">Edit Deal {dealNumber ?? ""}</h2>
        </div>

        {message && (
          <div className={`mb-6 rounded-lg px-4 py-3 ${message.type === "error" ? "bg-red-500/20 text-red-300 border border-red-500/30" : "bg-green-500/20 text-green-300 border border-green-500/30"}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-0">

          {/* Client (read-only) */}
          {(contactInfo || companyInfo) && (
            <div className={sectionClass}>
              <h3 className="text-base font-bold mb-3">Client</h3>
              {contactInfo ? (
                <div className="flex items-center justify-between rounded-lg border border-blue-400/30 bg-blue-600/10 px-4 py-3">
                  <div>
                    <p className="font-semibold">{contactInfo.first_name} {contactInfo.last_name}</p>
                    {contactInfo.department && <p className="text-xs text-white/60">{DEPT_LABELS[contactInfo.department] ?? contactInfo.department}</p>}
                  </div>
                  <Link href={`/contacts/${contactInfo.id}`} className="text-xs text-blue-400 hover:underline">View contact →</Link>
                </div>
              ) : companyInfo ? (
                <div className="flex items-center justify-between rounded-lg border border-blue-400/30 bg-blue-600/10 px-4 py-3">
                  <div>
                    <p className="font-semibold">{companyInfo.company_name}</p>
                    {companyInfo.department && <p className="text-xs text-white/60">{DEPT_LABELS[companyInfo.department] ?? companyInfo.department}</p>}
                  </div>
                  <Link href={`/companies/${companyInfo.id}`} className="text-xs text-blue-400 hover:underline">View company →</Link>
                </div>
              ) : null}
            </div>
          )}

          {/* Agent (optional) */}
          <div className={sectionClass}>
            <h3 className="text-base font-bold mb-4">Agent (Optional)</h3>
            {selectedAgent ? (
              <div className="flex items-center justify-between rounded-lg border border-orange-400/30 bg-orange-600/10 px-4 py-3">
                <p className="font-semibold">{selectedAgent.agent_name}</p>
                <button type="button" onClick={() => { setSelectedAgent(null); setAgentSearch(""); }} className="text-xs text-white/50 hover:text-white">Remove</button>
              </div>
            ) : (
              <div>
                <input
                  value={agentSearch}
                  onChange={e => searchAgents(e.target.value)}
                  placeholder="Search agent by name..."
                  className={inputClass}
                />
                {agentResults.length > 0 && (
                  <ul className="mt-1 rounded-lg border border-white/10 bg-blue-950 max-h-40 overflow-y-auto">
                    {agentResults.map(a => (
                      <li key={a.id}>
                        <button type="button" onClick={() => { setSelectedAgent(a); setAgentSearch(""); setAgentResults([]); }}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/10">
                          {a.agent_name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Deal Information */}
          <div className={sectionClass}>
            <h3 className="text-base font-bold mb-4">Deal Information</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Deal Type *</label>
                <select name="deal_type" value={form.deal_type} onChange={handleChange} required className={selectClass}>
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
            </div>
          </div>

          {/* Reference Prices */}
          {refPrices.length > 0 && (
            <div className={sectionClass}>
              <p className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Reference Prices</p>
              <p className="text-xs text-white/40 mb-3">Reference price — actual fee may vary</p>
              <div className="space-y-1">
                {refPrices.map((p, i) => (
                  <div key={i} className="flex justify-between text-sm text-white/70 py-1 border-b border-white/5">
                    <span>{p.service_name}</span>
                    <span className="text-white/90">Svc: ${p.service_fee.toLocaleString()} {p.inz_fee > 0 ? `| INZ: $${p.inz_fee.toLocaleString()}` : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pricing & Payment Stages */}
          <div className={sectionClass}>
            <h3 className="text-base font-bold mb-4">Pricing & Payment Stages</h3>
            <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Contract Language</label>
                <select name="preferred_language" value={form.preferred_language} onChange={handleChange} className={selectClass}>
                  <option value="en" className="bg-blue-900">English</option>
                  <option value="zh" className="bg-blue-900">Chinese (中文)</option>
                  <option value="th" className="bg-blue-900">Thai (ภาษาไทย)</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Refund Percentage (%)</label>
                <input name="refund_percentage" value={form.refund_percentage} onChange={handleChange} type="number" min="0" max="100" placeholder="50" className={inputClass} />
              </div>
            </div>

            {/* Payment stage rows */}
            <div className="space-y-3 mb-4">
              {paymentStages.map((stage, idx) => (
                <div key={stage.id} className={`rounded-lg border p-4 ${stage.is_paid ? "border-green-500/30 bg-green-500/5 opacity-70" : "border-white/10 bg-white/5"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white/50 uppercase tracking-wider">Stage {idx + 1}</span>
                      {stage.is_paid && <span className="text-xs text-green-400 bg-green-500/20 rounded-full px-2 py-0.5">Paid — locked</span>}
                    </div>
                    {!stage.is_paid && paymentStages.length > 1 && (
                      <button type="button" onClick={() => setPaymentStages(ps => ps.filter(s => s.id !== stage.id))}
                        className="text-xs text-red-400 hover:text-red-300">Remove</button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-3">
                    <div>
                      <label className={labelClass}>Stage Name</label>
                      {stage.is_paid
                        ? <p className="text-sm text-white/70 px-1">{stage.stage_name}</p>
                        : <select value={stage.stage_name} onChange={e => setPaymentStages(ps => ps.map(s => s.id === stage.id ? { ...s, stage_name: e.target.value } : s))} className={selectClass}>
                            {STAGE_NAMES.map(n => <option key={n} value={n} className="bg-blue-900">{n}</option>)}
                          </select>
                      }
                    </div>
                    <div>
                      <label className={labelClass}>Stage Details</label>
                      {stage.is_paid
                        ? <p className="text-sm text-white/70 px-1">{stage.stage_details || "—"}</p>
                        : <input value={stage.stage_details} onChange={e => setPaymentStages(ps => ps.map(s => s.id === stage.id ? { ...s, stage_details: e.target.value } : s))}
                            placeholder="e.g. Signing agreement" className={inputClass} />
                      }
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    <div>
                      <label className={labelClass}>Service Fee</label>
                      {stage.is_paid
                        ? <p className="text-sm font-semibold px-1">${fmt(parseFloat(stage.service_fee) || 0)}</p>
                        : <input value={stage.service_fee} onChange={e => setPaymentStages(ps => ps.map(s => s.id === stage.id ? { ...s, service_fee: e.target.value } : s))}
                            type="number" step="0.01" min="0" placeholder="0.00" className={inputClass} />
                      }
                    </div>
                    <div>
                      <label className={labelClass}>INZ Fee</label>
                      {stage.is_paid
                        ? <p className="text-sm font-semibold px-1">${fmt(parseFloat(stage.inz_fee) || 0)}</p>
                        : <input value={stage.inz_fee} onChange={e => setPaymentStages(ps => ps.map(s => s.id === stage.id ? { ...s, inz_fee: e.target.value } : s))}
                            type="number" step="0.01" min="0" placeholder="0.00" className={inputClass} />
                      }
                    </div>
                    <div>
                      <label className={labelClass}>Other Fee</label>
                      {stage.is_paid
                        ? <p className="text-sm font-semibold px-1">${fmt(parseFloat(stage.other_fee) || 0)}</p>
                        : <input value={stage.other_fee} onChange={e => setPaymentStages(ps => ps.map(s => s.id === stage.id ? { ...s, other_fee: e.target.value } : s))}
                            type="number" step="0.01" min="0" placeholder="0.00" className={inputClass} />
                      }
                    </div>
                    <div>
                      <label className={labelClass}>GST</label>
                      {stage.is_paid
                        ? <p className="text-sm text-white/70 px-1">{stage.gst_type}</p>
                        : <select value={stage.gst_type} onChange={e => setPaymentStages(ps => ps.map(s => s.id === stage.id ? { ...s, gst_type: e.target.value } : s))} className={selectClass}>
                            {GST_TYPES.map(g => <option key={g} value={g} className="bg-blue-900">{g}</option>)}
                          </select>
                      }
                    </div>
                    <div>
                      <label className={labelClass}>Currency</label>
                      {stage.is_paid
                        ? <p className="text-sm text-white/70 px-1">{stage.currency}</p>
                        : <select value={stage.currency} onChange={e => setPaymentStages(ps => ps.map(s => s.id === stage.id ? { ...s, currency: e.target.value } : s))} className={selectClass}>
                            {CURRENCIES.map(c => <option key={c} value={c} className="bg-blue-900">{c}</option>)}
                          </select>
                      }
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {paymentStages.length < 6 && (
              <button type="button" onClick={() => setPaymentStages(ps => [...ps, newStageRow()])}
                className="mb-4 text-sm text-blue-400 hover:text-blue-300 border border-blue-400/30 rounded-lg px-4 py-2 hover:bg-blue-400/10 transition-colors">
                + Add Payment Stage
              </button>
            )}

            {/* Totals summary */}
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3">Totals (auto-calculated)</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-sm">
                <div><p className="text-white/50 text-xs">Service Fee</p><p className="font-bold">${stageServiceTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
                <div><p className="text-white/50 text-xs">INZ Fee</p><p className="font-bold">${stageInzTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
                <div><p className="text-white/50 text-xs">Other Fee</p><p className="font-bold">${stageOtherTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
                <div><p className="text-white/50 text-xs">Total</p><p className="text-xl font-bold">${stageTotalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
              </div>
            </div>
          </div>

          {/* Assignment */}
          <div className={sectionClass}>
            <h3 className="text-base font-bold mb-4">Assignment</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Assigned Sales</label>
                <select name="assigned_sales_id" value={form.assigned_sales_id} onChange={handleChange} className={selectClass}>
                  <option value="" className="bg-blue-900">— None —</option>
                  {salesUsers.map(s => <option key={s.id} value={s.id} className="bg-blue-900">{s.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Assigned LIA</label>
                <select name="assigned_lia_id" value={form.assigned_lia_id} onChange={handleChange} className={selectClass}>
                  <option value="" className="bg-blue-900">— None —</option>
                  {salesUsers.map(s => <option key={s.id} value={s.id} className="bg-blue-900">{s.full_name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Department */}
          <div className={sectionClass}>
            <h3 className="text-base font-bold mb-4">Department</h3>
            <select name="department" value={form.department} onChange={handleChange} className={`${selectClass} max-w-xs`}>
              <option value="" className="bg-blue-900">— Select —</option>
              <option value="china" className="bg-blue-900">China</option>
              <option value="thailand" className="bg-blue-900">Thailand</option>
              <option value="myanmar" className="bg-blue-900">Myanmar</option>
              <option value="korea_japan" className="bg-blue-900">Korea & Japan</option>
            </select>
          </div>

          {/* Notes */}
          <div className={sectionClass}>
            <label className={labelClass}>Notes</label>
            <textarea name="notes" value={form.notes} onChange={handleChange} rows={3} className={`${inputClass} resize-none`} />
          </div>

          <div className="flex gap-3 pb-10">
            <button type="submit" disabled={isSaving} className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50">
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
            <Link href={`/deals/${id}`} className="rounded-lg border border-white/20 px-6 py-3 font-bold hover:bg-white/10 inline-flex items-center">
              Cancel
            </Link>
          </div>

        </form>
      </main>
    </div>
  );
}
