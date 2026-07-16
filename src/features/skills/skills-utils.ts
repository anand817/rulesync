import { basename, dirname, join, relative } from "node:path";

import { SKILL_FILE_NAME } from "../../constants/general.js";
import {
  RULESYNC_CURATED_SKILLS_RELATIVE_DIR_PATH,
  RULESYNC_SKILLS_RELATIVE_DIR_PATH,
} from "../../constants/rulesync-paths.js";
import { directoryExists, findFilesByGlobs } from "../../utils/file.js";

export type SkillDirEntry = {
  relativeDirPath: string;
  dirName: string;
  relativeSkillDirPath: string;
};

function normalizeRelativePath(path: string): string {
  return path.replaceAll("\\", "/");
}

/**
 * Discover all local rulesync skills by finding `SKILL.md` files recursively
 * under `.rulesync/skills/`.
 * `.rulesync/skills/.curated/` is intentionally excluded.
 */
export async function getLocalSkillDirEntries(outputRoot: string): Promise<SkillDirEntry[]> {
  const skillsDir = join(outputRoot, RULESYNC_SKILLS_RELATIVE_DIR_PATH);
  if (!(await directoryExists(skillsDir))) {
    return [];
  }

  const skillFilePaths = await findFilesByGlobs(join(skillsDir, "**", SKILL_FILE_NAME), {
    type: "file",
  });

  const entries = new Map<string, SkillDirEntry>();
  const curatedPrefix = `${basename(RULESYNC_CURATED_SKILLS_RELATIVE_DIR_PATH)}/`;
  for (const skillFilePath of skillFilePaths) {
    const absoluteSkillDir = dirname(skillFilePath);
    const relativeSkillDirPath = normalizeRelativePath(relative(skillsDir, absoluteSkillDir));
    if (
      relativeSkillDirPath === basename(RULESYNC_CURATED_SKILLS_RELATIVE_DIR_PATH) ||
      relativeSkillDirPath.startsWith(curatedPrefix)
    ) {
      continue;
    }

    const dirName = basename(absoluteSkillDir);
    const parentPath = dirname(relativeSkillDirPath);
    const relativeDirPath =
      parentPath === "."
        ? RULESYNC_SKILLS_RELATIVE_DIR_PATH
        : join(RULESYNC_SKILLS_RELATIVE_DIR_PATH, parentPath);

    entries.set(relativeSkillDirPath, {
      relativeDirPath,
      dirName,
      relativeSkillDirPath,
    });
  }

  return [...entries.values()].toSorted((a, b) =>
    a.relativeSkillDirPath.localeCompare(b.relativeSkillDirPath),
  );
}

/**
 * Returns the set of local skill directory names (excluding `.curated`).
 */
export async function getLocalSkillDirNames(outputRoot: string): Promise<Set<string>> {
  const entries = await getLocalSkillDirEntries(outputRoot);
  return new Set(entries.map((entry) => entry.dirName));
}

/**
 * Resolve the effective `disable-model-invocation` value for a tool skill.
 *
 * The rulesync skill frontmatter exposes a root-level `disable-model-invocation`
 * default that applies to every tool supporting the flag (claudecode, cursor,
 * zed, pi, qwencode, factorydroid). Each tool's own section may override that
 * default with a per-target value. A defined section value (including `false`)
 * always wins over the root default.
 *
 * @returns The resolved boolean, or `undefined` when neither value is set.
 */
export function resolveDisableModelInvocation({
  rootFrontmatter,
  section,
}: {
  rootFrontmatter: { "disable-model-invocation"?: boolean };
  section: { "disable-model-invocation"?: boolean } | undefined;
}): boolean | undefined {
  return section?.["disable-model-invocation"] ?? rootFrontmatter["disable-model-invocation"];
}

/**
 * Resolve the effective `user-invocable` value for a tool skill.
 *
 * The rulesync skill frontmatter exposes a root-level `user-invocable` default
 * that applies to every tool supporting the flag (claudecode, qwencode, vibe,
 * factorydroid). Each tool's own section may override that default with a
 * per-target value. A defined section value (including `false`) always wins
 * over the root default.
 *
 * @returns The resolved boolean, or `undefined` when neither value is set.
 */
export function resolveUserInvocable({
  rootFrontmatter,
  section,
}: {
  rootFrontmatter: { "user-invocable"?: boolean };
  section: { "user-invocable"?: boolean } | undefined;
}): boolean | undefined {
  return section?.["user-invocable"] ?? rootFrontmatter["user-invocable"];
}
