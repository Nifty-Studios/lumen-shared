// Outline icons shared by every app. Pages store { type: "icon", name, color }; older or
// imported emoji icons are still readable and are drawn as the closest outline icon.

import type { Icon } from "../model";
import { ICON_NODES, type IconName } from "./data";

export * from "./data";

/** Color tokens for page icons. Apps resolve them per theme with iconColor(). */
export const ICON_COLORS = ["default", "gray", "brown", "orange", "yellow", "green", "teal", "blue", "purple", "pink", "red"] as const;
export type IconColor = (typeof ICON_COLORS)[number];

const COLOR_VALUES: Record<Exclude<IconColor, "default">, [light: string, dark: string]> = {
  gray: ["#787774", "#9b9a97"],
  brown: ["#9f6b53", "#ba856f"],
  orange: ["#d9730d", "#ec9a4f"],
  yellow: ["#cb912f", "#e6bb5c"],
  green: ["#448361", "#6dbb8d"],
  teal: ["#2b8a8a", "#5cc3c0"],
  blue: ["#337ea9", "#6fb3e0"],
  purple: ["#9065b0", "#b892d8"],
  pink: ["#c14c8a", "#e07cb2"],
  red: ["#d44c47", "#ef7d76"],
};

/** A concrete color for a token, or undefined for "default" (use the text color). */
export const iconColor = (token: string | undefined, dark: boolean): string | undefined => {
  const pair = COLOR_VALUES[token as keyof typeof COLOR_VALUES];
  return pair ? pair[dark ? 1 : 0] : undefined;
};

const EMOJI_ICONS: Record<string, IconName> = {
  "👋": "hand", "📄": "file-text", "📝": "notebook-pen", "📌": "pin", "💡": "lightbulb", "✅": "square-check",
  "📚": "library", "🎯": "target", "🗂": "folder", "🗂️": "folder", "🧠": "brain", "🚀": "rocket", "🌱": "sprout",
  "⭐": "star", "🌟": "star", "🔥": "flame", "🎨": "palette", "🛠": "wrench", "🛠️": "wrench", "📅": "calendar",
  "📆": "calendar", "💼": "briefcase", "🏠": "house", "🏡": "house", "✈️": "plane", "🍳": "utensils", "🎵": "guitar",
  "🎶": "guitar", "💬": "message-circle", "🔒": "lock", "📖": "book-open", "📓": "notebook-text", "📒": "notebook-text",
  "📔": "notebook-text", "📕": "book-open", "📗": "book-open", "📘": "book-open", "📙": "book-open", "🔖": "bookmark",
  "❤️": "heart", "♥️": "heart", "💖": "heart", "🏆": "trophy", "👑": "crown", "💎": "gem", "🔬": "flask-conical",
  "🧪": "flask-conical", "📈": "chart-line", "📊": "chart-line", "📰": "newspaper", "🔗": "link", "🔔": "bell",
  "😀": "face-slightly-smiling", "🙂": "face-slightly-smiling", "😊": "face-slightly-smiling", "🎉": "party-popper",
  "🐱": "cat", "🐈": "cat", "🐶": "dog", "🐕": "dog", "☀️": "sun", "🌙": "moon", "☁️": "cloud", "☂️": "umbrella",
  "⚡": "zap", "🎓": "graduation-cap", "💻": "code-xml", "🖥️": "terminal", "💰": "wallet", "💵": "wallet",
  "🛒": "shopping-cart", "🎁": "gift", "🏋️": "dumbbell", "💪": "dumbbell", "🎮": "gamepad-2", "👥": "users",
  "✉️": "mail", "📧": "mail", "📞": "phone", "🔑": "key-round", "🛡️": "shield", "🏷️": "tag", "🧩": "puzzle",
  "🔧": "wrench", "🔨": "hammer", "🌍": "globe", "🌎": "globe", "🌏": "globe", "🗺️": "map", "🧭": "compass",
  "⏰": "alarm-clock", "⏳": "hourglass", "🕒": "clock", "📋": "clipboard-list", "📁": "folder", "📂": "folder",
  "📥": "inbox", "✏️": "pen-line", "🖊️": "pen-line", "🪶": "feather", "🎧": "headphones", "📷": "camera",
  "🎬": "film", "☕": "coffee", "🍕": "pizza", "🍎": "apple", "🚗": "car", "🚲": "bike", "⛺": "tent",
  "⛰️": "mountain", "🏔️": "mountain", "🌲": "trees", "🌳": "trees", "🍃": "leaf", "🌸": "flower-2", "🌷": "flower-2",
  "🌈": "rainbow", "🌊": "waves-horizontal", "⚓": "anchor", "🔭": "telescope", "⚛️": "atom", "📦": "archive",
};

const isIconName = (name: unknown): name is IconName => typeof name === "string" && name in ICON_NODES;

/** What to draw for a page icon: an outline icon name and an optional color token. */
export function resolveIcon(icon: Icon | null | undefined, fallback: IconName = "file-text"): { name: IconName; color?: string | undefined } {
  if (icon?.type === "icon" && isIconName(icon.name)) return { name: icon.name, color: icon.color };
  if (icon?.type === "emoji") return { name: EMOJI_ICONS[icon.value] ?? EMOJI_ICONS[icon.value.replace(/️/g, "")] ?? fallback };
  return { name: fallback };
}

const escapeAttr = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** The icon as an SVG string, for DOM code (innerHTML) and react-native-svg's SvgXml. */
export function iconSvg(name: IconName, { size = 18, color = "currentColor", strokeWidth = 1.75 } = {}): string {
  const body = (ICON_NODES[name] ?? [])
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${escapeAttr(String(v))}"`).join(" ")}/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${escapeAttr(color)}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}
