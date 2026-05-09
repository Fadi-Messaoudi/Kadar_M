import React, { useEffect, useState } from "react";

const STEPS = [
  "Checking system info…",
  "Scanning plugins & apps…",
  "Auditing custom fields…",
  "Reviewing workflows…",
  "Checking projects…",
  "Analysing users…",
  "Measuring data volume…",
  "Reviewing permissions…",
  "Checking automation rules…",
  "Calculating readiness score…",
];

export default function LoadingScreen({ message }: { message: string }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex(i => {
        const next = Math.min(i + 1, STEPS.length - 1);
        setProgress(Math.round((next / (STEPS.length - 1)) * 95));
        return next;
      });
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="8" fill="#0052cc" />
            <path d="M20 8L8 20l4 4 8-8 8 8 4-4L20 8z" fill="white" opacity="0.9" />
            <path d="M20 18L12 26h16L20 18z" fill="white" />
          </svg>
        </div>
        <h2 style={styles.title}>Running Migration Audit</h2>
        <p style={styles.subtitle}>{message}</p>

        <div style={styles.progressBar}>
          <div style={{ ...styles.progressFill, width: `${progress}%` }} />
        </div>
        <p style={styles.percent}>{progress}%</p>

        <div style={styles.stepList}>
          {STEPS.map((step, i) => (
            <div key={step} style={{
              ...styles.step,
              color: i < stepIndex ? "#36b37e" : i === stepIndex ? "#0052cc" : "#6b778c",
              fontWeight: i === stepIndex ? 600 : 400,
            }}>
              <span style={styles.stepIcon}>
                {i < stepIndex ? "✓" : i === stepIndex ? "▶" : "○"}
              </span>
              {step}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f5f7" },
  card: { background: "#fff", borderRadius: 12, padding: "40px 48px", maxWidth: 480, width: "100%", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", textAlign: "center" },
  logo: { marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 700, color: "#172b4d", marginBottom: 8 },
  subtitle: { color: "#6b778c", fontSize: 14, marginBottom: 28 },
  progressBar: { background: "#ebecf0", borderRadius: 4, height: 8, overflow: "hidden", marginBottom: 8 },
  progressFill: { height: "100%", background: "#0052cc", borderRadius: 4, transition: "width 0.5s ease" },
  percent: { color: "#0052cc", fontWeight: 700, fontSize: 14, marginBottom: 24 },
  stepList: { textAlign: "left" },
  step: { display: "flex", alignItems: "center", gap: 10, padding: "4px 0", fontSize: 13, transition: "all 0.3s" },
  stepIcon: { width: 16, textAlign: "center", fontSize: 12 },
};
