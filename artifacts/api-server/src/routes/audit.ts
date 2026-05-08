import { Router } from "express";
import { db } from "@workspace/db";
import {
  auditSessionsTable,
  auditFindingsTable,
} from "@workspace/db";
import { eq, desc, avg, sum, count } from "drizzle-orm";
import {
  TestJiraConnectionBody,
  CreateAuditSessionBody,
  GetAuditSessionParams,
  DeleteAuditSessionParams,
  GetAuditSummaryParams,
  GetAuditBlockersParams,
} from "@workspace/api-zod";
import { JiraClient } from "../lib/jira-client";
import { runAudit } from "../lib/audit-engine";

const router = Router();

// POST /audit/connect — test connection
router.post("/audit/connect", async (req, res): Promise<void> => {
  const parsed = TestJiraConnectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { jiraUrl, username, password } = parsed.data;
  const client = new JiraClient(jiraUrl, username, password);

  try {
    const info = await client.getServerInfo();
    res.json({
      success: true,
      jiraVersion: info.version,
      serverTitle: info.serverTitle,
      deploymentType: info.deploymentType,
      message: `Connected to ${info.serverTitle} (Jira ${info.version}, ${info.deploymentType})`,
    });
  } catch (err) {
    req.log.warn({ err }, "Jira connection test failed");
    res.json({
      success: false,
      message: err instanceof Error ? err.message : "Connection failed",
    });
  }
});

// GET /audit/sessions — list all
router.get("/audit/sessions", async (req, res): Promise<void> => {
  const sessions = await db
    .select()
    .from(auditSessionsTable)
    .orderBy(desc(auditSessionsTable.createdAt));

  res.json(
    sessions.map((s) => ({
      id: String(s.id),
      label: s.label,
      jiraUrl: s.jiraUrl,
      jiraVersion: s.jiraVersion,
      serverTitle: s.serverTitle,
      deploymentType: s.deploymentType,
      status: s.status,
      readinessScore: s.readinessScore,
      blockerCount: s.blockerCount,
      warningCount: s.warningCount,
      infoCount: s.infoCount,
      createdAt: s.createdAt.toISOString(),
      completedAt: s.completedAt?.toISOString() ?? null,
      errorMessage: s.errorMessage,
    })),
  );
});

// POST /audit/sessions — start new audit
router.post("/audit/sessions", async (req, res): Promise<void> => {
  const parsed = CreateAuditSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { jiraUrl, username, password, label } = parsed.data;

  const [session] = await db
    .insert(auditSessionsTable)
    .values({
      jiraUrl,
      username,
      encryptedPassword: password,
      label: label ?? null,
      status: "pending",
    })
    .returning();

  // Fire-and-forget audit in background
  setImmediate(() => {
    runAudit(session.id, password).catch((err) => {
      req.log.error({ err, sessionId: session.id }, "Background audit error");
    });
  });

  res.status(201).json({
    id: String(session.id),
    label: session.label,
    jiraUrl: session.jiraUrl,
    jiraVersion: session.jiraVersion,
    serverTitle: session.serverTitle,
    deploymentType: session.deploymentType,
    status: session.status,
    readinessScore: session.readinessScore,
    blockerCount: session.blockerCount,
    warningCount: session.warningCount,
    infoCount: session.infoCount,
    createdAt: session.createdAt.toISOString(),
    completedAt: null,
    errorMessage: null,
  });
});

// GET /audit/sessions/stats
router.get("/audit/sessions/stats", async (req, res): Promise<void> => {
  const [stats] = await db
    .select({
      totalSessions: count(auditSessionsTable.id),
      averageReadinessScore: avg(auditSessionsTable.readinessScore),
      totalBlockersFound: sum(auditSessionsTable.blockerCount),
      totalWarningsFound: sum(auditSessionsTable.warningCount),
    })
    .from(auditSessionsTable);

  const [completedCount] = await db
    .select({ count: count() })
    .from(auditSessionsTable)
    .where(eq(auditSessionsTable.status, "completed"));

  // Find most common blocker category
  const blockerCounts = await db
    .select({ category: auditFindingsTable.category, cnt: count() })
    .from(auditFindingsTable)
    .where(eq(auditFindingsTable.severity, "blocker"))
    .groupBy(auditFindingsTable.category)
    .orderBy(desc(count()))
    .limit(1);

  res.json({
    totalSessions: Number(stats.totalSessions ?? 0),
    completedSessions: Number(completedCount.count ?? 0),
    averageReadinessScore: stats.averageReadinessScore
      ? Math.round(Number(stats.averageReadinessScore) * 10) / 10
      : 0,
    totalBlockersFound: Number(stats.totalBlockersFound ?? 0),
    totalWarningsFound: Number(stats.totalWarningsFound ?? 0),
    mostCommonBlockerCategory: blockerCounts[0]?.category ?? null,
  });
});

// GET /audit/sessions/:id
router.get("/audit/sessions/:id", async (req, res): Promise<void> => {
  const params = GetAuditSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid session id" });
    return;
  }

  const id = parseInt(params.data.id, 10);
  const [session] = await db
    .select()
    .from(auditSessionsTable)
    .where(eq(auditSessionsTable.id, id));

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const findings = await db
    .select()
    .from(auditFindingsTable)
    .where(eq(auditFindingsTable.sessionId, id));

  res.json({
    id: String(session.id),
    label: session.label,
    jiraUrl: session.jiraUrl,
    jiraVersion: session.jiraVersion,
    serverTitle: session.serverTitle,
    deploymentType: session.deploymentType,
    status: session.status,
    readinessScore: session.readinessScore,
    blockerCount: session.blockerCount,
    warningCount: session.warningCount,
    infoCount: session.infoCount,
    createdAt: session.createdAt.toISOString(),
    completedAt: session.completedAt?.toISOString() ?? null,
    errorMessage: session.errorMessage,
    findings: findings.map((f) => ({
      id: String(f.id),
      sessionId: String(f.sessionId),
      category: f.category,
      severity: f.severity,
      title: f.title,
      description: f.description,
      count: f.count,
      details: f.details,
      migrationNote: f.migrationNote,
    })),
  });
});

// DELETE /audit/sessions/:id
router.delete("/audit/sessions/:id", async (req, res): Promise<void> => {
  const params = DeleteAuditSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid session id" });
    return;
  }

  const id = parseInt(params.data.id, 10);
  await db.delete(auditSessionsTable).where(eq(auditSessionsTable.id, id));
  res.status(204).send();
});

// GET /audit/sessions/:id/summary
router.get("/audit/sessions/:id/summary", async (req, res): Promise<void> => {
  const params = GetAuditSummaryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid session id" });
    return;
  }

  const id = parseInt(params.data.id, 10);
  const [session] = await db
    .select()
    .from(auditSessionsTable)
    .where(eq(auditSessionsTable.id, id));

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const findings = await db
    .select()
    .from(auditFindingsTable)
    .where(eq(auditFindingsTable.sessionId, id));

  const categories = [
    "system_info",
    "plugins",
    "custom_fields",
    "workflows",
    "permissions",
    "users",
    "data_volume",
    "automation",
    "projects",
  ] as const;

  const categoryBreakdown = categories.map((cat) => {
    const catFindings = findings.filter((f) => f.category === cat);
    const blockers = catFindings.filter((f) => f.severity === "blocker").length;
    const warnings = catFindings.filter((f) => f.severity === "warning").length;
    const infos = catFindings.filter((f) => f.severity === "info").length;
    const score = Math.max(0, Math.min(100, 100 - blockers * 20 - warnings * 5));
    return { category: cat, blockers, warnings, infos, score };
  });

  const topBlockers = findings
    .filter((f) => f.severity === "blocker")
    .slice(0, 5)
    .map((f) => ({
      id: String(f.id),
      sessionId: String(f.sessionId),
      category: f.category,
      severity: f.severity,
      title: f.title,
      description: f.description,
      count: f.count,
      details: f.details,
      migrationNote: f.migrationNote,
    }));

  const score = session.readinessScore ?? 0;
  let readinessLevel: "critical" | "at_risk" | "moderate" | "good" | "excellent";
  if (score < 20) readinessLevel = "critical";
  else if (score < 40) readinessLevel = "at_risk";
  else if (score < 60) readinessLevel = "moderate";
  else if (score < 80) readinessLevel = "good";
  else readinessLevel = "excellent";

  res.json({
    sessionId: String(session.id),
    readinessScore: score,
    readinessLevel,
    blockerCount: session.blockerCount ?? 0,
    warningCount: session.warningCount ?? 0,
    infoCount: session.infoCount ?? 0,
    categoryBreakdown,
    topBlockers,
  });
});

// GET /audit/sessions/:id/blockers
router.get("/audit/sessions/:id/blockers", async (req, res): Promise<void> => {
  const params = GetAuditBlockersParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid session id" });
    return;
  }

  const id = parseInt(params.data.id, 10);
  const [session] = await db
    .select({ id: auditSessionsTable.id })
    .from(auditSessionsTable)
    .where(eq(auditSessionsTable.id, id));

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const blockers = await db
    .select()
    .from(auditFindingsTable)
    .where(eq(auditFindingsTable.sessionId, id))
    .orderBy(auditFindingsTable.category);

  res.json(
    blockers
      .filter((f) => f.severity === "blocker")
      .map((f) => ({
        id: String(f.id),
        sessionId: String(f.sessionId),
        category: f.category,
        severity: f.severity,
        title: f.title,
        description: f.description,
        count: f.count,
        details: f.details,
        migrationNote: f.migrationNote,
      })),
  );
});

export default router;
