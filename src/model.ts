// Core record types. Shape is a slimmed-down Notion model: every record has an id,
// a parent pointer, a soft-delete flag and timestamps. Rows are stored as-is in
// SQLite (JSON columns as TEXT) and changed only through ops (see ops.ts).

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export const TABLES = ["space", "block", "collection", "collection_view"] as const;
export type TableName = (typeof TABLES)[number];

export type ParentTable = "space" | "block" | "collection";

export const BLOCK_TYPES = [
  "page",
  "text",
  "header",
  "sub_header",
  "sub_sub_header",
  "bulleted_list",
  "numbered_list",
  "to_do",
  "toggle",
  "quote",
  "callout",
  "code",
  "divider",
  "image",
  // v1.5
  "collection_view_page",
  "collection_view",
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export type MarkType = "bold" | "italic" | "underline" | "strike" | "code" | "link" | "color" | "background";

// Type aliases (not interfaces) so they stay assignable to Json.
export type Mark = {
  type: MarkType;
  /** href for `link`, color token for `color` / `background`. */
  value?: string;
};

export type TextSpan = {
  text: string;
  marks?: Mark[];
};

export type RichText = TextSpan[];

export type Icon = { type: "emoji"; value: string } | { type: "file"; file_id: string };

export interface BlockProperties {
  title?: RichText;
  /** to_do */
  checked?: boolean;
  /** code */
  language?: string;
  /** image */
  source?: string;
  caption?: RichText;
  /** Collection rows: property id -> value. */
  [propertyId: string]: Json | undefined;
}

export interface BlockFormat {
  icon?: Icon;
  cover?: string;
  color?: string;
  background?: string;
  align?: "left" | "center" | "right" | "justify";
  /** callout */
  callout_icon?: Icon;
  page_full_width?: boolean;
  [key: string]: Json | undefined;
}

export type CollectionPropertyType =
  | "title"
  | "text"
  | "number"
  | "select"
  | "multi_select"
  | "date"
  | "checkbox"
  | "url"
  | "relation";

export interface SelectOption {
  id: string;
  value: string;
  color?: string;
}

export interface CollectionProperty {
  name: string;
  type: CollectionPropertyType;
  options?: SelectOption[];
  /** relation: target collection id */
  collection_id?: string;
}

export type CollectionSchema = Record<string, CollectionProperty>;

export type CollectionViewType = "table" | "board" | "list";

export interface CollectionViewQuery {
  filters?: Json[];
  sorts?: { property: string; direction: "asc" | "desc" }[];
  group_by?: string;
}

export interface CollectionViewFormat {
  visible_properties?: string[];
  property_widths?: Record<string, number>;
  [key: string]: Json | undefined;
}
