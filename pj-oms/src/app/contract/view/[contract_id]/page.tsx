"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type ContractData = {
  id: string;
  contract_number: string | null;
  status: string;
  content: string | null;
  sent_date: string | null;
  contract_type: string | null;
  deals: {
    deal_number: string | null;
    visa_type: string | null;
    deal_type: string | null;
    contacts: { first_name: string; last_name: string } | null;
    companies: { company_name: string } | null;
  } | null;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent_to_lia: "Pending LIA Review",
  lia_signed: "LIA Approved",
  sent_to_client: "Sent to Client",
  completed: "Signed & Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export default function ContractViewPage() {
  const params = useParams();
  const contractId = params.contract_id as string;

  const [contract, setContract] = useState<ContractData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchContract() {
      const { data, error: fetchError } = await supabase
        .from("deal_contracts")
        .select("id, contract_number, status, content, sent_date, contract_type, deals(deal_number, visa_type, deal_type, contacts(first_name, last_name), companies(company_name))")
        .eq("id", contractId)
        .single();

      if (fetchError || !data) {
        setError("Contract not found.");
        setIsLoading(false);
        return;
      }

      setContract(data as unknown as ContractData);
      setIsLoading(false);
    }
    fetchContract();
  }, [contractId]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading contract...</p>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Contract Not Found</h1>
          <p className="text-gray-600">{error ?? "This contract link is invalid."}</p>
        </div>
      </div>
    );
  }

  const clientName = contract.deals?.contacts
    ? `${contract.deals.contacts.first_name} ${contract.deals.contacts.last_name}`
    : contract.deals?.companies?.company_name ?? "—";

  const caseType = contract.deals?.visa_type ?? contract.deals?.deal_type?.replace(/_/g, " ") ?? "Service Agreement";
  const dealNumber = contract.deals?.deal_number ?? "—";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white dark:bg-blue-900 text-gray-900 dark:text-white py-5 px-4 print:hidden">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold">PJ Operation & Management System</h1>
            <p className="text-blue-200 text-xs mt-0.5">Service Agreement</p>
          </div>
          <button
            onClick={() => window.print()}
            className="rounded-lg border border-gray-300 dark:border-white/30 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-white/10"
          >
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Status banner */}
      <div className={`py-2 px-4 text-center text-sm font-medium print:hidden ${
        contract.status === "completed" ? "bg-green-100 text-green-800" :
        contract.status === "rejected" ? "bg-red-100 text-red-800" :
        contract.status === "cancelled" ? "bg-gray-200 text-gray-600" :
        "bg-blue-100 text-blue-800"
      }`}>
        Status: {STATUS_LABELS[contract.status] ?? contract.status}
      </div>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Contract meta */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500 text-xs mb-0.5">Contract No.</p>
              <p className="font-bold text-gray-900">{contract.contract_number ?? "—"}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-0.5">Case No.</p>
              <p className="font-bold text-gray-900">{dealNumber}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-0.5">Client</p>
              <p className="font-bold text-gray-900">{clientName}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-0.5">Service</p>
              <p className="font-bold text-gray-900">{caseType}</p>
            </div>
          </div>
          {contract.sent_date && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 pt-3 border-t border-gray-100">
              Issued: {new Date(contract.sent_date).toLocaleDateString("en-NZ", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          )}
        </div>

        {/* Contract content */}
        <div className="bg-white rounded-xl border border-gray-200 p-8 mb-6">
          {contract.content ? (
            <div
              className="prose prose-sm max-w-none"
              style={{
                color: "#111",
                lineHeight: 1.8,
                fontSize: "14px",
              }}
              dangerouslySetInnerHTML={{ __html: contract.content }}
            />
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">Contract content not available.</p>
              <p className="text-gray-500 dark:text-gray-300 text-sm mt-2">Please contact your consultant.</p>
            </div>
          )}
        </div>

        {/* Signature section */}
        <div className="bg-white rounded-xl border border-gray-200 p-8 mb-6">
          <h3 className="text-base font-bold text-gray-900 mb-6">Signatures</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Client Signature</p>
              <div className="border-b-2 border-gray-300 h-14 mb-2"></div>
              <p className="text-xs text-gray-500">Name: {clientName}</p>
              <p className="text-xs text-gray-500 mt-1">Date: ____________________</p>
              <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3">
                <p className="text-xs text-amber-700">
                  🔒 Electronic signature coming soon. Please print, sign, and return this document to your consultant, or sign as instructed.
                </p>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Authorised Representative</p>
              <div className="border-b-2 border-gray-300 h-14 mb-2"></div>
              <p className="text-xs text-gray-500">PJ Operation & Management System</p>
              <p className="text-xs text-gray-500 mt-1">Date: ____________________</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 dark:text-gray-400 pb-6">
          Contract {contract.contract_number} — PJ Operation & Management System<br />
          This document is confidential and intended solely for the named client.
        </p>
      </main>

      {/* Print styles */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { background: white; }
          main { max-width: 100%; padding: 0; }
        }
      `}</style>
    </div>
  );
}
