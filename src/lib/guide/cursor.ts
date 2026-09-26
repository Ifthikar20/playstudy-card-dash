import { avatarDef, type AvatarDef, type AvatarId } from "./avatars.ts";
import { ARROW_PATH, AVATAR_ART, BADGE_PATHS, paint } from "./avatarArt.ts";
import { BOT_PALETTE, botRuns } from "./botArt.ts";
import type { BotKind } from "../../components/guide/GuideBot";

/*
  The tutor's pointer as the mouse cursor itself.

  The browser draws a CSS cursor image, so unlike an element that follows the mouse it is
  never covered by a PDF's canvas, a board or a dialog, never lags, and is never gone: a
  cursor that vanishes is the one thing a page must not do. The image is the lesson's own
  arrow and avatar, composed here as an SVG string from the same data GuideAvatar and
  GuideBot draw from (avatarArt.ts, botArt.ts) - no React, no DOM, nothing scheduled, so it
  is the same in development and production. (Rendering the components to markup was tried
  twice: react-dom/server is a second copy of React in the Vite dev server and refuses the
  avatar's hooks; an offscreen root flushed from inside an effect never renders in time.)
  The arrow's tip is the hotspot. Browsers without SVG cursors (Safari) fall back to `auto`.
*/
const SIZE = 48; // well under the 128px browsers allow, and the size the lesson's pointer is drawn at
const ARROW = 26; // the arrow's box, at the top left (GuidePointer's AvatarArrow)
const FACE = 34; // the avatar's box, at (13, 13) (.guide-cursor-avatar in index.css)
const AT = 13;

function arrowSvg(color: string): string {
  return (
    `<svg x="0" y="0" width="${ARROW}" height="${ARROW}" viewBox="0 0 28 28">` +
    `<path d="${ARROW_PATH}" fill="${color}" stroke="#ffffff" stroke-width="2.2" stroke-linejoin="round"/></svg>`
  );
}

/** A character on its coloured badge, as GuideAvatar draws it (without the ring, which the page hides). */
function badgeSvg(def: AvatarDef): string {
  const p = def.palette;
  return (
    `<svg x="${AT}" y="${AT}" width="${FACE}" height="${FACE}" viewBox="0 0 64 64">` +
    `<path d="${BADGE_PATHS[def.shape]}" fill="${p.base}" stroke="${p.dark}" stroke-width="3" stroke-linejoin="round"/>` +
    paint(AVATAR_ART[def.id] ?? "", def) +
    "</svg>"
  );
}

/** The pixel tutor's head on its rounded badge (.guide-avatar-pixel-badge): the figure's
 *  rows, its eyes and its shut mouth; not the glow, the dots or the open mouth, which the
 *  page keeps hidden until a mood calls for them. */
function pixelSvg(def: AvatarDef, kind: BotKind): string {
  const p = def.palette; // avatarDef already swapped in this voice's pixel palette
  const bot = BOT_PALETTE[kind];
  const inner = Math.round(FACE * 0.78);
  const off = AT + (FACE - inner) / 2;
  const rx = (FACE * 0.28).toFixed(1);
  const runs = botRuns(kind)
    .map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="1" fill="${r.fill}"/>`)
    .join("");
  const face =
    `<g fill="${bot.e}"><rect x="7" y="10" width="2" height="2"/><rect x="11" y="10" width="2" height="2"/>` +
    `<rect x="7" y="10" width="1" height="1" fill="#ffffff"/><rect x="11" y="10" width="1" height="1" fill="#ffffff"/></g>` +
    `<rect x="9" y="13" width="2" height="1" fill="${bot.e}"/>`;
  return (
    `<rect x="${AT + 1}" y="${AT + 1}" width="${FACE - 2}" height="${FACE - 2}" rx="${rx}" fill="${p.light}" stroke="${p.dark}" stroke-width="2"/>` +
    `<svg x="${off}" y="${off}" width="${inner}" height="${inner}" viewBox="1 0 18 18" shape-rendering="crispEdges">${runs}${face}</svg>`
  );
}

/** The `cursor` value for this tutor: the arrow in its colour with the avatar beside it. */
export function tutorCursor(avatar: AvatarId, kind: BotKind, color: string): string {
  const def = avatarDef(avatar, kind);
  const face = def.id === "pixel" ? pixelSvg(def, kind) : badgeSvg(def);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">` +
    arrowSvg(color) +
    face +
    "</svg>";
  // The arrow's tip sits at (3,3) of its box: that is the hotspot.
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}") 3 3, auto`;
}
