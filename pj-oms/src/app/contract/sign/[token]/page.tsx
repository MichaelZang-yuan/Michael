"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import SignaturePad from "@/components/SignaturePad";

type ContractInfo = {
  id: string;
  status: string;
  html: string;
  client_signed_at: string | null;
  client_name: string;
  deal_number: string;
};

export default function ClientSignPage() {
  const params = useParams();
  const token = params.token as string;

  const [isLoading, setIsLoading] = useState(true);
  const [contract, setContract] = useState<ContractInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [signDone, setSignDone] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/contract/sign/${token}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "This link is invalid or has expired.");
        setIsLoading(false);
        return;
      }
      const data = await res.json();
      setContract(data);
      if (data.client_signed_at || data.status === "completed") setSignDone(true);
      setIsLoading(false);
    }
    load();
  }, [token]);

  // ── Sign submission ─────────────────────────────────────────────────

  const submitSignature = async (signature: string) => {
    if (!agreed) { setMessage({ type: "error", text: "Please confirm you have read and agreed to the terms." }); return; }

    setIsSigning(true);
    setMessage(null);
    const res = await fetch(`/api/contract/sign/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signature }),
    });
    const json = await res.json();
    if (!res.ok) { setMessage({ type: "error", text: json.error ?? "Failed to submit signature." }); setIsSigning(false); return; }
    setSignDone(true);
    setMessage({ type: "success", text: "Your signature has been submitted successfully." });
    setIsSigning(false);
  };

  if (isLoading) return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-500">Loading your contract...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">Link Invalid or Expired</h1>
        <p className="text-gray-500">{error}</p>
        <p className="text-sm text-gray-400 mt-4">Please contact PJ Immigration Services for assistance.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-blue-900 text-white px-6 py-5">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm text-blue-200 mb-0.5">PJ Immigration Services Ltd</p>
          <h1 className="text-xl font-bold">Service Agreement — {contract?.deal_number ?? ""}</h1>
          {contract?.client_name && (
            <p className="text-sm text-blue-200 mt-0.5">Prepared for: {contract.client_name}</p>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Info banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-6 text-sm text-blue-800">
          Please read the following agreement carefully. Scroll to the bottom to sign.
        </div>

        {message && (
          <div className={`mb-6 rounded-xl px-4 py-3 ${message.type === "error" ? "bg-red-50 text-red-800 border border-red-200" : "bg-green-50 text-green-800 border border-green-200"}`}>
            {message.text}
          </div>
        )}

        {/* Contract content */}
        <div className="bg-white rounded-xl shadow-sm p-8 mb-8 prose prose-sm max-w-none" style={{ color: "#111", lineHeight: "1.7" }}>
          {contract?.html ? (
            <div dangerouslySetInnerHTML={{ __html: contract.html }} />
          ) : (
            <p className="text-gray-400 italic text-center py-8">Contract content unavailable. Please contact us.</p>
          )}
        </div>

        {/* Signature section */}
        {signDone ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
            <div className="text-5xl mb-3">✅</div>
            <h2 className="text-xl font-bold text-green-800 mb-2">Agreement Signed</h2>
            <p className="text-green-700 text-sm">
              {contract?.client_signed_at
                ? `Signed on ${new Date(contract.client_signed_at).toLocaleDateString("en-NZ", { year: "numeric", month: "long", day: "numeric" })}`
                : "Your signature has been recorded."}
            </p>
            <p className="text-gray-500 text-sm mt-4">
              Thank you, {contract?.client_name}. A copy of the signed agreement will be kept on file.<br />
              Please contact PJ Immigration Services if you have any questions.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-1">Sign the Agreement</h2>
            <p className="text-sm text-gray-500 mb-5">
              By signing below, you confirm that you have read, understood, and agree to all terms of this agreement.
            </p>

            {/* Agreement checkbox */}
            <label className="flex items-start gap-3 mb-5 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 shrink-0"
              />
              <span className="text-sm text-gray-700">
                I, <strong>{contract?.client_name}</strong>, confirm that I have read and understood the entire agreement above, and I agree to be bound by its terms and conditions.
              </span>
            </label>

            <SignaturePad
              onSignature={submitSignature}
              submitLabel={isSigning ? "Submitting..." : "Submit Signature & Sign Agreement"}
              disabled={isSigning || !agreed}
              canvasHeight={160}
            />

            <p className="text-xs text-gray-400 text-center mt-3">
              Your electronic signature is legally binding under New Zealand law.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 mt-8 pb-8">
          PJ Immigration Services Ltd · Licensed Immigration Advisers<br />
          Jiale WAN · Xu ZHOU · Di WU
        </div>
      </div>
    </div>
  );
}
