import { formatCliCommand } from "../cli/command-format.js";
import { readConfigFileSnapshot } from "../config/config.js";
import { resolveOpenClawPackageRoot } from "../infra/openclaw-root.js";
import {
  checkUpdateStatus,
  compareSemverStrings,
  normalizeUpdateVersionSourceUrl,
  type UpdateCheckResult,
} from "../infra/update-check.js";
import { VERSION } from "../version.js";

export async function getUpdateCheckResult(params: {
  timeoutMs: number;
  fetchGit: boolean;
  includeRegistry: boolean;
}): Promise<UpdateCheckResult> {
  const root = await resolveOpenClawPackageRoot({
    moduleUrl: import.meta.url,
    argv1: process.argv[1],
    cwd: process.cwd(),
  });
  const configSnapshot = await readConfigFileSnapshot().catch(() => null);
  const versionSourceUrl =
    configSnapshot?.valid === true
      ? normalizeUpdateVersionSourceUrl(configSnapshot.config.update?.versionSourceUrl)
      : null;
  return await checkUpdateStatus({
    root,
    timeoutMs: params.timeoutMs,
    fetchGit: params.fetchGit,
    includeRegistry: params.includeRegistry,
    versionSourceUrl,
  });
}

export type UpdateAvailability = {
  available: boolean;
  hasGitUpdate: boolean;
  hasRegistryUpdate: boolean;
  latestVersion: string | null;
  gitBehind: number | null;
};

export function resolveUpdateAvailability(update: UpdateCheckResult): UpdateAvailability {
  const latestVersion = update.registry?.latestVersion ?? null;
  const registryCmp = latestVersion ? compareSemverStrings(VERSION, latestVersion) : null;
  const hasRegistryUpdate = registryCmp != null && registryCmp < 0;
  const gitBehind =
    update.installKind === "git" && typeof update.git?.behind === "number"
      ? update.git.behind
      : null;
  const hasGitUpdate = gitBehind != null && gitBehind > 0;

  return {
    available: hasGitUpdate || hasRegistryUpdate,
    hasGitUpdate,
    hasRegistryUpdate,
    latestVersion: hasRegistryUpdate ? latestVersion : null,
    gitBehind,
  };
}

export function formatUpdateAvailableHint(update: UpdateCheckResult): string | null {
  const availability = resolveUpdateAvailability(update);
  if (!availability.available) {
    return null;
  }

  const details: string[] = [];
  if (availability.hasGitUpdate && availability.gitBehind != null) {
    details.push(`git behind ${availability.gitBehind}`);
  }
  if (availability.hasRegistryUpdate && availability.latestVersion) {
    details.push(`${describeRegistrySource(update)} ${availability.latestVersion}`);
  }
  const suffix = details.length > 0 ? ` (${details.join(" · ")})` : "";
  const canRunUpdate = availability.hasGitUpdate || update.registry?.canUpdate !== false;
  const actionHint = canRunUpdate ? `. Run: ${formatCliCommand("openclaw update")}` : "";
  return `Update available${suffix}${actionHint}`;
}

export function formatUpdateOneLiner(update: UpdateCheckResult): string {
  const parts: string[] = [];

  const appendRegistryUpdateSummary = () => {
    const sourceLabel = describeRegistrySource(update);
    if (update.registry?.latestVersion) {
      const cmp = compareSemverStrings(VERSION, update.registry.latestVersion);
      if (cmp === 0) {
        parts.push(`${sourceLabel} latest ${update.registry.latestVersion}`);
      } else if (cmp != null && cmp < 0) {
        parts.push(`${sourceLabel} update ${update.registry.latestVersion}`);
      } else {
        parts.push(`${sourceLabel} latest ${update.registry.latestVersion} (local newer)`);
      }
      return;
    }
    if (update.registry?.error) {
      parts.push(`${sourceLabel} latest unknown`);
    }
  };

  if (update.installKind === "git" && update.git) {
    const branch = update.git.branch ? `git ${update.git.branch}` : "git";
    parts.push(branch);
    if (update.git.upstream) {
      parts.push(`↔ ${update.git.upstream}`);
    }
    if (update.git.dirty === true) {
      parts.push("dirty");
    }
    if (update.git.behind != null && update.git.ahead != null) {
      if (update.git.behind === 0 && update.git.ahead === 0) {
        parts.push("up to date");
      } else if (update.git.behind > 0 && update.git.ahead === 0) {
        parts.push(`behind ${update.git.behind}`);
      } else if (update.git.behind === 0 && update.git.ahead > 0) {
        parts.push(`ahead ${update.git.ahead}`);
      } else if (update.git.behind > 0 && update.git.ahead > 0) {
        parts.push(`diverged (ahead ${update.git.ahead}, behind ${update.git.behind})`);
      }
    }
    if (update.git.fetchOk === false) {
      parts.push("fetch failed");
    }
    appendRegistryUpdateSummary();
  } else {
    parts.push(update.packageManager !== "unknown" ? update.packageManager : "pkg");
    appendRegistryUpdateSummary();
  }

  if (update.deps) {
    if (update.deps.status === "ok") {
      parts.push("deps ok");
    }
    if (update.deps.status === "missing") {
      parts.push("deps missing");
    }
    if (update.deps.status === "stale") {
      parts.push("deps stale");
    }
  }
  return `Update: ${parts.join(" · ")}`;
}

function describeRegistrySource(update: UpdateCheckResult): string {
  return update.registry?.source === "version-source" ? "version source" : "npm";
}
