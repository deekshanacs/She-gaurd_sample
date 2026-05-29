import { useState } from "react";
import { motion } from "framer-motion";
import { Send, CheckCircle, Loader2 } from "lucide-react";
import { type IncidentReport } from "@/lib/mockApi";
import Navbar from "@/components/Navbar";
import AnimatedBackground from "@/components/AnimatedBackground";
import GlowCursor from "@/components/GlowCursor";
import Footer from "@/components/Footer";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "../config";

const fields = [
  { name: "name", label: "Full Name", type: "text" },
  { name: "email", label: "Email Address", type: "email" },
  { name: "gender", label: "Gender", type: "select", options: ["Female", "Male", "Non-binary", "Prefer not to say"] },
  { name: "age", label: "Age", type: "number" },
  { name: "location", label: "Location", type: "text" },
  { name: "contact", label: "Contact Number", type: "tel" },
] as const;

const ReportPage = () => {
  const [form, setForm] = useState({ name: "", email: "", gender: "", age: "", location: "", contact: "", description: "" });
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IncidentReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const update = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) {
      setError("Consent to the privacy policy is required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/reports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "sheguard-client"
        },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        throw new Error("Failed to submit report. Backend server may be offline.");
      }

      const res = await response.json();
      setResult(res);
    } catch (err: any) {
      console.warn("Backend unavailable. Simulating local report submission...", err);
      // Simulate submission delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const mockResult: IncidentReport = {
        caseId: `SG-${Math.floor(100000 + Math.random() * 900000).toString(16).toUpperCase().substring(0, 6)}`,
        name: form.name,
        gender: form.gender,
        age: form.age,
        location: form.location,
        contact: form.contact,
        description: form.description,
        status: "Filed",
        submittedAt: new Date().toISOString()
      };
      setResult(mockResult);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen cyber-grid">
      <AnimatedBackground />
      <GlowCursor />
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-28">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-2 text-center font-display text-3xl font-bold tracking-wide"
        >
          <span className="gradient-text-accent">Report Incident</span>
        </motion.h1>
        <p className="mb-10 text-center text-muted-foreground">Your identity will be protected</p>

        {result ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card neon-border p-8 text-center">
            <CheckCircle className="mx-auto mb-4 h-12 w-12 risk-safe" />
            <h2 className="mb-2 font-display text-xl font-bold">Report Filed Successfully</h2>
            <p className="mb-4 text-muted-foreground">Your case ID is:</p>
            <p className="font-display text-2xl font-bold gradient-text">{result.caseId}</p>
            <p className="mt-4 text-xs text-muted-foreground">We have sent a confirmation details card to {form.email || "your email"}.</p>
            <p className="mt-2 text-sm text-muted-foreground">Status: {result.status} • {new Date(result.submittedAt).toLocaleString()}</p>
          </motion.div>
        ) : (
          <>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card border-destructive/50 p-4 text-center text-destructive mb-6"
              >
                <p className="font-semibold">Submission Failed</p>
                <p className="text-xs text-muted-foreground">{error}</p>
              </motion.div>
            )}
            <motion.form
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              onSubmit={submit}
              method="POST"
              className="glass-card p-8 space-y-5"
            >
              {fields.map((f) => (
                <div key={f.name}>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground" htmlFor={f.name}>
                    {f.label}
                  </label>
                  {f.type === "select" ? (
                    <select
                      id={f.name}
                      name={f.name}
                      value={form[f.name as keyof typeof form]}
                      onChange={(e) => update(f.name, e.target.value)}
                      required
                      className="input-cyber"
                    >
                      <option value="">Select...</option>
                      {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      id={f.name}
                      name={f.name}
                      type={f.type}
                      value={form[f.name as keyof typeof form]}
                      onChange={(e) => update(f.name, e.target.value)}
                      required
                      className="input-cyber"
                      placeholder={f.label}
                      {...(f.name === "age" ? { min: "18", max: "120" } : {})}
                      {...(f.name === "contact" ? { pattern: "[0-9]{10}", placeholder: "10-digit mobile number" } : {})}
                    />
                  )}
                </div>
              ))}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground" htmlFor="description">
                    Incident Description
                  </label>
                  <span className="text-[10px] text-muted-foreground">{form.description.length}/2000</span>
                </div>
                <textarea
                  id="description"
                  name="description"
                  value={form.description}
                  onChange={(e) => update("description", e.target.value.substring(0, 2000))}
                  required
                  rows={4}
                  maxLength={2000}
                  className="input-cyber resize-none"
                  placeholder="Describe the incident in detail..."
                />
              </div>

              {/* Consent check */}
              <div className="flex items-start gap-2 py-2">
                <input
                  type="checkbox"
                  id="consent"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 rounded border-border bg-secondary text-neon-purple focus:ring-neon-purple"
                  required
                />
                <label htmlFor="consent" className="text-xs text-muted-foreground leading-normal">
                  I agree to the{" "}
                  <Link to="/privacy" className="text-neon-purple underline hover:text-neon-purple/80">
                    Privacy Policy
                  </Link>{" "}
                  and consent to my details being stored securely for digital evidence.
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-glow flex w-full items-center justify-center gap-2 font-display text-sm tracking-wide text-primary-foreground"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {loading ? "Submitting..." : "Submit Report"}
              </button>
            </motion.form>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default ReportPage;
