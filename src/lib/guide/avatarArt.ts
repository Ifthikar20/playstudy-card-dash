import type { AvatarDef, AvatarId, AvatarShape } from "./avatars";

/*
  The characters drawn on each avatar's badge, as SVG markup in a 64x64 box.
  Colours are tokens (DARK, BASE, LIGHT, WHITE) that GuideAvatar swaps for the
  avatar's palette; the eyes are wrapped in .av-eyes and the mouth in .av-mouth
  so CSS can blink and talk. Everything stays inside the circle r=22 around
  (32, 32), because some badges are hexagons or octagons. Original characters,
  drawn for AnotherNote in a flat badge style. GuideAvatar draws all this on the page;
  this is plain data with no React in it, so anything else can draw the same.
*/

export const AVATAR_ART: Partial<Record<AvatarId, string>> = {
  owl: `<path d="M20.5 15.5C23 18 27 19.5 32 19.5C37 19.5 41 18 43.5 15.5C48 20 51 26 51 33.5C51 44.5 42.5 51.5 32 51.5C21.5 51.5 13 44.5 13 33.5C13 26 16 20 20.5 15.5Z" fill="BASE" stroke="DARK" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 25C35.5 20.5 46 20 47.5 29.5C48.5 37.5 40.5 44 32 46C23.5 44 15.5 37.5 16.5 29.5C18 20 28.5 20.5 32 25Z" fill="LIGHT" stroke="DARK" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><g class="av-eyes"><circle cx="25" cy="31" r="5.4" fill="WHITE" stroke="DARK" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="39" cy="31" r="5.4" fill="WHITE" stroke="DARK" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="25.8" cy="31.6" r="2.9" fill="DARK"/><circle cx="38.2" cy="31.6" r="2.9" fill="DARK"/><circle cx="26.9" cy="30.4" r="1.05" fill="WHITE"/><circle cx="39.3" cy="30.4" r="1.05" fill="WHITE"/></g><circle cx="25" cy="31" r="5.4" fill="none" stroke="DARK" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="39" cy="31" r="5.4" fill="none" stroke="DARK" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M30.4 29.6Q32 28.2 33.6 29.6M19.6 30.2L15.4 28.4M44.4 30.2L48.6 28.4" fill="none" stroke="DARK" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><g class="av-mouth"><path d="M29.2 37C29.2 35.8 34.8 35.8 34.8 37C34.8 39 33.2 41.4 32 42.2C30.8 41.4 29.2 39 29.2 37Z" fill="BASE" stroke="DARK" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></g>`,
  fox: `<path d="M17.6 31C17 25 17.6 20 19.4 16C24 16.8 28.4 19 31 22.6Z" fill="BASE" stroke="DARK" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M46.4 31C47 25 46.4 20 44.6 16C40 16.8 35.6 19 33 22.6Z" fill="BASE" stroke="DARK" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M19.8 25.6C19.7 22.6 20.1 20.3 20.9 18.8C23.4 19.4 25.6 20.6 27.3 22.3C24.6 22.9 21.8 24 19.8 25.6Z" fill="LIGHT" stroke="DARK" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M44.2 25.6C44.3 22.6 43.9 20.3 43.1 18.8C40.6 19.4 38.4 20.6 36.7 22.3C39.4 22.9 42.2 24 44.2 25.6Z" fill="LIGHT" stroke="DARK" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 21C40 21 45.8 24.5 47.6 31.5L49.8 35.6L47.8 36.2L50.9 40C46.5 43.5 40.5 49.8 32 49.8C23.5 49.8 17.5 43.5 13.1 40L16.2 36.2L14.2 35.6L16.4 31.5C18.2 24.5 24 21 32 21Z" fill="BASE" stroke="DARK" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M16.4 31.5L14.2 35.6L16.2 36.2L13.1 40C17.5 43.5 23.5 49.8 32 49.8C40.5 49.8 46.5 43.5 50.9 40L47.8 36.2L49.8 35.6L47.6 31.5C46 35.5 42 37.6 37 37.8C35 38 33.5 39 32 39C30.5 39 29 38 27 37.8C22 37.6 18 35.5 16.4 31.5Z" fill="LIGHT" stroke="DARK" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><g class="av-eyes"><ellipse cx="24.6" cy="30.4" rx="3.9" ry="4.2" fill="WHITE" stroke="DARK" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="39.4" cy="30.4" rx="3.9" ry="4.2" fill="WHITE" stroke="DARK" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="25.2" cy="30.9" rx="2.5" ry="2.9" fill="DARK"/><ellipse cx="38.8" cy="30.9" rx="2.5" ry="2.9" fill="DARK"/><circle cx="26.2" cy="29.7" r="1" fill="WHITE"/><circle cx="39.8" cy="29.7" r="1" fill="WHITE"/></g><path d="M29.3 38.2C29.3 36.9 34.7 36.9 34.7 38.2C34.7 39.7 33.1 40.9 32 40.9C30.9 40.9 29.3 39.7 29.3 38.2Z" fill="DARK" stroke="DARK" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="30.9" cy="37.9" r="0.6" fill="WHITE"/><g class="av-mouth"><path d="M32 41L32 42.2M28.4 42.2C29.4 44 31.6 44 32 42.2C32.4 44 34.6 44 35.6 42.2" fill="none" stroke="DARK" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></g>`,
  cat: `<polygon points="16.5,29 20.5,15 30,21" fill="BASE" stroke="DARK" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
<polygon points="47.5,29 43.5,15 34,21" fill="BASE" stroke="DARK" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
<polygon points="22,18.9 20,26 29.3,23.5" fill="LIGHT" stroke="none"/>
<polygon points="42,18.9 44,26 34.7,23.5" fill="LIGHT" stroke="none"/>
<ellipse cx="32" cy="34.5" rx="17.5" ry="15" fill="BASE" stroke="DARK" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
<line x1="32" y1="22" x2="32" y2="24.4" stroke="DARK" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
<line x1="28.4" y1="22.6" x2="28.9" y2="24.5" stroke="DARK" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
<line x1="35.6" y1="22.6" x2="35.1" y2="24.5" stroke="DARK" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
<line x1="13.8" y1="37.6" x2="21.4" y2="39.3" stroke="DARK" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<line x1="15" y1="43.4" x2="21.8" y2="42" stroke="DARK" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<line x1="50.2" y1="37.6" x2="42.6" y2="39.3" stroke="DARK" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<line x1="49" y1="43.4" x2="42.2" y2="42" stroke="DARK" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<ellipse cx="32" cy="41.6" rx="8.4" ry="4.6" fill="LIGHT" stroke="DARK" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<g class="av-eyes">
<circle cx="24.5" cy="30.3" r="4.9" fill="WHITE" stroke="DARK" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="39.5" cy="30.3" r="4.9" fill="WHITE" stroke="DARK" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="24.5" cy="30.8" r="2.9" fill="DARK"/>
<circle cx="39.5" cy="30.8" r="2.9" fill="DARK"/>
<circle cx="25.6" cy="29.7" r="1.1" fill="WHITE"/>
<circle cx="40.6" cy="29.7" r="1.1" fill="WHITE"/>
<circle cx="23.6" cy="32" r="0.5" fill="WHITE"/>
<circle cx="38.6" cy="32" r="0.5" fill="WHITE"/>
</g>
<path d="M30.4 38.4 Q32 37.8 33.6 38.4 Q33 39.8 32 40 Q31 39.8 30.4 38.4 Z" fill="DARK" stroke="DARK" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<g class="av-mouth">
<path d="M32 40 V41.6 M27.6 41.6 Q29.8 44.6 32 41.6 Q34.2 44.6 36.4 41.6" fill="none" stroke="DARK" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
</g>`,
  robot: `<rect x="12.3" y="30.5" width="6" height="8" rx="2" fill="BASE" stroke="DARK" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="45.7" y="30.5" width="6" height="8" rx="2" fill="BASE" stroke="DARK" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
<line x1="32" y1="21" x2="32" y2="16.6" stroke="DARK" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="32" cy="14.8" r="2.6" fill="LIGHT" stroke="DARK" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="32.9" cy="13.9" r="0.8" fill="WHITE"/>
<rect x="16" y="20.5" width="32" height="28" rx="8" fill="LIGHT" stroke="DARK" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
<g class="av-eyes">
<circle cx="24.8" cy="30.5" r="5" fill="WHITE" stroke="DARK" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="39.2" cy="30.5" r="5" fill="WHITE" stroke="DARK" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="24.8" cy="30.8" r="2.6" fill="DARK"/>
<circle cx="39.2" cy="30.8" r="2.6" fill="DARK"/>
<circle cx="25.8" cy="29.8" r="1" fill="WHITE"/>
<circle cx="40.2" cy="29.8" r="1" fill="WHITE"/>
</g>
<g class="av-mouth">
<path d="M24 39.2 H40 Q40 45 32 45 Q24 45 24 39.2 Z" fill="WHITE" stroke="DARK" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
<line x1="28" y1="39.8" x2="28" y2="43.5" stroke="DARK" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<line x1="32" y1="39.8" x2="32" y2="43.9" stroke="DARK" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<line x1="36" y1="39.8" x2="36" y2="43.5" stroke="DARK" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
</g>`,
  octopus: `<path d="M22.5 38.5 C20.5 42 17.5 43.5 15.5 42.2 C13.8 41 14 38.6 15.6 37.9 C16.8 37.4 17.6 38.4 17.2 39.3 C18.6 39.4 19.8 37.8 20 35.5 Z" fill="LIGHT" stroke="DARK" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.4"/><path d="M41.5 38.5 C43.5 42 46.5 43.5 48.5 42.2 C50.2 41 50 38.6 48.4 37.9 C47.2 37.4 46.4 38.4 46.8 39.3 C45.4 39.4 44.2 37.8 44 35.5 Z" fill="LIGHT" stroke="DARK" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.4"/><path d="M28.8 39 L28.8 44.5 C28.8 48.8 25.6 50.6 22.6 49.4 C20.4 48.5 20.2 45.6 22 45 C23.2 44.6 24 45.6 23.6 46.6 C24.6 46.4 24.8 45.4 24.8 44 L24.8 39 Z" fill="LIGHT" stroke="DARK" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.4"/><path d="M35.2 39 L35.2 44.5 C35.2 48.8 38.4 50.6 41.4 49.4 C43.6 48.5 43.8 45.6 42 45 C40.8 44.6 40 45.6 40.4 46.6 C39.4 46.4 39.2 45.4 39.2 44 L39.2 39 Z" fill="LIGHT" stroke="DARK" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.4"/><path d="M16 30 C16 18 23 11.5 32 11.5 C41 11.5 48 18 48 30 C48 37.5 41 41.5 32 41.5 C23 41.5 16 37.5 16 30 Z" fill="LIGHT" stroke="DARK" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.6"/><circle cx="23.6" cy="19.4" r="2.3" fill="BASE" stroke="DARK" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2"/><circle cx="32.6" cy="15.9" r="1.3" fill="BASE" stroke="DARK" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2"/><circle cx="40.6" cy="18.6" r="1.8" fill="BASE" stroke="DARK" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2"/><g class="av-eyes"><ellipse cx="26" cy="28.5" rx="4.2" ry="4.7" fill="WHITE" stroke="DARK" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.4"/><ellipse cx="38" cy="28.5" rx="4.2" ry="4.7" fill="WHITE" stroke="DARK" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.4"/><circle cx="26" cy="29.4" r="2.5" fill="DARK"/><circle cx="38" cy="29.4" r="2.5" fill="DARK"/><circle cx="25.1" cy="28.3" r="1" fill="WHITE"/><circle cx="37.1" cy="28.3" r="1" fill="WHITE"/></g><g class="av-mouth"><path d="M29.2 35.6 C29.8 38.8 34.2 38.8 34.8 35.6 Q32 36.4 29.2 35.6 Z" fill="DARK" stroke="DARK" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2"/></g>`,
  frog: `<path d="M14 36 C14 31.5 15 28.2 16.77 26.1 A7.2 7.2 0 1 1 29.24 26.1 Q32 25 34.76 26.1 A7.2 7.2 0 1 1 47.24 26.1 C49 28.2 50 31.5 50 36 C50 43 42 47 32 47 C22 47 14 43 14 36 Z" fill="BASE" stroke="DARK" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.6"/><path d="M14 36 C18 31.5 25 30.5 32 30.5 C39 30.5 46 31.5 50 36 C50 43 42 47 32 47 C22 47 14 43 14 36 Z" fill="LIGHT" stroke="DARK" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.6"/><ellipse cx="19.3" cy="38.8" rx="2.8" ry="2.1" fill="BASE" stroke="DARK" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2"/><ellipse cx="44.7" cy="38.8" rx="2.8" ry="2.1" fill="BASE" stroke="DARK" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2"/><g class="av-eyes"><circle cx="23" cy="23.8" r="4.8" fill="WHITE" stroke="DARK" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.4"/><circle cx="41" cy="23.8" r="4.8" fill="WHITE" stroke="DARK" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.4"/><circle cx="23" cy="24.7" r="2.6" fill="DARK"/><circle cx="41" cy="24.7" r="2.6" fill="DARK"/><circle cx="22" cy="23.5" r="1" fill="WHITE"/><circle cx="40" cy="23.5" r="1" fill="WHITE"/></g><g class="av-mouth"><path d="M23 35 Q32 44.5 41 35 Q32 38.5 23 35 Z" fill="DARK" stroke="DARK" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2"/></g>`,
  panda: `<circle cx="21" cy="21" r="5" fill="DARK" stroke="DARK" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="43" cy="21" r="5" fill="DARK" stroke="DARK" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
<ellipse cx="32" cy="34" rx="17" ry="15" fill="LIGHT" stroke="DARK" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
<ellipse cx="24.5" cy="34" rx="4.8" ry="6.6" transform="rotate(25 24.5 34)" fill="DARK" stroke="DARK" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
<ellipse cx="39.5" cy="34" rx="4.8" ry="6.6" transform="rotate(-25 39.5 34)" fill="DARK" stroke="DARK" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
<g class="av-eyes">
<circle cx="25" cy="33.2" r="3.9" fill="WHITE" stroke="DARK" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="39" cy="33.2" r="3.9" fill="WHITE" stroke="DARK" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="25.35" cy="33.8" r="0.75" fill="DARK" stroke="DARK" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="38.65" cy="33.8" r="0.75" fill="DARK" stroke="DARK" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="26.1" cy="33" r="0.85" fill="WHITE" stroke="none"/>
<circle cx="39.4" cy="33" r="0.85" fill="WHITE" stroke="none"/>
</g>
<ellipse cx="32" cy="39.8" rx="2.1" ry="1.3" fill="DARK" stroke="DARK" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<g class="av-mouth">
<path d="M29.2 43.2 Q32 44.2 34.8 43.2 C34.8 46.4 29.2 46.4 29.2 43.2 Z" fill="DARK" stroke="DARK" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
</g>`,
  dino: `<polygon points="23,24 25,15.8 29.5,22" fill="BASE" stroke="DARK" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
<polygon points="41,24 39,15.8 34.5,22" fill="BASE" stroke="DARK" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
<polygon points="28.5,22.5 32,13 35.5,22.5" fill="BASE" stroke="DARK" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M32 20 C40 20 45.5 25 46 32 C48.5 35 49 39 48.5 42 C47.5 48 40.5 51 32 51 C23.5 51 16.5 48 15.5 42 C15 39 15.5 35 18 32 C18.5 25 24 20 32 20 Z" fill="LIGHT" stroke="DARK" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
<g class="av-eyes">
<circle cx="25" cy="29.2" r="4.5" fill="WHITE" stroke="DARK" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="39" cy="29.2" r="4.5" fill="WHITE" stroke="DARK" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="25.45" cy="29.9" r="1.25" fill="DARK" stroke="DARK" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="38.55" cy="29.9" r="1.25" fill="DARK" stroke="DARK" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="26.3" cy="29" r="1" fill="WHITE" stroke="none"/>
<circle cx="39.4" cy="29" r="1" fill="WHITE" stroke="none"/>
</g>
<ellipse cx="29.3" cy="37.3" rx="0.5" ry="0.8" transform="rotate(-20 29.3 37.3)" fill="DARK" stroke="DARK" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<ellipse cx="34.7" cy="37.3" rx="0.5" ry="0.8" transform="rotate(20 34.7 37.3)" fill="DARK" stroke="DARK" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<g class="av-mouth">
<path d="M20.5 40.5 Q32 43 43.5 40.5 C43 48.5 21 48.5 20.5 40.5 Z" fill="DARK" stroke="DARK" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
<polygon points="24.4,42.1 27.8,42.4 26.1,44.3" fill="WHITE" stroke="none"/>
<polygon points="39.6,42.1 36.2,42.4 37.9,44.3" fill="WHITE" stroke="none"/>
</g>`,
};

/** The badge behind each character. */
export const BADGE_PATHS: Record<AvatarShape, string> = {
  // Everything sits in a 64×64 box, with room for the 3px outline.
  hexagon: "M32 3.5 L56.7 17.75 L56.7 46.25 L32 60.5 L7.3 46.25 L7.3 17.75 Z",
  circle: "M32 3.5 A28.5 28.5 0 1 1 31.99 3.5 Z",
  squircle: "M20 4 H44 C54 4 60 10 60 20 V44 C60 54 54 60 44 60 H20 C10 60 4 54 4 44 V20 C4 10 10 4 20 4 Z",
  octagon: "M21.6 4 H42.4 L60 21.6 V42.4 L42.4 60 H21.6 L4 42.4 V21.6 Z",
  shield: "M32 3.5 L57 11 V31 C57 46 46 55.5 32 60.5 C18 55.5 7 46 7 31 V11 Z",
};

/** The pointer's arrow, in a 28×28 box; its tip, at (3, 3), is the point it points with. */
export const ARROW_PATH = "M3 3 L25 11.4 L14.6 14.6 L11.4 25 Z";

/** The art uses colour tokens; swap in this avatar's palette. */
export function paint(markup: string, def: AvatarDef): string {
  return markup
    .replace(/\bDARK\b/g, def.palette.dark)
    .replace(/\bBASE\b/g, def.palette.base)
    .replace(/\bLIGHT\b/g, def.palette.light)
    .replace(/\bWHITE\b/g, "#ffffff");
}
