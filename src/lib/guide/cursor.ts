import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AvatarArrow, GuideAvatar } from "@/components/guide/GuideAvatar";
import type { BotKind } from "@/components/guide/GuideBot";
import type { AvatarId } from "@/lib/guide/avatars";

/*
  The tutor's pointer as the mouse cursor itself.

  The browser draws a CSS cursor image, so unlike an element that follows the mouse it is
  never covered by a PDF's canvas, a board or a dialog, never lags, and is never gone: a
  cursor that vanishes is the one thing a page must not do. The image is the lesson's own
  arrow and avatar (GuideAvatar / AvatarArrow) rendered once to a standalone SVG; the tip
  of the arrow is the hotspot. Browsers without SVG cursors (Safari) fall back to `auto`.
*/
const SIZE = 48; // well under the 128px browsers allow, and the size the lesson's pointer is drawn at

function nested(svg: string, x: number, y: number, size: number): string {
  // A React-rendered <svg> becomes a nested one: placed with x/y, sized in px, never in %.
  return svg
    .replace(/^<svg/, `<svg x="${x}" y="${y}"`)
    .replace(/ width="[^"]*"/, ` width="${size}"`)
    .replace(/ height="[^"]*"/, ` height="${size}"`);
}

export function tutorCursor(avatar: AvatarId, kind: BotKind, color: string): string {
  const arrow = renderToStaticMarkup(createElement(AvatarArrow, { color, size: 26 }));
  const face = renderToStaticMarkup(createElement(GuideAvatar, { avatar, kind, size: 34, mood: "idle" }));
  const faceSvg = face.match(/<svg[\s\S]*<\/svg>/)?.[0] ?? "";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">` +
    nested(arrow, 0, 0, 26) +
    nested(faceSvg, 13, 13, 34) +
    "</svg>";
  // The arrow's tip sits at (3,3) of its own box: that is the hotspot.
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}") 3 3, auto`;
}
