import React, { useState } from "react";
import { ConnectionInfo } from "../App";

interface Props {
  onTestConnection: (baseUrl: string, username: string, password: string) => Promise<{ success: boolean; serverTitle?: string; version?: string; error?: string }>;
  onRunAudit: () => void;
  connection: ConnectionInfo | null;
}

export default function ConnectForm({ onTestConnection, onRunAudit, connection }: Props) {
  const [baseUrl, setBaseUrl] = useState(connection?.baseUrl || "");
  const [username, setUsername] = useState(connection?.username || "");
  const [password, setPassword] = useState(connection?.password || "");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTest = async () => {
    if (!baseUrl || !username || !password) {
      setTestResult({ success: false, message: "Please fill in all fields." });
      return;
    }
    setTesting(true);
    setTestResult(null);
    const result = await onTestConnection(baseUrl.trim(), username.trim(), password);
    setTesting(false);
    if (result.success) {
      setTestResult({ success: true, message: `Connected to "${result.serverTitle}" (Jira ${result.version})` });
    } else {
      setTestResult({ success: false, message: result.error || "Connection failed." });
    }
  };

  const isConnected = connection && testResult?.success;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.logo}>
            <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="8" fill="#0052cc" />
              <path d="M20 8L8 20l4 4 8-8 8 8 4-4L20 8z" fill="white" opacity="0.9" />
              <path d="M20 18L12 26h16L20 18z" fill="white" />
            </svg>
            <span style={styles.logoText}>Jira Migration Audit</span>
          </div>
          <p style={styles.headerSub}>Analyse your Jira DC/Server instance for Cloud migration readiness</p>
        </div>
      </div>

      <div style={styles.content}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Connect to Jira DC/Server</h2>
          <p style={styles.cardDesc}>Enter your Jira Data Center or Server instance details. Credentials are only used to call your instance's REST API and are never stored.</p>

          <div style={styles.field}>
            <label style={styles.label}>Jira Base URL</label>
            <input
              style={styles.input}
              type="url"
              placeholder="https://jira.yourcompany.com"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
            />
            <span style={styles.hint}>The root URL of your Jira instance</span>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Username or Email</label>
            <input
              style={styles.input}
              type="text"
              placeholder="admin or admin@yourcompany.com"
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password or Personal Access Token</label>
            <input
              style={styles.input}
              type="password"
              placeholder="Password or PAT"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <span style={styles.hint}>Use a PAT for better security. Requires Jira admin access for full audit.</span>
          </div>

          {testResult && (
            <div style={{ ...styles.alert, background: testResult.success ? "#e3fcef" : "#ffebe6", borderColor: testResult.success ? "#36b37e" : "#de350b" }}>
              <span style={{ color: testResult.success ? "#006644" : "#de350b", fontWeight: 600 }}>
                {testResult.success ? "✓ " : "✗ "}{testResult.message}
              </span>
            </div>
          )}

          <div style={styles.btnRow}>
            <button style={styles.secondaryBtn} onClick={handleTest} disabled={testing}>
              {testing ? "Testing…" : "Test Connection"}
            </button>
            <button
              style={{ ...styles.primaryBtn, opacity: isConnected ? 1 : 0.5, cursor: isConnected ? "pointer" : "not-allowed" }}
              onClick={isConnected ? onRunAudit : undefined}
              disabled={!isConnected}
            >
              Run Full Audit →
            </button>
          </div>
        </div>

        <div style={styles.infoGrid}>
          {[
            { icon: "🔍", title: "9 Audit Categories", desc: "System, Plugins, Custom Fields, Workflows, Projects, Users, Data Volume, Permissions, Automation" },
            { icon: "📊", title: "Readiness Score 0–100", desc: "Get an instant migration readiness score with colour-coded risk levels" },
            { icon: "🚨", title: "Blocker Detection", desc: "Identify migration blockers and warnings with specific remediation guidance" },
            { icon: "🔒", title: "Secure & Private", desc: "Credentials are used only for the API calls and never stored on any server" },
          ].map(item => (
            <div key={item.title} style={styles.infoCard}>
              <div style={styles.infoIcon}>{item.icon}</div>
              <div>
                <div style={styles.infoTitle}>{item.title}</div>
                <div style={styles.infoDesc}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#f4f5f7", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  header: { background: "#0052cc", color: "#fff", padding: "32px 24px" },
  headerInner: { maxWidth: 800, margin: "0 auto" },
  logo: { display: "flex", alignItems: "center", gap: 12, marginBottom: 8 },
  logoText: { fontSize: 22, fontWeight: 700, color: "#fff" },
  headerSub: { color: "#b3d4ff", fontSize: 15 },
  content: { maxWidth: 800, margin: "32px auto", padding: "0 24px" },
  card: { background: "#fff", borderRadius: 8, padding: 32, boxShadow: "0 1px 4px rgba(0,0,0,0.1)", marginBottom: 24 },
  cardTitle: { fontSize: 18, fontWeight: 700, color: "#172b4d", marginBottom: 8 },
  cardDesc: { color: "#6b778c", fontSize: 14, lineHeight: 1.6, marginBottom: 24 },
  field: { marginBottom: 20 },
  label: { display: "block", fontSize: 13, fontWeight: 600, color: "#172b4d", marginBottom: 6 },
  input: { width: "100%", padding: "10px 12px", border: "2px solid #dfe1e6", borderRadius: 4, fontSize: 14, color: "#172b4d", outline: "none", boxSizing: "border-box" },
  hint: { display: "block", fontSize: 12, color: "#6b778c", marginTop: 4 },
  alert: { border: "1px solid", borderRadius: 4, padding: "12px 16px", marginBottom: 20, fontSize: 14 },
  btnRow: { display: "flex", gap: 12, justifyContent: "flex-end" },
  secondaryBtn: { background: "#fff", color: "#0052cc", border: "2px solid #0052cc", borderRadius: 4, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  primaryBtn: { background: "#0052cc", color: "#fff", border: "none", borderRadius: 4, padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  infoGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  infoCard: { background: "#fff", borderRadius: 8, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", display: "flex", gap: 16, alignItems: "flex-start" },
  infoIcon: { fontSize: 28, flexShrink: 0 },
  infoTitle: { fontSize: 14, fontWeight: 700, color: "#172b4d", marginBottom: 4 },
  infoDesc: { fontSize: 13, color: "#6b778c", lineHeight: 1.5 },
};
