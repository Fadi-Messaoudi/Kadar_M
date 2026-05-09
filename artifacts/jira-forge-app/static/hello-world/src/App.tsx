import React, { useState } from "react";
import invoke from "@forge/bridge";
import ConnectForm from "./components/ConnectForm";
import AuditResults from "./components/AuditResults";
import LoadingScreen from "./components/LoadingScreen";

export type AppState = "connect" | "testing" | "auditing" | "results" | "error";

export interface ConnectionInfo {
  baseUrl: string;
  username: string;
  password: string;
  serverTitle?: string;
  version?: string;
  deploymentType?: string;
}

export interface Finding {
  category: string;
  severity: "blocker" | "warning" | "info";
  title: string;
  description: string;
  migrationNote: string;
}

export interface AuditResult {
  overallScore: number;
  readinessLevel: "ready" | "needs-attention" | "at-risk" | "not-ready";
  blockers: number;
  warnings: number;
  findings: Finding[];
  categoryScores: Record<string, number>;
}

export default function App() {
  const [state, setState] = useState<AppState>("connect");
  const [connection, setConnection] = useState<ConnectionInfo | null>(null);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string>("");
  const [loadingMessage, setLoadingMessage] = useState("");

  const handleTestConnection = async (baseUrl: string, username: string, password: string) => {
    setState("testing");
    setLoadingMessage("Testing connection to your Jira instance…");
    try {
      const result = await invoke("testConnection", { baseUrl, username, password }) as any;
      if (result.success) {
        setConnection({ baseUrl, username, password, serverTitle: result.serverTitle, version: result.version, deploymentType: result.deploymentType });
        setState("connect");
        return { success: true, serverTitle: result.serverTitle, version: result.version };
      } else {
        setState("connect");
        return { success: false, error: result.error };
      }
    } catch (e: any) {
      setState("connect");
      return { success: false, error: e.message };
    }
  };

  const handleRunAudit = async () => {
    if (!connection) return;
    setState("auditing");
    setLoadingMessage("Running full migration audit across 9 categories…");
    try {
      const result = await invoke("runAudit", {
        baseUrl: connection.baseUrl,
        username: connection.username,
        password: connection.password,
      }) as any;
      if (result.success) {
        setAuditResult(result);
        setState("results");
      } else {
        setError(result.error || "Audit failed");
        setState("error");
      }
    } catch (e: any) {
      setError(e.message);
      setState("error");
    }
  };

  const handleReset = () => {
    setState("connect");
    setConnection(null);
    setAuditResult(null);
    setError("");
  };

  if (state === "testing" || state === "auditing") {
    return <LoadingScreen message={loadingMessage} />;
  }

  if (state === "error") {
    return (
      <div style={styles.errorContainer}>
        <div style={styles.errorCard}>
          <div style={styles.errorIcon}>✗</div>
          <h2 style={styles.errorTitle}>Audit Failed</h2>
          <p style={styles.errorMessage}>{error}</p>
          <button style={styles.primaryBtn} onClick={handleReset}>Try Again</button>
        </div>
      </div>
    );
  }

  if (state === "results" && auditResult) {
    return (
      <AuditResults
        result={auditResult}
        connection={connection!}
        onReset={handleReset}
      />
    );
  }

  return (
    <ConnectForm
      onTestConnection={handleTestConnection}
      onRunAudit={handleRunAudit}
      connection={connection}
    />
  );
}

const styles: Record<string, React.CSSProperties> = {
  errorContainer: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f5f7" },
  errorCard: { background: "#fff", borderRadius: 8, padding: 40, textAlign: "center", maxWidth: 400, boxShadow: "0 2px 8px rgba(0,0,0,0.1)" },
  errorIcon: { fontSize: 48, color: "#de350b", marginBottom: 16 },
  errorTitle: { fontSize: 20, fontWeight: 700, marginBottom: 8, color: "#172b4d" },
  errorMessage: { color: "#6b778c", marginBottom: 24, lineHeight: 1.5 },
  primaryBtn: { background: "#0052cc", color: "#fff", border: "none", borderRadius: 4, padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
};
