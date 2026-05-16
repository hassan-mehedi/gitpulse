#!/usr/bin/env node
// Builds latest.json from signed bundle artifacts attached to the draft release
// and uploads it as a release asset. Run from the release workflow after all
// matrix build jobs have finished.

import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";

const tag = required("TAG");
const version = required("VERSION");
const repo = required("REPO");
const token = required("GH_TOKEN");

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
  // Linux AppImage updater bundle
  if (/\.AppImage\.sig$/.test(name)) return "linux-x86_64";
  // macOS .app tarball — distinguish arch from the filename
  if (/\.app\.tar\.gz\.sig$/.test(name)) {
    if (/aarch64|arm64/i.test(name)) return "darwin-aarch64";
    if (/x64|x86_64/i.test(name)) return "darwin-x86_64";
    return "darwin-universal";
  }
  // Windows NSIS installer
  if (/-setup\.exe\.sig$/.test(name) || /\.nsis\.zip\.sig$/.test(name)) {
    return "windows-x86_64";
  }
  return null;
}

const release = await ghJson(`/repos/${repo}/releases/tags/${tag}`);
const assets = release.assets || [];
if (assets.length === 0) {
  console.error(`No assets found on release ${tag}.`);
  process.exit(1);
}

const platforms = {};
const baseDownload = `https://github.com/${repo}/releases/download/${tag}`;

for (const asset of assets) {
  const platform = platformFor(asset.name);
  if (!platform) continue;

  const signature = (await downloadAssetText(asset)).trim();
  const bundleName = asset.name.replace(/\.sig$/, "");
  const bundleUrl = `${baseDownload}/${encodeURIComponent(bundleName)}`;

  platforms[platform] = {
    signature,
    url: bundleUrl
  };
  console.log(`+ ${platform}: ${bundleName}`);
}

if (Object.keys(platforms).length === 0) {
  console.error("No signature files found among release assets.");
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
console.log(`Wrote ${out}:`);
console.log(JSON.stringify(manifest, null, 2));

// Replace if it already exists on the release, then upload.
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
