import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface Finding {
  id: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  count?: number | null;
  migrationNote?: string | null;
}

interface Session {
  id: string;
  label?: string | null;
  jiraUrl: string;
  jiraVersion?: string | null;
  serverTitle?: string | null;
  deploymentType?: string | null;
  status: string;
  readinessScore?: number | null;
  blockerCount?: number | null;
  warningCount?: number | null;
  infoCount?: number | null;
  createdAt: string;
  completedAt?: string | null;
  findings?: Finding[];
}

interface Summary {
  readinessScore: number;
  readinessLevel: string;
  categoryBreakdown: Array<{
    category: string;
    blockers: number;
    warnings: number;
    infos: number;
    score: number;
  }>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function capitalize(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function exportPDF(session: Session, summary?: Summary) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;

  // ── Header ──────────────────────────────────────────────────────────────
  doc.setFillColor(0, 82, 204);
  doc.rect(0, 0, pageW, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Jira Cloud Migration Audit Report", margin, 12);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${formatDate(new Date().toISOString())}`, margin, 20);

  let y = 36;

  // ── Session Info ─────────────────────────────────────────────────────────
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(session.label || session.serverTitle || "Audit Report", margin, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`Jira URL: ${session.jiraUrl}`, margin, y); y += 5;
  if (session.jiraVersion) { doc.text(`Version: ${session.jiraVersion}  |  Type: ${capitalize(session.deploymentType || "")}`, margin, y); y += 5; }
  doc.text(`Audit Date: ${formatDate(session.createdAt)}`, margin, y); y += 5;

  // ── Score Banner ─────────────────────────────────────────────────────────
  if (summary) {
    y += 4;
    const scoreColor = {
      critical: [220, 38, 38],
      at_risk: [234, 88, 12],
      moderate: [202, 138, 4],
      good: [20, 184, 166],
      excellent: [22, 163, 74],
    }[summary.readinessLevel] ?? [100, 100, 100];

    doc.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2]);
    doc.roundedRect(margin, y, pageW - margin * 2, 22, 3, 3, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(`${summary.readinessScore}`, margin + 8, y + 15);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`/ 100   Migration Readiness: ${capitalize(summary.readinessLevel)}`, margin + 22, y + 10);

    doc.setFontSize(9);
    doc.text(
      `${session.blockerCount ?? 0} Blockers  •  ${session.warningCount ?? 0} Warnings  •  ${session.infoCount ?? 0} Info`,
      margin + 22, y + 17
    );
    y += 30;
  }

  // ── Category Breakdown ───────────────────────────────────────────────────
  if (summary?.categoryBreakdown?.length) {
    y += 4;
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Category Breakdown", margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Category", "Score", "Blockers", "Warnings", "Info"]],
      body: summary.categoryBreakdown.map((c) => [
        capitalize(c.category),
        `${c.score}%`,
        c.blockers,
        c.warnings,
        c.infos,
      ]),
      theme: "grid",
      headStyles: { fillColor: [0, 82, 204], textColor: 255, fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 8.5 },
      columnStyles: {
        1: { halign: "center" },
        2: { halign: "center", textColor: [220, 38, 38] },
        3: { halign: "center", textColor: [180, 80, 0] },
        4: { halign: "center", textColor: [37, 99, 235] },
      },
      margin: { left: margin, right: margin },
      didDrawPage: (data) => { y = data.cursor?.y ?? y; },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ── Findings ─────────────────────────────────────────────────────────────
  if (session.findings?.length) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("Audit Findings", margin, y);
    y += 4;

    const severityOrder: Record<string, number> = { blocker: 0, warning: 1, info: 2 };
    const sorted = [...session.findings].sort(
      (a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3)
    );

    autoTable(doc, {
      startY: y,
      head: [["Severity", "Category", "Title", "Description", "Action Required"]],
      body: sorted.map((f) => [
        f.severity.toUpperCase(),
        capitalize(f.category),
        f.title,
        f.description,
        f.migrationNote ?? "",
      ]),
      theme: "striped",
      headStyles: { fillColor: [0, 82, 204], textColor: 255, fontStyle: "bold", fontSize: 8.5 },
      bodyStyles: { fontSize: 7.5, valign: "top" },
      columnStyles: {
        0: {
          fontStyle: "bold",
          cellWidth: 18,
          halign: "center",
        },
        1: { cellWidth: 26 },
        2: { cellWidth: 40 },
        3: { cellWidth: 55 },
        4: { cellWidth: 40 },
      },
      didParseCell: (data) => {
        if (data.column.index === 0 && data.section === "body") {
          const val = String(data.cell.raw ?? "").toLowerCase();
          if (val === "blocker") data.cell.styles.textColor = [220, 38, 38];
          else if (val === "warning") data.cell.styles.textColor = [180, 80, 0];
          else data.cell.styles.textColor = [37, 99, 235];
        }
      },
      margin: { left: margin, right: margin },
    });
  }

  // ── Footer ───────────────────────────────────────────────────────────────
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Jira Migration Audit  •  Page ${i} of ${pageCount}`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" }
    );
  }

  const filename = `jira-audit-${(session.label || session.jiraUrl).replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

export function exportExcel(session: Session, summary?: Summary) {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Summary ─────────────────────────────────────────────────────
  const summaryRows: (string | number)[][] = [
    ["Jira Migration Audit Report"],
    [],
    ["Instance", session.label || session.serverTitle || session.jiraUrl],
    ["Jira URL", session.jiraUrl],
    ["Jira Version", session.jiraVersion ?? ""],
    ["Deployment Type", capitalize(session.deploymentType ?? "")],
    ["Audit Date", formatDate(session.createdAt)],
    [],
    ["Readiness Score", summary?.readinessScore ?? session.readinessScore ?? ""],
    ["Readiness Level", capitalize(summary?.readinessLevel ?? "")],
    ["Hard Blockers", session.blockerCount ?? 0],
    ["Warnings", session.warningCount ?? 0],
    ["Info Findings", session.infoCount ?? 0],
  ];

  if (summary?.categoryBreakdown?.length) {
    summaryRows.push([], ["Category Breakdown"], ["Category", "Score (%)", "Blockers", "Warnings", "Info"]);
    summary.categoryBreakdown.forEach((c) => {
      summaryRows.push([capitalize(c.category), c.score, c.blockers, c.warnings, c.infos]);
    });
  }

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary["!cols"] = [{ wch: 24 }, { wch: 50 }, { wch: 12 }, { wch: 12 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

  // ── Sheet 2: All Findings ────────────────────────────────────────────────
  if (session.findings?.length) {
    const headers = ["Severity", "Category", "Title", "Description", "Count", "Action Required"];
    const rows = session.findings
      .slice()
      .sort((a, b) => {
        const order: Record<string, number> = { blocker: 0, warning: 1, info: 2 };
        return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
      })
      .map((f) => [
        f.severity.toUpperCase(),
        capitalize(f.category),
        f.title,
        f.description,
        f.count ?? "",
        f.migrationNote ?? "",
      ]);

    const wsFindings = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    wsFindings["!cols"] = [
      { wch: 12 }, { wch: 18 }, { wch: 40 }, { wch: 60 }, { wch: 8 }, { wch: 60 },
    ];
    XLSX.utils.book_append_sheet(wb, wsFindings, "All Findings");

    // ── Sheet 3: Blockers Only ───────────────────────────────────────────────
    const blockers = session.findings.filter((f) => f.severity === "blocker");
    if (blockers.length) {
      const wbRows = blockers.map((f) => [
        capitalize(f.category),
        f.title,
        f.description,
        f.count ?? "",
        f.migrationNote ?? "",
      ]);
      const wsBlockers = XLSX.utils.aoa_to_sheet([
        ["Category", "Title", "Description", "Count", "Action Required"],
        ...wbRows,
      ]);
      wsBlockers["!cols"] = [{ wch: 18 }, { wch: 40 }, { wch: 60 }, { wch: 8 }, { wch: 60 }];
      XLSX.utils.book_append_sheet(wb, wsBlockers, "Blockers");
    }
  }

  const filename = `jira-audit-${(session.label || session.jiraUrl).replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}
