#!/usr/bin/env node
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execSync, spawnSync } from "child_process";

const HELP = `Usage: npm run release -- [--type=patch|minor|major] [--version=x.y.z] [--no-push] [--no-publish]

Options:
  --type=<bump>      Semver bump to apply (default: patch). Ignored if --version is provided.
  --version=<ver>    Explicit version (must be x.y.z). Overrides --type.
  --no-push          Skip git push/tag push.
  --no-publish       Skip GitHub release creation.
`;

function parseArgs() {
  const args = process.argv.slice(2);
  let bumpType = "patch";
  let explicitVersion;
  let push = true;
  let publish = true;

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(HELP);
      process.exit(0);
    }
    if (arg.startsWith("--type=")) {
      bumpType = arg.split("=")[1]?.trim();
      continue;
    }
    if (arg.startsWith("--version=")) {
      explicitVersion = arg.split("=")[1]?.trim();
      continue;
    }
    if (arg === "--no-push") {
      push = false;
      continue;
    }
    if (arg === "--no-publish") {
      publish = false;
      continue;
    }
    console.error(`Unknown option: ${arg}`);
    process.exit(1);
  }

  return { bumpType, explicitVersion, push, publish };
}

function ensureCleanGit() {
  const status = execSync("git status --porcelain", { encoding: "utf8" });
  if (status.trim().length > 0) {
    console.error("Git working tree is not clean. Commit or stash changes before releasing.");
    process.exit(1);
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function assertGhAvailable() {
  const check = spawnSync("gh", ["--version"], { stdio: "ignore" });
  return check.status === 0;
}

function loadManifestVersion() {
  const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
  return manifest.version;
}

function loadReleaseNotes(version) {
  try {
    const changelog = readFileSync("CHANGELOG.md", "utf8");
    const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`## \\[${escaped}\\][\\s\\S]*?(?=\n## \\[|$)`, "m");
    const match = changelog.match(pattern);
    if (!match) return `Release ${version}`;
    const [, ...rest] = match[0].split(/\r?\n/);
    const body = rest.join("\n").trim();
    return body.length > 0 ? body : `Release ${version}`;
  } catch (error) {
    console.warn("Unable to read CHANGELOG.md, using default release notes.");
    return `Release ${version}`;
  }
}

function createTempNotes(content) {
  const dir = mkdtempSync(join(tmpdir(), "scrippets-release-"));
  const file = join(dir, "notes.md");
  writeFileSync(file, content, "utf8");
  return { dir, file };
}

function cleanupTempNotes(dir) {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch (error) {
    // ignore cleanup errors
  }
}

(function main() {
  const { bumpType, explicitVersion, push, publish } = parseArgs();
  const allowedTypes = new Set(["patch", "minor", "major"]);

  if (explicitVersion && !/^\d+\.\d+\.\d+$/.test(explicitVersion)) {
    console.error("--version must be in the form x.y.z");
    process.exit(1);
  }
  if (!explicitVersion && !allowedTypes.has(bumpType)) {
    console.error(`--type must be one of: ${Array.from(allowedTypes).join(", ")}`);
    process.exit(1);
  }

  ensureCleanGit();

  console.log("➡️  Building bundle");
  run("npm", ["run", "build"]);

  console.log("✅ Build complete");
  run("npm", ["run", "prepublish:assets"]);

  const bumpArg = explicitVersion ?? bumpType;
  console.log(`➡️  Bumping version (${explicitVersion ? "explicit" : bumpType})`);
  run("npm", ["version", bumpArg, "--message", "chore(release): %s"]);

  const version = loadManifestVersion();
  console.log(`✅ Version set to ${version}`);

  if (push) {
    console.log("➡️  Pushing branch and tags");
    run("git", ["push", "--follow-tags"]);
  } else {
    console.log("⚠️  Skipping git push (--no-push)");
  }

  if (publish) {
    if (!assertGhAvailable()) {
      console.warn("⚠️  GitHub CLI (gh) not found; skipping release upload.");
    } else {
      const assets = ["main.js", "manifest.json"];
      if (existsSync("styles.css")) {
        assets.push("styles.css");
      }
      const notes = loadReleaseNotes(version);
      const { dir, file } = createTempNotes(notes);
      try {
        console.log("➡️  Creating GitHub release");
        run("gh", [
          "release",
          "create",
          version,
          ...assets,
          "--title",
          version,
          "--notes-file",
          file,
        ]);
        console.log("✅ GitHub release published");
      } finally {
        cleanupTempNotes(dir);
      }
    }
  } else {
    console.log("⚠️  Skipping GitHub release (--no-publish)");
  }

  console.log("🎉 Release complete");
})();
