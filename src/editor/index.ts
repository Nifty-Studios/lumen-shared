// BlockNote <-> Lumen conversion, shared by the desktop editor and the mobile DOM-component editor.
// Kept out of the root export so the server never needs @blocknote/core. Type-only BlockNote
// imports here, so native screens can use it; the editor itself is in ./blocknote.
export * from "./convert";
export * from "./diff";
