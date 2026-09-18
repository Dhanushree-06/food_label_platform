import { useRef, useState, useCallback } from "react";
import { Upload, ImageIcon, FileText, Loader2, ShieldCheck, AlertTriangle, CheckCircle2, XCircle, MinusCircle, RotateCcw, Download } from "lucide-react";
import { runOcr, type OcrResult } from "@/lib/ocr";
import { runComplianceChecks, computeSummary, type ComplianceResult } from "@/lib/fssaiRules";

type Phase = "idle" | "processing" | "results";

const statusMeta: Record<string, { label: string; icon: typeof CheckCircle2; color: string; bg: string; border: string }> = {
  present: { label: "Present", icon: CheckCircle2, color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  missing: { label: "Missing", icon: XCircle, color: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
  not_applicable: { label: "Not Applicable", icon: MinusCircle, color: "text-slate-500", bg: "bg-slate-50", border: "border-slate-200" },
};

export default function App() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [ocrText, setOcrText] = useState("");
  const [ocrConfidence, setOcrConfidence] = useState(0);
  const [results, setResults] = useState<ComplianceResult[]>([]);
  const [summary, setSummary] = useState<ReturnType<typeof computeSummary> | null>(null);
  const [showRawText, setShowRawText] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (PNG, JPG, etc.).");
      return;
    }
    setError(null);
    setPhase("processing");
    setProgress(0);
    setPreviewUrl(URL.createObjectURL(file));

    try {
      const ocr: OcrResult = await runOcr(file, (p) => setProgress(p));
      setOcrText(ocr.text);
      setOcrConfidence(ocr.confidence);
      const checks = runComplianceChecks(ocr.text);
      setResults(checks);
      setSummary(computeSummary(checks));
      setPhase("results");
    } catch (e) {
      setError("Failed to read the image. Please try a clearer photo of the food label.");
      setPhase("idle");
    }
  }, []);

  const reset = () => {
    setPhase("idle");
    setPreviewUrl(null);
    setOcrText("");
    setOcrConfidence(0);
    setResults([]);
    setSummary(null);
    setShowRawText(false);
    setError(null);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const downloadReport = () => {
    if (!summary) return;
    const lines: string[] = [];
    lines.push("FSSAI FOOD LABEL COMPLIANCE REPORT");
    lines.push("=".repeat(50));
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push(`OCR Confidence: ${ocrConfidence.toFixed(1)}%`);
    lines.push("");
    lines.push(`Overall Compliance Score: ${summary.complianceScore}%`);
    lines.push(`Status: ${summary.isCompliant ? "COMPLIANT" : "NON-COMPLIANT"}`);
    lines.push(`Present: ${summary.present} | Missing: ${summary.missing} | Not Applicable: ${summary.notApplicable}`);
    lines.push("");
    lines.push("DETAILED FINDINGS");
    lines.push("-".repeat(50));
    results.forEach((r) => {
      const statusLabel = statusMeta[r.status].label.toUpperCase();
      lines.push(`${r.rule.id}. ${r.rule.name} [${statusLabel}]`);
      lines.push(`   ${r.rule.description}`);
      if (r.evidence) lines.push(`   Evidence: "${r.evidence}"`);
      lines.push("");
    });
    lines.push("");
    lines.push("EXTRACTED TEXT (OCR OUTPUT)");
    lines.push("-".repeat(50));
    lines.push(ocrText || "(none)");

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fssai-compliance-report.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/40">
      {/* Header */}
      <header className="border-b border-slate-200/70 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm shadow-emerald-200">
              <ShieldCheck className="w-5 h-5 text-white" strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900 tracking-tight">FSSAI Label Checker</h1>
              <p className="text-xs text-slate-500 -mt-0.5">Automated food-label compliance verification</p>
            </div>
          </div>
          {phase === "results" && (
            <button
              onClick={reset}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              New Check
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 sm:px-8 py-8 sm:py-12">
        {/* Hero / Intro */}
        {phase === "idle" && (
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Verify your food label against 15 FSSAI mandates
            </h2>
            <p className="mt-3 text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Upload a photo of any packaged food label. Our system reads the text automatically and checks it
              against the Food Safety and Standards Authority of India requirements — then produces a detailed compliance report.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Upload Zone */}
        {phase === "idle" && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
            className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer group
              ${dragOver ? "border-emerald-400 bg-emerald-50/60 scale-[1.01]" : "border-slate-300 bg-white hover:border-emerald-300 hover:bg-slate-50/50"}`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <div className="py-16 px-6 text-center">
              <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 items-center justify-center mb-5 shadow-lg shadow-emerald-200/60 group-hover:scale-105 transition-transform">
                <Upload className="w-7 h-7 text-white" strokeWidth={2} />
              </div>
              <p className="text-lg font-semibold text-slate-800">Drop your food label image here</p>
              <p className="text-sm text-slate-500 mt-1.5">or click to browse — PNG, JPG, WEBP supported</p>
            </div>
          </div>
        )}

        {/* Processing */}
        {phase === "processing" && (
          <div className="max-w-xl mx-auto">
            {previewUrl && (
              <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm mb-6">
                <img src={previewUrl} alt="Uploaded label" className="w-full max-h-72 object-contain bg-slate-50" />
              </div>
            )}
            <div className="text-center py-6">
              <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-800">Reading your food label…</h3>
              <p className="text-sm text-slate-500 mt-1.5 mb-5">Extracting text with OCR, then running 15 compliance checks.</p>
              <div className="max-w-sm mx-auto">
                <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(progress * 100, 8)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">{Math.round(progress * 100)}% recognized</p>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {phase === "results" && summary && (
          <div className="space-y-8">
            {/* Summary card */}
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-900">Compliance Score</h3>
                  {summary.isCompliant ? (
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
                      <ShieldCheck className="w-4 h-4" /> Compliant
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-red-700 bg-red-50 px-3 py-1 rounded-full">
                      <AlertTriangle className="w-4 h-4" /> Non-Compliant
                    </span>
                  )}
                </div>
                <div className="flex items-end gap-3">
                  <span className={`text-5xl font-bold tracking-tight ${summary.isCompliant ? "text-emerald-600" : "text-red-600"}`}>
                    {summary.complianceScore}%
                  </span>
                  <span className="text-sm text-slate-500 mb-1.5">
                    {summary.present} of {summary.applicable} applicable mandates met
                  </span>
                </div>
                <div className="mt-4 flex gap-2 flex-wrap">
                  <Badge count={summary.present} label="Present" color="emerald" />
                  <Badge count={summary.missing} label="Missing" color="red" />
                  <Badge count={summary.notApplicable} label="N/A" color="slate" />
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">OCR Quality</h3>
                  <p className="text-xs text-slate-500 mb-4">Text recognition confidence</p>
                  <div className="flex items-end gap-2">
                    <span className={`text-3xl font-bold ${ocrConfidence > 70 ? "text-slate-800" : "text-amber-600"}`}>
                      {ocrConfidence.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <button
                  onClick={downloadReport}
                  className="mt-4 flex items-center justify-center gap-2 w-full text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-xl py-2.5 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download Report
                </button>
              </div>
            </div>

            {/* Preview + raw text toggle */}
            {previewUrl && (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
                  <img src={previewUrl} alt="Label" className="w-full max-h-64 object-contain bg-slate-50" />
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
                  <button
                    onClick={() => setShowRawText((v) => !v)}
                    className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900"
                  >
                    <FileText className="w-4 h-4" />
                    {showRawText ? "Hide extracted text" : "Show extracted text"}
                  </button>
                  {showRawText && (
                    <pre className="mt-3 text-xs text-slate-600 bg-slate-50 rounded-lg p-3 max-h-48 overflow-auto whitespace-pre-wrap font-mono leading-relaxed">
                      {ocrText || "(no text extracted)"}
                    </pre>
                  )}
                  {!showRawText && (
                    <p className="mt-3 text-sm text-slate-500">
                      {ocrText ? (
                        <>
                          {ocrText.slice(0, 180)}
                          {ocrText.length > 180 ? "…" : ""}
                        </>
                      ) : (
                        "No text was extracted."
                      )}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Detailed findings */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Detailed Findings — 15 FSSAI Mandates</h3>
              <div className="space-y-3">
                {results.map((r) => {
                  const meta = statusMeta[r.status];
                  const Icon = meta.icon;
                  return (
                    <div
                      key={r.rule.id}
                      className={`rounded-xl border ${meta.border} ${meta.bg} p-4 flex items-start gap-4 transition-all hover:shadow-sm`}
                    >
                      <div className={`flex-shrink-0 w-9 h-9 rounded-lg ${meta.bg} ${meta.color} flex items-center justify-center border ${meta.border}`}>
                        <Icon className="w-5 h-5" strokeWidth={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-slate-400">#{r.rule.id.toString().padStart(2, "0")}</span>
                          <h4 className="font-semibold text-slate-900 text-sm">{r.rule.name}</h4>
                          <span className={`text-xs font-semibold ${meta.color} px-2 py-0.5 rounded-full bg-white border ${meta.border}`}>
                            {meta.label}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mt-1 leading-relaxed">{r.rule.description}</p>
                        {r.evidence && (
                          <p className="text-xs text-slate-500 mt-1.5 italic">
                            Found: "{r.evidence.length > 120 ? r.evidence.slice(0, 120) + "…" : r.evidence}"
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-center pt-2">
              <button
                onClick={reset}
                className="flex items-center gap-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 px-6 py-3 rounded-xl transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Check Another Label
              </button>
            </div>
          </div>
        )}

        {/* Footer note */}
        <footer className="mt-16 pt-6 border-t border-slate-200/70">
          <p className="text-xs text-slate-400 text-center leading-relaxed max-w-2xl mx-auto">
            This tool performs automated text recognition and rule-based checks for informational purposes only.
            It is not a substitute for official FSSAI certification or legal review. OCR accuracy depends on image quality.
          </p>
        </footer>
      </main>
    </div>
  );
}

function Badge({ count, label, color }: { count: number; label: string; color: "emerald" | "red" | "slate" }) {
  const styles = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    red: "bg-red-50 text-red-700 border-red-200",
    slate: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${styles[color]}`}>
      {count} {label}
    </span>
  );
}
