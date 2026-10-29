// Backups: one .zip with the complete op history (ops.jsonl) plus every page as Markdown.
// Restoring replays the ops through the normal merge, so it is exact, idempotent, and safe
// on a device that already has notes: both sets simply merge, with no server needed.

import { asc } from "drizzle-orm";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { Op } from "../ops";
import { opSchema } from "../sync";
import { plainText } from "../text";
import { ops as opsTable } from "../schema/client";
import { pageToMarkdown } from "../export/markdown";
import type { LocalStore } from "./store";
import type { PageNode, Workspace } from "./workspace";

export const BACKUP_FORMAT = "lumen-backup";
export const BACKUP_VERSION = 1;
const MANIFEST = "lumen-backup.json";
const OPS_FILE = "ops.jsonl";
const RESTORE_CHUNK = 1000;

export interface BackupManifest {
  format: typeof BACKUP_FORMAT;
  version: number;
  app: "Lumen";
  created_at: number;
  device_id: string;
  ops: number;
  pages: number;
}

const README = `Lumen backup
============

This file holds your whole Lumen workspace.

  ops.jsonl           Every change ever made, which is what Lumen restores from.
  pages/              Each page as a Markdown file, readable in any text editor.
  lumen-backup.json   What this backup contains.

To restore: open Lumen > Settings > Data > Restore from a backup, and pick this zip.
It works offline and merges with whatever is already on the device.
`;

const safeName = (title: string) =>
  title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").replace(/\s+/g, " ").trim().slice(0, 80).replace(/[. ]+$/, "") || "Untitled";

export const backupFileName = (now = new Date()) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `lumen-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.zip`;
};

export async function exportBackup(store: LocalStore, workspace: Workspace, now = Date.now()) {
  const rows = await store.db.select().from(opsTable).orderBy(asc(opsTable.hlc));
  const ops = rows.map(({ table_name, synced: _, ...op }) => ({ ...op, table: table_name }));
  const files: Record<string, Uint8Array> = {
    [OPS_FILE]: strToU8(ops.map((o) => JSON.stringify(o)).join("\n")),
    "README.txt": strToU8(README),
  };

  // Readable copies: pages/Title.md, sub-pages in pages/Title/Child.md.
  let pages = 0;
  const space = await workspace.getSpace();
  if (space) {
    const writeLevel = async (nodes: PageNode[], dir: string) => {
      const used = new Set<string>();
      const names = nodes.map((n) => {
        const base = safeName(plainText(n.page.properties.title));
        let name = base;
        for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base} (${i})`;
        used.add(name.toLowerCase());
        return name;
      });
      for (const [i, node] of nodes.entries()) {
        const name = names[i]!;
        const childNames = new Set<string>();
        const links = node.children.map((c) => {
          const base = safeName(plainText(c.page.properties.title));
          let n = base;
          for (let k = 2; childNames.has(n.toLowerCase()); k++) n = `${base} (${k})`;
          childNames.add(n.toLowerCase());
          return { title: plainText(c.page.properties.title) || "Untitled", href: `${name}/${n}.md` };
        });
        const blocks = await workspace.loadPageBlocks(node.page.id);
        files[`${dir}${name}.md`] = strToU8(pageToMarkdown(node.page, blocks, links));
        pages++;
        if (node.children.length) await writeLevel(node.children, `${dir}${name}/`);
      }
    };
    await writeLevel(await workspace.pageTree(space), "pages/");
  }

  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    app: "Lumen",
    created_at: now,
    device_id: store.deviceId,
    ops: ops.length,
    pages,
  };
  files[MANIFEST] = strToU8(JSON.stringify(manifest, null, 2));
  const bytes = zipSync(files, { level: 6, mtime: new Date(now) });
  return { bytes, fileName: backupFileName(new Date(now)), manifest };
}

export class NotABackupError extends Error {}

/** Reads and checks a backup without changing anything. */
export function readBackup(bytes: Uint8Array): { manifest: BackupManifest; ops: Op[] } {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new NotABackupError("This file isn't a zip, so it can't be a Lumen backup.");
  }
  const raw = entries[MANIFEST];
  if (!raw) {
    const looksNotion = Object.keys(entries).some((n) => /\s[0-9a-f]{32}\.(md|csv)$/i.test(n) || n.toLowerCase().endsWith(".zip"));
    throw new NotABackupError(
      looksNotion ? "This looks like a Notion export. Use “Import from Notion” instead." : "This zip isn't a Lumen backup (it has no lumen-backup.json).",
    );
  }
  const manifest = JSON.parse(strFromU8(raw)) as BackupManifest;
  if (manifest.format !== BACKUP_FORMAT) throw new NotABackupError("This zip isn't a Lumen backup.");
  if (manifest.version > BACKUP_VERSION) throw new NotABackupError("This backup was made by a newer version of Lumen. Update Lumen, then try again.");
  const lines = strFromU8(entries[OPS_FILE] ?? new Uint8Array()).split("\n").filter((l) => l.trim());
  const ops = lines.map((l) => opSchema.parse(JSON.parse(l)) as Op).sort((a, b) => (a.hlc < b.hlc ? -1 : a.hlc > b.hlc ? 1 : 0));
  return { manifest, ops };
}

/**
 * Merges a backup into this device. Restored ops count as unsynced so they also reach the
 * sync server, if there is one (it ignores ops it already has).
 */
export async function restoreBackup(store: LocalStore, bytes: Uint8Array, onProgress?: (done: number, total: number) => void) {
  const { manifest, ops } = readBackup(bytes);
  for (let i = 0; i < ops.length; i += RESTORE_CHUNK) {
    await store.commit(ops.slice(i, i + RESTORE_CHUNK), { remote: true, synced: false });
    onProgress?.(Math.min(i + RESTORE_CHUNK, ops.length), ops.length);
  }
  return { ops: ops.length, pages: manifest.pages, createdAt: manifest.created_at };
}
