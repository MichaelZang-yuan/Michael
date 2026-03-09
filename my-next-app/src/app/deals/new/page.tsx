"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import { logActivity } from "@/lib/activityLog";

type ContactOption = { id: string; first_name: string; last_name: string; department: string | null };
type CompanyOption = { id: string; company_name: string; department: string | null };
type AgentOption = { id: string; agent_name: string };

const DEPT_LABELS: Record<string, string> = {
  china: "China", thailand: "Thailand", myanmar: "Myanmar", korea_japan: "Korea & Japan",
};

async function generateDealNumber(supabaseClient: typeof supabase): Promise<string> {
  const year = new Date().getFullYear();
  const { data } = await supabaseClient
    .from("deals")
    .select("deal_number")
    .like("deal_number", `PJ-${year}-%`)
    .order("deal_number", { ascending: false })
    .limit(1);

  if (data && data.length > 0 && data[0].deal_number) {
    const parts = data[0].deal_number.split("-");
    const lastNum = parseInt(parts[2] ?? "0") || 0;
    return `PJ-${year}-${String(lastNum + 1).padStart(3, "0")}`;
  }
  return `PJ-${year}-001`;
}

export default function NewDealPageWrapper() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-blue-950"><p className="text-white/60">Loading...</p></div>}>
      <NewDealPage />
    </Suspense>
  );
}

function NewDealPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preContactId = searchParams.get("contact_id") ?? "";
  const preCompanyId = searchParams.get("company_id") ?? "";

  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSales, setIsSales] = useState(false);
  const [userDept, setUserDept] = useState("");
  const [userId, setUserId] = useState("");

  // Client type selection
  const [clientType, setClientType] = useState<"individual" | "business">(preCompanyId ? "business" : "individual");

  // Search state
  const [contactSearch, setContactSearch] = useState("");
  const [contactResults, setContactResults] = useState<ContactOption[]>([]);
  const [selectedContact, setSelectedContact] = useState<ContactOption | null>(null);
  const [companySearch, setCompanySearch] = useState("");
  const [companyResults, setCompanyResults] = useState<CompanyOption[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<CompanyOption | null>(null);
  const [agentSearch, setAgentSearch] = useState("");
  const [agentResults, setAgentResults] = useState<AgentOption[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentOption | null>(null);

  const [form, setForm] = useState({
    deal_type: "individual_visa",
    visa_type: "",
    description: "",
    service_fee: "",
    inz_application_fee: "",
    other_fee: "",
    notes: "",
    department: "",
    preferred_language: "en",
    refund_percentage: "50",
  });

  const totalAmount =
    (parseFloat(form.service_fee) || 0) +
    (parseFloat(form.inz_application_fee) || 0) +
    (parseFloat(form.other_fee) || 0);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/admin"); return; }
      setUserId(session.user.id);

      const { data: profileData } = await supabase.from("profiles").select("role, department").eq("id", session.user.id).single();
      const sales = profileData?.role === "sales";
      setIsSales(sales);
      if (profileData?.department) {
        setUserDept(profileData.department);
        setForm(f => ({ ...f, department: profileData.department }));
      }

      // Pre-fill if contact_id or company_id passed
      if (preContactId) {
        const { data: c } = await supabase.from("contacts").select("id, first_name, last_name, department").eq("id", preContactId).single();
        if (c) { setSelectedContact(c as ContactOption); setClientType("individual"); }
      }
      if (preCompanyId) {
        const { data: c } = await supabase.from("companies").select("id, company_name, department").eq("id", preCompanyId).single();
        if (c) { setSelectedCompany(c as CompanyOption); setClientType("business"); }
      }
    }
    init();
  }, [router, preContactId, preCompanyId]);

  const searchContacts = async (q: string) => {
    setContactSearch(q);
    if (q.length < 2) { setContactResults([]); return; }
    const { data } = await supabase.from("contacts")
      .select("id, first_name, last_name, department")
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
      .limit(8);
    if (data) setContactResults(data as ContactOption[]);
  };

  const searchCompanies = async (q: string) => {
    setCompanySearch(q);
    if (q.length < 2) { setCompanyResults([]); return; }
    const { data } = await supabase.from("companies")
      .select("id, company_name, department")
      .ilike("company_name", `%${q}%`)
      .limit(8);
    if (data) setCompanyResults(data as CompanyOption[]);
  };

  const searchAgents = async (q: string) => {
    setAgentSearch(q);
    if (q.length < 2) { setAgentResults([]); return; }
    const { data } = await supabase.from("agents")
      .select("id, agent_name")
      .ilike("agent_name", `%${q}%`)
      .limit(8);
    if (data) setAgentResults(data as AgentOption[]);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (clientType === "individual" && !selectedContact) {
      setMessage({ type: "error", text: "Please select a contact." }); return;
    }
    if (clientType === "business" && !selectedCompany) {
      setMessage({ type: "error", text: "Please select a company." }); return;
    }
    if (!form.deal_type) {
      setMessage({ type: "error", text: "Deal type is required." }); return;
    }

    const dept = form.department || (clientType === "individual" ? selectedContact?.department : selectedCompany?.department) || userDept;
    if (!dept) {
      setMessage({ type: "error", text: "Department is required." }); return;
    }

    setIsSaving(true); setMessage(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push("/admin"); return; }

    const dealNumber = await generateDealNumber(supabase);

    const payload: Record<string, unknown> = {
      deal_number: dealNumber,
      contact_id: clientType === "individual" ? (selectedContact?.id ?? null) : null,
      company_id: clientType === "business" ? (selectedCompany?.id ?? null) : null,
      agent_id: selectedAgent?.id ?? null,
      deal_type: form.deal_type,
      visa_type: form.deal_type === "individual_visa" ? (form.visa_type || null) : null,
      description: form.description.trim() || null,
      status: "draft",
      service_fee: form.service_fee ? parseFloat(form.service_fee) : null,
      inz_application_fee: form.inz_application_fee ? parseFloat(form.inz_application_fee) : null,
      other_fee: form.other_fee ? parseFloat(form.other_fee) : null,
      total_amount: totalAmount > 0 ? totalAmount : null,
      preferred_language: form.preferred_language || "en",
      refund_percentage: form.refund_percentage ? parseInt(form.refund_percentage) : 50,
      payment_status: "unpaid",
      assigned_sales_id: userId,
      department: dept,
      notes: form.notes.trim() || null,
      created_by: userId,
    };

    const { data: dealData, error } = await supabase.from("deals").insert(payload).select().single();
    if (error) { setMessage({ type: "error", text: error.message }); setIsSaving(false); return; }

    // Auto-add contact as main applicant for individual visa
    if (clientType === "individual" && selectedContact && form.deal_type === "individual_visa") {
      await supabase.from("deal_applicants").insert({
        deal_id: dealData.id,
        contact_id: selectedContact.id,
        relationship: "main",
      });
    }

    await logActivity(supabase, userId, "created_deal", "deals", dealData.id, {
      deal_number: dealNumber,
      deal_type: form.deal_type,
    });

    router.push(`/deals/${dealData.id}`);
  };

  const inputClass = "w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none";
  const selectClass = "w-full rounded-lg border border-white/20 bg-blue-900 px-4 py-2.5 text-white focus:border-blue-400 focus:outline-none";
  const labelClass = "block text-sm font-medium text-white/70 mb-1";
  const sectionClass = "rounded-xl border border-white/10 bg-white/5 p-6 mb-6";

  return (
    <div className="min-h-screen bg-blue-950 text-white">
      <Navbar hasUnsavedChanges />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="mb-8">
          <Link href="/deals" className="text-sm text-white/50 hover:text-white/80 mb-2 inline-block">← Deals</Link>
          <h2 className="text-2xl font-bold sm:text-3xl">New Deal</h2>
        </div>

        {message && (
          <div className={`mb-6 rounded-lg px-4 py-3 ${message.type === "error" ? "bg-red-500/20 text-red-300 border border-red-500/30" : "bg-green-500/20 text-green-300 border border-green-500/30"}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-0">

          {/* Step 1: Client Type */}
          <div className={sectionClass}>
            <h3 className="text-base font-bold mb-4">Client Type</h3>
            <div className="flex gap-3">
              <button type="button" onClick={() => setClientType("individual")}
                className={`flex-1 rounded-lg border px-4 py-3 font-bold text-sm transition-colors ${clientType === "individual" ? "border-blue-400 bg-blue-600/20 text-blue-300" : "border-white/20 text-white/60 hover:bg-white/10"}`}>
                Individual
              </button>
              <button type="button" onClick={() => setClientType("business")}
                className={`flex-1 rounded-lg border px-4 py-3 font-bold text-sm transition-colors ${clientType === "business" ? "border-blue-400 bg-blue-600/20 text-blue-300" : "border-white/20 text-white/60 hover:bg-white/10"}`}>
                Business
              </button>
            </div>
          </div>

          {/* Step 2: Select client */}
          <div className={sectionClass}>
            <h3 className="text-base font-bold mb-4">{clientType === "individual" ? "Select Contact" : "Select Company"}</h3>
            {clientType === "individual" ? (
              <div>
                {selectedContact ? (
                  <div className="flex items-center justify-between rounded-lg border border-blue-400/30 bg-blue-600/10 px-4 py-3">
                    <div>
                      <p className="font-semibold">{selectedContact.first_name} {selectedContact.last_name}</p>
                      {selectedContact.department && <p className="text-xs text-white/60">{DEPT_LABELS[selectedContact.department] ?? selectedContact.department}</p>}
                    </div>
                    <button type="button" onClick={() => { setSelectedContact(null); setContactSearch(""); }} className="text-xs text-white/50 hover:text-white">Change</button>
                  </div>
                ) : (
                  <div>
                    <label className={labelClass}>Search contact by name</label>
                    <input
                      value={contactSearch}
                      onChange={e => searchContacts(e.target.value)}
                      placeholder="Type to search contacts..."
                      className={inputClass}
                    />
                    {contactResults.length > 0 && (
                      <ul className="mt-1 rounded-lg border border-white/10 bg-blue-950 max-h-48 overflow-y-auto">
                        {contactResults.map(c => (
                          <li key={c.id}>
                            <button type="button" onClick={() => { setSelectedContact(c); setContactSearch(""); setContactResults([]); }}
                              className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/10">
                              <span className="font-medium">{c.first_name} {c.last_name}</span>
                              {c.department && <span className="ml-2 text-xs text-white/50">{DEPT_LABELS[c.department] ?? c.department}</span>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-2 text-xs text-white/40">
                      Contact not found? <Link href="/contacts/new" className="text-blue-400 hover:underline">Create new contact →</Link>
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div>
                {selectedCompany ? (
                  <div className="flex items-center justify-between rounded-lg border border-blue-400/30 bg-blue-600/10 px-4 py-3">
                    <div>
                      <p className="font-semibold">{selectedCompany.company_name}</p>
                      {selectedCompany.department && <p className="text-xs text-white/60">{DEPT_LABELS[selectedCompany.department] ?? selectedCompany.department}</p>}
                    </div>
                    <button type="button" onClick={() => { setSelectedCompany(null); setCompanySearch(""); }} className="text-xs text-white/50 hover:text-white">Change</button>
                  </div>
                ) : (
                  <div>
                    <label className={labelClass}>Search company by name</label>
                    <input
                      value={companySearch}
                      onChange={e => searchCompanies(e.target.value)}
                      placeholder="Type to search companies..."
                      className={inputClass}
                    />
                    {companyResults.length > 0 && (
                      <ul className="mt-1 rounded-lg border border-white/10 bg-blue-950 max-h-48 overflow-y-auto">
                        {companyResults.map(c => (
                          <li key={c.id}>
                            <button type="button" onClick={() => { setSelectedCompany(c); setCompanySearch(""); setCompanyResults([]); }}
                              className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/10">
                              <span className="font-medium">{c.company_name}</span>
                              {c.department && <span className="ml-2 text-xs text-white/50">{DEPT_LABELS[c.department] ?? c.department}</span>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-2 text-xs text-white/40">
                      Company not found? <Link href="/companies/new" className="text-blue-400 hover:underline">Create new company →</Link>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

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

          {/* Pricing */}
          <div className={sectionClass}>
            <h3 className="text-base font-bold mb-4">Pricing</h3>
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className={labelClass}>Service Fee ($)</label>
                <input name="service_fee" value={form.service_fee} onChange={handleChange} type="number" step="0.01" min="0" placeholder="0.00" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>INZ Application Fee ($)</label>
                <input name="inz_application_fee" value={form.inz_application_fee} onChange={handleChange} type="number" step="0.01" min="0" placeholder="0.00" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Other Fee ($)</label>
                <input name="other_fee" value={form.other_fee} onChange={handleChange} type="number" step="0.01" min="0" placeholder="0.00" className={inputClass} />
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-sm text-white/60">Total Amount</p>
              <p className="text-2xl font-bold">${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>

          {/* Department */}
          {isSales ? (
            <div className={sectionClass}>
              <h3 className="text-base font-bold mb-4">Department</h3>
              <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white/80 max-w-xs">
                {DEPT_LABELS[form.department] ?? form.department ?? "—"}
              </div>
              <p className="mt-1 text-xs text-white/40">Department is automatically set based on your account.</p>
            </div>
          ) : (
            <div className={sectionClass}>
              <h3 className="text-base font-bold mb-4">Department *</h3>
              <select name="department" value={form.department} onChange={handleChange} className={`${selectClass} max-w-xs`}>
                <option value="" className="bg-blue-900">Select or auto-detect from client...</option>
                <option value="china" className="bg-blue-900">China</option>
                <option value="thailand" className="bg-blue-900">Thailand</option>
                <option value="myanmar" className="bg-blue-900">Myanmar</option>
                <option value="korea_japan" className="bg-blue-900">Korea & Japan</option>
              </select>
              <p className="mt-1 text-xs text-white/40">If blank, department will be inferred from the selected client&apos;s department.</p>
            </div>
          )}

          {/* Notes */}
          <div className={sectionClass}>
            <label className={labelClass}>Notes</label>
            <textarea name="notes" value={form.notes} onChange={handleChange} rows={3} className={`${inputClass} resize-none`} />
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={isSaving} className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50">
              {isSaving ? "Creating..." : "Create Deal"}
            </button>
            <button type="button" onClick={() => router.push("/deals")} className="rounded-lg border border-white/20 px-6 py-3 font-bold hover:bg-white/10">
              Cancel
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
