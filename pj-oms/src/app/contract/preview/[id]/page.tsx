"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { hasAnyRole, hasRole } from "@/lib/roles";
import SignaturePad from "@/components/SignaturePad";

type ContractData = {
  id: string;
  status: string;
  contract_number: string | null;
  contract_html: string | null;
  content: string | null;
  adviser_signed_at: string | null;
  client_signed_at: string | null;
  deal_id: string;
};

export default function ContractPreviewPage() {
  const params = useParams();
  const router = useRouter();
  const contractId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [contract, setContract] = useState<ContractData | null>(null);
  const [displayHtml, setDisplayHtml] = useState<string>("");
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [signDone, setSignDone] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [savedSignatureUrl, setSavedSignatureUrl] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/admin"); return; }

      const { data: profile } = await supabase.from("profiles").select("role, roles, default_signature_url").eq("id", session.user.id).single();
      if (!profile || !hasAnyRole(profile, ["admin", "lia"])) {
        router.push("/crm"); return;
      }
      setUserId(session.user.id);

      // Check for saved default signature (LIA users)
      if (hasAnyRole(profile, ["lia"]) && profile.default_signature_url) {
        setSavedSignatureUrl(profile.default_signature_url);
      }

      const { data, error: fetchErr } = await supabase
        .from("deal_contracts")
        .select("id, status, contract_number, contract_html, content, adviser_signed_at, client_signed_at, deal_id")
        .eq("id", contractId)
        .single();

      if (fetchErr || !data) { setError("Contract not found."); setIsLoading(false); return; }
      setContract(data as ContractData);
      setDisplayHtml(data.contract_html ?? data.content ?? "");
      if (data.adviser_signed_at) setSignDone(true);
      setIsLoading(false);
    }
    init();
  }, [contractId, router]);

  // ── Sign submission ─────────────────────────────────────────────────

  const submitSignature = async (signature: string) => {
    if (!contract || !userId) return;
    setIsSigning(true);
    setMessage(null);

    const res = await fetch(`/api/contracts/${contract.id}/adviser-sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signature, signed_by: userId }),
    });
    const json = await res.json();
    if (!res.ok) { setMessage({ type: "error", text: json.error ?? "Failed to sign." }); setIsSigning(false); return; }

    // Re-fetch to get updated contract_html with signature embedded
    const { data: updated } = await supabase
      .from("deal_contracts")
      .select("id, status, contract_number, contract_html, content, adviser_signed_at, client_signed_at, deal_id")
      .eq("id", contract.id)
      .single();
    if (updated) {
      setContract(updated as ContractData);
      setDisplayHtml(updated.contract_html ?? updated.content ?? "");
    }

    setSignDone(true);
    setMessage({ type: "success", text: "Contract signed successfully. Status updated to LIA Approved." });
    setIsSigning(false);
  };

  const handleUseSaved = () => {
    if (savedSignatureUrl) submitSignature(savedSignatureUrl);
  };

  if (isLoading) return (
    <div className="flex min-h-screen items-center justify-center bg-blue-950">
      <p className="text-white/60">Loading contract...</p>
    </div>
  );

  if (error) return (
    <div className="flex min-h-screen items-center justify-center bg-blue-950">
      <p className="text-red-400">{error}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top bar */}
      <div className="bg-blue-950 text-white px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-white/50">Contract Preview</p>
          <h1 className="font-bold text-lg">{contract?.contract_number ?? "Contract"}</h1>
        </div>
        <div className="flex gap-3">
          {contract?.deal_id && (
            <a href={`/deals/${contract.deal_id}`} className="rounded-lg border border-white/30 px-4 py-2 text-sm hover:bg-white/10">
              ← Back to Deal
            </a>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {message && (
          <div className={`mb-6 rounded-lg px-4 py-3 ${message.type === "error" ? "bg-red-100 text-red-800 border border-red-300" : "bg-green-100 text-green-800 border border-green-300"}`}>
            {message.text}
          </div>
        )}

        {/* Contract HTML */}
        <div className="bg-white rounded-xl shadow-sm p-8 mb-8 prose prose-sm max-w-none" style={{ color: "#111" }}>
          {displayHtml ? (
            <div dangerouslySetInnerHTML={{ __html: displayHtml }} />
          ) : (
            <p className="text-gray-400 italic text-center py-12">No contract content available.</p>
          )}
        </div>

        {/* Signature section */}
        {!signDone ? (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-1">LIA Adviser Signature</h2>
            <p className="text-sm text-gray-500 mb-4">
              By signing, you confirm you have reviewed this contract and agree to its terms on behalf of PJ Immigration Services Ltd.
            </p>

            <SignaturePad
              onSignature={submitSignature}
              submitLabel={isSigning ? "Signing..." : "Sign Contract"}
              disabled={isSigning}
              savedSignatureUrl={savedSignatureUrl}
              onUseSaved={handleUseSaved}
            />
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <p className="text-2xl mb-2">✓</p>
            <p className="text-lg font-bold text-green-800">Contract Signed</p>
            <p className="text-sm text-green-600 mt-1">
              {contract?.adviser_signed_at
                ? `Signed on ${new Date(contract.adviser_signed_at).toLocaleDateString("en-NZ")}`
                : "Signature recorded."}
            </p>
            <p className="text-xs text-gray-400 mt-2">A signed PDF has been saved to the deal&apos;s attachments.</p>
            {contract?.deal_id && (
              <a href={`/deals/${contract.deal_id}`}
                className="mt-4 inline-block rounded-lg bg-blue-700 px-6 py-2 text-sm font-bold text-white hover:bg-blue-800">
                Return to Deal →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
