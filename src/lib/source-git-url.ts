import type { ParsedSource } from "../types/fetch.js";

import { parseSource } from "./source-parser.js";

export type GitProtocol = "ssh" | "https";

const CANONICAL_SOURCE_PATTERN =
  /^(?<owner>[A-Za-z0-9_.-]+)\/(?<repo>[A-Za-z0-9_.-]+)(?:@(?<ref>[^:]+))?(?::(?<path>.+))?$/u;

export function isCanonicalSourceSpecifier(source: string): boolean {
  return CANONICAL_SOURCE_PATTERN.test(source);
}

export function assertCanonicalSourceSpecifier(source: string): void {
  if (isCanonicalSourceSpecifier(source)) {
    return;
  }
  throw new Error(
    `Invalid declarative source: "${source}". Use canonical format only: owner/repo, owner/repo@ref, owner/repo:path, or owner/repo@ref:path.`,
  );
}

function toProtocolSpecificGitUrl(params: {
  provider: ParsedSource["provider"];
  owner: string;
  repo: string;
  gitProtocol: GitProtocol;
}): string {
  const { provider, owner, repo, gitProtocol } = params;
  const host = provider === "gitlab" ? "gitlab.com" : "github.com";
  if (gitProtocol === "https") {
    return `https://${host}/${owner}/${repo}.git`;
  }
  return `git@${host}:${owner}/${repo}.git`;
}

export function resolveGitUrlFromSource(params: {
  source: string;
  gitProtocol?: GitProtocol;
  allowRawGitUrl?: boolean;
}): { gitUrl: string; parsedSource?: ParsedSource } {
  const { source, gitProtocol = "ssh", allowRawGitUrl = false } = params;
  try {
    const parsed = parseSource(source);
    return {
      gitUrl: toProtocolSpecificGitUrl({
        provider: parsed.provider,
        owner: parsed.owner,
        repo: parsed.repo,
        gitProtocol,
      }),
      parsedSource: parsed,
    };
  } catch {
    if (allowRawGitUrl) {
      return { gitUrl: source };
    }
    throw new Error(`Unsupported source for git transport: ${source}`);
  }
}
