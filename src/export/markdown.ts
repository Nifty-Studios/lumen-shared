// Lumen pages as plain Markdown, so a backup stays readable without Lumen.

import type { RichText } from "../model";
import { resolveIcon } from "../icons";
import { plainText } from "../text";
import type { Block } from "../schema/client";

const escape = (t: string) => t.replace(/([\\`*_[\]<>])/g, "\\$1");

export function richTextToMarkdown(rt: RichText | undefined): string {
  return (rt ?? [])
    .map((span) => {
      const marks = new Set((span.marks ?? []).map((m) => m.type));
      if (marks.has("code")) return "`" + span.text.replace(/`/g, "ˋ") + "`";
      // Keep surrounding spaces outside the markers (Markdown ignores "** bold **").
      const [, lead, body, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(span.text)!;
      let t = escape(body!);
      if (!t) return span.text;
      if (marks.has("bold")) t = `**${t}**`;
      if (marks.has("italic")) t = `_${t}_`;
      if (marks.has("strike")) t = `~~${t}~~`;
      if (marks.has("underline")) t = `<u>${t}</u>`;
      const link = span.marks?.find((m) => m.type === "link")?.value;
      if (link) t = `[${t}](${link})`;
      return lead + t + trail;
    })
    .join("")
    .replace(/\n/g, "  \n");
}

/** Markdown for one page: title, its editor blocks, then links to its sub-pages. */
export function pageToMarkdown(page: Block, blocks: Map<string, Block>, childLinks: { title: string; href: string }[] = []): string {
  const lines: string[] = [`# ${plainText(page.properties.title) || "Untitled"}`, ""];
  let numbered = 0;

  const emit = (b: Block, indent: string) => {
    const text = richTextToMarkdown(b.properties.title);
    if (b.type !== "numbered_list") numbered = 0;
    switch (b.type) {
      case "header": lines.push(`${indent}# ${text}`, ""); break;
      case "sub_header": lines.push(`${indent}## ${text}`, ""); break;
      case "sub_sub_header": lines.push(`${indent}### ${text}`, ""); break;
      case "bulleted_list": lines.push(`${indent}- ${text}`); break;
      case "numbered_list": lines.push(`${indent}${++numbered}. ${text}`); break;
      case "to_do": lines.push(`${indent}- [${b.properties.checked ? "x" : " "}] ${text}`); break;
      case "toggle": lines.push(`${indent}- ${text}`); break;
      case "quote": lines.push(`${indent}> ${text}`, ""); break;
      case "callout": lines.push(`${indent}> **${resolveIcon(b.format.callout_icon, "lightbulb").name.replace(/-/g, " ")}:** ${text}`, ""); break;
      case "code":
        lines.push(`${indent}\`\`\`${b.properties.language && b.properties.language !== "text" ? b.properties.language : ""}`);
        lines.push(...plainText(b.properties.title).split("\n").map((l) => indent + l), `${indent}\`\`\``, "");
        break;
      case "divider": lines.push(`${indent}---`, ""); break;
      case "image": {
        const src = String(b.properties.source ?? "");
        lines.push(`${indent}![${escape(plainText(b.properties.caption))}](${src.startsWith("data:") ? "embedded-image" : src})`, "");
        break;
      }
      case "page": return;
      default: lines.push(`${indent}${text}`, "");
    }
    const kids = b.content.map((id) => blocks.get(id)).filter((c): c is Block => !!c && c.alive);
    if (kids.length) {
      const deeper = indent + (b.type === "numbered_list" ? "   " : "  ");
      const saved = numbered;
      numbered = 0;
      for (const k of kids) emit(k, deeper);
      numbered = saved;
    }
    const list = b.type === "bulleted_list" || b.type === "numbered_list" || b.type === "to_do" || b.type === "toggle";
    if (list && indent === "") {
      const next = page.content[page.content.indexOf(b.id) + 1];
      const nextBlock = next ? blocks.get(next) : undefined;
      if (!nextBlock || !["bulleted_list", "numbered_list", "to_do", "toggle"].includes(nextBlock.type)) lines.push("");
    }
  };

  for (const id of page.content) {
    const b = blocks.get(id);
    if (b && b.alive) emit(b, "");
  }
  if (childLinks.length) {
    lines.push("", "## Pages inside", "");
    for (const c of childLinks) lines.push(`- [${escape(c.title)}](${encodeURI(c.href)})`);
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
