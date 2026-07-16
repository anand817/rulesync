import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { RULESYNC_SKILLS_RELATIVE_DIR_PATH } from "../../constants/rulesync-paths.js";
import { setupTestDirectory } from "../../test-utils/test-directories.js";
import { ensureDir, writeFileContent } from "../../utils/file.js";
import {
  getLocalSkillDirEntries,
  resolveDisableModelInvocation,
  resolveUserInvocable,
} from "./skills-utils.js";

describe("resolveDisableModelInvocation", () => {
  it("returns the section value when it is set", () => {
    expect(
      resolveDisableModelInvocation({
        rootFrontmatter: { "disable-model-invocation": false },
        section: { "disable-model-invocation": true },
      }),
    ).toBe(true);
  });

  it("lets a false section value override a true root value", () => {
    expect(
      resolveDisableModelInvocation({
        rootFrontmatter: { "disable-model-invocation": true },
        section: { "disable-model-invocation": false },
      }),
    ).toBe(false);
  });

  it("falls back to the root value when the section omits the key", () => {
    expect(
      resolveDisableModelInvocation({
        rootFrontmatter: { "disable-model-invocation": true },
        section: {},
      }),
    ).toBe(true);
  });

  it("falls back to the root value when the section is undefined", () => {
    expect(
      resolveDisableModelInvocation({
        rootFrontmatter: { "disable-model-invocation": true },
        section: undefined,
      }),
    ).toBe(true);
  });

  it("returns undefined when neither value is set", () => {
    expect(
      resolveDisableModelInvocation({
        rootFrontmatter: {},
        section: undefined,
      }),
    ).toBeUndefined();
  });
});

describe("resolveUserInvocable", () => {
  it("returns the section value when it is set", () => {
    expect(
      resolveUserInvocable({
        rootFrontmatter: { "user-invocable": true },
        section: { "user-invocable": false },
      }),
    ).toBe(false);
  });

  it("lets a false section value override a true root value", () => {
    expect(
      resolveUserInvocable({
        rootFrontmatter: { "user-invocable": true },
        section: { "user-invocable": false },
      }),
    ).toBe(false);
  });

  it("falls back to the root value when the section omits the key", () => {
    expect(
      resolveUserInvocable({
        rootFrontmatter: { "user-invocable": false },
        section: {},
      }),
    ).toBe(false);
  });

  it("falls back to the root value when the section is undefined", () => {
    expect(
      resolveUserInvocable({
        rootFrontmatter: { "user-invocable": false },
        section: undefined,
      }),
    ).toBe(false);
  });

  it("returns undefined when neither value is set", () => {
    expect(
      resolveUserInvocable({
        rootFrontmatter: {},
        section: undefined,
      }),
    ).toBeUndefined();
  });
});

describe("getLocalSkillDirEntries", () => {
  it("discovers nested local skills and skips .curated", async () => {
    const { testDir, cleanup } = await setupTestDirectory();
    try {
      const localSkillDir = join(testDir, RULESYNC_SKILLS_RELATIVE_DIR_PATH, "core", "review");
      const curatedSkillDir = join(
        testDir,
        RULESYNC_SKILLS_RELATIVE_DIR_PATH,
        ".curated",
        "remote-skill",
      );
      await ensureDir(localSkillDir);
      await ensureDir(curatedSkillDir);
      await writeFileContent(join(localSkillDir, "SKILL.md"), "local");
      await writeFileContent(join(curatedSkillDir, "SKILL.md"), "curated");

      const entries = await getLocalSkillDirEntries(testDir);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual({
        relativeDirPath: join(".rulesync", "skills", "core"),
        dirName: "review",
        relativeSkillDirPath: "core/review",
      });
    } finally {
      await cleanup();
    }
  });
});
