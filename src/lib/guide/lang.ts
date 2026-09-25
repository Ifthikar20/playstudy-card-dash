/**
 * Which language a piece of text is in, so Teach mode can hand it to a native
 * voice: Arabic notes to an Arabic voice, a French quote to a French one.
 *
 *  - detectLang(text, hint): the language of a whole text (a section's notes,
 *    a reply). Long text is judged on its own evidence; a short line leans on
 *    the hint, the language we already believe the lesson is in.
 *  - speechRuns(sentence, base): cuts one sentence into the pieces each voice
 *    should read. An Arabic phrase inside an English sentence is its own piece.
 *
 * Everything here bends to one rule: never switch an English lesson to a
 * foreign voice by mistake. Hearing a French sentence in the English voice is a
 * small miss; hearing "Marie Curie discovered radium" in a French accent is a
 * bug every student notices. So:
 *  - a change of script (Arabic, Cyrillic, Devanagari, Han...) is certain and
 *    switches at once. The English voice can't read those letters anyway.
 *  - a change between two Latin-script languages needs several words of real
 *    evidence (common function words, not names or loanwords) and a wide margin.
 *
 * Self-contained on purpose: no imports and only erasable TypeScript, so Node
 * can run the tests directly, and cheap enough for every spoken sentence to go
 * through it. Nothing here throws; anything odd falls back to the hint.
 */

// ── Languages ────────────────────────────────────────────────────────────────

/*
  Latin-script languages we tell apart by their words. On a tie the earlier one
  wins, so the bigger language of a close pair comes first (id before ms, hr
  before sl, es and pt before gl, nb before da). Filipino is "fil" because that
  is the key the voice map (and Microsoft's fil-PH voices) use; "tl" is accepted
  as a hint and means the same.
*/
const LATIN_LANGS = [
  "en", "fr", "es", "pt", "it", "de", "nl", "af", "sv", "nb", "da", "fi", "et",
  "pl", "cs", "sk", "hr", "sl", "ro", "hu", "tr", "az", "uz", "id", "ms", "fil",
  "vi", "lt", "lv", "sq", "is", "ga", "cy", "mt", "sw", "so", "zu", "ca", "gl",
];

/** Every language detectLang/speechRuns can answer with (ISO 639-1 base codes, plus "fil"). */
export const DETECTABLE: readonly string[] = Object.freeze([
  ...LATIN_LANGS,
  "ar", "fa", "ur", "ps", "he", "ru", "uk", "bg", "sr", "mk", "kk", "mn", "el",
  "hi", "mr", "ne", "bn", "pa", "gu", "ta", "te", "kn", "ml", "si", "th", "lo",
  "km", "my", "ka", "hy", "am", "ko", "ja", "zh",
]);
const DETECTABLE_SET = new Set(DETECTABLE);

export type SpeechRun = { text: string; lang: string };

/* Old, three-letter and macro-language codes a hint might arrive as. */
const ALIASES: Record<string, string> = {
  iw: "he", in: "id", no: "nb", nn: "nb", tl: "fil", sh: "hr", bs: "hr", zsm: "ms", cmn: "zh", yue: "zh",
  wuu: "zh", pes: "fa", prs: "fa", arb: "ar", eng: "en", fra: "fr", fre: "fr", spa: "es", deu: "de",
  ger: "de", ita: "it", por: "pt", rus: "ru", ara: "ar", zho: "zh", chi: "zh", jpn: "ja", kor: "ko",
  hin: "hi", ben: "bn", urd: "ur", fas: "fa", per: "fa", tur: "tr", nld: "nl", dut: "nl", pol: "pl",
  ukr: "uk", ell: "el", gre: "el", heb: "he", tha: "th", vie: "vi", ind: "id", msa: "ms", may: "ms",
  swa: "sw", swe: "sv", nor: "nb", nob: "nb", dan: "da", fin: "fi", fil: "fil",
};

/** "fr-FR" → "fr", "iw" → "he", "tl" → "fil"; null when we have no voice language for it. */
function normalizeLang(code: unknown): string | null {
  if (typeof code !== "string") return null;
  const base = code.trim().toLowerCase().split(/[-_]/)[0];
  if (!base) return null;
  const c = Object.prototype.hasOwnProperty.call(ALIASES, base) ? ALIASES[base] : base;
  return DETECTABLE_SET.has(c) ? c : null;
}

// ── Scripts ──────────────────────────────────────────────────────────────────

/* What kind of character something is. NONE covers spaces, punctuation, digits
   and symbols (they never decide a language); MARK is a combining mark or a
   joiner that belongs to the letter before it. */
const NONE = 0, MARK = 1, LATIN = 2, ARABIC = 3, HEBREW = 4, CYRILLIC = 5, GREEK = 6,
  DEVANAGARI = 7, BENGALI = 8, GURMUKHI = 9, GUJARATI = 10, TAMIL = 11, TELUGU = 12,
  KANNADA = 13, MALAYALAM = 14, SINHALA = 15, THAI = 16, LAO = 17, KHMER = 18, MYANMAR = 19,
  GEORGIAN = 20, ARMENIAN = 21, ETHIOPIC = 22, HANGUL = 23, KANA = 24, HAN = 25, OTHER = 26;
const GROUPS = 27;

/*
  [first, last, script] code point ranges, sorted. Digits and punctuation that
  live inside a script's block (Arabic comma, Devanagari danda, Thai digits...)
  are left out on purpose, so they fall through to NONE.
*/
// prettier-ignore
const RANGES: number[] = [
  0x00aa, 0x00aa, LATIN, 0x00b5, 0x00b5, NONE, 0x00ba, 0x00ba, LATIN,
  0x00c0, 0x00d6, LATIN, 0x00d8, 0x00f6, LATIN, 0x00f8, 0x02af, LATIN,
  0x02b0, 0x036f, MARK,
  0x0370, 0x0373, GREEK, 0x0376, 0x037d, GREEK, 0x037f, 0x037f, GREEK, 0x0386, 0x0386, GREEK, 0x0388, 0x03ff, GREEK,
  0x0400, 0x0482, CYRILLIC, 0x0483, 0x0489, MARK, 0x048a, 0x052f, CYRILLIC,
  0x0531, 0x0559, ARMENIAN, 0x0560, 0x0588, ARMENIAN,
  0x0591, 0x05bd, MARK, 0x05bf, 0x05bf, MARK, 0x05c1, 0x05c2, MARK, 0x05c4, 0x05c5, MARK, 0x05c7, 0x05c7, MARK,
  0x05d0, 0x05ea, HEBREW, 0x05ef, 0x05f2, HEBREW, 0x05f3, 0x05f4, MARK,
  0x0610, 0x061a, MARK, 0x0620, 0x063f, ARABIC, 0x0640, 0x0640, MARK, 0x0641, 0x064a, ARABIC, 0x064b, 0x065f, MARK,
  0x066e, 0x066f, ARABIC, 0x0670, 0x0670, MARK, 0x0671, 0x06d3, ARABIC, 0x06d5, 0x06d5, ARABIC, 0x06d6, 0x06ed, MARK,
  0x06ee, 0x06ef, ARABIC, 0x06fa, 0x06ff, ARABIC, 0x0750, 0x077f, ARABIC, 0x08a0, 0x08c9, ARABIC, 0x08ca, 0x08ff, MARK,
  0x0900, 0x0963, DEVANAGARI, 0x0971, 0x097f, DEVANAGARI,
  0x0980, 0x09e5, BENGALI, 0x09f0, 0x09f1, BENGALI,
  0x0a00, 0x0a65, GURMUKHI, 0x0a70, 0x0a7f, GURMUKHI,
  0x0a80, 0x0ae5, GUJARATI, 0x0af9, 0x0aff, GUJARATI,
  0x0b00, 0x0b65, OTHER, 0x0b70, 0x0b77, OTHER,
  0x0b80, 0x0be5, TAMIL,
  0x0c00, 0x0c65, TELUGU,
  0x0c80, 0x0ce5, KANNADA, 0x0cf1, 0x0cf3, KANNADA,
  0x0d00, 0x0d65, MALAYALAM, 0x0d7a, 0x0d7f, MALAYALAM,
  0x0d80, 0x0de5, SINHALA, 0x0df2, 0x0df3, SINHALA,
  0x0e01, 0x0e3a, THAI, 0x0e40, 0x0e4e, THAI,
  0x0e81, 0x0ecf, LAO, 0x0edc, 0x0edf, LAO,
  0x1000, 0x103f, MYANMAR, 0x1050, 0x109f, MYANMAR,
  0x10a0, 0x10fa, GEORGIAN, 0x10fc, 0x10ff, GEORGIAN,
  0x1100, 0x11ff, HANGUL,
  0x1200, 0x135f, ETHIOPIC, 0x1380, 0x139f, ETHIOPIC,
  0x1780, 0x17d3, KHMER, 0x17dc, 0x17dd, KHMER,
  0x1ab0, 0x1aff, MARK,
  0x1c90, 0x1cbf, GEORGIAN,
  0x1dc0, 0x1dff, MARK,
  0x1e00, 0x1eff, LATIN,
  0x1f00, 0x1fff, GREEK,
  0x200c, 0x200d, MARK,
  0x20d0, 0x20ff, MARK,
  0x2c60, 0x2c7f, LATIN,
  0x2d00, 0x2d2f, GEORGIAN,
  0x2de0, 0x2dff, MARK,
  0x3005, 0x3007, HAN,
  0x3041, 0x3096, KANA, 0x3099, 0x309a, MARK, 0x309b, 0x309f, KANA, 0x30a1, 0x30fa, KANA, 0x30fc, 0x30ff, KANA,
  0x3131, 0x318e, HANGUL,
  0x31f0, 0x31ff, KANA,
  0x3400, 0x4dbf, HAN,
  0x4e00, 0x9fff, HAN,
  0xa640, 0xa66e, CYRILLIC, 0xa66f, 0xa67f, MARK, 0xa680, 0xa69f, CYRILLIC,
  0xa720, 0xa7ff, LATIN,
  0xa8e0, 0xa8ff, DEVANAGARI,
  0xa960, 0xa97f, HANGUL,
  0xab30, 0xab6f, LATIN,
  0xac00, 0xd7ff, HANGUL,
  0xf900, 0xfaff, HAN,
  0xfb00, 0xfb06, LATIN,
  0xfb1d, 0xfb4f, HEBREW,
  0xfb50, 0xfd3d, ARABIC, 0xfd50, 0xfdfb, ARABIC,
  0xfe00, 0xfe0f, MARK,
  0xfe20, 0xfe2f, MARK,
  0xfe70, 0xfefc, ARABIC,
  0xff21, 0xff3a, LATIN, 0xff41, 0xff5a, LATIN,
  0xff66, 0xff9f, KANA,
  0xffa0, 0xffdc, HANGUL,
  0x1d400, 0x1d7ff, NONE, // maths letters are symbols in a formula, not words
  0x20000, 0x323af, HAN,
];
const RANGE_COUNT = RANGES.length / 3;

const IS_LETTER = /\p{L}/u;
const IS_MARK = /\p{M}/u;
const unlisted = new Map<number, number>();

function scriptOf(cp: number): number {
  if (cp < 0x80) return (cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a) ? LATIN : NONE;
  let lo = 0;
  let hi = RANGE_COUNT - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cp < RANGES[mid * 3]) hi = mid - 1;
    else if (cp > RANGES[mid * 3 + 1]) lo = mid + 1;
    else return RANGES[mid * 3 + 2];
  }
  // Letters of scripts we have no voice for still count as words (so they are
  // never glued onto a neighbour's language); everything else is punctuation.
  let s = unlisted.get(cp);
  if (s === undefined) {
    const ch = String.fromCodePoint(cp);
    s = IS_LETTER.test(ch) ? OTHER : IS_MARK.test(ch) ? MARK : NONE;
    if (unlisted.size < 4096) unlisted.set(cp, s);
  }
  return s;
}

/** Japanese mixes Han and kana in every sentence, so for cutting runs they are one script. */
const groupOf = (s: number): number => (s === KANA ? HAN : s);

/* The one language a script means when nothing more specific shows. */
const GROUP_DEFAULT: string[] = [];
GROUP_DEFAULT[LATIN] = "en";
GROUP_DEFAULT[ARABIC] = "ar";
GROUP_DEFAULT[HEBREW] = "he";
GROUP_DEFAULT[CYRILLIC] = "ru";
GROUP_DEFAULT[GREEK] = "el";
GROUP_DEFAULT[DEVANAGARI] = "hi";
GROUP_DEFAULT[BENGALI] = "bn";
GROUP_DEFAULT[GURMUKHI] = "pa";
GROUP_DEFAULT[GUJARATI] = "gu";
GROUP_DEFAULT[TAMIL] = "ta";
GROUP_DEFAULT[TELUGU] = "te";
GROUP_DEFAULT[KANNADA] = "kn";
GROUP_DEFAULT[MALAYALAM] = "ml";
GROUP_DEFAULT[SINHALA] = "si";
GROUP_DEFAULT[THAI] = "th";
GROUP_DEFAULT[LAO] = "lo";
GROUP_DEFAULT[KHMER] = "km";
GROUP_DEFAULT[MYANMAR] = "my";
GROUP_DEFAULT[GEORGIAN] = "ka";
GROUP_DEFAULT[ARMENIAN] = "hy";
GROUP_DEFAULT[ETHIOPIC] = "am";
GROUP_DEFAULT[HANGUL] = "ko";
GROUP_DEFAULT[HAN] = "zh";

/* Which script each language is written in. */
const LANG_GROUP: Record<string, number> = {
  ar: ARABIC, fa: ARABIC, ur: ARABIC, ps: ARABIC, he: HEBREW,
  ru: CYRILLIC, uk: CYRILLIC, bg: CYRILLIC, sr: CYRILLIC, mk: CYRILLIC, kk: CYRILLIC, mn: CYRILLIC,
  el: GREEK, hi: DEVANAGARI, mr: DEVANAGARI, ne: DEVANAGARI, bn: BENGALI, pa: GURMUKHI, gu: GUJARATI,
  ta: TAMIL, te: TELUGU, kn: KANNADA, ml: MALAYALAM, si: SINHALA, th: THAI, lo: LAO, km: KHMER,
  my: MYANMAR, ka: GEORGIAN, hy: ARMENIAN, am: ETHIOPIC, ko: HANGUL, ja: HAN, zh: HAN,
};
for (const l of LATIN_LANGS) LANG_GROUP[l] = LATIN;

// ── Evidence profiles ────────────────────────────────────────────────────────

/** [language index, weight] pairs. */
type Weighted = Array<[number, number]>;

type Profile = {
  langs: string[];
  index: Record<string, number>;
  /** Function word → languages that use it. A word several languages share counts for less in each. */
  words: Map<string, Weighted>;
  /** Letters that point at a language (ß, ł, ő, ی...). */
  chars: Map<string, Weighted>;
  /** Letter groups: "sch", "ij", "^bhf" (word start), "ção$" (word end). */
  subs: Array<{ s: string; at: 0 | 1 | 2; w: Weighted }>;
};

function parseWeights(spec: string, index: Record<string, number>): Weighted {
  const out: Weighted = [];
  for (const part of spec.trim().split(/\s+/)) {
    const [code, w] = part.split(":");
    if (code in index) out.push([index[code], Number(w) || 1]);
  }
  return out;
}

function makeProfile(
  langs: string[],
  words: Record<string, string>,
  chars: Record<string, string>,
  subs: Array<[string, string]>,
): Profile {
  const index: Record<string, number> = {};
  langs.forEach((l, i) => (index[l] = i));
  // A word gets weight/n in each of the n languages that list it: "dans" is pure
  // French evidence, "de" is spread thin over a dozen languages.
  const raw = new Map<string, Weighted>();
  for (const lang of Object.keys(words)) {
    const li = index[lang];
    if (li === undefined) continue;
    for (const tok of words[lang].trim().split(/\s+/)) {
      const cut = tok.lastIndexOf(":");
      const word = cut > 0 ? tok.slice(0, cut) : tok;
      const w = cut > 0 ? Number(tok.slice(cut + 1)) || 1 : 1;
      const list = raw.get(word) ?? [];
      if (!list.some(([i]) => i === li)) list.push([li, w]);
      raw.set(word, list);
    }
  }
  const wordMap = new Map<string, Weighted>();
  raw.forEach((list, word) => wordMap.set(word, list.map(([li, w]) => [li, w / list.length] as [number, number])));
  const charMap = new Map<string, Weighted>();
  for (const ch of Object.keys(chars)) charMap.set(ch, parseWeights(chars[ch], index));
  const subList = subs.map(([pat, spec]) => {
    const start = pat.startsWith("^");
    const end = pat.endsWith("$");
    const s = pat.slice(start ? 1 : 0, end ? -1 : undefined);
    return { s, at: (start ? 1 : end ? 2 : 0) as 0 | 1 | 2, w: parseWeights(spec, index) };
  });
  return { langs, index, words: wordMap, chars: charMap, subs: subList };
}

// ── Latin-script languages ───────────────────────────────────────────────────

/*
  The most frequent short words of each language. "word:0.3" lowers a word that
  is also an ordinary English word ("come", "era", "sin", "air"), so an English
  sentence about trigonometry or history can't pile up foreign evidence.
  Words English uses constantly ("to", "by", "are") are left out of the
  foreign lists entirely so they stay full-strength English evidence.
*/
const LATIN_WORDS: Record<string, string> = {
  en: `the of and to a an in is it that for on was with as are be by this from or have has had not but they
    you at can we their were been also more its when there these than into so what some would about other how
    each all if only such because between during most both through our may then them will do does did who where
    why which he she his her him one two three first used use called known like many much very should could must
    might being your my me us i while however therefore although though since until upon within without often
    usually always never here now just any every another same different new over under after before up out down
    off again further once own few those whose whom whether either neither nor yet let get got make makes made
    take takes way ways part parts example it's don't doesn't can't isn't aren't n't 's 're 'll 've`,
  fr: `le la les l' un une des du de d' et est en que qu' qui dans pour pas sur au aux avec ce c' cette ces cet il
    elle ils elles sont ne n' se s' par plus:0.5 ou où nous vous on son:0.5 sa ses leur leurs mais comme tout tous
    toute toutes être été était étaient fait très aussi entre sans sous peut peuvent donc ça cela ceci celle celui
    ceux dont lorsque lorsqu' quand pourquoi comment chaque autre autres même car:0.3 ainsi alors après avant
    depuis pendant vers chez selon encore déjà toujours souvent beaucoup peu trop moins bien oui non notre votre
    nos vos je j' tu lui y ont avoir sera seront qu'il qu'elle c'est n'est d'un d'une l'on jusqu' puisqu' m' t'
    suis sommes êtes`,
  es: `el la los las lo un una unos unas de del al y e o u que en es son por para con no se su sus le les como más
    pero este esta estos estas ese esa eso esto muy también entre sin:0.3 sobre hasta desde cuando donde porque qué
    cómo cuál quién ya hay ha han fue fueron ser estar está están era:0.3 eran puede pueden tiene tienen todo todos
    toda todas otro otra otros otras mismo misma cada después antes durante según mientras aunque sino nos mi tu yo
    él ella ellos ellas usted nosotros hace bien así a cual cuales muchos muchas algunos algunas ni se`,
  pt: `o a os as um uma uns umas de do da dos das em no na nos nas por pelo pela pelos pelas para com e é são que
    não se seu sua seus suas ao aos à às mais muito muitos muitas também entre sem sobre até desde quando onde
    porque como qual quais quem já há foi foram ser estar está estão era:0.3 eram pode podem tem têm todo todos
    toda todas outro outra outros outras mesmo cada depois antes durante enquanto embora mas ele ela eles elas
    isso isto este esta estes estas esse essa você nós eu lhe num numa dum duma pois assim bem`,
  it: `il lo la i gli le l' un uno una un' di del della dei degli delle dello dell' a al alla ai agli alle all' da
    dal dalla dai dagli dalle dall' in nel nella nei negli nelle nell' con su sul sulla sui sull' per tra fra e ed
    è che non si ci ne sono come:0.3 più ma anche questo questa questi queste quello quella quelli quelle molto
    molti molte tutto tutti tutta tutte essere stato stata stati fatto ha hanno aveva era:0.3 erano può possono
    dove quando perché cosa chi:0.3 quale quali ogni altro altra altri altre stesso cioè dopo prima:0.5 durante
    mentre senza sempre già ancora così poi solo:0.5 se sia quindi però infatti c'è c' d' loro suo sua suoi sue
    nostro viene vengono`,
  de: `der die das den dem des ein eine einen einem einer eines und oder aber ist sind waren wird werden wurde
    wurden hat haben hatte sein seine seinen seiner ihre ihren kann können muss müssen soll sollen in im ins an am
    auf aus bei beim mit nach von vom zu zum zur für über unter vor hinter neben zwischen durch gegen ohne um
    nicht auch nur noch schon sehr so wie als wenn weil dass daß ob sich es er sie wir ihr ich du dieser diese
    dieses diesen diesem jeder jede jedes alle viele mehr kein keine keinen sowie bzw daher deshalb jedoch dabei
    damit also dann hier dort wo wann warum was wer welche welcher welches einige bereits etwa ebenfalls wobei
    sodass`,
  nl: `de het een en van in is dat op te zijn voor met die niet aan er om ook als bij of door:0.4 maar worden wordt
    werd werden naar uit dan tot over nog wel zo kan kunnen hij zij ze je we wij deze dit wat meer geen heeft
    hebben had zich onder tussen omdat waar wanneer hoe welke welk veel alle haar hun ons onze moet moeten zal
    zullen al nu hier daar dus toch echter waarbij waardoor waarop waarin waarmee daarom daarna zoals ieder elke
    iets andere hebt ben bent dezelfde hetzelfde steeds`,
  af: `die:1.5 en van is in het nie om te dat wat op vir met hy sy ons hulle ook maar word:0.3 was kan sal deur uit
    na aan as by moet baie meer daar hierdie wees tot of so al my jy jou ek u hul watter waar wanneer hoekom hoe
    elke alle geen nog reeds tussen sonder oor onder volgens omdat terwyl indien dit gebruik wys ander waarop
    waarin waarmee daarom`,
  sv: `och i att det som en på är av för med till den inte har de ett om var men kan jag vi från sig så eller när
    också efter hur vad mycket många bara mellan genom blir deras vid under över där detta denna dessa skulle ska
    kommer finns måste sina sin:0.3 sitt hans hennes dem nu då än alla varje ingen inga inget redan eftersom medan
    utan enligt samt både vilket vilken vilka man:0.3 dessutom även`,
  nb: `og i at:0.5 det som en på er av for med til den ikke har de et om var men kan jeg vi fra seg så eller når også
    etter hvordan hva mye mange bare:0.3 mellom gjennom blir deres ved under over der dette denne disse skulle skal
    kommer finnes må sine sin:0.3 sitt hans hennes dem nå da enn alle hver ingen allerede fordi mens uten ifølge
    samt både hvilket hvilken hvilke å ble blitt meg deg oss noen noe dessuten egen eget egne`,
  da: `og i at:2 det som en på er af for med til den ikke har de et om var men kan jeg vi fra sig så eller når også
    efter hvordan hvad meget mange kun mellem gennem bliver deres ved under over der dette denne disse skulle skal
    kommer findes må sine sin:0.3 hans hendes dem nu da end:0.3 alle hver ingen allerede fordi mens uden ifølge
    samt både hvilket hvilken hvilke blev blevet mig dig os nogle noget desuden egen eget egne`,
  fi: `ja on ei se että oli hän joka jotka kun mutta tai myös ovat tämä nämä sen ne niin kuin jos voi voivat mukaan
    sekä jossa joissa hyvin nyt vain kanssa jälkeen yli ollut olla koska siitä sitä tästä joita kaikki paljon
    vielä eli eikä sillä ennen aikana välillä kautta ilman mikä mitä miksi miten missä milloin kuka me te he minä
    sinä olen olet olemme voidaan täytyy esimerkiksi siis kuitenkin usein aina joiden jonka jota siksi oma oman
    omaa`,
  et: `ja on ei see et oli ta mis kui aga või ka need:0.3 selle nagu kes siis veel oma ning üle pärast kõik palju
    ainult koos sest seda mida olema ole saab võib tuleb juba üks kaks kõige väga ehk kuid samuti seal siin nüüd
    alati tihti enne ajal vahel kaudu ilma miks kuidas kus millal meie teie nemad mina sina olen oled oleme nende
    tema teda neid mille millel lisaks näiteks seega siiski kas mitte endale enda käigus juures kohta järgi abil
    jaoks poolt`,
  pl: `i w we na z ze do że się nie jest są o jak ale po co tak za od przez dla czy już tylko który która które
    którzy którą którego której którym których jego jej ich oraz także może być był była było były gdy jeśli
    bardzo tym ten ta te tego tej tych przy pod nad między również aby więc gdzie kiedy dlaczego dzięki jako też
    jednak można należy każdy wszystkie wiele bez przed podczas według ma mają tu`,
  cs: `a se na je v ve že s z ze do o i k ke jsou pro:0.4 ale jako podle od za po tak jeho jejich který která které
    kterou kterého kterém kterým kteří také nebo při už jen když mezi být byl byla bylo byly má mají může mohou
    tím této tento tato toto jsme jsem není však ještě proto protože kde velmi bez před pod nad přes během lze
    každý všechny mnoho tedy aby co jak či jaký jaká jaké jakým`,
  sk: `a sa na je v vo že s z zo do o i k ku sú pre ale ako podľa od za po tak jeho ich ktorý ktorá ktoré ktorú
    ktorého ktorom ktorým ktorí tiež alebo pri už len keď medzi byť bol bola bolo boli má majú môže môžu tým tejto
    tento táto toto sme som nie však ešte preto pretože kde veľmi bez pred pod nad cez počas možno každý všetky
    mnoho teda aby čo či`,
  hr: `je i u na se da za od s su a koji koja koje kojem kojoj kojih kojima ili kao iz o po što ne sa bi biti bio
    bila bilo bili ali te do prema također kada gdje jer vrlo može mogu nije ima imaju samo još već između tijekom
    kroz pri njegov njihov njezin ovaj ova ovo taj ta sve svi jedan jedna jako dakle zato npr ih ga mu nam vam
    treba trebaju čiji sam smo ste bismo biste bih jest jesu oni one ono kako`,
  sl: `je in v na se da za od s z so ki ali kot iz o po kar ne bi biti bil bila bilo bili pa tudi do ko kjer ker
    zelo lahko ni ima imajo samo še že med skozi pri njegov njihov njen ta vse vsi en ena zato sta sem smo ste jih
    ga mu tega te tem teh morajo mora saj torej npr kateri katera katero katere katerih katerem kateremu kako leta`,
  ro: `și si de la în in a cu pe din care o un se nu este sunt mai sau ca că dar pentru prin fi fost au al ale lui
    ei lor acest această aceste acesta acestea acestui fiecare foarte doar când unde cum după între despre până
    fără sub peste poate pot trebuie avea există cel cea cele cei iar deci astfel asupra împreună numai ce mult
    multe unei unui fiind ne vă îl îi atunci`,
  hu: `a az és hogy nem is egy van meg ez azt de mint csak már még el ki be:0.5 fel le vagy volt lesz kell lehet
    után előtt között alatt felett mellett által szerint miatt nagyon sok minden ahol amikor amely amelyek
    amelyet ami aki mert így tehát valamint illetve pedig azonban ezért vannak voltak egyik másik saját ezt ennek
    annak arra erre ezek azok hogyan miért mi ő ők nincs sem során ha hanem`,
  tr: `ve bir bu ile için da de olan olarak ise ki her:0.5 çok daha eder olur gibi sonra onun onlar hem ancak ama
    en göre arasında üzerinde hakkında sadece ayrıca böyle nasıl ne nerede değil var:0.4 yok mi mı mu mü şu o ya
    veya yani kadar diye çünkü eğer bunlar bunun şey olduğu önce sırasında tarafından bulunur vardır olduğunu
    oldukça kendi`,
  az: `və bir bu ilə üçün da də olan olaraq isə ki hər çox daha edir olur kimi sonra onun onlar həm lakin amma ən
    görə arasında üzərində haqqında yalnız həmçinin belə necə nə harada deyil var:0.4 yox mi mı mu mü o ya yəni
    qədər çünki əgər bunlar bunun şey olduğu əvvəl zamanı tərəfindən öz özü edilir olunur`,
  uz: `va bu bilan uchun ham edi emas yoki deb juda bir u ular biz siz esa keyin oldin bo'lib bo'ladi hisoblanadi
    mumkin kerak barcha har qanday nima qaysi shu ushbu orqali asosiy haqida bo'yicha lekin ammo chunki agar hamda
    kabi yana faqat o'z o'rtasida bo'lgan qiladi`,
  id: `yang dan di ini itu dengan untuk dari dalam tidak akan pada adalah juga ke ada oleh atau bisa karena bahwa
    yaitu saja merupakan tersebut tapi tetapi sudah belum telah mereka kami kita saya sangat lebih seperti banyak
    jika kepada antara semua hanya dapat harus serta namun hal secara setelah sebelum selama agar sehingga masih
    bagi para sebagai apa mengapa bagaimana dimana kapan siapa sedang terjadi tentang`,
  ms: `yang dan di ini itu dengan untuk dari dalam tidak akan pada adalah juga ke ada oleh atau boleh kerana bahawa
    iaitu sahaja ialah tetapi sudah belum telah mereka kami kita saya sangat lebih seperti banyak jika kepada
    antara semua hanya dapat harus serta namun hal secara selepas sebelum semasa supaya sehingga masih bagi para
    sebagai apa mengapa bagaimana manakala apabila daripada sedang berlaku tentang`,
  fil: `ang ng sa na ay mga at:0.5 si ni ko mo siya ito iyon iyan hindi para kung may:0.4 mayroon kanyang kaniyang
    nila natin namin tayo kami sila din rin lang lamang po ba pa ka niya ating upang dahil nang kapag kay kina sina
    ano saan bakit paano sino kailan ngunit pero o lahat bawat iba tungkol mula hanggang ayon maaari dapat gaya
    tulad kaya kasi ding raw daw ibang isang dalawang ginagamit tinatawag`,
  vi: `và của là có được trong các cho không những một với người này đã khi để từ đến cũng như về sẽ thì nhiều hay
    hoặc nhưng vì nên rất bởi tại theo trên dưới giữa sau trước đó ra vào lại mà nào gì sao đâu ai chúng họ tôi
    bạn nó ta hơn cả đều chỉ vẫn đang bị làm năm`,
  lt: `ir yra į kad su iš o bet kaip tai jo jos jų buvo nuo per dėl taip ne kuris kuri kurie kurios kurių kuriuos
    arba ar tik dar jau labai tarp po prie apie be:0.5 iki kai kur kodėl kas mes jūs jie jis ji šis ši šie tas ta
    būti gali turi vienas pagal metu kiekvienas visi pat savo tačiau todėl pavyzdžiui kurio kurią kuriame kuriais`,
  lv: `un ir ar no uz par kas ka bet vai arī tā tas šis šī viņš viņa viņi mēs jūs es tu bija būt var:0.4 kā kad
    kur kāpēc jo pēc pirms starp caur līdz pie:0.3 zem virs tikai vēl jau ļoti daudz visi katrs kurš kura kuri
    kuras tiek tika nav savu savā sava tomēr tāpēc piemēram tie:0.3 tās šo šajā kuru kurā lai sev`,
  sq: `e të në dhe i për me që është një nga së u ka janë si do nuk më por edhe ai ajo ata ato kjo ky këto këta
    kur ku sepse shumë pas para mbi nën midis ndërmjet gjatë duke kanë kishte ishte ishin mund duhet vetëm
    gjithashtu atë tij saj tyre cili cila cilat çfarë pse ose apo tek te prej sipas`,
  is: `og að í á er sem til um við með ekki en var hann hún það þeir þær þau af eða frá fyrir sig eru voru hefur
    hafa verið vera þegar eftir einnig mjög þetta þessi þessa hans hennar þeirra allt allir eins milli vegna
    hvernig hvar hvað getur má skal mun yfir undir upp út inn nú sína sinni svo þá því`,
  ga: `an:0.5 na agus is ar le go:0.4 bhí sé sí ag ach nach níl tá atá ní sa san leis don den ó faoi mar chun idir
    trí gach seo sin:0.3 siad muid sibh mé tú a i de do ina iad é í bhfuil raibh cé conas cad cén nuair freisin
    chomh mór orthu air:0.3 uirthi aon dhá eile féin anseo ansin`,
  cy: `y yr a ac yn o i ar mae ei gan wedi am fel ond neu hefyd hyn hwn hon sy sydd roedd bod gyda ein eich eu nhw
    ni chi fe fy dy pan:0.3 lle pam sut beth oherwydd felly rhwng trwy drwy dros ddim nid oedd fod yng ym iawn mwy
    llawer pob rhai un dau cael gall gallu ydy yw ydyn maen gennym i'r o'r a'r â'r yw'r yw' 'r â hi:0.3 ef`,
  mt: `il l u li ma fuq minn għal biex huwa hija huma kien kienet kienu dan din dawn:0.3 jew iżda wkoll meta fejn kif
    għaliex bħala kull ħafna anki bejn wara qabel matul permezz tagħhom tiegħu tagħha jista' tista' għandu
    għandha hemm hawn ta' f' b' m' ukoll mhux ġo lil sa mill tal fil bil għall lill mal sal`,
  sw: `na ya wa kwa za ni katika la cha vya ambayo ambao hii hizi huu kama au pia sana hiyo hilo lakini kuwa kutoka
    kwamba baada kabla wakati hata bado tu zaidi sasa wengi yake wao yao zake ili kila mwa si hakuna ndani juu chini
    nini gani vile hivyo je huo ndiyo hapa pale yetu wetu mimi wewe yeye sisi ninyi hawa wale kubwa nyingi
    mbalimbali ambazo ambacho ambavyo jinsi kuhusu kisha yenyewe`,
  so: `iyo waa ka ku u ee oo la uu ay ah soo wax aad ayaa leh si kale waxaa ama sida laga lagu loo kuwa kii kaas
    taas ayuu ayay waxay wuxuu haddii markii kadib iyada isaga iyaga dhex badan yar ugu mid kala inta halkan sidoo
    maxaa sababtoo waxa ahaa yihiin yahay ahayd`,
  zu: `futhi kanye noma ngoba uma kodwa lapho kakhulu ukuthi ukuze yini abantu kule lokhu lokho leli lesi kusho nje
    kuphela ngaphandle ngemva ngaphambi phakathi kusukela njengoba ngenxa yebo cha kanjani kungani wonke zonke
    bonke lonke sonke ukuba kufanele ngesikhathi ngokuthi ngokwesibonelo kwa nga ku zithi uthi ithi kungaba bese`,
  ca: `el la els les l' un una uns unes de d' del dels al als i o que en és són per amb no es se s' n' seu seva seus
    seves com més però aquest aquesta aquests aquestes aquell aquella molt molts moltes també entre sense sobre
    fins des quan on perquè què qual quals qui ja hi ha han va van era:0.3 eren ser estar està estan pot poden té
    tenen tot tots tota totes altre altra altres mateix mateixa cada després abans durant segons mentre encara ho
    li ens us jo tu ell ella ells elles nosaltres vosaltres pel pels això allò m'`,
  gl: `o a os as un unha uns unhas de do da dos das en no na nos nas por polo pola polos polas para con e é son que
    non se seu súa seus súas ao aos á ás máis moi tamén entre sen sobre ata desde cando onde porque como cal cales
    quen xa hai foi foron ser estar está están era:0.3 eran pode poden ten teñen todo todos toda todas outro outra
    outros outras mesmo cada despois antes durante mentres aínda pero el ela eles elas iso isto este esta estes
    estas ese esa vostede nós eu lle coa co cun cunha dun dunha nun nunha deste desta moitos moitas moito`,
};

/* Letters that point at a language, per occurrence. */
const LATIN_CHARS: Record<string, string> = {
  "ß": "de:3",
  "ä": "de:.8 sv:.8 fi:1 et:.8 sk:.3",
  "ö": "de:.8 sv:.8 fi:.8 et:.8 tr:.8 hu:.6 is:.6 az:.8",
  "ü": "de:.8 tr:.8 hu:.5 et:.6 az:.8 es:.1 ca:.1",
  "õ": "et:2 pt:.8 vi:.3",
  "ã": "pt:2 vi:.5",
  "â": "pt:.5 fr:.5 ro:.8 tr:.3 vi:.5 cy:.3",
  "ç": "fr:.6 pt:.6 ca:.6 tr:.6 sq:.8 az:.6",
  "à": "fr:.8 it:.7 ca:.8 pt:.3 vi:.3",
  "è": "fr:.8 it:.8 ca:.8",
  "é": "fr:.6 es:.3 pt:.3 it:.2 hu:.4 cs:.3 sk:.3 is:.3 ga:.3 ca:.4 gl:.3 vi:.2",
  "ê": "fr:.6 pt:.6 af:.8 vi:.5",
  "ë": "sq:2 nl:.3 af:.6 fr:.1",
  "î": "fr:.5 ro:1.2 af:.3",
  "ï": "fr:.5 nl:.4 af:.4 ca:.3",
  "ô": "fr:.5 pt:.5 sk:.8 af:.6 vi:.3",
  "û": "fr:.8 af:.3 cy:.3",
  "ù": "fr:.6 it:.6",
  "ì": "it:1",
  "ò": "it:.8 ca:.8",
  "í": "es:.3 pt:.3 cs:.5 sk:.4 hu:.4 is:.5 ga:.35 ca:.4 gl:.3 vi:.2",
  "ó": "es:.4 pt:.3 pl:.8 hu:.4 cs:.2 sk:.3 is:.4 ga:.35 ca:.4 gl:.3 vi:.2",
  "ú": "es:.3 pt:.3 hu:.3 cs:.5 sk:.4 is:.4 ga:.35 gl:.2 ca:.2 vi:.2",
  "á": "es:.4 pt:.4 hu:.6 cs:.6 sk:.6 is:.5 ga:.35 gl:.3 vi:.2",
  "ñ": "es:2 gl:1.2 fil:.3",
  "å": "sv:1 nb:1 da:1",
  "æ": "da:1.2 nb:1.2 is:1",
  "ø": "da:1.4 nb:1.4",
  "ł": "pl:3", "ą": "pl:2 lt:1.2", "ę": "pl:2 lt:1.2", "ś": "pl:3", "ć": "pl:1.5 hr:1.5", "ź": "pl:3",
  "ż": "pl:2 mt:1.5", "ń": "pl:3",
  "ř": "cs:3", "ů": "cs:3", "ě": "cs:3", "ď": "cs:1 sk:1", "ť": "cs:1 sk:1", "ň": "cs:1 sk:1",
  "ý": "cs:.5 sk:.5 is:.5",
  "č": "cs:.5 sk:.5 hr:.5 sl:.6 lt:.5 lv:.5",
  "š": "cs:.5 sk:.5 hr:.5 sl:.5 lt:.5 lv:.5 et:.2",
  "ž": "cs:.5 sk:.5 hr:.5 sl:.5 lt:.5 lv:.5 et:.2",
  "ľ": "sk:3", "ĺ": "sk:3", "ŕ": "sk:3",
  "đ": "hr:1.5 vi:1.5",
  "ș": "ro:3", "ț": "ro:3", "ş": "tr:1.5 az:1.5 ro:.8", "ţ": "ro:2", "ă": "ro:2 vi:1",
  "ı": "tr:2 az:2", "ğ": "tr:2 az:2", "ə": "az:4",
  "ő": "hu:3", "ű": "hu:3",
  "ė": "lt:3", "ų": "lt:3", "į": "lt:3", "ū": "lt:1 lv:1.2",
  "ā": "lv:2", "ē": "lv:2", "ī": "lv:2", "ģ": "lv:3", "ķ": "lv:3", "ļ": "lv:3", "ņ": "lv:3",
  "þ": "is:3", "ð": "is:3",
  "ŵ": "cy:3", "ŷ": "cy:3",
  "ħ": "mt:3", "ġ": "mt:3", "ċ": "mt:3",
  "ơ": "vi:3", "ư": "vi:3",
};

/* Letter groups typical of a language, counted once per word. Kept light: they
   separate close neighbours, they never carry a switch on their own. */
const LATIN_SUBS: Array<[string, string]> = [
  ["th", "en:.15"], ["^wh", "en:.3"], ["ght", "en:.5"], ["ing$", "en:.3"], ["ould", "en:.5"],
  ["sch", "de:.5 nl:.3"], ["ung$", "de:.6"], ["keit", "de:.8"], ["heit", "de:.8"], ["lich", "de:.4"], ["^zw", "de:.5"],
  ["ij", "nl:.8"], ["oe", "nl:.2 af:.2"], ["aa", "nl:.3 af:.3 fi:.2 et:.2 so:.2"], ["uu", "nl:.2 fi:.2 et:.2 so:.2"],
  ["heid", "nl:.8"],
  ["eau", "fr:.8"], ["aux$", "fr:.4"], ["eux", "fr:.5"], ["ais$", "fr:.3"], ["ait$", "fr:.3"],
  ["zione", "it:.8"], ["gli", "it:.5"], ["cch", "it:.5"], ["zz", "it:.3"],
  ["ción", "es:1 gl:.6"], ["dad$", "es:.6"],
  ["ção", "pt:1.5"], ["ções", "pt:1.5"], ["ões", "pt:1"], ["nh", "pt:.3 gl:.2 vi:.2"], ["lh", "pt:.4"],
  ["l·l", "ca:2"], ["ció$", "ca:1"], ["ny", "ca:.2 hu:.3 sw:.2"], ["tx", "ca:.3"],
  ["^x", "gl:.2"],
  ["cz", "pl:.6"], ["rz", "pl:.6"], ["sz", "pl:.4 hu:.4"], ["dz", "pl:.3"],
  ["gy", "hu:.6"], ["zs", "hu:.6"], ["cs", "hu:.4"],
  ["ää", "fi:.8 et:.3"], ["yy", "fi:.5"], ["kk", "fi:.3 et:.1"], ["uo", "fi:.3"],
  ["xh", "sq:.6"], ["gj", "sq:.6 nb:.3"], ["dh", "sq:.2 ga:.2 cy:.2 so:.3"], ["zh", "sq:.3"],
  ["bh", "ga:.6"], ["mh", "ga:.6"], ["fh", "ga:.8"], ["aoi", "ga:.6"], ["ao", "ga:.3"], ["^bhf", "ga:1"],
  ["^gc", "ga:.8"], ["^dt", "ga:.6"],
  ["dd", "cy:.4"], ["wy", "cy:.5"], ["yw", "cy:.5"], ["^rh", "cy:.4"], ["ydd", "cy:.8"],
  ["għ", "mt:2"],
  ["mw", "sw:.6"], ["^kw", "sw:.3"],
  ["kj", "nb:.4"], ["sjon", "nb:.6"], ["tion", "da:.3 sv:.3"], ["hed$", "da:.5"], ["het$", "nb:.3 sv:.3"],
  ["sie$", "af:.5"], ["tie$", "nl:.4"], ["^z", "nl:.2"],
  ["ije", "hr:.6"],
  ["ning$", "uz:.6"], ["dagi$", "uz:.4"],
  ["^nga", "zu:.3"],
  ["hl", "zu:.5"], ["dl", "zu:.3"], ["^uku", "zu:.6"], ["^ngo", "zu:.4"], ["^nge", "zu:.4"], ["^izi", "zu:.4"],
  ["^aba", "zu:.3"], ["kh", "zu:.2 so:.1"],
  ["o'", "uz:.8"], ["g'", "uz:.8"],
  ["nya$", "id:.3 ms:.3"], ["kan$", "id:.2 ms:.2"], ["^meng", "id:.3 ms:.3"],
];

const LATIN_PROFILE = makeProfile(LATIN_LANGS, LATIN_WORDS, LATIN_CHARS, LATIN_SUBS);
const L = LATIN_PROFILE.index;

/*
  Phrases English borrows whole. Their words are real French/Latin/Spanish
  function words ("et", "per", "la", "de"), so without this "et al." or "déjà
  vu" would count as foreign evidence inside a perfectly English sentence.
*/
const LOANS = [
  "et al", "et cetera", "per se", "a priori", "a posteriori", "status quo", "vice versa", "de facto", "de jure",
  "ad hoc", "ad infinitum", "in vitro", "in vivo", "in situ", "in silico", "bona fide", "alma mater",
  "modus operandi", "quid pro quo", "curriculum vitae", "sine qua non", "persona non grata", "prima facie",
  "per capita", "per annum", "per cent", "post mortem", "mea culpa", "magnum opus", "carpe diem", "terra firma",
  "c'est la vie", "déjà vu", "deja vu", "je ne sais quoi", "joie de vivre", "raison d'être", "raison d'etre",
  "coup d'état", "coup d'etat", "fait accompli", "tête-à-tête", "laissez-faire", "laissez faire", "savoir-faire",
  "savoir faire", "bon appétit", "bon voyage", "à la carte", "à la mode", "à la", "vis-à-vis", "cul-de-sac",
  "hors d'oeuvre", "hors d'œuvre", "nom de plume", "pièce de résistance", "crème de la crème", "crème brûlée",
  "en route", "en masse", "par excellence", "tour de force", "coup de grâce", "esprit de corps", "force majeure",
  "art nouveau", "belle époque", "la dolce vita", "dolce vita", "al dente", "a cappella", "al fresco",
  "que sera sera", "hasta la vista", "el niño", "la niña", "mise en place", "pas de deux", "fleur de lis",
  "tabula rasa", "homo sapiens", "habeas corpus",
];
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const LOAN_RE = new RegExp(
  `(^|[^\\p{L}\\p{M}'])(?:${[...LOANS].sort((a, b) => b.length - a.length).map(escapeRe).join("|")})(?=[^\\p{L}\\p{M}]|$)`,
  "giu",
);

const LAT_CLASS =
  "A-Za-z\\u00AA\\u00BA\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02AF\\u1E00-\\u1EFF\\u2C60-\\u2C7F\\uA720-\\uA7FF\\uAB30-\\uAB6F\\uFB00-\\uFB06";
/* Modifier letters (ʻ in Uzbek "oʻ") and combining accents (NFD text) belong to the letter before them. */
const LAT_MARKS = "[\\u02B0-\\u02FF]|\\p{M}";
/* A Latin word, with inner apostrophes ("l'eau", "don't", "bo'lib") and the
   Catalan middle dot ("col·legi"); a trailing apostrophe is kept for "ta'", "po'". */
const LAT_RUN = `(?:[${LAT_CLASS}]|${LAT_MARKS})*`;
const LATIN_TOKEN = new RegExp(`[${LAT_CLASS}]${LAT_RUN}(?:['·][${LAT_CLASS}]${LAT_RUN})*'?`, "gu");
const APOSTROPHES = /[’‘ʼʻ`´]/g;
/* Afrikaans "'n" (a/an) is the most common word in the language and unlike anything else. */
const AF_N = /(^|[^\p{L}\p{M}'])'n(?=[^\p{L}\p{M}]|$)/gu;
/* Maltese articles hang on the next word with a hyphen: "il-kelb", "tal-ilma", "ix-xemx". */
const MT_ARTICLE = /(^|[^\p{L}])(?:(?:il|tal|fil|mill|għall|għal|bil|lill|mal|sal)-(?=\p{L})|i([dnrstxżċz])-\2)/giu;
/* Irish mutations capitalise mid-word: "na hÉireann", "i nGaeilge", "an tSeapáin". Needs lower-case letters
   after the capital so "mRNA" and "tRNA" never count. */
const IRISH_MUTATION = /^(?:n|t|h|b|bh|d|g|m|mb|gc|ng|bp|dt|nd)[A-ZÁÉÍÓÚ][a-záéíóú]{2,}/;
/* What can come just before the first word of a sentence (after spaces and opening quotes). */
const SENTENCE_BREAK = ".!?:;…\n\r•–—-*#>|)]\u3002";
const OPENING_PUNCT = "\"'“‘«„‚‹([{¿¡`";

function startsSentence(s: string, at: number): boolean {
  for (let i = at - 1; i >= 0; i--) {
    const c = s[i];
    if (c === "\n" || c === "\r") return true;
    if (c === " " || c === "\t" || c === "\u00a0" || OPENING_PUNCT.includes(c)) continue;
    return SENTENCE_BREAK.includes(c);
  }
  return true;
}

/* A lone letter next to "=", an operator or a digit is a variable or a unit
   ("y = 2x", "v = s / t", "5 m"), not the Spanish "y" or the Czech "v". */
const FORMULA_NEIGHBOUR = /[=+\-*/^<>()[\]{}|%²³0-9]/;

function inFormula(s: string, start: number, end: number): boolean {
  let i = start - 1;
  while (i >= 0 && s[i] === " ") i--;
  let j = end;
  while (j < s.length && s[j] === " ") j++;
  return (i >= 0 && FORMULA_NEIGHBOUR.test(s[i])) || (j < s.length && FORMULA_NEIGHBOUR.test(s[j]));
}

/*
  Letters English never writes in its own lower-case words. A French loanword
  brings é or ç, a Spanish one ñ; nobody writes "ř", "ő", "ə" or "ā" in an
  English sentence except inside a capitalised name, which never counts here.
  Three different words carrying them are as good as function words, which
  matters for languages whose short sentences have few (Czech, Latvian,
  Azerbaijani...).
*/
const STRONG_LETTERS: Record<string, string> = {
  "ř": "cs", "ů": "cs", "ě": "cs", "ý": "cs sk is", "č": "cs sk hr sl lt lv", "š": "cs sk hr sl lt lv et",
  "ž": "cs sk hr sl lt lv et", "ď": "cs sk", "ť": "cs sk", "ň": "cs sk", "ľ": "sk", "ĺ": "sk", "ŕ": "sk",
  "ł": "pl", "ś": "pl", "ź": "pl", "ń": "pl", "ą": "pl lt", "ę": "pl lt", "ż": "pl mt", "ć": "pl hr",
  "ő": "hu", "ű": "hu", "ș": "ro", "ț": "ro", "ţ": "ro", "ş": "ro tr az", "ă": "ro vi",
  "ı": "tr az", "ğ": "tr az", "ə": "az",
  "ė": "lt", "ų": "lt", "į": "lt", "ū": "lt lv", "ā": "lv", "ē": "lv", "ī": "lv", "ģ": "lv", "ķ": "lv",
  "ļ": "lv", "ņ": "lv", "ħ": "mt", "ġ": "mt", "ċ": "mt", "ŵ": "cy", "ŷ": "cy", "þ": "is", "ð": "is",
  "ơ": "vi", "ư": "vi", "đ": "vi hr", "ã": "pt vi", "õ": "pt et vi", "ë": "sq", "ø": "da nb", "æ": "da nb is",
  "å": "sv nb da", "ß": "de", "ä": "de sv fi et", "ö": "de sv fi et tr hu is az", "ü": "de tr hu et az",
};
const STRONG = new Map<string, number[]>();
for (const ch of Object.keys(STRONG_LETTERS)) {
  STRONG.set(ch, STRONG_LETTERS[ch].split(" ").map((c) => LATIN_PROFILE.index[c]));
}

type Scores = {
  /** Everything together: word evidence plus half the letter evidence. */
  total: number[];
  /** Function-word evidence only; a switch between Latin languages needs this, not just accents. */
  word: number[];
  /** Words that point at the language with some specificity (not "de", which a dozen languages use). */
  hits: number[];
  /** Ordinary lower-case words holding a letter English never uses (see STRONG_LETTERS). */
  strong: number[];
  /** How many words were weighed. */
  n: number;
};

function emptyScores(k: number): Scores {
  const zero = () => new Array(k).fill(0);
  return { total: zero(), word: zero(), hits: zero(), strong: zero(), n: 0 };
}

function addWord(sc: Scores, hit: Weighted | undefined, f: number): boolean {
  if (!hit) return false;
  for (const [li, w] of hit) {
    sc.word[li] += w * f;
    if (w * f >= 0.19) sc.hits[li]++; // shared by five languages at most
  }
  return true;
}

function addLetters(p: Profile, chars: number[], tok: string): void {
  for (const ch of tok) {
    const cw = p.chars.get(ch);
    if (cw) for (const [li, w] of cw) chars[li] += w;
  }
  if (tok.length < 2) return;
  for (const sub of p.subs) {
    const ok = sub.at === 1 ? tok.startsWith(sub.s) : sub.at === 2 ? tok.endsWith(sub.s) : tok.includes(sub.s);
    if (ok) for (const [li, w] of sub.w) chars[li] += w;
  }
}

/** How strongly a Latin-script text looks like each Latin-script language. */
function latinScores(text: string): Scores {
  const P = LATIN_PROFILE;
  const k = P.langs.length;
  const sc = emptyScores(k);
  const chars = new Array(k).fill(0);
  let s = text;
  try {
    s = s.normalize("NFC");
  } catch {
    /* keep as is */
  }
  s = s.replace(APOSTROPHES, "'");
  s = s.replace(LOAN_RE, (m: string, pre: string) => pre + " ".repeat(m.length - pre.length));

  LATIN_TOKEN.lastIndex = 0;
  for (let m = LATIN_TOKEN.exec(s); m; m = LATIN_TOKEN.exec(s)) {
    const raw = m[0];
    const rest = raw.slice(1);
    if (rest !== rest.toLowerCase()) {
      // Acronyms, formulas and code (DNA, NaCl, mRNA, getElementById) say nothing
      // about the language, except Irish, which capitalises inside words.
      if (IRISH_MUTATION.test(raw)) {
        sc.word[L.ga] += 1.5;
        sc.hits[L.ga]++;
        sc.n++;
      }
      continue;
    }
    const lower = raw.toLowerCase();
    let f = 1;
    if (raw[0] !== lower[0] && !startsSentence(s, m.index)) {
      // "I" (and "I'm", "I've"...) is English whatever it sits next to.
      if (raw === "I" || /^I'(?:m|ve|ll|d)$/.test(raw)) {
        sc.word[L.en] += 0.8;
        sc.hits[L.en]++;
        sc.n++;
        continue;
      }
      // A capital mid-sentence is a name ("Leonardo da Vinci", "Los Angeles",
      // "Marie Curie"): it barely counts.
      f = 0.25;
    }
    if (lower.length === 1 && inFormula(s, m.index, m.index + 1)) continue;
    sc.n++;
    let stacked = false;
    for (const ch of lower) {
      const cp = ch.codePointAt(0);
      if (cp >= 0x1ea0 && cp <= 0x1ef9) {
        chars[L.vi] += 3; // ạ ả ấ ầ ẩ ...: only Vietnamese stacks tone marks like these
        stacked = true;
      }
    }
    if (f === 1) {
      const seen = new Set<number>();
      if (stacked) seen.add(L.vi);
      for (const ch of lower) for (const li of STRONG.get(ch) ?? []) seen.add(li);
      seen.forEach((li) => sc.strong[li]++);
    }
    if (!addWord(sc, P.words.get(lower), f) && lower.includes("'")) {
      const tail = lower.endsWith("'") ? P.words.get(lower.slice(0, -1)) : undefined;
      if (!addWord(sc, tail, f)) {
        const cut = lower.indexOf("'");
        addWord(sc, P.words.get(lower.slice(0, cut + 1)), f); // l' d' qu' dell'
        const end = lower.endsWith("n't") ? "n't" : lower.slice(lower.lastIndexOf("'"));
        if (end.length > 1) addWord(sc, P.words.get(end), f); // 's 're n't
      }
    }
    addLetters(P, chars, lower);
  }
  const low = s.toLowerCase();
  const afN = low.match(AF_N);
  if (afN) {
    sc.word[L.af] += 2 * afN.length;
    sc.hits[L.af] += afN.length;
  }
  const mt = low.match(MT_ARTICLE);
  if (mt) {
    sc.word[L.mt] += 1.5 * mt.length;
    sc.hits[L.mt] += mt.length;
  }
  for (let i = 0; i < k; i++) sc.total[i] = sc.word[i] + 0.5 * chars[i];
  return sc;
}

/**
 * How much evidence a Latin-script switch needs: at least `minWords` words, a
 * total `ratio` times the current language's (plus `plus`), and either real
 * function words (`minWord` of them, from `minHits` specific words) or
 * `minStrong` ordinary words with letters English never uses, backed by at
 * least `strongLead` more function-word evidence than the current language has.
 */
type Rule = {
  minWords: number;
  minWord: number;
  minHits: number;
  ratio: number;
  plus: number;
  minStrong: number;
  strongLead: number;
};
/* A whole text (notes, a reply): four words of clear evidence, twice the hint's. */
const RULE_TEXT: Rule = { minWords: 4, minWord: 1.2, minHits: 2, ratio: 2, plus: 1, minStrong: 3, strongLead: 0 };
/* One sentence inside a lesson: five words, three times the lesson language's evidence. */
const RULE_SENTENCE: Rule = { minWords: 5, minWord: 2, minHits: 2, ratio: 3, plus: 1.5, minStrong: 3, strongLead: 0.5 };
/* A quoted foreign sentence inside a lesson sentence: four words. */
const RULE_QUOTE: Rule = { minWords: 4, minWord: 1.5, minHits: 2, ratio: 2.5, plus: 1, minStrong: 3, strongLead: 0.3 };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const round2 = (x: number) => Math.round(clamp01(x) * 100) / 100;

/**
 * How sure we are of the winner: how much evidence there is at all, and how
 * far it leads the best rival. A close relative (Danish next to Norwegian,
 * Malay next to Indonesian) only takes a little off: the right family is most
 * of what the voice needs. Being barely ahead on two words takes off a lot.
 */
function certainty(top: number, rival: number): number {
  if (top <= 0) return 0;
  return (0.6 + 0.4 * clamp01(1 - rival / top)) * (1 - Math.exp(-top / 3));
}

/**
 * Pick the Latin-script language. `stay` is the language we already believe
 * (the lesson's, or English); anything else has to clear `rule` to win.
 */
function chooseLatin(sc: Scores, stay: string, rule: Rule): { lang: string; confidence: number } {
  const t = sc.total;
  const hi = L[stay] ?? L.en;
  let b = 0;
  for (let i = 1; i < t.length; i++) if (t[i] > t[b]) b = i;
  if (t[b] <= 0) return { lang: LATIN_LANGS[hi], confidence: 0.1 };
  let rival = 0;
  for (let i = 0; i < t.length; i++) if (i !== b && t[i] > rival) rival = t[i];
  if (b === hi) return { lang: LATIN_LANGS[hi], confidence: Math.max(0.1, certainty(t[b], rival)) };
  const enough = sc.n >= rule.minWords && t[b] >= rule.ratio * t[hi] + rule.plus;
  const byWords = sc.word[b] >= rule.minWord && sc.hits[b] >= rule.minHits;
  const byLetters = sc.strong[b] >= rule.minStrong && sc.word[b] >= sc.word[hi] + rule.strongLead;
  if (enough && (byWords || byLetters)) {
    return { lang: LATIN_LANGS[b], confidence: Math.max(0.3, certainty(t[b], rival)) };
  }
  // Not enough to move: keep what we believed, but say we're unsure.
  const doubt = clamp01((t[b] - t[hi]) / (t[b] + 1));
  return { lang: LATIN_LANGS[hi], confidence: Math.max(0.05, 0.3 * (1 - doubt)) };
}

// ── Scripts shared by several languages ──────────────────────────────────────

/* Arabic script: Persian, Urdu and Pashto each add letters Arabic never uses,
   and write ی/ک where Arabic writes ي/ك. */
const ARABIC_PROFILE = makeProfile(
  ["ar", "fa", "ur", "ps"],
  {
    ar: `في من على إلى الى أن ان هذا هذه التي الذي الذين هو هي هم كان كانت عن مع ما لا قد ثم أو او بين كل بعد عند حيث
      ذلك تلك هناك إذا اذا لكن أيضا ايضا يتم يمكن وهو وهي وفي ومن لم لن ليس حتى منذ خلال عندما لأن`,
    fa: `است و در به از که این را با برای آن یک می هم تا بر هر شود کرد بود نیز اما یا شده دارد کند خود ما شما آنها او
      چه چرا چگونه هستند باشد بین پس همه دیگر وقتی زیرا اگر`,
    ur: `ہے ہیں کے کی کا میں اور سے کو یہ وہ نہیں پر بھی ایک تھا تھے تھی جو کہ لیے ہوتا ہوتی ہوتے کرتے کیا گیا جاتا اس ان
      اپنے کچھ سکتے تک بہت کیوں کیسے جب یا لیکن ذریعے ساتھ بعد پہلے`,
    ps: `د او په چې ده دی دي یو له ته سره هم کې پر څخه لپاره دا هغه دغه وي شي کوي کړي نه یا خو بیا ټول ډېر`,
  },
  {
    "ٹ": "ur:3", "ڈ": "ur:3", "ڑ": "ur:3", "ں": "ur:3", "ے": "ur:3", "ۓ": "ur:3", "ھ": "ur:3", "ہ": "ur:3", "ۂ": "ur:3",
    "ټ": "ps:3", "ځ": "ps:3", "څ": "ps:3", "ډ": "ps:3", "ړ": "ps:3", "ږ": "ps:3", "ښ": "ps:3", "ګ": "ps:3",
    "ڼ": "ps:3", "ې": "ps:3", "ۍ": "ps:3",
    "پ": "fa:1.5 ur:.5 ps:.5", "چ": "fa:1.5 ur:.5 ps:.5", "ژ": "fa:1.5 ur:.3 ps:.5", "گ": "fa:1.5 ur:.5",
    "ی": "fa:.5 ur:.3 ps:.3", "ک": "fa:.5 ur:.3 ps:.3",
    "ي": "ar:1 ps:.2", "ك": "ar:1", "ة": "ar:1", "ى": "ar:.8", "أ": "ar:.5", "إ": "ar:.5", "ؤ": "ar:.3", "ئ": "ar:.2 ps:.2",
  },
  [["^ال", "ar:.3"], ["^وال", "ar:.3"], ["^بال", "ar:.3"], ["^لل", "ar:.2"], ["وں$", "ur:.5"], ["ها$", "fa:.3"]],
);

/* Cyrillic: most of these languages have a letter or two nobody else uses
   (Ukrainian ї є ґ, Serbian ђ ћ, Macedonian ѓ ќ ѕ, Kazakh ә ғ қ ң ұ һ). */
const CYRILLIC_PROFILE = makeProfile(
  ["ru", "uk", "bg", "sr", "mk", "kk", "mn"],
  {
    ru: `и в не на что с как это по но из у к так же от было для мы вы они он она оно его её ее их был была были который
      которая которые которое также очень между через после когда где почему поэтому или этот эта эти того может есть
      при только уже если чтобы всё все во со о об ли бы даже вот этом этого спасибо`,
    uk: `і й та що це як але до на з не для від ми ви вони він вона воно є був була було були які який яка яке також
      дуже між через після коли де чому тому або його її їх цей ця ці цього може при тільки вже якщо щоб все всі у в
      зі із під якого якої яких дякую`,
    bg: `и в не на че с като това по но от за да се е са той тя то те ние вие беше бяха който която които което също
      много между чрез след когато къде защо затова или този тази тези може има при само вече ако всички ще във със
      към`,
    sr: `и у не на да се је су за од са као што који која које али или из по до овај ова ово био била било може када
      где зашто веома између кроз после након такође само већ ако сви његов њихов ће бити би коме`,
    mk: `и во не на да се е за од со како што кој која кое кои но или по до тоа овој оваа ова беше биле може кога каде
      зошто многу меѓу преку после исто само веќе ако сите ќе има нема ја ги го`,
    kk: `және мен бен пен бұл ол да де та те үшін деп бар жоқ емес болып болады сол осы бір екі көп өте арқылы кейін
      дейін туралы бойынша немесе бірақ сондықтан себебі қандай қалай неге кім не`,
    mn: `ба нь юм бол энэ тэр байна байсан болон мөн гэж гэсэн бөгөөд харин хэрэв учир тул дээр доор хооронд дараа
      өмнө их маш бүх нэг хоёр ямар яаж яагаад хэн юу хаана бид тэд би чи`,
  },
  {
    "ы": "ru:2 mn:1 kk:1", "э": "ru:2 mn:1.5 kk:.5", "ё": "ru:3 mn:.5", "ъ": "bg:1.5 ru:.2",
    "і": "uk:2 kk:1.5", "ї": "uk:4", "є": "uk:4", "ґ": "uk:4",
    "ђ": "sr:4", "ћ": "sr:4", "ј": "sr:2 mk:2", "љ": "sr:2 mk:2", "њ": "sr:2 mk:2", "џ": "sr:2 mk:2",
    "ѓ": "mk:4", "ќ": "mk:4", "ѕ": "mk:4",
    "ә": "kk:4", "ғ": "kk:4", "қ": "kk:4", "ң": "kk:4", "ұ": "kk:4", "һ": "kk:4",
    "ө": "mn:2 kk:1", "ү": "mn:2 kk:1",
    "щ": "ru:.3 bg:.5 uk:.5", "й": "ru:.2 uk:.2 bg:.2 kk:.1 mn:.1", "я": "ru:.2 uk:.2 bg:.2 kk:.1 mn:.1",
    "ю": "ru:.2 uk:.2 bg:.2 kk:.1 mn:.1", "ь": "ru:.3 uk:.3 bg:.1",
  },
  [],
);

/* Devanagari: Hindi unless Marathi or Nepali shows clearly (their own grammar
   words, Marathi ळ, Nepali -हरू / -छ endings). */
const DEVANAGARI_PROFILE = makeProfile(
  ["hi", "mr", "ne"],
  {
    hi: `है हैं के की का में और से को यह वह नहीं पर भी एक था थे थी जो कि लिए होता होती होते करते करता करती किया गया जाता ये
      वे इस उस इसे उसे अपने कुछ सकते सकता तक बहुत क्या क्यों कैसे कहाँ जब तब या लेकिन इसलिए द्वारा साथ बाद पहले बीच अन्य
      सभी हम आप मैं तुम`,
    mr: `आहे आहेत आणि हे ही हा या तो ती ते च्या चा ची चे ला ना मध्ये नाही होते होता होती केले करतात करते असते असतात असे
      म्हणून पण किंवा त्या त्याचे त्याची आपण मी आम्ही तुम्ही काही सर्व खूप कसे कुठे केव्हा जेव्हा तेव्हा नंतर आधी दरम्यान
      द्वारे साठी वर खाली मधून पासून पर्यंत`,
    ne: `छ छन् छौं हो हुन् र मा ले लाई बाट पनि यो त्यो यी गर्न गर्छ गर्छन् गरेको गरिन्छ हुन्छ हुन्छन् भएको भन्ने थियो थिए तर
      वा किनभने त्यसैले कसरी किन कहिले सबै धेरै एउटा हामी तपाईं म उनी उनीहरू सक्छ सक्छन् अनुसार पछि अघि माथि तल संग
      सँग`,
  },
  { "ळ": "mr:1.5" },
  [
    ["च्या$", "mr:1"], ["ांना$", "mr:1"], ["हरू", "ne:2"], ["्छ$", "ne:1"], ["छन्$", "ne:1.2"],
    ["ेको$", "ne:.8"], ["लाई$", "ne:1.2"], ["मा$", "ne:.2"],
  ],
);

/** The words of one script group in `text`, marks kept with their letters. */
function tokensOf(text: string, group: number): string[] {
  const out: string[] = [];
  let start = -1;
  for (let i = 0; i < text.length; ) {
    const cp = text.codePointAt(i);
    const len = cp > 0xffff ? 2 : 1;
    const s = scriptOf(cp);
    const g = groupOf(s);
    if (g === group) {
      if (start < 0) start = i;
    } else if (!(s === MARK && start >= 0)) {
      if (start >= 0) out.push(text.slice(start, i));
      start = -1;
    }
    i += len;
  }
  if (start >= 0) out.push(text.slice(start));
  return out;
}

const ARABIC_VOWEL_MARKS = /[\u064b-\u065f\u0670\u0640]/g;

function scriptScores(p: Profile, tokens: string[]): Scores {
  const k = p.langs.length;
  const sc = emptyScores(k);
  const chars = new Array(k).fill(0);
  for (const tok of tokens) {
    // Persian writes the verb prefix می and suffixes with a zero-width non-joiner
    // ("میسازند"): split there so the pieces are looked up as words.
    for (const part of tok.replace(ARABIC_VOWEL_MARKS, "").toLowerCase().split(/[\u200c\u200d]/)) {
      if (!part) continue;
      sc.n++;
      addWord(sc, p.words.get(part), 1);
      addLetters(p, chars, part);
    }
  }
  for (let i = 0; i < k; i++) sc.total[i] = sc.word[i] + chars[i];
  return sc;
}

/**
 * Pick among the languages sharing a script. `solid` languages share it with a
 * much bigger one (Marathi, Nepali next to Hindi) and need clear evidence;
 * a hint in the same script wins unless the text clearly says otherwise.
 */
function pickInScript(
  p: Profile,
  sc: Scores,
  fallback: string,
  hint: string | undefined,
  solid: string[] = [],
): { lang: string; certainty: number } {
  const t = sc.total;
  const di = p.index[fallback];
  const hi = hint !== undefined && hint in p.index ? p.index[hint] : -1;
  let b = 0;
  for (let i = 1; i < t.length; i++) if (t[i] > t[b]) b = i;
  if (t[b] < 0.5) return { lang: hi >= 0 ? p.langs[hi] : fallback, certainty: 0.6 };
  let pick = b;
  if (solid.includes(p.langs[b]) && b !== hi && !(t[b] >= 2 && t[b] >= 1.5 * t[di])) pick = di;
  if (hi >= 0 && pick !== hi && !(t[pick] >= 2 * t[hi] + 1.5)) pick = hi;
  let rival = 0;
  for (let i = 0; i < t.length; i++) if (i !== pick && t[i] > rival) rival = t[i];
  return { lang: p.langs[pick], certainty: Math.max(0.6, certainty(t[pick], rival)) };
}

/** The language of text written in `group` (a non-Latin script). */
function scriptLang(group: number, text: string, hint: string | undefined): { lang: string; certainty: number } {
  if (group === ARABIC) {
    return pickInScript(ARABIC_PROFILE, scriptScores(ARABIC_PROFILE, tokensOf(text, ARABIC)), "ar", hint);
  }
  if (group === CYRILLIC) {
    return pickInScript(CYRILLIC_PROFILE, scriptScores(CYRILLIC_PROFILE, tokensOf(text, CYRILLIC)), "ru", hint);
  }
  if (group === DEVANAGARI) {
    const sc = scriptScores(DEVANAGARI_PROFILE, tokensOf(text, DEVANAGARI));
    return pickInScript(DEVANAGARI_PROFILE, sc, "hi", hint, ["mr", "ne"]);
  }
  if (group === HAN) {
    // Japanese always has kana (particles, verb endings); Chinese has none. A
    // line of kanji alone could be either, so there the lesson decides.
    let han = 0;
    let kana = 0;
    for (const ch of text) {
      const s = scriptOf(ch.codePointAt(0));
      if (s === KANA) kana++;
      else if (s === HAN) han++;
    }
    if (kana > 0 && kana >= 0.02 * (han + kana)) return { lang: "ja", certainty: 0.97 };
    return { lang: hint === "ja" ? "ja" : "zh", certainty: hint === "ja" ? 0.8 : 0.85 };
  }
  const lang = GROUP_DEFAULT[group];
  return lang ? { lang, certainty: 0.97 } : { lang: hint ?? "en", certainty: 0.1 };
}

// ── detectLang ───────────────────────────────────────────────────────────────

/* Enough of a long text to be sure of its language; the rest adds nothing. */
const MAX_CHARS = 60000;

/**
 * How much of the text each script carries, in rough "words", so scripts
 * compare fairly: Han and kana have no spaces (a character is about 0.6 of a
 * word), Thai, Lao, Khmer and Burmese write whole phrases without spaces.
 */
function scriptWeights(text: string): number[] {
  const tokens = new Array(GROUPS).fill(0);
  const letters = new Array(GROUPS).fill(0);
  let cur = -1;
  for (let i = 0; i < text.length; ) {
    const cp = text.codePointAt(i);
    const len = cp > 0xffff ? 2 : 1;
    const s = scriptOf(cp);
    if (s === MARK) {
      i += len;
      continue;
    }
    const g = groupOf(s);
    if (s === NONE) cur = -1;
    else {
      if (g !== cur) tokens[g]++;
      letters[g]++;
      cur = g;
    }
    i += len;
  }
  const weight = tokens.slice();
  weight[HAN] = letters[HAN] * 0.6;
  for (const g of [THAI, LAO, KHMER, MYANMAR]) weight[g] = Math.max(tokens[g], letters[g] / 4);
  weight[NONE] = 0;
  return weight;
}

/**
 * The language of a whole text: a base code from DETECTABLE plus how sure we
 * are (0..1). `hint` is the language we already believe (BCP-47 or base code);
 * with no hint it is English. A different script decides at once; between
 * Latin-script languages the text has to show clear evidence to move off the
 * hint, so a short line mostly keeps it.
 */
export function detectLang(text: string, hint?: string): { lang: string; confidence: number } {
  const hinted = normalizeLang(hint);
  const stay = hinted ?? "en";
  try {
    let s = typeof text === "string" ? text : String(text ?? "");
    if (s.length > MAX_CHARS) s = s.slice(0, MAX_CHARS);
    const weight = scriptWeights(s);
    let total = 0;
    let g = -1;
    for (let i = 0; i < GROUPS; i++) {
      total += weight[i];
      if (weight[i] > 0 && (g < 0 || weight[i] > weight[g])) g = i;
    }
    if (g < 0 || total <= 0) return { lang: stay, confidence: 0 };
    // A real hint whose script carries nearly as much of the text keeps its
    // script. With no hint English is only a default, so mixed text (Hinglish,
    // Arabic notes full of English terms) goes to the other script: its voice
    // copes with the English words, the English voice can't read the rest.
    const hg = LANG_GROUP[stay];
    if (hinted && hg !== g && weight[hg] > 0 && weight[hg] >= 0.75 * weight[g]) g = hg;
    const share = weight[g] / total;
    if (g === LATIN) {
      const r = chooseLatin(latinScores(s), hg === LATIN ? stay : "en", RULE_TEXT);
      return { lang: r.lang, confidence: round2(r.confidence * (0.5 + 0.5 * share)) };
    }
    if (g === OTHER) return { lang: stay, confidence: 0.05 };
    const r = scriptLang(g, s, hg === g ? stay : undefined);
    const amount = Math.min(1, 0.6 + weight[g] / 10);
    return { lang: r.lang, confidence: round2(r.certainty * share * amount) };
  } catch {
    return { lang: stay, confidence: 0 };
  }
}

// ── speechRuns ───────────────────────────────────────────────────────────────

/* Opening brackets and quotes belong with the words after them. */
const OPENERS = "([{«‹“‘„‚\"'¿¡（［｛「『【〈《〔";
const WHITESPACE = /\s/;

/**
 * Where to cut the gap of spaces and punctuation between two runs in different
 * scripts: after the last space, so a comma or full stop stays with the words
 * it ends and an opening quote goes with the words it opens. With no space at
 * all ("DNA-الحمض", "光合作用（photosynthesis）") only the opening brackets move.
 */
function cutGap(text: string, from: number, to: number): number {
  for (let k = to - 1; k >= from; k--) if (WHITESPACE.test(text[k])) return k + 1;
  let k = to;
  while (k > from && OPENERS.includes(text[k - 1])) k--;
  return k;
}

const QUOTE_CLOSERS: Record<string, string> = {
  "“": "”", "„": "“”", "«": "»", "»": "«", "‹": "›", "‚": "‘’", "‘": "’", '"': '"', "'": "'",
};

const isLetterAt = (s: string, i: number) => i >= 0 && i < s.length && IS_LETTER.test(s[i]);

/** Quoted stretches in a Latin-script run: [start, end) including the quote marks. */
function findQuotes(text: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < text.length; i++) {
    const closers = QUOTE_CLOSERS[text[i]];
    if (!closers) continue;
    const c = text[i];
    // A straight or curly single quote is usually an apostrophe ("don't",
    // "students'"): it only opens a quote at the start of a word.
    const single = c === "'" || c === "‘" || c === "‚";
    if ((single || c === '"') && (isLetterAt(text, i - 1) || !isLetterAt(text, i + 1))) continue;
    for (let j = i + 1; j < text.length; j++) {
      if (!closers.includes(text[j])) continue;
      if ((single || c === '"') && isLetterAt(text, j + 1)) continue;
      out.push([i, j + 1]);
      i = j;
      break;
    }
  }
  return out;
}

function latinWordCount(text: string): number {
  LATIN_TOKEN.lastIndex = 0;
  let n = 0;
  while (LATIN_TOKEN.exec(text)) n++;
  return n;
}

type Piece = { start: number; end: number; lang: string };

/**
 * The language(s) of one Latin-script run. It stays in `base` (or English when
 * the lesson is in another script) unless the words clearly say otherwise; a
 * quoted foreign sentence of four words or more gets its own voice.
 */
function latinPieces(text: string, start: number, end: number, base: string): Piece[] {
  const stay = LANG_GROUP[base] === LATIN ? base : "en";
  const run = text.slice(start, end);
  const quotes = findQuotes(run).filter(([a, b]) => latinWordCount(run.slice(a + 1, b - 1)) >= 4);
  let outside = run;
  for (const [a, b] of quotes) outside = outside.slice(0, a) + " ".repeat(b - a) + outside.slice(b);
  const main = chooseLatin(latinScores(outside), stay, RULE_SENTENCE).lang;
  const pieces: Piece[] = [];
  let pos = 0;
  for (const [a, b] of quotes) {
    if (a > pos) pieces.push({ start: start + pos, end: start + a, lang: main });
    const q = chooseLatin(latinScores(run.slice(a + 1, b - 1)), main, RULE_QUOTE).lang;
    pieces.push({ start: start + a, end: start + b, lang: q });
    pos = b;
  }
  if (pos < run.length) pieces.push({ start: start + pos, end, lang: main });
  return pieces;
}

type Segment = { start: number; end: number; group: number; letters: number };

/**
 * One sentence as the pieces each voice should read, in order. Joining the
 * pieces' text gives back the sentence exactly.
 *
 *  - Each script is its own piece: an Arabic phrase inside an English sentence
 *    goes to the Arabic voice; English words inside an Arabic sentence go to
 *    `base` when that is a Latin-script language, else to English.
 *  - Spaces, punctuation and digits never make a piece of their own, and a
 *    piece of one lone letter (a variable "x", an angle "θ") joins its neighbour.
 *  - A Latin-script sentence leaves `base` only on strong evidence (five words
 *    and a wide margin, or a quoted foreign sentence of four words or more).
 */
export function speechRuns(sentence: string, base: string): SpeechRun[] {
  const text = typeof sentence === "string" ? sentence : String(sentence ?? "");
  const lang = normalizeLang(base) ?? "en";
  if (!text) return [];
  try {
    return runsOf(text, lang);
  } catch {
    return [{ text, lang }];
  }
}

function runsOf(text: string, base: string): SpeechRun[] {
  // 1. Cut at every change of script.
  const segs: Segment[] = [];
  let cur: Segment | null = null;
  let lastLetterEnd = 0;
  for (let i = 0; i < text.length; ) {
    const cp = text.codePointAt(i);
    const len = cp > 0xffff ? 2 : 1;
    const s = scriptOf(cp);
    if (s !== NONE && s !== MARK) {
      const g = groupOf(s);
      // A Han character or a Hangul syllable is a whole syllable, not one letter.
      const w = g === HAN || g === HANGUL ? 2 : 1;
      if (!cur) cur = { start: 0, end: 0, group: g, letters: 0 };
      else if (cur.group !== g) {
        const cut = cutGap(text, lastLetterEnd, i);
        cur.end = cut;
        segs.push(cur);
        cur = { start: cut, end: 0, group: g, letters: 0 };
      }
      cur.letters += w;
      lastLetterEnd = i + len;
    }
    i += len;
  }
  if (!cur) return [{ text, lang: base }];
  cur.end = text.length;
  segs.push(cur);

  // 2. A lone letter joins its neighbour (the one before it when there is one).
  for (let k = 0; k < segs.length && segs.length > 1; ) {
    if (segs[k].letters >= 2) {
      k++;
      continue;
    }
    if (k > 0) {
      segs[k - 1].end = segs[k].end;
      segs[k - 1].letters += segs[k].letters;
    } else {
      segs[1].start = segs[0].start;
      segs[1].letters += segs[0].letters;
    }
    segs.splice(k, 1);
    k = Math.max(0, k - 1);
  }
  for (let k = 1; k < segs.length; ) {
    if (segs[k].group === segs[k - 1].group) {
      segs[k - 1].end = segs[k].end;
      segs[k - 1].letters += segs[k].letters;
      segs.splice(k, 1);
    } else k++;
  }

  // 3. A language for each piece.
  const pieces: Piece[] = [];
  for (const seg of segs) {
    if (seg.group === LATIN) pieces.push(...latinPieces(text, seg.start, seg.end, base));
    else if (seg.group === OTHER) pieces.push({ start: seg.start, end: seg.end, lang: base });
    else {
      const hint = LANG_GROUP[base] === seg.group ? base : undefined;
      pieces.push({ start: seg.start, end: seg.end, lang: scriptLang(seg.group, text.slice(seg.start, seg.end), hint).lang });
    }
  }

  // 4. Neighbours in the same language are read together.
  const out: SpeechRun[] = [];
  let open: Piece | null = null;
  for (const p of pieces) {
    if (p.end <= p.start) continue;
    if (open && open.lang === p.lang && open.end === p.start) open.end = p.end;
    else {
      if (open) out.push({ text: text.slice(open.start, open.end), lang: open.lang });
      open = { ...p };
    }
  }
  if (open) out.push({ text: text.slice(open.start, open.end), lang: open.lang });
  return out;
}
