/**
 * Tests for src/lib/guide/cursor.ts: the tutor's pointer as a CSS cursor image.
 *
 * Run: node --test "scripts/tests/*.test.ts"   (or npm test)
 *
 * The cursor is a string built from the avatar data, so this checks every avatar for
 * every voice: a 48px SVG data URL with the arrow's tip as the hotspot, the avatar's own
 * colour in it, and none of the parts the page keeps hidden (the pixel tutor's open
 * mouth, glow and thinking dots; the badge's ring).
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { tutorCursor } from "../../src/lib/guide/cursor.ts";
import { AVATARS, avatarDef } from "../../src/lib/guide/avatars.ts";

const KINDS = ["female", "male", "neutral"] as const;
const PREFIX = 'url("data:image/svg+xml;charset=utf-8,';
const SUFFIX = '") 3 3, auto';
const markupOf = (css: string) => decodeURIComponent(css.slice(PREFIX.length, -SUFFIX.length));

describe("tutorCursor", () => {
  for (const a of AVATARS) {
    for (const kind of KINDS) {
      test(`${a.id} for the ${kind} voice is a 48px SVG cursor pointing with the arrow's tip`, () => {
        const def = avatarDef(a.id, kind);
        const css = tutorCursor(a.id, kind, def.palette.base);
        assert.ok(css.startsWith(PREFIX), css.slice(0, 60));
        assert.ok(css.endsWith(SUFFIX), css.slice(-30));
        const svg = markupOf(css);
        assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"'), svg.slice(0, 80));
        assert.ok(svg.includes(def.palette.base), "the avatar's own colour is in the image");
        for (const hidden of ["bot-mouth-open", "bot-glow", "bot-dots", "av-ring"]) {
          assert.ok(!svg.includes(hidden), `${hidden} must not be in the image`);
        }
        assert.equal((svg.match(/<svg\b/g) ?? []).length, (svg.match(/<\/svg>/g) ?? []).length, "every <svg> is closed");
        assert.ok(!svg.includes("undefined") && !svg.includes("NaN"));
      });
    }
  }

  test("the pixel tutor sits on its rounded badge and carries only the shut mouth", () => {
    const svg = markupOf(tutorCursor("pixel", "female", "#f472b6"));
    assert.ok(svg.includes('viewBox="1 0 18 18"'), "the head crop, as on the page");
    assert.ok(svg.includes('rx="9.5"'), "the badge's rounded corners (28% of 34)");
    assert.ok(svg.includes('<rect x="9" y="13" width="2" height="1"'), "the shut mouth");
    assert.ok(!svg.includes('<rect x="8" y="13" width="4"'), "not the open one");
  });

  test("the arrow takes the colour it is given", () => {
    const svg = markupOf(tutorCursor("owl", "male", "#123456"));
    assert.ok(svg.includes('fill="#123456" stroke="#ffffff"'));
  });
});
