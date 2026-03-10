"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { hasAnyRole } from "@/lib/roles";

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

  // Signature mode
  const [signMode, setSignMode] = useState<"draw" | "upload">("draw");
  const [uploadedSig, setUploadedSig] = useState<string>("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/admin"); return; }

      const { data: profile } = await supabase.from("profiles").select("role, roles").eq("id", session.user.id).single();
      if (!profile || !hasAnyRole(profile, ["admin", "lia"])) {
        router.push("/crm"); return;
      }
      setUserId(session.user.id);

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

  // ── Canvas drawing ──────────────────────────────────────────────────────────

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    isDrawing.current = true;
    lastPos.current = getPos(e, canvas);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current || !canvasRef.current || !lastPos.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1e3a5f";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
    lastPos.current = pos;
  };

  const endDraw = () => { isDrawing.current = false; lastPos.current = null; };

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const isCanvasBlank = () => {
    const canvas = canvasRef.current;
    if (!canvas) return true;
    const ctx = canvas.getContext("2d");
    if (!ctx) return true;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    return !data.some(v => v !== 0);
  };

  // ── Signature upload ────────────────────────────────────────────────────────

  const handleSigUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setUploadedSig(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ── Sign submission ─────────────────────────────────────────────────────────

  const handleSign = async () => {
    let signature: string;

    if (signMode === "upload") {
      if (!uploadedSig) { setMessage({ type: "error", text: "Please upload a signature image first." }); return; }
      signature = uploadedSig;
    } else {
      if (isCanvasBlank()) { setMessage({ type: "error", text: "Please draw your signature first." }); return; }
      signature = canvasRef.current!.toDataURL("image/png");
    }

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

            {/* Mode toggle */}
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setSignMode("draw")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${signMode === "draw" ? "bg-blue-700 text-white border-blue-700" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}
              >
                ✏️ Draw Signature
              </button>
              <button
                type="button"
                onClick={() => setSignMode("upload")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${signMode === "upload" ? "bg-blue-700 text-white border-blue-700" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}
              >
                📁 Upload Image
              </button>
            </div>

            {/* Draw mode */}
            {signMode === "draw" && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Draw your signature below:</label>
                <div className="relative border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={140}
                    className="w-full touch-none cursor-crosshair"
                    style={{ display: "block" }}
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={endDraw}
                    onMouseLeave={endDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={endDraw}
                  />
                  <p className="absolute bottom-2 right-3 text-xs text-gray-300 pointer-events-none select-none">Sign here</p>
                </div>
                <button onClick={clearCanvas} className="mt-2 text-xs text-gray-400 hover:text-gray-600 underline">
                  Clear signature
                </button>
              </div>
            )}

            {/* Upload mode */}
            {signMode === "upload" && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Upload your signature image (PNG or JPG):</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg"
                  onChange={handleSigUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg border-2 border-dashed border-gray-300 px-6 py-4 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors w-full text-center"
                >
                  Click to select signature image…
                </button>
                {uploadedSig && (
                  <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <p className="text-xs text-gray-500 mb-2 font-medium">Preview:</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={uploadedSig} alt="Uploaded signature" className="max-h-24 max-w-xs object-contain" />
                    <button
                      type="button"
                      onClick={() => setUploadedSig("")}
                      className="mt-2 text-xs text-red-400 hover:text-red-600 underline block"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleSign}
              disabled={isSigning}
              className="w-full rounded-lg bg-blue-700 px-6 py-3 font-bold text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {isSigning ? "Signing..." : "Sign Contract"}
            </button>
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
