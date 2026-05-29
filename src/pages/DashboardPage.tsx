import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Activity, FileText, AlertTriangle, CheckCircle, Clock, Loader2, Search, ArrowUpDown, Lock, ShieldCheck } from "lucide-react";
import Navbar from "@/components/Navbar";
import AnimatedBackground from "@/components/AnimatedBackground";
import GlowCursor from "@/components/GlowCursor";
import Footer from "@/components/Footer";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as ChartTooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";

interface CaseData {
  caseId: string;
  imageStatus: "Safe" | "Suspicious" | "Manipulated";
  confidenceScore: number;
  forensicScore: number;
  timestamp: string;
  riskLevel: "green" | "yellow" | "red";
}

const PIN_CODE = "1930";

const DashboardPage = () => {
  const [cases, setCases] = useState<CaseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Authentication states
  const [pin, setPin] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinError, setPinError] = useState(false);

  // Search, Filter, Sort states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortField, setSortField] = useState<keyof CaseData>("timestamp");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Check session authorization on mount
  useEffect(() => {
    const auth = sessionStorage.getItem("sheguard_auth");
    if (auth === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === PIN_CODE) {
      sessionStorage.setItem("sheguard_auth", "true");
      setIsAuthenticated(true);
      setPinError(false);
    } else {
      setPinError(true);
      setPin("");
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    
    const fetchCases = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/api/cases`);
        if (!response.ok) {
          throw new Error("Failed to fetch cases from database");
        }
        const data = await response.json();
        
        // Merge with local storage cases to ensure recent uploads are visible
        const cached = localStorage.getItem("sheguard_cases");
        const localCases: CaseData[] = cached ? JSON.parse(cached) : [];
        
        const merged = [...localCases, ...data].reduce((acc: CaseData[], cur) => {
          if (!acc.some(item => item.caseId === cur.caseId)) {
            acc.push(cur);
          }
          return acc;
        }, []);
        
        setCases(merged);
        setError(null);
      } catch (err: any) {
        console.warn("Backend connection offline. Pulling cached local session results...", err);
        setError("Backend offline. Displaying cached local session results.");
        
        // Fallback to localStorage cases, seed with fresh mock date cases if empty
        const cached = localStorage.getItem("sheguard_cases");
        let localCases: CaseData[] = cached ? JSON.parse(cached) : [];
        if (localCases.length === 0) {
          const now = Date.now();
          localCases = [
            { caseId: "SG-862D19", imageStatus: "Manipulated", confidenceScore: 94.2, forensicScore: 84.5, timestamp: new Date(now - 2 * 3600 * 1000).toISOString(), riskLevel: "red" },
            { caseId: "SG-334A29", imageStatus: "Safe", confidenceScore: 98.1, forensicScore: 8.5, timestamp: new Date(now - 12 * 3600 * 1000).toISOString(), riskLevel: "green" },
            { caseId: "SG-452F90", imageStatus: "Suspicious", confidenceScore: 76.5, forensicScore: 36.2, timestamp: new Date(now - 28 * 3600 * 1000).toISOString(), riskLevel: "yellow" },
            { caseId: "SG-901B11", imageStatus: "Safe", confidenceScore: 99.0, forensicScore: 4.2, timestamp: new Date(now - 48 * 3600 * 1000).toISOString(), riskLevel: "green" },
            { caseId: "SG-188A21", imageStatus: "Manipulated", confidenceScore: 92.0, forensicScore: 78.9, timestamp: new Date(now - 72 * 3600 * 1000).toISOString(), riskLevel: "red" },
          ];
          localStorage.setItem("sheguard_cases", JSON.stringify(localCases));
        }
        setCases(localCases);
      } finally {
        setLoading(false);
      }
    };
    fetchCases();
  }, [isAuthenticated]);

  // Compute stat card figures dynamically
  const totalCases = cases.length;
  const threatsDetected = cases.filter(c => c.riskLevel === "red" || c.imageStatus === "Manipulated").length;
  const safeImages = cases.filter(c => c.riskLevel === "green" || c.imageStatus === "Safe").length;
  const pendingCases = cases.filter(c => c.riskLevel === "yellow" || c.imageStatus === "Suspicious").length;

  const stats = [
    { label: "Total Cases", value: String(totalCases), icon: FileText },
    { label: "Threats Detected", value: String(threatsDetected), icon: AlertTriangle },
    { label: "Safe Images", value: String(safeImages), icon: CheckCircle },
    { label: "Pending Investigation", value: String(pendingCases), icon: Clock },
  ];

  // Sorting and Filtering logic
  const handleSort = (field: keyof CaseData) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const processedCases = useMemo(() => {
    let result = [...cases];

    // Filter by search query
    if (searchQuery.trim()) {
      result = result.filter(c => c.caseId.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    // Filter by status select
    if (statusFilter !== "All") {
      result = result.filter(c => c.imageStatus === statusFilter);
    }

    // Sort items
    result.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === "string") {
        return sortOrder === "asc"
          ? (aVal as string).localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal as string);
      } else {
        return sortOrder === "asc"
          ? (aVal as number) - (bVal as number)
          : (bVal as number) - (aVal as number);
      }
    });

    return result;
  }, [cases, searchQuery, statusFilter, sortField, sortOrder]);

  // Chart Data preparation
  const pieData = useMemo(() => {
    return [
      { name: "Safe", value: safeImages, color: "#10b981" },
      { name: "Suspicious", value: pendingCases, color: "#f59e0b" },
      { name: "Manipulated", value: threatsDetected, color: "#ef4444" },
    ].filter(d => d.value > 0);
  }, [safeImages, pendingCases, threatsDetected]);

  const areaData = useMemo(() => {
    // Generate simple sorted chronologically daily trends
    const dayMap: Record<string, number> = {};
    [...cases].reverse().forEach(c => {
      const dateStr = new Date(c.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      dayMap[dateStr] = (dayMap[dateStr] || 0) + 1;
    });

    return Object.entries(dayMap).map(([date, count]) => ({
      date,
      count
    }));
  }, [cases]);

  const riskTextClass = (r: string) => r === "green" ? "risk-safe" : r === "yellow" ? "risk-suspicious" : "risk-manipulated";

  if (!isAuthenticated) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-black cyber-grid">
        <AnimatedBackground />
        <GlowCursor />
        <Navbar />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card neon-border max-w-md w-full mx-4 p-8 relative z-10 text-center"
        >
          <Lock className="mx-auto mb-4 h-12 w-12 text-neon-purple animate-pulse" />
          <h1 className="font-display text-lg font-bold uppercase tracking-wider mb-2">Access Portal Locked</h1>
          <p className="text-xs text-muted-foreground mb-6">
            Authorized personnel only. Please verify your officer credentials.
          </p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter Access PIN (Try 1930)"
                className="input-cyber text-center tracking-widest text-lg font-mono"
              />
              {pinError && (
                <p className="text-xs text-destructive mt-1.5 font-semibold">Invalid PIN. Try "1930" (Cyber Cell Hotline).</p>
              )}
            </div>
            <button
              type="submit"
              className="btn-glow flex w-full items-center justify-center gap-2 font-display text-xs tracking-wider uppercase text-primary-foreground"
            >
              <ShieldCheck className="h-4 w-4" />
              Verify Access
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen cyber-grid">
      <AnimatedBackground />
      <GlowCursor />
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-28">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-2 font-display text-3xl font-bold tracking-wide"
        >
          <span className="gradient-text">Dashboard</span>
        </motion.h1>
        <p className="mb-8 text-muted-foreground">AI Cyber Forensic Database Control</p>

        {error && (
          <div className="mb-6 rounded border border-yellow-500/30 bg-yellow-500/10 p-3 text-center text-xs text-yellow-400">
            {error}
          </div>
        )}

        {/* Stats Grid */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i }}
              className="glass-card-hover p-5"
            >
              <div className="mb-2 flex items-center gap-2">
                <s.icon className="h-4 w-4 text-neon-purple" />
                <span className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</span>
              </div>
              <p className="font-display text-3xl font-bold">{s.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Charts Section */}
        {totalCases > 0 && (
          <div className="mb-8 grid gap-6 md:grid-cols-2">
            {/* Area Chart: Case Trend */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-card p-5 h-[280px]"
            >
              <h3 className="mb-4 font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">Case Volume Timeline</h3>
              <div className="w-full h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={areaData}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#262035" />
                    <XAxis dataKey="date" stroke="#6b7280" fontSize={10} />
                    <YAxis stroke="#6b7280" fontSize={10} allowDecimals={false} />
                    <ChartTooltip 
                      contentStyle={{ background: "#0b0813", borderColor: "#3b2c5c", borderRadius: "8px" }}
                      labelStyle={{ color: "#a855f7" }}
                    />
                    <Area type="monotone" dataKey="count" stroke="#a855f7" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Pie Chart: Status Distribution */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-card p-5 h-[280px]"
            >
              <h3 className="mb-4 font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">Threat Breakdown</h3>
              <div className="flex h-[200px] items-center justify-center">
                <div className="w-[50%] h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartTooltip 
                        contentStyle={{ background: "#0b0813", borderColor: "#3b2c5c", borderRadius: "8px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-[50%] space-y-2 text-xs">
                  {pieData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-muted-foreground">{d.name} ({Math.round(d.value / totalCases * 100)}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Controls: Search and Filter */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search Case ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-cyber pl-10 py-2.5 text-sm"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-cyber py-2.5 px-4 text-sm w-44"
            >
              <option value="All">All Statuses</option>
              <option value="Safe">Safe</option>
              <option value="Suspicious">Suspicious</option>
              <option value="Manipulated">Manipulated</option>
            </select>
          </div>
        </div>

        {/* Cases Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card overflow-hidden"
        >
          <div className="border-b border-border p-5">
            <div className="flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-neon-blue" />
                <h2 className="font-display text-sm font-semibold tracking-wide">Recent Case Logs</h2>
              </div>
              {loading && <Loader2 className="h-4 w-4 animate-spin text-neon-blue" />}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground select-none">
                  <th className="p-4 cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort("caseId")}>
                    <span className="flex items-center gap-1.5">
                      Case ID <ArrowUpDown className="h-3.5 w-3.5" />
                    </span>
                  </th>
                  <th className="p-4 cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort("imageStatus")}>
                    <span className="flex items-center gap-1.5">
                      Status <ArrowUpDown className="h-3.5 w-3.5" />
                    </span>
                  </th>
                  <th className="p-4 cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort("confidenceScore")}>
                    <span className="flex items-center gap-1.5">
                      Confidence <ArrowUpDown className="h-3.5 w-3.5" />
                    </span>
                  </th>
                  <th className="p-4 cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort("timestamp")}>
                    <span className="flex items-center gap-1.5">
                      Date <ArrowUpDown className="h-3.5 w-3.5" />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {processedCases.length > 0 ? (
                  processedCases.map((c) => (
                    <tr 
                      key={c.caseId} 
                      onClick={() => navigate(`/evidence-report?caseId=${c.caseId}&status=${c.imageStatus}&confidence=${c.confidenceScore}&forensic=${c.forensicScore}&risk=${c.riskLevel}`)}
                      className="border-b border-border/50 transition-colors hover:bg-secondary/30 cursor-pointer"
                    >
                      <td className="p-4 font-display text-sm font-semibold text-neon-blue">{c.caseId}</td>
                      <td className={`p-4 text-sm font-semibold ${riskTextClass(c.riskLevel)}`}>{c.imageStatus}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 rounded-full bg-secondary">
                            <div
                              className={`h-full rounded-full ${c.riskLevel === "green" ? "progress-safe" : c.riskLevel === "yellow" ? "progress-suspicious" : "progress-manipulated"}`}
                              style={{ width: `${c.confidenceScore}%` }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground">{c.confidenceScore}%</span>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">{new Date(c.timestamp).toLocaleDateString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-sm text-muted-foreground">
                      No matching cases found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
};

export default DashboardPage;
