import React, { useState } from "react";
import { AuditResult, ConnectionInfo, Finding } from "../App";

interface Props {
  result: AuditResult;
  connection: ConnectionInfo;
  onReset: () => void;
}

const SEVERITY_COLOR: Record<string, string> = {
  blocker: "#de350b",
  warning: "#ff8b00",
  info: "#0052cc",
};

const SEVERITY_BG: Record<string, string> = {
  blocker: "#ffebe6",
  warning: "#fffae6",
  info: "#deebff",
};

const SEVERITY_LABEL: Record<string, string> = {
  blocker: "BLOCKER",
  warning: "WARNING",
  info: "INFO",
};

const READINESS_COLOR: Record<string, string> = {
  ready: "#36b37e",
  "needs-attention": "#ff8b00",
  "at-risk": "#de350b",
  "not-ready": "#bf2600",
};

const READINESS_LABEL: Record<string, string> = {
  ready: "Ready for Migration",
  "needs-attention": "Needs Attention",
  "at-risk": "At Risk",
  "not-ready": "Not Ready",
};

const CATEGORIES = ["System Info", "Plugins", "Custom Fields", "Workflows", "Projects", "Users", "Data Volume", "Permissions", "Automation"];

export default function AuditResults({ result, connection, onReset }: Props) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "findings" | "categories">("overview");

  const filteredFindings = activeCategory
    ? result.findings.filter(f => f.category === activeCategory)
    : result.findings;

  const readinessColor = READINESS_COLOR[result.readinessLevel];

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.headerTop}>
            <div style={styles.logo}>
              <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
                <rect width="40" height="40" rx="8" fill="white" fillOpacity="0.2" />
                <path d="M20 8L8 20l4 4 8-8 8 8 4-4L20 8z" fill="white" opacity="0.9" />
                <path d="M20 18L12 26h16L20 18z" fill="white" />
              </svg>
              <span style={styles.logoText}>Jira Migration Audit</span>
            </div>
            <button style={styles.newAuditBtn} onClick={onReset}>+ New Audit</button>
          </div>
          <p style={{ color: "#b3d4ff", fontSize: 13, marginTop: 4 }}>
            {connection.serverTitle} · {connection.baseUrl}
          </p>
        </div>
      </div>

      <div style={styles.scoreBar}>
        <div style={styles.scoreBarInner}>
          <div style={styles.scoreBox}>
            <div style={{ ...styles.scoreBig, color: readinessColor }}>{result.overallScore}</div>
            <div style={styles.scoreLabel}>out of 100</div>
          </div>
          <div style={styles.scoreInfo}>
            <div style={{ ...styles.readinessBadge, background: readinessColor + "22", color: readinessColor }}>
              {READINESS_LABEL[result.readinessLevel]}
            </div>
            <div style={styles.statsRow}>
              <div style={styles.stat}>
                <span style={{ ...styles.statNum, color: "#de350b" }}>{result.blockers}</span>
                <span style={styles.statLbl}>Blockers</span>
              </div>
              <div style={styles.stat}>
                <span style={{ ...styles.statNum, color: "#ff8b00" }}>{result.warnings}</span>
                <span style={styles.statLbl}>Warnings</span>
              </div>
              <div style={styles.stat}>
                <span style={{ ...styles.statNum, color: "#0052cc" }}>{result.findings.filter(f => f.severity === "info").length}</span>
                <span style={styles.statLbl}>Info</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={styles.content}>
        <div style={styles.tabs}>
          {(["overview", "findings", "categories"] as const).map(tab => (
            <button
              key={tab}
              style={{ ...styles.tab, ...(activeTab === tab ? styles.tabActive : {}) }}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "overview" ? "Overview" : tab === "findings" ? `Findings (${result.findings.length})` : "By Category"}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <div>
            <div style={styles.categoryGrid}>
              {CATEGORIES.map(cat => {
                const score = result.categoryScores[cat] ?? 0;
                const color = score >= 80 ? "#36b37e" : score >= 60 ? "#ff8b00" : "#de350b";
                const catFindings = result.findings.filter(f => f.category === cat);
                const catBlockers = catFindings.filter(f => f.severity === "blocker").length;
                return (
                  <div key={cat} style={styles.catCard} onClick={() => { setActiveCategory(cat); setActiveTab("findings"); }}>
                    <div style={styles.catHeader}>
                      <span style={styles.catName}>{cat}</span>
                      <span style={{ ...styles.catScore, color }}>{score}</span>
                    </div>
                    <div style={styles.catBar}>
                      <div style={{ ...styles.catBarFill, width: `${score}%`, background: color }} />
                    </div>
                    {catBlockers > 0 && (
                      <div style={styles.catBlocker}>{catBlockers} blocker{catBlockers > 1 ? "s" : ""}</div>
                    )}
                  </div>
                );
              })}
            </div>

            {result.readinessLevel !== "ready" && (
              <div style={styles.recommendCard}>
                <h3 style={styles.recommendTitle}>Recommended Next Steps</h3>
                <ol style={styles.recommendList}>
                  {result.blockers > 0 && <li>Resolve all {result.blockers} blocker{result.blockers > 1 ? "s" : ""} before proceeding with migration planning</li>}
                  {result.warnings > 0 && <li>Review and address {result.warnings} warning{result.warnings > 1 ? "s" : ""} to reduce migration risk</li>}
                  <li>Use the <a href="https://www.atlassian.com/migration/assess/journey-to-cloud" target="_blank" style={{ color: "#0052cc" }}>Atlassian Cloud Migration Guide</a> for detailed migration steps</li>
                  <li>Run the <a href="https://marketplace.atlassian.com/apps/1222995" target="_blank" style={{ color: "#0052cc" }}>Jira Cloud Migration Assistant</a> for automated migration</li>
                </ol>
              </div>
            )}
          </div>
        )}

        {activeTab === "findings" && (
          <div>
            <div style={styles.filterRow}>
              <button style={{ ...styles.filterBtn, ...(activeCategory === null ? styles.filterBtnActive : {}) }} onClick={() => setActiveCategory(null)}>
                All ({result.findings.length})
              </button>
              {CATEGORIES.filter(c => result.findings.some(f => f.category === c)).map(cat => (
                <button
                  key={cat}
                  style={{ ...styles.filterBtn, ...(activeCategory === cat ? styles.filterBtnActive : {}) }}
                  onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            {(["blocker", "warning", "info"] as const).map(severity => {
              const sevFindings = filteredFindings.filter(f => f.severity === severity);
              if (sevFindings.length === 0) return null;
              return (
                <div key={severity} style={{ marginBottom: 24 }}>
                  <h3 style={{ ...styles.sevHeader, color: SEVERITY_COLOR[severity] }}>
                    {SEVERITY_LABEL[severity]}S ({sevFindings.length})
                  </h3>
                  {sevFindings.map((f, i) => (
                    <FindingCard key={i} finding={f} />
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "categories" && (
          <div>
            {CATEGORIES.map(cat => {
              const score = result.categoryScores[cat] ?? 0;
              const color = score >= 80 ? "#36b37e" : score >= 60 ? "#ff8b00" : "#de350b";
              const catFindings = result.findings.filter(f => f.category === cat);
              return (
                <div key={cat} style={styles.catDetailCard}>
                  <div style={styles.catDetailHeader}>
                    <h3 style={styles.catDetailName}>{cat}</h3>
                    <div style={{ ...styles.catDetailScore, color, background: color + "18" }}>{score}/100</div>
                  </div>
                  <div style={styles.catBar}>
                    <div style={{ ...styles.catBarFill, width: `${score}%`, background: color }} />
                  </div>
                  <div style={{ marginTop: 16 }}>
                    {catFindings.map((f, i) => <FindingCard key={i} finding={f} compact />)}
                    {catFindings.length === 0 && <p style={{ color: "#6b778c", fontSize: 13 }}>No findings for this category.</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FindingCard({ finding, compact }: { finding: Finding; compact?: boolean }) {
  const [expanded, setExpanded] = useState(!compact);
  return (
    <div style={{ ...styles.findingCard, borderLeftColor: SEVERITY_COLOR[finding.severity] }}>
      <div style={styles.findingHeader} onClick={() => compact && setExpanded(e => !e)}>
        <span style={{ ...styles.sevBadge, background: SEVERITY_BG[finding.severity], color: SEVERITY_COLOR[finding.severity] }}>
          {SEVERITY_LABEL[finding.severity]}
        </span>
        <span style={styles.findingTitle}>{finding.title}</span>
        {compact && <span style={{ marginLeft: "auto", color: "#6b778c", fontSize: 12 }}>{expanded ? "▲" : "▼"}</span>}
      </div>
      {expanded && (
        <div style={styles.findingBody}>
          {finding.description && <p style={styles.findingDesc}>{finding.description}</p>}
          {finding.migrationNote && (
            <div style={styles.migrationNote}>
              <strong>Migration note: </strong>{finding.migrationNote}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#f4f5f7", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  header: { background: "#0052cc", padding: "20px 24px" },
  headerInner: { maxWidth: 1000, margin: "0 auto" },
  headerTop: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  logo: { display: "flex", alignItems: "center", gap: 10 },
  logoText: { fontSize: 18, fontWeight: 700, color: "#fff" },
  newAuditBtn: { background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.4)", borderRadius: 4, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  scoreBar: { background: "#fff", borderBottom: "1px solid #dfe1e6", padding: "20px 24px" },
  scoreBarInner: { maxWidth: 1000, margin: "0 auto", display: "flex", alignItems: "center", gap: 32 },
  scoreBox: { textAlign: "center" },
  scoreBig: { fontSize: 64, fontWeight: 800, lineHeight: 1 },
  scoreLabel: { fontSize: 12, color: "#6b778c", marginTop: 2 },
  scoreInfo: { flex: 1 },
  readinessBadge: { display: "inline-block", padding: "4px 12px", borderRadius: 12, fontSize: 13, fontWeight: 700, marginBottom: 12 },
  statsRow: { display: "flex", gap: 24 },
  stat: { display: "flex", flexDirection: "column", alignItems: "center" },
  statNum: { fontSize: 28, fontWeight: 800, lineHeight: 1 },
  statLbl: { fontSize: 12, color: "#6b778c" },
  content: { maxWidth: 1000, margin: "24px auto", padding: "0 24px" },
  tabs: { display: "flex", borderBottom: "2px solid #dfe1e6", marginBottom: 24 },
  tab: { background: "none", border: "none", borderBottom: "3px solid transparent", padding: "10px 20px", fontSize: 14, fontWeight: 600, color: "#6b778c", cursor: "pointer", marginBottom: -2 },
  tabActive: { color: "#0052cc", borderBottomColor: "#0052cc" },
  categoryGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 },
  catCard: { background: "#fff", borderRadius: 8, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", cursor: "pointer" },
  catHeader: { display: "flex", justifyContent: "space-between", marginBottom: 8 },
  catName: { fontSize: 13, fontWeight: 600, color: "#172b4d" },
  catScore: { fontSize: 20, fontWeight: 800 },
  catBar: { background: "#ebecf0", borderRadius: 4, height: 6, overflow: "hidden" },
  catBarFill: { height: "100%", borderRadius: 4, transition: "width 0.5s" },
  catBlocker: { marginTop: 6, fontSize: 11, color: "#de350b", fontWeight: 600 },
  recommendCard: { background: "#fff", borderRadius: 8, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" },
  recommendTitle: { fontSize: 16, fontWeight: 700, color: "#172b4d", marginBottom: 12 },
  recommendList: { paddingLeft: 20, color: "#172b4d", fontSize: 14, lineHeight: 2 },
  filterRow: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  filterBtn: { background: "#fff", border: "1px solid #dfe1e6", borderRadius: 20, padding: "5px 14px", fontSize: 12, fontWeight: 600, color: "#6b778c", cursor: "pointer" },
  filterBtnActive: { background: "#0052cc", color: "#fff", borderColor: "#0052cc" },
  sevHeader: { fontSize: 13, fontWeight: 700, marginBottom: 10, letterSpacing: 0.5 },
  findingCard: { background: "#fff", borderLeft: "4px solid", borderRadius: "0 6px 6px 0", padding: "14px 16px", marginBottom: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.07)" },
  findingHeader: { display: "flex", alignItems: "center", gap: 10, cursor: "pointer" },
  sevBadge: { fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 10, letterSpacing: 0.5, flexShrink: 0 },
  findingTitle: { fontSize: 14, fontWeight: 600, color: "#172b4d" },
  findingBody: { marginTop: 10, paddingTop: 10, borderTop: "1px solid #f0f0f0" },
  findingDesc: { fontSize: 13, color: "#6b778c", lineHeight: 1.6, marginBottom: 8 },
  migrationNote: { fontSize: 13, color: "#172b4d", background: "#f4f5f7", padding: "10px 14px", borderRadius: 4, lineHeight: 1.6 },
  catDetailCard: { background: "#fff", borderRadius: 8, padding: 24, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" },
  catDetailHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  catDetailName: { fontSize: 16, fontWeight: 700, color: "#172b4d" },
  catDetailScore: { fontSize: 16, fontWeight: 800, padding: "4px 12px", borderRadius: 6 },
};
