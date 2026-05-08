import { db } from "@workspace/db";
import {
  auditSessionsTable,
  auditFindingsTable,
  type InsertAuditFinding,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { JiraClient } from "./jira-client";
import { logger } from "./logger";

const UNSUPPORTED_CLOUD_FIELD_TYPES = [
  "com.atlassian.jira.plugin.system.customfieldtypes:grouppicker",
  "com.atlassian.jira.plugin.system.customfieldtypes:multigrouppicker",
  "com.atlassian.jira.toolkit:viewportcustomfield",
  "com.atlassian.jira.plugin.system.customfieldtypes:importid",
  "com.atlassian.jira.plugins.jira-importers-plugin:jira-importers-plugin-originalproject",
];

const KNOWN_BLOCKER_PLUGINS = [
  "com.atlassian.jira.plugins.jira-importers-plugin",
  "com.onresolve.jira.groovy.groovyrunner",
  "com.innovalog.jmwe",
  "com.intensivemeasure.jira.scripts",
  "de.scandio.jira.plugins.scriptrunner",
];

const KNOWN_WARNING_PLUGINS = [
  "com.tempoplugin",
  "com.pyxis.greenhopper.jira",
  "ru.mail.jira.plugins",
  "com.atlassian.jira.plugins.jira-development-integration-plugin",
  "com.atlassian.streams",
];

function computeReadinessScore(
  blockers: number,
  warnings: number,
  infos: number,
): number {
  const base = 100;
  const blockerPenalty = blockers * 15;
  const warningPenalty = warnings * 4;
  const infoPenalty = infos * 0.5;
  const score = Math.max(
    0,
    Math.min(100, base - blockerPenalty - warningPenalty - infoPenalty),
  );
  return Math.round(score * 10) / 10;
}

export async function runAudit(sessionId: number, password: string) {
  const [session] = await db
    .select()
    .from(auditSessionsTable)
    .where(eq(auditSessionsTable.id, sessionId));

  if (!session) {
    logger.error({ sessionId }, "Audit session not found");
    return;
  }

  await db
    .update(auditSessionsTable)
    .set({ status: "running" })
    .where(eq(auditSessionsTable.id, sessionId));

  const client = new JiraClient(session.jiraUrl, session.username, password);
  const findings: InsertAuditFinding[] = [];

  try {
    // 1. System Info
    const serverInfo = await client.getServerInfo();
    await db
      .update(auditSessionsTable)
      .set({
        jiraVersion: serverInfo.version,
        serverTitle: serverInfo.serverTitle,
        deploymentType: serverInfo.deploymentType,
      })
      .where(eq(auditSessionsTable.id, sessionId));

    const [major] = serverInfo.version.split(".").map(Number);
    if (major !== undefined && major < 8) {
      findings.push({
        sessionId,
        category: "system_info",
        severity: "blocker",
        title: "Outdated Jira Version",
        description: `Jira ${serverInfo.version} is below the minimum supported version for migration tooling. Atlassian requires at least version 8.x for the Jira Cloud Migration Assistant.`,
        count: null,
        details: JSON.stringify({ version: serverInfo.version }),
        migrationNote:
          "Upgrade to Jira 8.x or later before running the Cloud Migration Assistant.",
      });
    } else {
      findings.push({
        sessionId,
        category: "system_info",
        severity: "info",
        title: "Jira Version Compatible",
        description: `Running Jira ${serverInfo.version} (${serverInfo.deploymentType}). This version is supported by the Cloud Migration Assistant.`,
        count: null,
        details: JSON.stringify({
          version: serverInfo.version,
          type: serverInfo.deploymentType,
        }),
        migrationNote: null,
      });
    }

    if (serverInfo.deploymentType === "server") {
      findings.push({
        sessionId,
        category: "system_info",
        severity: "warning",
        title: "Jira Server (Not Data Center)",
        description:
          "This instance runs Jira Server, which reached end-of-life in February 2024. Migrating directly from Server may have a more limited tooling path than Data Center.",
        count: null,
        details: null,
        migrationNote:
          "Consider upgrading to Data Center first to access the latest migration tools, then migrate to Cloud.",
      });
    }

    // 2. Plugins
    const plugins = await client.getPlugins();
    if (plugins.length > 0) {
      const blockerPlugins = plugins.filter((p) =>
        KNOWN_BLOCKER_PLUGINS.some((bp) => p.key.startsWith(bp)),
      );
      const warningPlugins = plugins.filter((p) =>
        KNOWN_WARNING_PLUGINS.some((wp) => p.key.startsWith(wp)),
      );
      const thirdPartyEnabled = plugins.filter(
        (p) =>
          p.enabled &&
          !p.key.startsWith("com.atlassian") &&
          !blockerPlugins.includes(p) &&
          !warningPlugins.includes(p),
      );

      findings.push({
        sessionId,
        category: "plugins",
        severity: "info",
        title: "Installed Apps Detected",
        description: `Found ${plugins.length} installed apps: ${plugins.filter((p) => p.enabled).length} enabled, ${plugins.filter((p) => !p.enabled).length} disabled.`,
        count: plugins.length,
        details: JSON.stringify(
          plugins.slice(0, 30).map((p) => ({ key: p.key, name: p.name })),
        ),
        migrationNote:
          "Verify each enabled app has a Cloud-compatible version in the Atlassian Marketplace.",
      });

      if (blockerPlugins.length > 0) {
        for (const plugin of blockerPlugins) {
          findings.push({
            sessionId,
            category: "plugins",
            severity: "blocker",
            title: `Migration-Blocking App: ${plugin.name}`,
            description: `"${plugin.name}" (${plugin.key}) uses server-side scripting or unsupported APIs that have no direct Cloud equivalent. This is a known migration blocker.`,
            count: null,
            details: JSON.stringify({
              key: plugin.key,
              version: plugin.version,
            }),
            migrationNote:
              "Evaluate alternative Cloud-native apps or redesign the automation before migration.",
          });
        }
      }

      if (warningPlugins.length > 0) {
        findings.push({
          sessionId,
          category: "plugins",
          severity: "warning",
          title: "Apps with Limited Cloud Support",
          description: `${warningPlugins.length} app(s) may have reduced feature sets or different pricing models on Cloud: ${warningPlugins.map((p) => p.name).join(", ")}.`,
          count: warningPlugins.length,
          details: JSON.stringify(
            warningPlugins.map((p) => ({ key: p.key, name: p.name })),
          ),
          migrationNote:
            "Review each app on the Atlassian Marketplace for Cloud compatibility and licensing changes.",
        });
      }

      if (thirdPartyEnabled.length > 0) {
        findings.push({
          sessionId,
          category: "plugins",
          severity: "warning",
          title: "Third-Party Apps Need Cloud Review",
          description: `${thirdPartyEnabled.length} third-party apps are enabled. Each must be evaluated for Cloud availability and data migration support.`,
          count: thirdPartyEnabled.length,
          details: JSON.stringify(
            thirdPartyEnabled
              .slice(0, 20)
              .map((p) => ({ key: p.key, name: p.name })),
          ),
          migrationNote:
            "Use the Atlassian Marketplace to check Cloud availability. Disable or replace any app with no Cloud version before migration.",
        });
      }
    }

    // 3. Custom Fields
    const customFields = await client.getCustomFields();
    if (customFields.length > 0) {
      const unsupported = customFields.filter((f) =>
        UNSUPPORTED_CLOUD_FIELD_TYPES.includes(f.type),
      );
      const groupPicker = customFields.filter(
        (f) =>
          f.type.includes("grouppicker") || f.type.includes("multigroup"),
      );
      const scriptedFields = customFields.filter(
        (f) => f.type.includes("script") || f.type.includes("groovy"),
      );

      findings.push({
        sessionId,
        category: "custom_fields",
        severity: "info",
        title: "Custom Fields Inventory",
        description: `${customFields.length} custom fields detected. Most standard custom field types migrate automatically. Some types require manual review.`,
        count: customFields.length,
        details: JSON.stringify(
          customFields.slice(0, 30).map((f) => ({ name: f.name, type: f.type })),
        ),
        migrationNote: null,
      });

      if (unsupported.length > 0) {
        findings.push({
          sessionId,
          category: "custom_fields",
          severity: "blocker",
          title: "Unsupported Custom Field Types",
          description: `${unsupported.length} custom field(s) use types that are not supported in Jira Cloud: ${unsupported.map((f) => f.name).join(", ")}.`,
          count: unsupported.length,
          details: JSON.stringify(
            unsupported.map((f) => ({ name: f.name, type: f.type })),
          ),
          migrationNote:
            "Replace these fields with supported Cloud alternatives before migration. Data in these fields may be lost.",
        });
      }

      if (groupPicker.length > 0) {
        findings.push({
          sessionId,
          category: "custom_fields",
          severity: "warning",
          title: "Group Picker Fields Detected",
          description: `${groupPicker.length} group picker field(s) found. Group management in Jira Cloud differs significantly — groups are managed at the Atlassian organization level.`,
          count: groupPicker.length,
          details: JSON.stringify(groupPicker.map((f) => f.name)),
          migrationNote:
            "Re-evaluate group picker fields. Consider using user picker fields or Atlassian Access group management post-migration.",
        });
      }

      if (scriptedFields.length > 0) {
        findings.push({
          sessionId,
          category: "custom_fields",
          severity: "blocker",
          title: "Scripted Custom Fields",
          description: `${scriptedFields.length} scripted/computed custom field(s) detected. ScriptRunner and similar script-based fields do not migrate to Cloud automatically.`,
          count: scriptedFields.length,
          details: JSON.stringify(scriptedFields.map((f) => f.name)),
          migrationNote:
            "Rewrite scripted fields using native Jira automation or Atlassian's Forge platform.",
        });
      }
    }

    // 4. Workflows
    const workflows = await client.getWorkflows();
    if (workflows.length > 0) {
      const systemWorkflows = workflows.filter(
        (w) => w.name === "classic default workflow" || w.name.startsWith("jira"),
      );
      const customWorkflows = workflows.filter(
        (w) => !systemWorkflows.includes(w),
      );
      const complexWorkflows = customWorkflows.filter(
        (w) => (w.steps ?? 0) > 15,
      );

      findings.push({
        sessionId,
        category: "workflows",
        severity: "info",
        title: "Workflow Inventory",
        description: `${workflows.length} workflows found: ${systemWorkflows.length} system, ${customWorkflows.length} custom. Workflows migrate automatically but custom validators, conditions, and post-functions may not.`,
        count: workflows.length,
        details: JSON.stringify(
          customWorkflows.slice(0, 20).map((w) => ({
            name: w.name,
            steps: w.steps,
          })),
        ),
        migrationNote: null,
      });

      if (complexWorkflows.length > 0) {
        findings.push({
          sessionId,
          category: "workflows",
          severity: "warning",
          title: "Complex Workflows Detected",
          description: `${complexWorkflows.length} custom workflow(s) with more than 15 steps. Complex workflows with scripted validators or post-functions may not migrate cleanly.`,
          count: complexWorkflows.length,
          details: JSON.stringify(
            complexWorkflows.map((w) => ({ name: w.name, steps: w.steps })),
          ),
          migrationNote:
            "Audit each complex workflow for scripted elements. Replace custom validators/post-functions with native Jira automation rules.",
        });
      }

      findings.push({
        sessionId,
        category: "workflows",
        severity: "warning",
        title: "Custom Validators and Post-Functions Not Inspected",
        description:
          "Workflow post-functions using ScriptRunner, JMWE, or custom plugins are migration blockers. REST API does not expose condition/validator details — manual inspection required.",
        count: customWorkflows.length,
        details: null,
        migrationNote:
          "Manually review each workflow in the Workflow Designer and document any scripted conditions, validators, or post-functions.",
      });
    }

    // 5. Projects
    const projects = await client.getProjects();
    if (projects.length > 0) {
      const businessProjects = projects.filter(
        (p) => p.projectTypeKey === "business",
      );
      const softwareProjects = projects.filter(
        (p) => p.projectTypeKey === "software",
      );
      const serviceProjects = projects.filter(
        (p) => p.projectTypeKey === "service_desk",
      );

      findings.push({
        sessionId,
        category: "projects",
        severity: "info",
        title: "Project Inventory",
        description: `${projects.length} projects: ${softwareProjects.length} Software, ${businessProjects.length} Business, ${serviceProjects.length} Service Desk.`,
        count: projects.length,
        details: JSON.stringify({
          software: softwareProjects.length,
          business: businessProjects.length,
          serviceDesk: serviceProjects.length,
        }),
        migrationNote: null,
      });

      if (projects.length > 100) {
        findings.push({
          sessionId,
          category: "projects",
          severity: "warning",
          title: "Large Number of Projects",
          description: `${projects.length} projects detected. Large project counts extend migration time and increase risk of configuration conflicts.`,
          count: projects.length,
          details: null,
          migrationNote:
            "Consider migrating projects in batches. Archive unused projects before migration to reduce scope.",
        });
      }

      if (serviceProjects.length > 0) {
        findings.push({
          sessionId,
          category: "projects",
          severity: "warning",
          title: "Service Desk Projects Require Separate Migration",
          description: `${serviceProjects.length} Jira Service Management project(s) detected. JSM has its own migration path with additional considerations for SLA, queues, and portal configuration.`,
          count: serviceProjects.length,
          details: null,
          migrationNote:
            "Use the JSM-specific migration guide and test portal configurations in a staging Cloud instance first.",
        });
      }
    }

    // 6. Users
    const users = await client.getUserCount();
    const groups = await client.getGroups();

    findings.push({
      sessionId,
      category: "users",
      severity: "info",
      title: "User Directory Overview",
      description: `${users.total} users found (${users.active} active, ${users.inactive} inactive). ${groups} groups detected.`,
      count: users.total,
      details: JSON.stringify({
        active: users.active,
        inactive: users.inactive,
        groups,
      }),
      migrationNote: null,
    });

    if (users.total > 2000) {
      findings.push({
        sessionId,
        category: "users",
        severity: "warning",
        title: "Large User Base",
        description: `${users.total} users detected. Large user migrations require careful planning around Atlassian Access licensing and directory synchronization.`,
        count: users.total,
        details: null,
        migrationNote:
          "Review Atlassian Access for organization-wide user management. Plan for SCIM provisioning if using an Identity Provider.",
      });
    }

    findings.push({
      sessionId,
      category: "users",
      severity: "warning",
      title: "External Directory Integration",
      description:
        "If users are managed via LDAP or Active Directory, the directory integration does not migrate automatically. Cloud uses Atlassian Access for SSO and SCIM provisioning.",
      count: null,
      details: null,
      migrationNote:
        "Configure Atlassian Access with your Identity Provider before migration. Set up SCIM to sync users and groups.",
    });

    // 7. Data Volume
    const issueCount = await client.getIssueCount();
    findings.push({
      sessionId,
      category: "data_volume",
      severity: "info",
      title: "Issue Data Volume",
      description: `${issueCount.toLocaleString()} total issues. Migration time scales with data volume.`,
      count: issueCount,
      details: null,
      migrationNote: null,
    });

    if (issueCount > 500000) {
      findings.push({
        sessionId,
        category: "data_volume",
        severity: "blocker",
        title: "Very Large Issue Volume — Migration Complexity High",
        description: `${issueCount.toLocaleString()} issues detected. Instances with more than 500,000 issues require a phased migration strategy and extended maintenance windows.`,
        count: issueCount,
        details: null,
        migrationNote:
          "Use Atlassian's Large Instance Migration support. Plan for multiple migration rounds and extended downtime.",
      });
    } else if (issueCount > 100000) {
      findings.push({
        sessionId,
        category: "data_volume",
        severity: "warning",
        title: "Large Issue Volume — Extended Migration Time",
        description: `${issueCount.toLocaleString()} issues will require extended migration windows. Estimate migration time carefully.`,
        count: issueCount,
        details: null,
        migrationNote:
          "Run test migrations in a staging environment to estimate actual migration duration.",
      });
    }

    findings.push({
      sessionId,
      category: "data_volume",
      severity: "warning",
      title: "Attachment Storage Not Automatically Migrated",
      description:
        "Attachments are migrated by the Cloud Migration Assistant but large attachment volumes significantly increase migration time and may hit Cloud storage limits.",
      count: null,
      details: null,
      migrationNote:
        "Audit attachment storage volume. Consider archiving old attachments. Cloud has a 250 GB attachment limit per site.",
    });

    // 8. Permissions
    const permissionSchemes = await client.getPermissionSchemes();
    if (permissionSchemes.length > 0) {
      findings.push({
        sessionId,
        category: "permissions",
        severity: "info",
        title: "Permission Schemes",
        description: `${permissionSchemes.length} permission scheme(s) detected. Most migrate automatically but group-based permissions require Cloud user sync.`,
        count: permissionSchemes.length,
        details: JSON.stringify(permissionSchemes.map((ps) => ps.name)),
        migrationNote: null,
      });

      if (permissionSchemes.length > 10) {
        findings.push({
          sessionId,
          category: "permissions",
          severity: "warning",
          title: "Many Permission Schemes",
          description: `${permissionSchemes.length} permission schemes may indicate complex access control that needs audit post-migration.`,
          count: permissionSchemes.length,
          details: null,
          migrationNote:
            "Review and consolidate permission schemes where possible. Verify access control post-migration in a staging environment.",
        });
      }
    }

    findings.push({
      sessionId,
      category: "permissions",
      severity: "warning",
      title: "Security Level Schemes",
      description:
        "Issue-level security schemes migrate but may behave differently in Cloud due to changes in group management and project roles.",
      count: null,
      details: null,
      migrationNote:
        "Test issue visibility and security levels thoroughly in a Cloud staging environment after migration.",
    });

    // 9. Automation
    findings.push({
      sessionId,
      category: "automation",
      severity: "blocker",
      title: "Server-Side Groovy Scripts Cannot Migrate",
      description:
        "Any Groovy scripts (ScriptRunner, JMWE, etc.) used for automation, validators, listeners, or scheduled jobs have no equivalent in Cloud and must be rewritten.",
      count: null,
      details: null,
      migrationNote:
        "Inventory all Groovy scripts. Rewrite them using Jira Automation rules or Atlassian Forge apps before migration.",
    });

    findings.push({
      sessionId,
      category: "automation",
      severity: "warning",
      title: "Email Listeners and Custom Event Handlers",
      description:
        "Custom email listeners, project event handlers, and JQL-based automation rules may not migrate automatically and must be recreated.",
      count: null,
      details: null,
      migrationNote:
        "Document all automation rules and listeners. Recreate them using Jira Cloud Automation post-migration.",
    });

    // Save all findings
    if (findings.length > 0) {
      await db.insert(auditFindingsTable).values(findings);
    }

    // Compute final score
    const blockers = findings.filter((f) => f.severity === "blocker").length;
    const warnings = findings.filter((f) => f.severity === "warning").length;
    const infos = findings.filter((f) => f.severity === "info").length;
    const score = computeReadinessScore(blockers, warnings, infos);

    await db
      .update(auditSessionsTable)
      .set({
        status: "completed",
        readinessScore: score,
        blockerCount: blockers,
        warningCount: warnings,
        infoCount: infos,
        completedAt: new Date(),
      })
      .where(eq(auditSessionsTable.id, sessionId));

    logger.info(
      { sessionId, score, blockers, warnings },
      "Audit completed successfully",
    );
  } catch (err) {
    logger.error({ sessionId, err }, "Audit failed");
    await db
      .update(auditSessionsTable)
      .set({
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
        completedAt: new Date(),
      })
      .where(eq(auditSessionsTable.id, sessionId));
  }
}
