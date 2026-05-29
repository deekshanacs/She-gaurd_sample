import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileImage, Loader2, AlertTriangle, CheckCircle, XCircle, Cpu, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { type AnalysisResult } from "@/lib/mockApi";
import Navbar from "@/components/Navbar";
import AnimatedBackground from "@/components/AnimatedBackground";
import GlowCursor from "@/components/GlowCursor";
import Footer from "@/components/Footer";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "../config";

interface ExtendedAnalysisResult extends AnalysisResult {
  ela_image?: string;
  metadata?: {
    software: string | null;
    has_exif: boolean;
    details: Record<string, string>;
  };
}

const UploadPage = () => {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExtendedAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);

  const handleFile = (f: File) => {
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(f.type)) {
      setError("Unsupported file format. Please upload a JPG, PNG, or WEBP image.");
      setFile(null);
      setResult(null);
      return;
    }
    
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (f.size > maxSize) {
      setError("File is too large. Maximum supported size is 10MB.");
      setFile(null);
      setResult(null);
      return;
    }
    
    setFile(f);
    setResult(null);
    setError(null);
    setIsDemoMode(false);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  }, []);

  const analyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setIsDemoMode(false);
    
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: "POST",
        headers: {
          "X-Requested-With": "sheguard-client"
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Failed to analyze image: ${response.statusText}`);
      }

      const res = await response.json();
      setResult(res);
      
      // Save to local storage cache
      const cached = localStorage.getItem("sheguard_cases");
      const casesList = cached ? JSON.parse(cached) : [];
      casesList.unshift({
        caseId: res.caseId,
        imageStatus: res.imageStatus,
        confidenceScore: res.confidenceScore,
        forensicScore: res.forensicScore,
        timestamp: res.timestamp || new Date().toISOString(),
        riskLevel: res.riskLevel,
        details: res.details,
        metadata: res.metadata,
        ela_image: res.ela_image
      });
      localStorage.setItem("sheguard_cases", JSON.stringify(casesList));

    } catch (err: any) {
      console.warn("Backend unavailable. Falling back to local simulated client-side analysis...", err);
      
      // Simulate processing time
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      const seed = file.name.length + file.size;
      const isManipulated = seed % 3 === 0;
      const isSuspicious = seed % 3 === 1;
      
      const status = isManipulated ? "Manipulated" : isSuspicious ? "Suspicious" : "Safe";
      const riskLevel = isManipulated ? "red" : isSuspicious ? "yellow" : "green";
      const confidenceScore = Math.round((82.0 + (seed % 15) + Math.random() * 2) * 10) / 10;
      const forensicScore = isManipulated 
        ? Math.round((68.0 + (seed % 28)) * 10) / 10 
        : isSuspicious 
          ? Math.round((30.0 + (seed % 15)) * 10) / 10 
          : Math.round((2.0 + (seed % 8)) * 10) / 10;
      
      const res: ExtendedAnalysisResult = {
        caseId: `SG-${Math.floor(100000 + Math.random() * 900000).toString(16).toUpperCase().substring(0, 6)}`,
        imageStatus: status,
        confidenceScore: Math.min(99.5, confidenceScore),
        forensicScore: Math.min(100.0, forensicScore),
        timestamp: new Date().toISOString(),
        riskLevel: riskLevel,
        details: {
          faceManipulation: isManipulated ? Math.round((55.0 + (seed % 35)) * 10) / 10 : 8.5,
          spliceDetection: isManipulated ? Math.round((70.0 + (seed % 25)) * 10) / 10 : isSuspicious ? Math.round((35.0 + (seed % 15)) * 10) / 10 : 11.2,
          metadataAnomaly: isSuspicious ? 45.0 : isManipulated ? 75.0 : 15.0,
          noiseAnalysis: isManipulated ? Math.round((65.0 + (seed % 30)) * 10) / 10 : isSuspicious ? Math.round((38.0 + (seed % 12)) * 10) / 10 : 6.4
        },
        metadata: {
          software: isManipulated || isSuspicious ? "Adobe Photoshop CC 2024 (Windows)" : null,
          has_exif: true,
          details: {
            "Camera Make": "Apple",
            "Camera Model": "iPhone 15 Pro Max",
            "Software Trace": isManipulated || isSuspicious ? "Adobe Photoshop CC" : "iOS 17.4",
            "ISO Speed": "100",
            "Aperture": "f/1.8",
            "Resolution": "3024 x 4032"
          }
        },
        ela_image: ""
      };
      
      setResult(res);
      setIsDemoMode(true);
      
      // Save client side demo to localStorage cases list
      const cached = localStorage.getItem("sheguard_cases");
      const casesList = cached ? JSON.parse(cached) : [];
      casesList.unshift({
        caseId: res.caseId,
        imageStatus: res.imageStatus,
        confidenceScore: res.confidenceScore,
        forensicScore: res.forensicScore,
        timestamp: res.timestamp,
        riskLevel: res.riskLevel,
        details: res.details,
        metadata: res.metadata,
        ela_image: res.ela_image
      });
      localStorage.setItem("sheguard_cases", JSON.stringify(casesList));
    } finally {
      setLoading(false);
    }
  };

  const riskIcon = (level: string) => {
    if (level === "green") return <CheckCircle className="h-5 w-5 risk-safe" />;
    if (level === "yellow") return <AlertTriangle className="h-5 w-5 risk-suspicious" />;
    return <XCircle className="h-5 w-5 risk-manipulated" />;
  };

  const riskClass = (level: string) =>
    level === "green" ? "progress-safe" : level === "yellow" ? "progress-suspicious" : "progress-manipulated";

  const riskTextClass = (level: string) =>
    level === "green" ? "risk-safe" : level === "yellow" ? "risk-suspicious" : "risk-manipulated";

  return (
    <div className="relative min-h-screen cyber-grid">
      <AnimatedBackground />
      <GlowCursor />
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 pb-24 pt-28">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-2 text-center font-display text-3xl font-bold tracking-wide"
        >
          <span className="gradient-text">Image Analysis</span>
        </motion.h1>
        <p className="mb-10 text-center text-muted-foreground">Upload an image to detect manipulation</p>

        {/* Upload area / Scanning view */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`glass-card cursor-pointer border-2 border-dashed p-12 text-center transition-all duration-300 relative overflow-hidden ${
            dragging 
              ? "border-neon-purple bg-neon-purple/5 shadow-[0_0_15px_rgba(168,85,247,0.3)] scale-[1.01] animate-pulse" 
              : "border-border hover:border-neon-blue/50 hover:bg-neon-blue/5"
          }`}
          onClick={() => !loading && document.getElementById("file-input")?.click()}
        >
          <input
            id="file-input"
            type="file"
            accept="image/*"
            className="hidden"
            disabled={loading}
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          
          {loading ? (
            <div className="flex flex-col items-center gap-4 py-4 relative z-10">
              <div className="relative w-24 h-24 flex items-center justify-center">
                <FileImage className="h-16 w-16 text-neon-blue animate-pulse" />
                <div className="absolute inset-0 border-2 border-neon-blue border-t-neon-purple rounded-full animate-spin"></div>
              </div>
              <div className="space-y-1">
                <p className="font-display text-sm font-semibold tracking-wide text-neon-blue uppercase animate-pulse">Running Digital Audits...</p>
                <p className="text-xs text-muted-foreground font-mono">Analyzing pixels, noise, and metadata</p>
              </div>
              
              {/* Neon scanner laser line */}
              <div className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-neon-purple to-transparent top-0 animate-[scan_2s_infinite]"></div>
            </div>
          ) : file ? (
            <div className="flex flex-col items-center gap-3">
              <FileImage className="h-12 w-12 text-neon-purple" />
              <p className="font-body text-foreground">{file.name}</p>
              <p className="text-sm text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload className="h-12 w-12 text-muted-foreground" />
              <p className="text-foreground">Drag & drop an image or click to browse</p>
              <p className="text-sm text-muted-foreground">Supports JPG, PNG, WEBP (Max 10MB)</p>
            </div>
          )}
        </motion.div>

        <div className="mt-6 flex justify-center">
          <button
            onClick={analyze}
            disabled={!file || loading}
            className="btn-glow flex items-center gap-2 font-display text-sm tracking-wide text-primary-foreground disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? "Analyzing..." : "Analyze Image"}
          </button>
        </div>

        {/* Info/Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 glass-card border-destructive/50 p-4 text-center text-destructive"
          >
            <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-destructive" />
            <p className="font-semibold">Analysis Error</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </motion.div>
        )}

        {isDemoMode && result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 rounded border border-yellow-500/30 bg-yellow-500/10 p-3 text-center text-xs text-yellow-400"
          >
            Backend offline. Running client-side simulated analysis. Results saved to local session.
          </motion.div>
        )}

        {/* Results */}
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-12"
          >
            <h2 className="mb-6 text-center font-display text-xl font-bold tracking-wide">
              Analysis <span className="gradient-text">Results</span>
            </h2>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Left Column: Forensic Data */}
              <div className="space-y-6">
                {/* Status card */}
                <div className="glass-card neon-border p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Case ID</p>
                      <p className="font-display text-sm font-bold">{result.caseId}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {riskIcon(result.riskLevel)}
                      <span className={`font-display text-lg font-bold ${riskTextClass(result.riskLevel)}`}>
                        {result.imageStatus}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
                    {[
                      { label: "Confidence", value: result.confidenceScore },
                      { label: "Forensic Score", value: result.forensicScore },
                    ].map((m) => (
                      <div key={m.label}>
                        <p className="mb-1 text-xs text-muted-foreground">{m.label}</p>
                        <div className="h-2 rounded-full bg-secondary">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${m.value}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className={`h-full rounded-full ${riskClass(result.riskLevel)}`}
                          />
                        </div>
                        <p className="mt-1 text-right text-xs text-muted-foreground">{m.value}%</p>
                      </div>
                    ))}
                    <div className="col-span-2 sm:col-span-1">
                      <p className="mb-1 text-xs text-muted-foreground">Timestamp</p>
                      <p className="text-xs text-foreground mt-1">{new Date(result.timestamp).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Detailed scores */}
                <div className="glass-card p-6">
                  <h3 className="mb-4 font-display text-sm font-semibold tracking-wide">Forensic Detail Scores</h3>
                  <div className="space-y-3">
                    {Object.entries(result.details).map(([key, val]) => (
                      <div key={key}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                          <span className="text-foreground">{val}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-secondary">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${val}%` }}
                            transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
                            className="h-full rounded-full"
                            style={{ background: `linear-gradient(90deg, hsl(270 80% 65%), hsl(200 100% 55%))` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Visual scan & EXIF metadata */}
              <div className="space-y-6">
                {/* ELA Visualizer */}
                <div className="glass-card p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Cpu className="h-4 w-4 text-neon-blue" />
                    <h3 className="font-display text-sm font-semibold tracking-wide">Error Level Analysis (ELA) Scan</h3>
                  </div>
                  <div className="relative overflow-hidden rounded border border-border bg-black/80 p-2 flex justify-center items-center h-[236px]">
                    {result.ela_image ? (
                      <img
                        src={`data:image/jpeg;base64,${result.ela_image}`}
                        alt="Error Level Analysis scan"
                        className="max-h-[220px] object-contain rounded"
                      />
                    ) : (
                      // Simulated interactive scan lines
                      <div className="w-full h-full flex flex-col items-center justify-center border border-dashed border-neon-blue/30 rounded p-4 text-center">
                        <div className="absolute inset-0 bg-gradient-to-t from-neon-blue/5 to-transparent pointer-events-none"></div>
                        <div className="w-12 h-12 border-2 border-neon-blue/40 border-t-neon-purple rounded-full animate-spin mb-4"></div>
                        <p className="text-xs font-mono text-neon-blue uppercase tracking-widest animate-pulse">Running Digital Edge Map...</p>
                        <p className="text-[10px] text-muted-foreground mt-1">ELA visualization is only available in live backend mode</p>
                      </div>
                    )}
                    <div className="absolute inset-0 pointer-events-none border border-neon-blue/20 scanline animate-pulse"></div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground leading-normal">
                    High-contrast pixels signify variance in compression error levels, indicating potential splicing, editing, or face manipulation.
                  </p>
                </div>

                {/* EXIF Metadata Audit */}
                <div className="glass-card p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-4 w-4 text-neon-purple" />
                    <h3 className="font-display text-sm font-semibold tracking-wide">EXIF Metadata Analysis</h3>
                  </div>

                  {result.metadata ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center rounded bg-secondary/30 p-2.5 text-xs">
                        <span className="text-muted-foreground">Software Trace</span>
                        {result.metadata.software ? (
                          <span className="font-bold text-destructive animate-pulse bg-destructive/10 px-2 py-0.5 rounded border border-destructive/20">
                            {result.metadata.software} detected
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-semibold">No editor signature</span>
                        )}
                      </div>
                      
                      <div className="max-h-[140px] overflow-y-auto text-xs space-y-1 pr-1">
                        {Object.keys(result.metadata.details).length > 0 ? (
                          Object.entries(result.metadata.details).map(([k, v]) => (
                            <div key={k} className="flex justify-between py-1 border-b border-border/20">
                              <span className="text-muted-foreground">{k}</span>
                              <span className="text-foreground font-mono truncate max-w-[150px]">{v}</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-muted-foreground text-center py-4">No EXIF tags found (metadata might be stripped).</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">EXIF audit unavailable.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-center">
              <Link
                to={`/evidence-report?caseId=${result.caseId}&status=${result.imageStatus}&confidence=${result.confidenceScore}&forensic=${result.forensicScore}&risk=${result.riskLevel}`}
                className="btn-glow font-display text-sm tracking-wide text-primary-foreground"
              >
                View Evidence Report
              </Link>
            </div>
          </motion.div>
        )}

        {/* Algorithm Methodology Toggle Section */}
        <div className="mt-12 border-t border-border/40 pt-8">
          <button
            onClick={() => setShowMethodology(!showMethodology)}
            className="mx-auto flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>Forensics Methodology & Transparencies</span>
            {showMethodology ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          <AnimatePresence>
            {showMethodology && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mt-6 text-xs text-muted-foreground leading-relaxed space-y-4 max-w-3xl mx-auto bg-secondary/10 p-5 rounded-lg border border-border/55"
              >
                <h4 className="font-display font-semibold text-foreground uppercase tracking-wide">Algorithm Transparency Disclosure</h4>
                <p>
                  SHE-GUARD AI utilizes multiple analytical filters to score local regions for statistical irregularities:
                </p>
                <div className="grid gap-4 sm:grid-cols-3 mt-2">
                  <div className="space-y-1">
                    <h5 className="font-semibold text-neon-purple uppercase">1. Error Level Analysis (ELA)</h5>
                    <p className="text-[11px]">
                      Saves the image at a target 95% JPEG quality and analyzes pixel grid differences. Manipulated portions compress at different rates, producing highlighted edge outlines.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-semibold text-neon-blue uppercase">2. Local Noise Check</h5>
                    <p className="text-[11px]">
                      Extracts high-frequency noise from flat regions using Sobel filters. Mismatched variance between blocks highlights composites pasted from differing capture sources.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-semibold text-neon-pink uppercase">3. Face Swap Matching</h5>
                    <p className="text-[11px]">
                      Detects faces using Haar Cascades and checks if ELA compression signatures inside the face boundaries are consistent with the overall image background.
                    </p>
                  </div>
                </div>
                <p className="text-[11px] border-t border-border/20 pt-2 text-center italic">
                  Scores indicate mathematical variance profiles and do not represent absolute certitude. Results should be verified by certified forensic examiners.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default UploadPage;
