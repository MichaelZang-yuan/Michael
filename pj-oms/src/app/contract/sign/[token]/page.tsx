"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";

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

  // Signature mode
  const [signMode, setSignMode] = useState<"draw" | "upload">("draw");
  const [uploadedSig, setUploadedSig] = useState<string>("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

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

  // ── Canvas drawing ──────────────────────────────────────────────────────────

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * scaleX, y: ((e as React.MouseEvent).clientY - rect.top) * scaleY };
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
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
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
    if (!agreed) { setMessage({ type: "error", text: "Please confirm you have read and agreed to the terms." }); return; }

    let signature: string;
    if (signMode === "upload") {
      if (!uploadedSig) { setMessage({ type: "error", text: "Please upload a signature image first." }); return; }
      signature = uploadedSig;
    } else {
      if (isCanvasBlank()) { setMessage({ type: "error", text: "Please draw your signature first." }); return; }
      signature = canvasRef.current!.toDataURL("image/png");
    }

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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Draw your signature: <span className="text-gray-400 font-normal">(use your finger or mouse)</span>
                </label>
                <div className="relative border-2 border-gray-300 rounded-xl overflow-hidden bg-gray-50" style={{ touchAction: "none" }}>
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={160}
                    className="w-full cursor-crosshair"
                    style={{ display: "block", touchAction: "none" }}
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
                  Clear and redo
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
                  className="rounded-xl border-2 border-dashed border-gray-300 px-6 py-5 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors w-full text-center"
                >
                  Click to select signature image…
                </button>
                {uploadedSig && (
                  <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
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
              disabled={isSigning || !agreed}
              className="w-full rounded-xl bg-blue-700 px-6 py-4 text-base font-bold text-white hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isSigning ? "Submitting..." : "Submit Signature & Sign Agreement"}
            </button>
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
