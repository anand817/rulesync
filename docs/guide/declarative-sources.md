# Declarative Sources

Rulesync can fetch rules, commands, subagents, and skills from external repositories using the `install` command. Instead of manually running `fetch` for each source, declare selectors in your `rulesync.jsonc` and run `rulesync install`. Typical workflow: `rulesync install && rulesync generate`.

## Configuration

Add a `sources` array to your `rulesync.jsonc`:

```jsonc
{
  "$schema": "https://github.com/dyoshikawa/rulesync/releases/latest/download/config-schema.json",
  "targets": ["copilot", "claudecode"],
  "features": ["rules", "skills"],
  "sources": [
    // Fetch all skills from a GitHub repository (default transport)
    { "source": "owner/repo" },

    // Fetch selected skills by path (directory or file path)
    {
      "source": "anthropics/skills",
      "skills": { "paths": ["skill-creator"] },
    },

    // Fetch selected rules/commands/subagents by path selectors
    {
      "source": "owner/shared-catalog@v1.2.0",
      "rules": { "paths": ["core", "languages/python"] },
      "commands": { "paths": ["review"] },
      "subagents": { "paths": ["research/planner.md"] },
    },

    // With ref pinning and subdirectory path (same syntax as fetch command)
    { "source": "owner/repo@v1.0.0:path/to/skills" },

    // Git transport with canonical source and explicit protocol
    {
      "source": "owner/private-catalog",
      "transport": "git",
      "gitProtocol": "https",
      "ref": "main",
      "path": ".rulesync/skills",
    },

    // Git transport with full git URL
    {
      "source": "https://dev.azure.com/org/project/_git/repo",
      "transport": "git",
      "ref": "main",
      "path": "exports/skills",
    },

    // Git transport with a local repository
    { "source": "file:///path/to/local/repo", "transport": "git" },

    // Git transport against a single-skill repo whose SKILL.md is at the root
    {
      "source": "feature-sliced/skills",
      "transport": "git",
      "path": ".",
    },
  ],
}
```

Each entry in `sources` accepts:

| Property      | Type     | Description                                                                                                                                                                                                 |
| ------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `source`      | `string` | Repository source. Supports canonical (`owner/repo`, `owner/repo@ref:path`) and URL/scp/file formats (for `transport: "git"`).                                                                              |
| `rules`       | `object` | Optional selector for `rules/` with `{ paths?: string[] }`. `paths` entries can be directory prefixes or exact file paths.                                                                                  |
| `commands`    | `object` | Optional selector for `commands/` with `{ paths?: string[] }`. `paths` entries can be directory prefixes or exact file paths.                                                                               |
| `subagents`   | `object` | Optional selector for `subagents/` with `{ paths?: string[] }`. `paths` entries can be directory prefixes or exact file paths.                                                                              |
| `skills`      | `object` | Optional selector for `skills/` with `{ paths?: string[] }`. Install fetches skills only when this selector is present and has explicit `paths`.                                                            |
| `transport`   | `string` | `"github"` (default) uses the GitHub REST API. `"git"` uses git CLI and accepts canonical or raw git URLs.                                                                                                  |
| `gitProtocol` | `string` | Optional when `transport: "git"`. `"ssh"` (default) generates `git@github.com:owner/repo.git`; `"https"` generates `https://github.com/owner/repo.git`.                                                     |
| `ref`         | `string` | Branch, tag, or ref to fetch from. Defaults to the remote's default branch. For GitHub transport, use the `@ref` source syntax.                                                                             |
| `path`        | `string` | Path to the feature directory root in the repository. Defaults to `.rulesync` (so features are read from `.rulesync/rules`, `.rulesync/skills`, etc.). For GitHub transport, use the `:path` source syntax. |

> **Repository-root paths (`path: "."`):** When `path` is `""`, `"."`, or `"./"` (with the `git` transport), rulesync disables sparse-checkout and fetches the **entire** repository tree, then groups each top-level directory as a skill. This is useful for single-skill repositories whose `SKILL.md` lives at the repo root (`<repo>/SKILL.md`) rather than under a `skills/` container. Because the whole tree is fetched, prefer a narrower `path` for large repositories; the fetch is still bounded by rulesync's file-count, total-size, and depth limits.

## How It Works

When `rulesync install` runs and `sources` is configured:

1. **Lockfile resolution** — Each source's ref is resolved to a commit SHA and stored in `rulesync.lock` (at the project root). On subsequent runs the locked SHA is reused for deterministic builds.
2. **Entity selection** — Each source entry fetches only entities whose selectors are declared (`rules`, `commands`, `subagents`, `skills`). If a source entry declares no selectors, nothing is fetched.
3. **Explicit selectors only** — Empty selectors (for example, `skills: {}`) fetch nothing. Wildcards are honored only when explicitly declared (for example, `skills: { "paths": ["*"] }`).
4. **Remote skill listing** — `.rulesync/skills` is listed only when the `skills` selector is declared for that source with explicit `paths`.
5. **Filtering** — Per-feature selectors use `paths` only. Each path may target a directory subtree or a specific file.
6. **Precedence rules**:
   - **Local skills always win** — Skills in `.rulesync/skills/` (not in `.curated/`) take precedence; a remote skill with the same name is skipped.
   - **First-declared source wins** — If two sources provide a skill with the same name, the one declared first in the `sources` array is used.
7. **Output** — Fetched skills are written to `.rulesync/skills/.curated/<skill-name>/`. This directory is automatically added to `.gitignore` by `rulesync gitignore`.

## Install Modes

`rulesync install` supports three install modes via `--mode <mode>`:

| Mode       | Manifest input               | Lockfile                 | Skill output layout                                                          |
| ---------- | ---------------------------- | ------------------------ | ---------------------------------------------------------------------------- |
| `rulesync` | `rulesync.jsonc` `sources`   | `rulesync.lock`          | `.rulesync/skills/.curated/<name>/` (then re-emitted by `rulesync generate`) |
| `apm`      | `apm.yml` `dependencies.apm` | `rulesync-apm.lock.yaml` | `.github/instructions/`, `.github/skills/` (APM v1 layout)                   |
| `gh`       | `rulesync.jsonc` `sources`   | `rulesync-gh.lock.yaml`  | Per-agent / per-scope dirs (matching `gh skill install`)                     |

When `--mode` is omitted, rulesync defaults to `rulesync` mode. If `apm.yml` is present and `sources` is also defined, you must pass `--mode apm` or `--mode rulesync` to disambiguate.

### `--mode gh` — gh-skill-install–compatible layout

`--mode gh` reads the same `sources` array from `rulesync.jsonc` but writes each discovered skill into the agent-specific directory expected by `gh skill install`. Each source supports two extra fields:

| Property | Type     | Default          | Description                                                                               |
| -------- | -------- | ---------------- | ----------------------------------------------------------------------------------------- |
| `agent`  | `string` | `github-copilot` | One of `github-copilot`, `claude-code`, `cursor`, `codex`, `gemini`, `antigravity`.       |
| `scope`  | `string` | `project`        | `project` writes inside the project root; `user` writes inside the user's home directory. |

Agent → install directory mapping:

| Agent            | Project scope (relative to project root) | User scope (relative to home) |
| ---------------- | ---------------------------------------- | ----------------------------- |
| `github-copilot` | `.agents/skills`                         | `.copilot/skills`             |
| `claude-code`    | `.claude/skills`                         | `.claude/skills`              |
| `cursor`         | `.agents/skills`                         | `.cursor/skills`              |
| `codex`          | `.agents/skills`                         | `.agents/skills`              |
| `gemini`         | `.agents/skills`                         | `.gemini/skills`              |
| `antigravity`    | `.agents/skills`                         | `.gemini/antigravity/skills`  |

For each skill discovered as `skills/<name>/SKILL.md` in the remote repository, rulesync deploys the entire skill directory to `<install-dir>/<name>/` and injects a provenance frontmatter block (`source`, `repository`, `ref`) into the deployed `SKILL.md`. The lockfile `rulesync-gh.lock.yaml` records one entry per `(source, agent, scope, skill)` tuple.

Per-source field support in `--mode gh`:

| Field       | Status                                                                                                                                       |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `source`    | Required. Canonical GitHub source only (`owner/repo`, `owner/repo@ref`, `owner/repo:path`, `owner/repo@ref:path`).                           |
| `skills`    | Optional. Uses selector shape `{ paths?: string[] }`. In gh mode `skills.paths` is used for skill-name selection.                            |
| `ref`       | Optional. Pins a tag, branch, or commit SHA. When omitted, gh mode resolves to the latest release's tag, falling back to the default branch. |
| `agent`     | Optional. Defaults to `github-copilot`. See the agent table above.                                                                           |
| `scope`     | Optional. Defaults to `project`.                                                                                                             |
| `transport` | **Rejected.** gh mode is GitHub-only and does not honor the `git` transport. Drop the field or switch to `--mode rulesync`.                  |
| `path`      | **Rejected.** The remote layout is fixed to `skills/<name>/SKILL.md`. Repositories that store skills elsewhere are not supported in gh mode. |

The remote repository must use the layout `skills/<name>/SKILL.md` (one directory per skill, each containing a `SKILL.md`). Other layouts are not auto-discovered.

Example `rulesync.jsonc`:

```jsonc
{
  "targets": ["claudecode"],
  "features": ["rules"],
  "sources": [
    // Default: agent=github-copilot, scope=project -> .agents/skills/git-commit/
    { "source": "acme/skills", "skills": { "paths": ["git-commit"] } },

    // Same source, deployed for Claude Code at user scope -> ~/.claude/skills/git-commit/
    {
      "source": "acme/skills",
      "skills": { "paths": ["git-commit"] },
      "agent": "claude-code",
      "scope": "user",
    },
  ],
}
```

Run with `npx rulesync install --mode gh`.

## CLI Options

The `install` command accepts these flags:

| Flag              | Description                                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--mode <mode>`   | Install mode: `rulesync` (default), `apm`, or `gh`. See **Install Modes** above.                                                                             |
| `--update`        | Force re-resolve all source refs, ignoring the lockfile (useful to pull new updates).                                                                        |
| `--frozen`        | Fail if lockfile is missing or out of sync. Fetches missing skills using locked refs without updating the lockfile. Useful for CI to ensure reproducibility. |
| `--token <token>` | GitHub token for private repositories.                                                                                                                       |

```bash
# Install skills using locked refs
rulesync install

# Force update to latest refs
rulesync install --update

# Strict CI mode — fail if lockfile doesn't cover all sources (missing locked skills are fetched)
rulesync install --frozen

# Install then generate
rulesync install && rulesync generate

# Skip source installation — just don't run install
rulesync generate
```

## Lockfile

The lockfile at `rulesync.lock` (at the project root) records the resolved commit SHA and per-skill integrity hashes for each source so that builds are reproducible. It is safe to commit this file. An example:

```json
{
  "lockfileVersion": 1,
  "sources": {
    "owner/skill-repo": {
      "requestedRef": "main",
      "resolvedRef": "abc123def456...",
      "resolvedAt": "2025-01-15T12:00:00.000Z",
      "skills": {
        "my-skill": { "integrity": "sha256-abcdef..." },
        "another-skill": { "integrity": "sha256-123456..." }
      }
    }
  }
}
```

To update locked refs, run `rulesync install --update`.

## Authentication

GitHub transport uses the `GITHUB_TOKEN` or `GH_TOKEN` environment variable for authentication. This is required for private repositories and recommended for better rate limits. Git transport relies on your local git credential configuration (SSH keys, credential helpers, etc.).

```bash
# Using environment variable
export GITHUB_TOKEN=ghp_xxxx
npx rulesync install

# Or using GitHub CLI
GITHUB_TOKEN=$(gh auth token) npx rulesync install
```

> [!TIP]
> The `install` command also accepts a `--token` flag for explicit authentication: `rulesync install --token ghp_xxxx`.

## Curated vs Local Skills

| Location                            | Type    | Precedence | Committed to Git |
| ----------------------------------- | ------- | ---------- | ---------------- |
| `.rulesync/skills/<name>/`          | Local   | Highest    | Yes              |
| `.rulesync/skills/.curated/<name>/` | Curated | Lower      | No (gitignored)  |

When both a local and a curated skill share the same name, the local skill is used and the remote one is not fetched.
