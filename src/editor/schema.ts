// The BlockNote schema every Lumen editor uses (desktop and the mobile webview): only the
// block types Lumen can store, plus a callout block. Keep it in sync with convert.ts.

import {
  BlockNoteSchema,
  createBlockSpec,
  createHeadingBlockSpec,
  defaultBlockSpecs,
  defaultProps,
} from "@blocknote/core";
import { iconSvg, type IconName } from "../icons";

/** Icons a callout cycles through when its icon is clicked. */
export const CALLOUT_ICONS: IconName[] = ["lightbulb", "info", "triangle-alert", "circle-check", "star", "flame", "heart", "bookmark", "pin", "sparkles"];

export const createCalloutBlockSpec = createBlockSpec(
  {
    type: "callout" as const,
    propSchema: {
      backgroundColor: defaultProps.backgroundColor,
      textColor: defaultProps.textColor,
      icon: { default: "lightbulb" as string },
    },
    content: "inline" as const,
  },
  {
    render(block, editor) {
      const dom = document.createElement("div");
      dom.className = "lumen-callout";
      const icon = document.createElement("button");
      icon.type = "button";
      icon.contentEditable = "false";
      icon.className = "lumen-callout-icon";
      icon.title = "Change icon";
      let current = String(block.props.icon);
      icon.innerHTML = iconSvg(current as IconName, { size: 18 });
      icon.addEventListener("mousedown", (e) => {
        e.preventDefault();
        if (!editor.isEditable) return;
        const next = CALLOUT_ICONS[(CALLOUT_ICONS.indexOf(current as IconName) + 1) % CALLOUT_ICONS.length]!;
        editor.updateBlock(block.id, { props: { icon: next } });
      });
      const content = document.createElement("div");
      content.className = "lumen-callout-content";
      dom.append(icon, content);
      return {
        dom,
        contentDOM: content,
        update(node) {
          const next = String(node.attrs.icon ?? "lightbulb");
          if (next !== current) {
            current = next;
            icon.innerHTML = iconSvg(next as IconName, { size: 18 });
          }
          return true;
        },
      };
    },
    parse(element) {
      return element.tagName === "ASIDE" ? {} : undefined;
    },
    toExternalHTML() {
      const dom = document.createElement("aside");
      return { dom, contentDOM: dom };
    },
  },
);

export const lumenSchema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph: defaultBlockSpecs.paragraph,
    // Loosely typed: its optional isToggleable prop trips exactOptionalPropertyTypes.
    heading: createHeadingBlockSpec({ levels: [1, 2, 3], allowToggleHeadings: false }) as any,
    quote: defaultBlockSpecs.quote,
    bulletListItem: defaultBlockSpecs.bulletListItem,
    numberedListItem: defaultBlockSpecs.numberedListItem,
    checkListItem: defaultBlockSpecs.checkListItem,
    toggleListItem: defaultBlockSpecs.toggleListItem,
    codeBlock: defaultBlockSpecs.codeBlock,
    divider: defaultBlockSpecs.divider,
    image: defaultBlockSpecs.image,
    callout: createCalloutBlockSpec(),
  },
});

export type LumenEditorSchema = typeof lumenSchema;
