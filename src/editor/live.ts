// Other devices' edits arriving in an open editor (see RemoteUpdate in client/workspace.ts).
// The editor keeps a snapshot of its top-level blocks as last saved or received; a block that
// differs from it has unsaved local changes and is left alone, since the local save will win.

import type { BlockNoteEditor, PartialBlock } from "@blocknote/core";

// Loosely typed: the helpers work for any schema.
type AnyEditor = BlockNoteEditor<any, any, any>;
export type Snapshot = Map<string, string>;

/** The editor's top-level blocks as they are now, by id. */
export const snapshot = (editor: AnyEditor): Snapshot => new Map(editor.document.map((b) => [b.id, JSON.stringify(b)]));

/**
 * Applies a remote update to the blocks in `changed` and fixes the order of the rest. Returns
 * the new snapshot, advanced only for blocks it touched, so a block with unsaved local edits
 * stays marked as such. Call it with saving suppressed: the result is already stored.
 */
export function applyRemoteUpdate(editor: AnyEditor, update: { doc: PartialBlock[]; changed: string[] }, known: Snapshot): Snapshot {
  const wanted = new Map(update.doc.map((b) => [b.id!, b]));
  const order = update.doc.map((b) => b.id!);
  const unsaved = (id: string) => {
    const block = editor.getBlock(id);
    return !!block && known.get(id) !== JSON.stringify(block);
  };
  const next = new Map(known);
  const stored = (id: string) => next.set(id, JSON.stringify(editor.getBlock(id)));
  /** Inserts after the nearest earlier block (in the remote order) that the editor has. */
  const place = (block: PartialBlock) => {
    const before = order.slice(0, order.indexOf(block.id!)).reverse().find((id) => editor.getBlock(id));
    const first = editor.document[0];
    if (before) editor.insertBlocks([block as never], before, "after");
    else if (first) editor.insertBlocks([block as never], first, "before");
    stored(block.id!);
  };

  editor.transact(() => {
    for (const id of update.changed) {
      if (unsaved(id)) continue;
      const want = wanted.get(id);
      const have = editor.getBlock(id);
      if (have && !want) {
        editor.removeBlocks([id]);
        next.delete(id);
      } else if (have && want) {
        editor.updateBlock(id, want as never);
        stored(id);
      } else if (want) place(want);
    }
    // Blocks another device moved.
    const present = () => editor.document.map((b) => b.id).filter((id) => wanted.has(id));
    const target = order.filter((id) => editor.getBlock(id));
    if (present().join() !== target.join())
      target.forEach((id, i) => {
        if (present()[i] === id || unsaved(id)) return;
        editor.removeBlocks([id]);
        place(wanted.get(id)!);
      });
  });
  return next;
}
