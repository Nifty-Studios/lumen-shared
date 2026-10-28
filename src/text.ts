import type { RichText } from "./model";

export const plainText = (rt: RichText | null | undefined): string => (rt ?? []).map((s) => s.text).join("");

export const richText = (text: string): RichText => (text ? [{ text }] : []);

/**
 * Text indexed by the block_fts table. Derived locally on every device and never
 * synced, so recompute it whenever a block's properties change.
 */
export function deriveSearchText(properties: { title?: RichText; caption?: RichText } | null | undefined): string {
  if (!properties) return "";
  return [plainText(properties.title), plainText(properties.caption)].filter(Boolean).join("\n");
}
