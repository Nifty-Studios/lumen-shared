// Publishes a release build to Cloudflare R2 (bucket lumen-downloads) and refreshes the
// download page. Each build goes up twice: versioned, and as the stable "latest" link.
//   node publish-download.mjs --platform windows|android --file <path> --version 1.0.0
// Needs wrangler logged in (`npx wrangler login`).

import { execFileSync } from "node:child_process";
import { mkdtempSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

const BUCKET = "lumen-downloads";
export const BASE = "https://pub-069d921642c646cd94244c50a3494c14.r2.dev";
const LATEST = { windows: "Lumen-Setup.exe", android: "Lumen.apk" };
const TYPES = { ".exe": "application/vnd.microsoft.portable-executable", ".apk": "application/vnd.android.package-archive" };

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
const { platform, file, version } = args;
if (!LATEST[platform] || !file || !version) throw new Error("Usage: --platform windows|android --file <path> --version <x.y.z>");

const put = (key, path, type) =>
  execFileSync("npx", ["--yes", "wrangler@4", "r2", "object", "put", `${BUCKET}/${key}`, "--file", path, "--content-type", type, "--remote"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

const ext = file.slice(file.lastIndexOf("."));
const versioned = `${platform}/${LATEST[platform].replace(ext, `-${version}${ext}`)}`;
console.log(`Uploading ${basename(file)} (${(statSync(file).size / 1e6).toFixed(1)} MB) as ${versioned} and ${LATEST[platform]}`);
put(versioned, file, TYPES[ext]);
put(LATEST[platform], file, TYPES[ext]);

// The manifest: the latest version and size per platform, which the page is built from.
const manifest = await fetch(`${BASE}/manifest.json`, { cache: "no-store" })
  .then((r) => (r.ok ? r.json() : {}))
  .catch(() => ({}));
manifest[platform] = { version, file: LATEST[platform], versioned, bytes: statSync(file).size, date: new Date().toISOString().slice(0, 10) };

const dir = mkdtempSync(join(tmpdir(), "lumen-publish-"));
writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
writeFileSync(join(dir, "index.html"), page(manifest));
put("manifest.json", join(dir, "manifest.json"), "application/json");
put("index.html", join(dir, "index.html"), "text/html"); // the page declares utf-8 itself
console.log(`\nDownload page: ${BASE}/index.html\n${platform}: ${BASE}/${LATEST[platform]}`);

function page(m) {
  const card = (key, title, note, icon) => {
    const r = m[key];
    if (!r) return "";
    return `<a class="card" href="${r.file}" download>
      <span class="icon">${icon}</span>
      <span class="text"><b>${title}</b><span>${note} · v${r.version} · ${(r.bytes / 1e6).toFixed(1)} MB · ${r.date}</span></span>
      <span class="get">Download</span>
    </a>`;
  };
  const win = `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`;
  const phone = `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/></svg>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Download Lumen</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; font-family: Inter, system-ui, sans-serif; color: #f5f3ee;
    background: radial-gradient(circle at 82% 12%, rgba(255,205,140,.45), rgba(255,205,140,0) 26%), linear-gradient(180deg, #1b2550 0%, #5a4a7a 62%, #f09a6b 130%);
    display: grid; place-items: center; padding: 24px 16px; }
  .sun { position: fixed; right: 9vw; top: 7vh; width: 92px; height: 92px; border-radius: 50%;
    background: radial-gradient(circle at 40% 38%, #fffdf3, #fff0c8 55%, #ffc98a); box-shadow: 0 0 90px 30px rgba(255,200,140,.35); }
  main { position: relative; width: min(520px, 100%); padding: 36px 28px 28px; border-radius: 28px;
    background: rgba(16,20,40,.42); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); box-shadow: 0 30px 80px -20px rgba(0,0,0,.5); }
  h1 { font-family: Fraunces, Georgia, serif; font-weight: 600; font-size: 46px; margin: 0; letter-spacing: -.02em; }
  p { color: rgba(245,243,238,.75); line-height: 1.55; margin: 8px 0 24px; }
  .card { display: flex; align-items: center; gap: 14px; padding: 14px 16px; margin-top: 10px; border-radius: 18px;
    background: rgba(255,255,255,.08); color: inherit; text-decoration: none; transition: background .2s; }
  .card:hover { background: rgba(255,255,255,.14); }
  .icon { display: grid; place-items: center; width: 46px; height: 46px; border-radius: 14px; background: rgba(140,170,255,.18); color: #b9cbff; flex: none; }
  .text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .text span { font-size: 13px; color: rgba(245,243,238,.6); }
  .get { padding: 8px 14px; border-radius: 12px; background: #8ab4ff; color: #0b0c1a; font-weight: 500; font-size: 14px; }
  small { display: block; margin-top: 18px; color: rgba(245,243,238,.55); font-size: 12.5px; line-height: 1.5; }
</style></head>
<body><div class="sun"></div>
<main>
  <h1>Lumen</h1>
  <p>Your notes, under your own sky. Works offline, syncs between your devices, and shares with whoever you choose.</p>
  ${card("windows", "Windows", "Installer", win)}
  ${card("android", "Android", "Phone app", phone)}
  <small>Windows may warn that the installer is from an unknown publisher: choose “More info”, then “Run anyway”. On Android, allow installing from your browser when asked.</small>
</main></body></html>`;
}
