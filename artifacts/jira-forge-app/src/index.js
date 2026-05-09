import Resolver from "@forge/resolver";
import { fetch } from "@forge/api";

const resolver = new Resolver();

// ── helpers ──────────────────────────────────────────────────────────────────

function makeAuthHeader(username, password) {
  return "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
}

async function jiraGet(baseUrl, path, auth) {
  const url = `${baseUrl.replace(/\/$/, "")}/rest/api/2${path}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: auth, "Content-Type": "application/json", Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Jira API error ${res.status} at ${path}`);
  return res.json();
}

// ── connection test ───────────────────────────────────────────────────────────

resolver.define("testConnection", async ({ payload }) => {
  const { baseUrl, username, password } = payload;
  try {
    const auth = makeAuthHeader(username, password);
    const info = await jiraGet(baseUrl, "/serverInfo", auth);
    return {
      success: true,
      serverTitle: info.serverTitle,
      version: info.version,
      deploymentType: info.deploymentType,
      baseUrl: info.baseUrl,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ── full audit ────────────────────────────────────────────────────────────────

resolver.define("runAudit", async ({ payload }) => {
  const { baseUrl, username, password } = payload;
  const auth = makeAuthHeader(username, password);
  const findings = [];
  const categoryScores = {};

  function addFinding(category, severity, title, description, migrationNote) {
    findings.push({ category, severity, title, description, migrationNote });
  }

  // ── 1. System Info ──────────────────────────────────────────────────────────
  try {
    const info = await jiraGet(baseUrl, "/serverInfo", auth);
    const version = parseFloat(info.version);
    categoryScores["System Info"] = 100;
    if (version < 8.0) {
      addFinding("System Info", "blocker", "Unsupported Jira version",
        `Jira ${info.version} is not supported for migration. Minimum is 8.x.`,
        "Upgrade to Jira 8.x or later before migrating.");
      categoryScores["System Info"] = 20;
    } else if (version < 9.0) {
      addFinding("System Info", "warning", "Older Jira version",
        `Jira ${info.version} is supported but upgrading to 9.x+ is recommended.`,
        "Consider upgrading for best migration compatibility.");
      categoryScores["System Info"] = 70;
    } else {
      addFinding("System Info", "info", "Jira version compatible",
        `Jira ${info.version} is fully compatible with Cloud migration.`, "");
    }
  } catch (e) {
    addFinding("System Info", "blocker", "Cannot connect to Jira", e.message, "Fix connectivity before proceeding.");
    categoryScores["System Info"] = 0;
  }

  // ── 2. Plugins / Apps ───────────────────────────────────────────────────────
  try {
    const plugins = await jiraGet(baseUrl, "/plugins/1.0/enabled", auth);
    const pluginList = Array.isArray(plugins) ? plugins : [];
    const userInstalled = pluginList.filter(p => !p.systemPlugin);
    categoryScores["Plugins"] = userInstalled.length === 0 ? 100 : Math.max(20, 100 - userInstalled.length * 5);
    if (userInstalled.length > 20) {
      addFinding("Plugins", "blocker", `${userInstalled.length} third-party plugins detected`,
        "Large number of plugins may not have Cloud equivalents.",
        "Review each plugin at marketplace.atlassian.com for Cloud availability.");
    } else if (userInstalled.length > 5) {
      addFinding("Plugins", "warning", `${userInstalled.length} third-party plugins`,
        "Some plugins may not be available on Cloud.",
        "Verify Cloud alternatives for each plugin.");
    } else {
      addFinding("Plugins", "info", `${userInstalled.length} third-party plugins`,
        "Low plugin count is favourable for migration.", "");
    }
  } catch {
    addFinding("Plugins", "warning", "Could not retrieve plugin list",
      "Plugin API may require admin access.", "Manually review installed plugins.");
    categoryScores["Plugins"] = 50;
  }

  // ── 3. Custom Fields ────────────────────────────────────────────────────────
  try {
    const fields = await jiraGet(baseUrl, "/field", auth);
    const customFields = fields.filter(f => f.custom);
    categoryScores["Custom Fields"] = customFields.length < 50 ? 90 : customFields.length < 100 ? 65 : 40;
    if (customFields.length > 100) {
      addFinding("Custom Fields", "blocker", `${customFields.length} custom fields detected`,
        "Very high number of custom fields increases migration complexity and risk.",
        "Audit and remove unused custom fields before migration.");
    } else if (customFields.length > 50) {
      addFinding("Custom Fields", "warning", `${customFields.length} custom fields`,
        "High custom field count may cause issues during migration.",
        "Review and clean up unused custom fields.");
    } else {
      addFinding("Custom Fields", "info", `${customFields.length} custom fields`,
        "Custom field count is manageable.", "");
    }
  } catch {
    categoryScores["Custom Fields"] = 50;
    addFinding("Custom Fields", "warning", "Could not retrieve custom fields", "", "");
  }

  // ── 4. Workflows ────────────────────────────────────────────────────────────
  try {
    const workflows = await jiraGet(baseUrl, "/workflow?maxResults=200", auth);
    const wfList = Array.isArray(workflows) ? workflows : [];
    categoryScores["Workflows"] = wfList.length < 20 ? 90 : wfList.length < 50 ? 65 : 40;
    if (wfList.length > 50) {
      addFinding("Workflows", "blocker", `${wfList.length} workflows detected`,
        "Large number of workflows increases migration time significantly.",
        "Consolidate and simplify workflows before migration.");
    } else if (wfList.length > 20) {
      addFinding("Workflows", "warning", `${wfList.length} workflows`,
        "Moderate number of workflows — review for Cloud compatibility.",
        "Check each workflow for post-functions that may not be supported in Cloud.");
    } else {
      addFinding("Workflows", "info", `${wfList.length} workflows`, "Workflow count is manageable.", "");
    }
  } catch {
    categoryScores["Workflows"] = 50;
    addFinding("Workflows", "warning", "Could not retrieve workflows", "", "");
  }

  // ── 5. Projects ─────────────────────────────────────────────────────────────
  try {
    const projects = await jiraGet(baseUrl, "/project?maxResults=500", auth);
    const projectList = Array.isArray(projects) ? projects : [];
    categoryScores["Projects"] = projectList.length < 100 ? 85 : projectList.length < 500 ? 60 : 35;
    const nextGenCompatible = projectList.filter(p => p.projectTypeKey === "software").length;
    if (projectList.length > 500) {
      addFinding("Projects", "blocker", `${projectList.length} projects detected`,
        "Very high number of projects will significantly extend migration time.",
        "Consider migrating in batches or archiving inactive projects.");
    } else if (projectList.length > 100) {
      addFinding("Projects", "warning", `${projectList.length} projects`,
        "Large project count — plan for extended migration window.",
        "Identify and archive inactive projects before migration.");
    } else {
      addFinding("Projects", "info", `${projectList.length} projects (${nextGenCompatible} software)`,
        "Project count is manageable for migration.", "");
    }
  } catch {
    categoryScores["Projects"] = 50;
    addFinding("Projects", "warning", "Could not retrieve projects", "", "");
  }

  // ── 6. Users ────────────────────────────────────────────────────────────────
  try {
    const users = await jiraGet(baseUrl, "/user/search?username=.&maxResults=1000&startAt=0", auth);
    const userList = Array.isArray(users) ? users : [];
    const activeUsers = userList.filter(u => u.active);
    categoryScores["Users"] = activeUsers.length < 500 ? 85 : activeUsers.length < 2000 ? 65 : 40;
    const noEmail = activeUsers.filter(u => !u.emailAddress);
    if (noEmail.length > 0) {
      addFinding("Users", "blocker", `${noEmail.length} users without email addresses`,
        "Users without emails cannot be migrated to Atlassian Cloud accounts.",
        "Ensure all active users have valid email addresses before migration.");
    }
    if (activeUsers.length > 2000) {
      addFinding("Users", "warning", `${activeUsers.length} active users`,
        "Large user base increases migration complexity.",
        "Plan user provisioning strategy for Cloud (SSO, managed accounts).");
    } else {
      addFinding("Users", "info", `${activeUsers.length} active users`, "User count is manageable.", "");
    }
  } catch {
    categoryScores["Users"] = 50;
    addFinding("Users", "warning", "Could not retrieve user list", "May require admin permissions.", "");
  }

  // ── 7. Data Volume ──────────────────────────────────────────────────────────
  try {
    const searchResult = await jiraGet(baseUrl, "/search?jql=ORDER+BY+created+ASC&maxResults=0", auth);
    const totalIssues = searchResult.total || 0;
    categoryScores["Data Volume"] = totalIssues < 100000 ? 90 : totalIssues < 500000 ? 60 : 30;
    if (totalIssues > 500000) {
      addFinding("Data Volume", "blocker", `${totalIssues.toLocaleString()} total issues`,
        "Very large data volume will require extended migration window and careful planning.",
        "Contact Atlassian for large-instance migration support. Plan for 2+ week downtime.");
    } else if (totalIssues > 100000) {
      addFinding("Data Volume", "warning", `${totalIssues.toLocaleString()} total issues`,
        "Large issue count — expect longer migration time.",
        "Schedule migration during low-usage period. Expect 24–48 hours.");
    } else {
      addFinding("Data Volume", "info", `${totalIssues.toLocaleString()} total issues`,
        "Data volume is within normal migration range.", "");
    }
  } catch {
    categoryScores["Data Volume"] = 50;
    addFinding("Data Volume", "warning", "Could not retrieve issue count", "", "");
  }

  // ── 8. Permissions ──────────────────────────────────────────────────────────
  try {
    const permSchemes = await jiraGet(baseUrl, "/permissionscheme", auth);
    const schemes = permSchemes.permissionSchemes || [];
    categoryScores["Permissions"] = schemes.length < 10 ? 90 : schemes.length < 30 ? 70 : 45;
    if (schemes.length > 30) {
      addFinding("Permissions", "warning", `${schemes.length} permission schemes`,
        "High number of permission schemes complicates migration.",
        "Consolidate permission schemes where possible before migration.");
    } else {
      addFinding("Permissions", "info", `${schemes.length} permission schemes`, "Permission complexity is acceptable.", "");
    }
  } catch {
    categoryScores["Permissions"] = 60;
    addFinding("Permissions", "warning", "Could not retrieve permission schemes", "", "");
  }

  // ── 9. Automation ───────────────────────────────────────────────────────────
  try {
    const automations = await jiraGet(baseUrl, "/automation/rules", auth);
    const rules = Array.isArray(automations) ? automations : (automations.rules || []);
    categoryScores["Automation"] = rules.length < 20 ? 90 : rules.length < 50 ? 70 : 45;
    if (rules.length > 50) {
      addFinding("Automation", "warning", `${rules.length} automation rules`,
        "Many automation rules may need reconfiguration in Cloud.",
        "Review automation rules for Cloud compatibility. Some actions differ between DC and Cloud.");
    } else {
      addFinding("Automation", "info", `${rules.length} automation rules`, "Automation count is manageable.", "");
    }
  } catch {
    categoryScores["Automation"] = 70;
    addFinding("Automation", "info", "Automation rules could not be retrieved",
      "Automation API is not available on all Jira DC versions.", "Manually review automation rules.");
  }

  // ── Calculate overall score ─────────────────────────────────────────────────
  const scores = Object.values(categoryScores);
  const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  const blockers = findings.filter(f => f.severity === "blocker").length;
  const warnings = findings.filter(f => f.severity === "warning").length;

  let readinessLevel;
  if (overallScore >= 80) readinessLevel = "ready";
  else if (overallScore >= 60) readinessLevel = "needs-attention";
  else if (overallScore >= 40) readinessLevel = "at-risk";
  else readinessLevel = "not-ready";

  return {
    success: true,
    overallScore,
    readinessLevel,
    blockers,
    warnings,
    findings,
    categoryScores,
  };
});

export const handler = resolver.getDefinitions();
