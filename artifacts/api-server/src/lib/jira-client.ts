import { logger } from "./logger";

export interface JiraSystemInfo {
  version: string;
  serverTitle: string;
  deploymentType: "server" | "datacenter" | "cloud" | "unknown";
}

export interface JiraPlugin {
  key: string;
  name: string;
  version: string;
  vendor?: string;
  enabled: boolean;
}

export interface JiraCustomField {
  id: string;
  name: string;
  type: string;
  custom: boolean;
}

export interface JiraWorkflow {
  name: string;
  description?: string;
  steps?: number;
}

export interface JiraProject {
  key: string;
  name: string;
  projectTypeKey: string;
  isPrivate?: boolean;
}

export interface JiraUser {
  name: string;
  emailAddress?: string;
  active: boolean;
  directoryType?: string;
}

export interface JiraPermissionScheme {
  id: number;
  name: string;
  description?: string;
}

export class JiraClient {
  private baseUrl: string;
  private authHeader: string;

  constructor(jiraUrl: string, username: string, password: string) {
    this.baseUrl = jiraUrl.replace(/\/$/, "");
    const encoded = Buffer.from(`${username}:${password}`).toString("base64");
    this.authHeader = `Basic ${encoded}`;
  }

  private async fetch<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}/rest/api/2${path}`;
    const res = await fetch(url, {
      headers: {
        Authorization: this.authHeader,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error(`Jira API ${path} returned ${res.status}: ${res.statusText}`);
    }

    return res.json() as Promise<T>;
  }

  async getServerInfo(): Promise<JiraSystemInfo> {
    const data = await this.fetch<{
      version: string;
      serverTitle: string;
      deploymentType?: string;
    }>("/serverInfo");

    let deploymentType: "server" | "datacenter" | "cloud" | "unknown" =
      "unknown";
    if (data.deploymentType) {
      const dt = data.deploymentType.toLowerCase();
      if (dt.includes("datacenter") || dt.includes("data_center"))
        deploymentType = "datacenter";
      else if (dt.includes("server")) deploymentType = "server";
      else if (dt.includes("cloud")) deploymentType = "cloud";
    }

    return {
      version: data.version,
      serverTitle: data.serverTitle,
      deploymentType,
    };
  }

  async getPlugins(): Promise<JiraPlugin[]> {
    try {
      const data = await this.fetch<
        Array<{
          key: string;
          name: string;
          version: string;
          vendor?: { name: string };
          enabled: boolean;
        }>
      >("/plugin");
      return data.map((p) => ({
        key: p.key,
        name: p.name,
        version: p.version,
        vendor: p.vendor?.name,
        enabled: p.enabled,
      }));
    } catch {
      logger.warn("Could not fetch plugins — may require admin access");
      return [];
    }
  }

  async getCustomFields(): Promise<JiraCustomField[]> {
    try {
      const data = await this.fetch<
        Array<{ id: string; name: string; schema?: { type: string; custom?: string }; custom: boolean }>
      >("/field");
      return data
        .filter((f) => f.custom)
        .map((f) => ({
          id: f.id,
          name: f.name,
          type: f.schema?.custom ?? f.schema?.type ?? "unknown",
          custom: f.custom,
        }));
    } catch {
      logger.warn("Could not fetch custom fields");
      return [];
    }
  }

  async getWorkflows(): Promise<JiraWorkflow[]> {
    try {
      const data = await this.fetch<
        Array<{ name: string; description?: string; steps?: Array<unknown> }>
      >("/workflow?maxResults=200");
      return data.map((w) => ({
        name: w.name,
        description: w.description,
        steps: w.steps?.length,
      }));
    } catch {
      logger.warn("Could not fetch workflows");
      return [];
    }
  }

  async getProjects(): Promise<JiraProject[]> {
    try {
      const data = await this.fetch<
        Array<{
          key: string;
          name: string;
          projectTypeKey: string;
          isPrivate?: boolean;
        }>
      >("/project?expand=projectKeys&maxResults=500");
      return data.map((p) => ({
        key: p.key,
        name: p.name,
        projectTypeKey: p.projectTypeKey,
        isPrivate: p.isPrivate,
      }));
    } catch {
      logger.warn("Could not fetch projects");
      return [];
    }
  }

  async getUserCount(): Promise<{
    total: number;
    active: number;
    inactive: number;
  }> {
    try {
      const data = await this.fetch<Array<{ active: boolean }>>(
        "/user/search?username=.&maxResults=1000",
      );
      const active = data.filter((u) => u.active).length;
      return { total: data.length, active, inactive: data.length - active };
    } catch {
      logger.warn("Could not fetch users");
      return { total: 0, active: 0, inactive: 0 };
    }
  }

  async getIssueCount(): Promise<number> {
    try {
      const data = await this.fetch<{ total: number }>(
        "/search?jql=ORDER BY created DESC&maxResults=0",
      );
      return data.total;
    } catch {
      logger.warn("Could not fetch issue count");
      return 0;
    }
  }

  async getPermissionSchemes(): Promise<JiraPermissionScheme[]> {
    try {
      const data = await this.fetch<{
        permissionSchemes: Array<{
          id: number;
          name: string;
          description?: string;
        }>;
      }>("/permissionscheme");
      return data.permissionSchemes.map((ps) => ({
        id: ps.id,
        name: ps.name,
        description: ps.description,
      }));
    } catch {
      logger.warn("Could not fetch permission schemes");
      return [];
    }
  }

  async getGroups(): Promise<number> {
    try {
      const data = await this.fetch<{
        groups: Array<unknown>;
        total: number;
      }>("/groups/picker?maxResults=200");
      return data.total ?? data.groups?.length ?? 0;
    } catch {
      logger.warn("Could not fetch groups");
      return 0;
    }
  }

  async getAttachmentSizeBytes(): Promise<number> {
    try {
      const data = await this.fetch<{ value: string }>("/configuration");
      const max = parseInt(data.value ?? "0");
      return max;
    } catch {
      return 0;
    }
  }
}
