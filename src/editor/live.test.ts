import { describe, expect, it } from "vitest";
import { BlockNoteEditor, type PartialBlock } from "@blocknote/core";
import { applyRemoteUpdate, snapshot } from "./live";

const para = (id: string, text: string): PartialBlock => ({ id, type: "paragraph", content: text });
const texts = (editor: BlockNoteEditor) => editor.document.map((b) => `${b.id}:${(b.content as { text: string }[])[0]?.text ?? ""}`);

describe("remote updates in an open editor", () => {
  const setup = () => {
    const editor = BlockNoteEditor.create({ initialContent: [para("a", "one"), para("b", "two"), para("c", "three")] });
    return { editor, known: snapshot(editor) };
  };

  it("updates, adds, removes and reorders blocks", () => {
    const { editor, known } = setup();
    const doc = [para("c", "three"), para("a", "one (remote)"), para("d", "new")];
    applyRemoteUpdate(editor, { doc, changed: ["a", "b", "d"] }, known);
    expect(texts(editor)).toEqual(["c:three", "a:one (remote)", "d:new"]);
  });

  it("leaves a block with unsaved local changes alone", () => {
    const { editor, known } = setup();
    editor.updateBlock("b", { content: "two (typing…)" });
    const next = applyRemoteUpdate(editor, { doc: [para("a", "one"), para("b", "two (remote)"), para("c", "three")], changed: ["b"] }, known);
    expect(texts(editor)).toEqual(["a:one", "b:two (typing…)", "c:three"]);
    expect(next.get("b")).not.toContain("typing"); // still unsaved, so a later update skips it too
  });
});
