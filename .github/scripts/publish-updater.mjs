#!/usr/bin/env node
// Builds latest.json from signed bundle artifacts attached to the draft release
// and uploads it. Run from .github/workflows/release.yml after every matrix
// build job has finished, or locally with DRY_RUN=1 to debug.

import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";

const tag = required("TAG");
const version = required("VERSION");
const repo = required("REPO");
const token = required("GH_TOKEN");
const dryRun = process.env.DRY_RUN === "1";

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

async function ghJson(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json"
    }
  });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

async function downloadAssetText(asset) {
  const res = await fetch(asset.url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/octet-stream"
    },
    redirect: "follow"
  });
  if (!res.ok) throw new Error(`download ${asset.name} → ${res.status}`);
  return res.text();
}

function platformFor(name) {
  if (/\.AppImage\.sig$/.test(name)) return "linux-x86_64";
  if (/\.app\.tar\.gz\.sig$/.test(name)) {
    if (/aarch64|arm64/i.test(name)) return "darwin-aarch64";
    if (/x64|x86_64/i.test(name)) return "darwin-x86_64";
    return "darwin-universal";
  }
  if (/-setup\.exe\.sig$/.test(name) || /\.nsis\.zip\.sig$/.test(name)) {
    return "windows-x86_64";
  }
  return null;
}

// /releases/tags/{tag} hides drafts; list with auth and filter instead.
// Multiple draft releases can share a tag (drafts don't create the underlying
// tag), so pick the one with the most assets — that's the latest build.
const releases = await ghJson(`/repos/${repo}/releases?per_page=100`);
const candidates = releases.filter((r) => r.tag_name === tag);
if (candidates.length === 0) {
  console.error(`No release (draft or published) found for tag ${tag}.`);
  console.error("Releases seen:", releases.map((r) => `${r.tag_name} (draft=${r.draft})`));
  process.exit(1);
}
if (candidates.length > 1) {
  console.warn(`Found ${candidates.length} releases sharing tag ${tag}:`);
  for (const c of candidates) {
    console.warn(`  - id=${c.id} draft=${c.draft} created=${c.created_at} assets=${(c.assets || []).length}`);
  }
  console.warn("Picking the one with the most assets.");
}
const release = candidates
  .slice()
  .sort((a, b) => (b.assets?.length || 0) - (a.assets?.length || 0))[0];

console.log(`Release id=${release.id} draft=${release.draft} tag=${release.tag_name}`);

// Fetch assets via the dedicated endpoint — more reliable than the inline
// assets field on the list-releases response (which can lag for drafts).
const assets = await ghJson(`/repos/${repo}/releases/${release.id}/assets?per_page=100`);
console.log(`Found ${assets.length} assets on the release:`);
for (const a of assets) console.log(`  - ${a.name}`);

if (assets.length === 0) {
  console.error(`No assets on release ${tag}. Make sure the matrix build jobs ran successfully.`);
  process.exit(1);
}

const platforms = {};
const baseDownload = `https://github.com/${repo}/releases/download/${tag}`;
const matched = [];
const skipped = [];

for (const asset of assets) {
  const platform = platformFor(asset.name);
  if (!platform) {
    skipped.push(asset.name);
    continue;
  }

  const signature = (await downloadAssetText(asset)).trim();
  const bundleName = asset.name.replace(/\.sig$/, "");
  const bundleUrl = `${baseDownload}/${encodeURIComponent(bundleName)}`;

  platforms[platform] = { signature, url: bundleUrl };
  matched.push(`${platform} ← ${asset.name}`);
}

console.log("\nMatched signatures:");
for (const m of matched) console.log(`  + ${m}`);
console.log("\nSkipped (no platform match):");
for (const s of skipped) console.log(`  - ${s}`);

if (Object.keys(platforms).length === 0) {
  console.error("\nNo signature files found among release assets.");
  console.error("Expected one of: *.AppImage.sig, *.app.tar.gz.sig, *-setup.exe.sig, *.nsis.zip.sig");
  process.exit(1);
}

const manifest = {
  version,
  notes: release.body || `GitPulse v${version}`,
  pub_date: new Date().toISOString(),
  platforms
};

const out = "latest.json";
writeFileSync(out, JSON.stringify(manifest, null, 2));
console.log(`\nWrote ${out}:`);
console.log(JSON.stringify(manifest, null, 2));

if (dryRun) {
  console.log("\nDRY_RUN=1 — skipping upload.");
  if (existsSync(out)) unlinkSync(out);
  process.exit(0);
}

try {
  execFileSync("gh", ["release", "delete-asset", tag, out, "--yes"], {
    stdio: "ignore",
    env: { ...process.env, GH_TOKEN: token }
  });
} catch {
  // not present yet
}

execFileSync("gh", ["release", "upload", tag, out, "--clobber"], {
  stdio: "inherit",
  env: { ...process.env, GH_TOKEN: token }
});

if (existsSync(out)) unlinkSync(out);
console.log("latest.json uploaded.");
