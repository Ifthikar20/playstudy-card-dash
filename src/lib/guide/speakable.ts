/**
 * Roman numerals, read the way a person would say them.
 *
 * Teach mode speaks the notes sentence by sentence, and a TTS voice reads "grade IV"
 * as "grade I-V" and "Henry VIII" as "Henry V-I-I-I". forSpeech() rewrites only the
 * numerals that clearly mean numbers into what should be heard ("grade 4",
 * "Henry the Eighth", "19e siècle") and leaves every other character alone. Captions
 * keep showing the original sentence; this text only goes to the voice.
 *
 * The hard part is knowing WHEN a run of I/V/X/L/C/D/M letters is a numeral. "I think",
 * "an IV drip", "vitamin D", "DC current", "95% CI" and "size XL" must never change, and a
 * wrong rewrite is far worse than a numeral read out letter by letter. So a numeral is only
 * rewritten when something around it proves what it is:
 *   - a keyword right before it: "grade IV", "Chapter XI", "Types I and II", "capítulo V"
 *   - a ruler's or pope's name: "Louis XIV", "John Paul II", "Ramesses II"
 *   - a century word or an ordinal ending: "XIX century", "XIXe siècle", "XIX. Jahrhundert"
 *   - a list marker: "(iv)", "ii)", "iii." at the start of a line
 *   - another capitalised name, for multi-letter numerals only: "Apollo XIII", "Super Bowl LVII"
 * Single letters (I, V, X) need a keyword or a ruler's name, and C, D, L, M alone never change.
 *
 * Languages: en, fr, es, it, pt, de each get their own keywords and their own way of reading
 * a ruler ("Henry the Eighth", "Henri 4", "Felipe segundo", "Luigi quattordicesimo",
 * "Ludwig der Vierzehnte"). Text in any other language is returned untouched rather than
 * guessed at with English rules.
 *
 * Self-contained on purpose (no imports, erasable TypeScript only) so Node runs the tests in
 * scripts/tests directly. It runs on every spoken sentence, so it is one pass over the words.
 */

type Lang = "en" | "fr" | "es" | "it" | "pt" | "de";

const LANGS: readonly string[] = ["en", "fr", "es", "it", "pt", "de"];

/** "fr-FR", "FR", "pt_BR" → the base code; a language we have no rules for → null. */
function baseLang(lang?: string): Lang | null {
  const base = String(lang || "en").trim().toLowerCase().split(/[-_]/)[0] || "en";
  return LANGS.includes(base) ? (base as Lang) : null;
}

/* ------------------------------------------------------------------ numerals */

const ROMAN_VALUE: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
const ROMAN_PAIRS: Array<[number, string]> = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
  [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

function toRoman(n: number): string {
  let out = "";
  for (const [v, s] of ROMAN_PAIRS) {
    while (n >= v) {
      out += s;
      n -= v;
    }
  }
  return out;
}

/**
 * Value of a canonical upper-case numeral (I..MMMCMXCIX), else 0. Writing the value back
 * out and comparing is what rejects "IIII", "IC", "VX", "CIVIL" or "MIMIC": only the one
 * standard spelling of a number counts.
 */
function romanValue(s: string): number {
  if (!s || s.length > 15 || !/^[IVXLCDM]+$/.test(s)) return 0;
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const v = ROMAN_VALUE[s[i]];
    const next = i + 1 < s.length ? ROMAN_VALUE[s[i + 1]] : 0;
    total += v < next ? -v : v;
  }
  return total > 0 && total < 4000 && toRoman(total) === s ? total : 0;
}

interface Numeral {
  value: number;
  /** Written in capitals ("IV"), not as a lower-case list numeral ("iv"). */
  upper: boolean;
  /** The numeral letters themselves. */
  roman: string;
  /** Letters glued on after it: "B" in "IIIB", "e" in "XIXe", "th" in "XIXth". */
  suffix: string;
  /** "sub" = a sub-stage letter (Stage IIIB, Type Ia); "ord" = an ordinal ending (XIXe, XIXth). */
  kind: "" | "sub" | "ord";
}

// Ordinal endings written straight onto a numeral. French does this all the time
// ("XIXe siècle", "François Ier"); English only occasionally ("the XIXth century").
const ORD_ENDING: Partial<Record<Lang, RegExp>> = {
  en: /^([IVXLC]+)(th|st|nd|rd)$/,
  fr: /^([IVXLC]+)(e|ème|eme|è|ᵉ|er|re|ère|ᵉʳ|ʳᵉ)$/,
};

function parseNumeral(word: string, lang: Lang): Numeral | null {
  if (/^[IVXLCDM]+$/.test(word)) {
    const value = romanValue(word);
    if (value) return { value, upper: true, roman: word, suffix: "", kind: "" };
  } else if (/^[ivx]+$/.test(word)) {
    // Lower-case numerals only ever use i, v and x (list markers go up to about xxx);
    // allowing l, c, d, m would turn "mm", "cm", "ml" and "dl" into numbers.
    const value = romanValue(word.toUpperCase());
    if (value) return { value, upper: false, roman: word, suffix: "", kind: "" };
    return null;
  }
  const ord = ORD_ENDING[lang]?.exec(word);
  if (ord) {
    const value = romanValue(ord[1]);
    const first = /^(er|re|ère|ᵉʳ|ʳᵉ)$/.test(ord[2]);
    // "Ier"/"Ire" only mean first; "IIe", "XIXe" only mean second and up.
    if (value && (lang !== "fr" || first === (value === 1))) return { value, upper: true, roman: ord[1], suffix: ord[2], kind: "ord" };
  }
  // A sub-stage letter: "Stage IIIB", "Stage IVC", "Type Ia", "factor Xa", "type IIx fibres".
  const sub = /^([IVX]+)([A-Ea-ex])$/.exec(word);
  if (sub) {
    const value = romanValue(sub[1]);
    if (value) return { value, upper: true, roman: sub[1], suffix: sub[2], kind: "sub" };
  }
  return null;
}

/* ------------------------------------------------------------ number words */

const EN_ORD = [
  "", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth",
  "eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth", "sixteenth", "seventeenth", "eighteenth", "nineteenth",
];
const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const EN_TENS_ORD = ["", "", "twentieth", "thirtieth", "fortieth", "fiftieth", "sixtieth", "seventieth", "eightieth", "ninetieth"];

function enOrdinalWord(n: number): string {
  if (n < 20) return EN_ORD[n];
  const tens = Math.floor(n / 10);
  const unit = n % 10;
  return unit ? `${EN_TENS[tens]}-${EN_ORD[unit]}` : EN_TENS_ORD[tens];
}

/** 1 → "1st", 12 → "12th", 22 → "22nd". */
function enOrdinalDigits(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const end = teen ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th";
  return `${n}${end}`;
}

const ES_ORD = ["", "primero", "segundo", "tercero", "cuarto", "quinto", "sexto", "séptimo", "octavo", "noveno", "décimo"];
const PT_ORD = ["", "primeiro", "segundo", "terceiro", "quarto", "quinto", "sexto", "sétimo", "oitavo", "nono", "décimo"];
const IT_ORD = [
  "", "primo", "secondo", "terzo", "quarto", "quinto", "sesto", "settimo", "ottavo", "nono", "decimo",
  "undicesimo", "dodicesimo", "tredicesimo", "quattordicesimo", "quindicesimo", "sedicesimo", "diciassettesimo",
  "diciottesimo", "diciannovesimo", "ventesimo", "ventunesimo", "ventiduesimo", "ventitreesimo", "ventiquattresimo",
  "venticinquesimo", "ventiseiesimo", "ventisettesimo", "ventottesimo", "ventinovesimo", "trentesimo",
];
// German ordinal stems; the ending depends on case and gender ("der Vierzehnte", "dem Vierzehnten").
const DE_ORD = [
  "", "Erst", "Zweit", "Dritt", "Viert", "Fünft", "Sechst", "Siebt", "Acht", "Neunt", "Zehnt",
  "Elft", "Zwölft", "Dreizehnt", "Vierzehnt", "Fünfzehnt", "Sechzehnt", "Siebzehnt", "Achtzehnt", "Neunzehnt",
  "Zwanzigst", "Einundzwanzigst", "Zweiundzwanzigst", "Dreiundzwanzigst", "Vierundzwanzigst", "Fünfundzwanzigst",
  "Sechsundzwanzigst", "Siebenundzwanzigst", "Achtundzwanzigst", "Neunundzwanzigst", "Dreißigst",
];

/** Spanish/Portuguese ordinal words stop at ten: above that both languages say the cardinal ("Alfonso trece"). */
function iberianOrdinal(lang: "es" | "pt", n: number, fem: boolean): string {
  const word = (lang === "es" ? ES_ORD : PT_ORD)[n];
  if (!word) return String(n);
  return fem ? word.replace(/o$/, "a") : word;
}

/** Italian says ordinals for rulers and centuries all the way up ("Luigi quattordicesimo"). */
function italianOrdinal(n: number, fem: boolean): string {
  const word = IT_ORD[n];
  if (!word) return String(n);
  return fem ? word.replace(/o$/, "a") : word;
}

/* ------------------------------------------------------------------ keywords */

const words = (list: string): ReadonlySet<string> => new Set(list.trim().split(/\s+/));

// What a keyword allows after it (bit flags).
/** Also names a variable in maths or code ("the volume V", "class X extends"): a lone V or X needs more proof. */
const VAR = 1;
/** A lone X after it is a name, not ten ("Generation X", "Model X"). */
const NO_X = 2;
/** A lone V after it is volts ("the unit V"). */
const NO_V = 4;
/** The numeral after it is read as an ordinal ("siglo V" → "siglo quinto", "secolo XIX" → "secolo diciannovesimo"). */
const ORD = 8;
/** Only multi-letter numerals ("p. xiv" is a preface page; "p. I" is too easily something else). */
const MULTI = 16;
/** A number sign ("No.", "Nr.", "nº"): stands alone or between a keyword and the numeral. */
const SIGN = 32;
/** "World War": a lone I after it is the numeral unless a verb follows ("the world war I studied"). */
const WAR = 64;

function table(groups: Array<[string, number]>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [list, flags] of groups) for (const w of list.trim().split(/\s+/)) out[w] = flags;
  return out;
}

// Keywords are matched lower-cased; abbreviations keep their dot ("vol.", "fig.").
const KEYWORDS: Record<Lang, Record<string, number>> = {
  en: table([
    [
      "grade grades stage stages phase phases tier tiers category categories chapter chapters part parts book books " +
        "act acts scene scenes article articles section sections appendix appendices appendixes annex annexes " +
        "schedule schedules clause clauses lesson lessons psalm psalms canto cantos division divisions league leagues " +
        "title titles vatican amendment amendments protocol protocols paragraph paragraphs plate plates episode episodes " +
        "symphony symphonies sonnet sonnets movement movements stanza stanzas dynasty dynasties nerve nerves lead leads " +
        "complex complexes photosystem photosystems council pillar pillars war wars olympiad mk " +
        "vol. vols. fig. figs. ch. chap. sec. sect. art. pt. bk. para. app. mk. ep. cn",
      0,
    ],
    [
      "type types class classes factor factors form forms level levels step steps module modules series volume volumes " +
        "figure figures table tables item items rule rules problem problems question questions exercise exercises round rounds",
      VAR,
    ],
    ["generation generations gen model models mark marks", VAR | NO_X],
    ["unit units", VAR | NO_V],
    ["p. pp. page pages", MULTI],
    ["no. nos. nº n°", SIGN],
  ]),
  fr: table([
    [
      "chapitre chapitres partie parties tome tomes livre livres acte actes scène scènes article articles section sections " +
        "annexe annexes titre titres stade stades grade grades phase phases catégorie catégories leçon leçons chant chants " +
        "planche planches division divisions ligue ligues concile vatican amendement amendements protocole protocoles " +
        "psaume psaumes paragraphe paragraphes alinéa alinéas dynastie dynasties épisode épisodes symphonie symphonies " +
        "complexe complexes photosystème photosystèmes nerf nerfs vol. fig. chap. art.",
      0,
    ],
    ["type types classe classes facteur facteurs niveau niveaux étape étapes module modules série séries volume volumes figure figures tableau tableaux", VAR],
    ["génération générations modèle modèles", VAR | NO_X],
    ["unité unités", VAR | NO_V],
    ["no. nº n°", SIGN],
  ]),
  es: table([
    [
      "capítulo capítulos parte partes tomo tomos libro libros acto actos escena escenas artículo artículos sección secciones " +
        "anexo anexos título títulos estadio estadios etapa etapas grado grados fase fases categoría categorías lección lecciones " +
        "canto cantos lámina láminas división divisiones liga ligas concilio vaticano enmienda enmiendas protocolo protocolos " +
        "salmo salmos párrafo párrafos dinastía dinastías episodio episodios sinfonía sinfonías complejo complejos " +
        "fotosistema fotosistemas nervio nervios tema temas vol. fig. cap. art.",
      0,
    ],
    ["tipo tipos clase clases factor factores nivel niveles paso pasos módulo módulos serie series volumen volúmenes figura figuras tabla tablas", VAR],
    ["generación generaciones modelo modelos", VAR | NO_X],
    ["unidad unidades", VAR | NO_V],
    ["siglo siglos milenio milenios", ORD],
    ["núm. nº n° no.", SIGN],
  ]),
  it: table([
    [
      "capitolo capitoli parte parti tomo tomi libro libri atto atti scena scene articolo articoli sezione sezioni " +
        "allegato allegati titolo titoli stadio stadi grado gradi fase fasi categoria categorie lezione lezioni canto canti " +
        "tavola tavole divisione divisioni lega leghe concilio vaticano emendamento emendamenti protocollo protocolli " +
        "salmo salmi paragrafo paragrafi dinastia dinastie episodio episodi sinfonia sinfonie complesso complessi " +
        "fotosistema fotosistemi nervo nervi vol. fig. cap. art.",
      0,
    ],
    ["tipo tipi classe classi fattore fattori livello livelli passo passi modulo moduli serie volume volumi figura figure tabella tabelle", VAR],
    ["generazione generazioni modello modelli", VAR | NO_X],
    ["unità", VAR | NO_V],
    ["secolo secoli millennio millenni", ORD],
    ["n. num. nº n°", SIGN],
  ]),
  pt: table([
    [
      "capítulo capítulos parte partes tomo tomos livro livros ato atos acto actos cena cenas artigo artigos secção secções " +
        "seção seções anexo anexos título títulos estádio estádios estágio estágios grau graus fase fases categoria categorias " +
        "lição lições canto cantos divisão divisões liga ligas concílio vaticano emenda emendas protocolo protocolos " +
        "salmo salmos parágrafo parágrafos dinastia dinastias episódio episódios sinfonia sinfonias complexo complexos " +
        "fotossistema fotossistemas nervo nervos vol. fig. cap. art.",
      0,
    ],
    ["tipo tipos classe classes fator fatores factor factores nível níveis passo passos módulo módulos série séries volume volumes figura figuras tabela tabelas", VAR],
    ["geração gerações modelo modelos", VAR | NO_X],
    ["unidade unidades", VAR | NO_V],
    ["século séculos milénio milênio milénios milênios", ORD],
    ["núm. nº n° no.", SIGN],
  ]),
  de: table([
    [
      "kapitel teil teile band bände buch bücher akt akte szene szenen artikel abschnitt abschnitte anhang anlage anlagen " +
        "titel stadium stadien grad phase phasen kategorie kategorien lektion lektionen gesang tafel tafeln division liga " +
        "konzil vatikanum protokoll protokolle psalm psalmen paragraf paragraph absatz dynastie episode episoden " +
        "sinfonie symphonie komplex komplexe photosystem nerv hirnnerv abb. bd. kap. art.",
      0,
    ],
    ["typ typen klasse klassen faktor faktoren stufe stufen schritt schritte modul module serie serien abbildung abbildungen tabelle tabellen", VAR],
    ["generation generationen modell modelle", VAR | NO_X],
    ["einheit einheiten", VAR | NO_V],
    ["nr. no. nº", SIGN],
  ]),
};

// Joins a numeral to the next one in a list after a keyword: "Types I and II", "stages III–IV".
const CONNECTORS: Record<Lang, ReadonlySet<string>> = {
  en: words("and or to through thru"),
  fr: words("et ou à"),
  es: words("y o a al hasta"),
  it: words("e ed o a al"),
  pt: words("e ou a até"),
  de: words("und oder bis"),
};

/* --------------------------------------------------------------- the English "I" */

// After a keyword, "I" is usually the numeral ("Type I diabetes") but can be the pronoun
// ("the part I like"). These words after it show which one it is.

/** Nouns a numeral qualifies ("Type I diabetes", "type V collagen"): the pronoun never comes before them. */
const I_NOUN_NEXT = words(`
  diabetes diabetic diabetics trial trials studies cancer cancers carcinoma carcinomas tumour tumours tumor tumors
  lesion lesions disease diseases error errors hypersensitivity reaction reactions collagen fibre fibres fiber fibers
  muscle muscles supernova supernovae receptor receptors drug drugs agent agents antiarrhythmic antiarrhythmics antigen
  antigens molecule molecules protein proteins enzyme enzymes inhibitor inhibitors deficiency evidence recommendation
  recommendations restriction interferon interferons respiratory failure block hypertension obesity cell cells pneumocyte
  pneumocytes alveolar bond bonds civilisation civilization leiden cavity cavities restoration restorations fracture
  fractures burn burns injury injuries sprain sprains symptom symptoms patients response responses site sites compound
  compounds storm storms hurricane hurricanes star stars galaxy galaxies deficiencies mutation mutations allele alleles
  heart antibody antibodies hormone hormones
`);

/** Small words and -s verbs that follow a numeral but never the pronoun "I" ("Part I of", "Book I covers"). */
const I_VERB_NEXT = words(`
  of is has does in for with versus vs covers describes shows explains lists contains introduces deals examines begins
  ends focuses involves includes refers affects occurs causes results requires means consists comprises lasts follows
  represents corresponds differs tends features looks discusses presents provides gives marks starts opens concludes
  continues measures becomes remains appears seems applies relates allows helps makes
`);

/** Words that follow the pronoun: "the lesson I learned", "the type I prefer", "No. I think". */
const I_PRONOUN_NEXT = words(`
  am was were have had will would shall should can could may might must do did didn don dont cannot couldn wouldn won
  wasn haven hadn shouldn also always never often usually sometimes really just still only even already actually probably
  then now once recently think thought know knew guess mean meant hope believe feel felt suppose want wanted need needed
  love loved like liked hate hated prefer preferred enjoy enjoyed remember remembered forget forgot see saw read wrote
  write made make took take learned learnt learn found find said say told tell chose choose picked pick got get go went
  came come use used study studied teach taught bought buy watched watch heard hear tried try played play visited reached
  finished finish started start passed failed missed keep kept call called give gave put agree disagree understand
  understood reckon wonder wish expect expected fought lived live
`);

/** A ruler's name then "I" is the numeral, unless it plainly starts a clause: "Mary I think…". */
const REGNAL_PRONOUN_NEXT = words(`
  am think thought know knew guess mean meant hope believe feel felt suppose want wanted need needed love loved like liked
  really just also don didn cannot wonder wish agree disagree reckon
`);

/** "told Mary I would…": a verb before the name makes the "I" a pronoun. */
const TELL_VERBS = words(`
  told tell tells ask asked asks thank thanked thanks let lets help helped gave give show showed taught teach remind reminded
  warn warned promised promise wrote texted called emailed said says bet assure assured
`);

/* ------------------------------------------------------------------- rulers */

// Rulers, popes and pharaohs whose names take a numeral, in the spellings of the six
// languages. A capitalised word from this list then a numeral is read as a regnal name.
const REGNAL = words(`
  Henry Henri Enrique Enrico Henrique Heinrich Edward Édouard Edouard Eduardo Edoardo Eduard George Georges Jorge Giorgio Georg
  William Guillaume Guillermo Guglielmo Guilherme Wilhelm Willem Elizabeth Elisabeth Élisabeth Elisabetta Isabel Isabella
  Isabelle Isabela Louis Luis Luís Luigi Ludwig Lodewijk Charles Carlos Carlo Karl Carl Carol James Jacques Jaime Giacomo
  Jakob Richard Ricardo Riccardo John Jean Juan Giovanni João Johann Johannes Mary Marie María Maria Anne Anna Ana Victoria
  Vittoria Philip Philippe Felipe Filippo Filipe Philipp Frederick Frédéric Federico Frederico Friedrich Peter Pierre
  Pedro Pietro Catherine Catalina Caterina Katharina Nicholas Nicolas Nicolás Nicola Nikolaus Nicolau Alexander Alexandre
  Alejandro Alessandro Ivan Iván Pius Pie Pío Pio Benedict Benoît Benedicto Benedetto Bento Benedikt Gregory Grégoire
  Gregorio Gregório Gregor Leo Léon León Leone Leão Innocent Inocencio Innocenzo Inocêncio Innozenz Clement Clément Clemente
  Klemens Urban Urbain Urbano Paul Paolo Pablo Paulo Francis François Francisco Francesco Franz Boniface Bonifacio
  Bonifácio Bonifatius Sixtus Sixte Sisto Sixto Julius Jules Julio Giulio Júlio Adrian Hadrian Adrien Adriano Martin
  Martín Martino Celestine Célestin Celestino Eugene Eugène Eugenio Eugen Callixtus Calixte Honorius Marcellus Sergius
  Ramesses Rameses Ramses Ramsès Thutmose Thoutmôsis Tuthmosis Amenhotep Aménophis Amenemhat Senusret Sesostris Seti Séthi
  Psamtik Nectanebo Ptolemy Ptolémée Tolomeo Ptolomeo Ptolemaios Cleopatra Cléopâtre Kleopatra Napoleon Napoléon Napoleone
  Napoleão Otto Othon Ottone Constantine Constantin Constantino Costantino Konstantin Justinian Justinien Justiniano
  Giustiniano Theodosius Théodose Teodosio Rudolf Rodolphe Rodolfo Ferdinand Fernando Ferdinando Alfonso Alphonse Afonso
  Alfons Sancho Ramiro Gustav Gustave Gustavo Gustaf Gustavus Christian Haakon Håkon Olaf Olav Harald Magnus Eric Erik
  Canute Cnut Knut Harold Malcolm Robert David Kenneth Umberto Humbert Emanuele Emmanuel Manuel Mehmed Mehmet Suleiman
  Süleyman Soliman Selim Murad Bayezid Osman Mahmud Darius Xerxes Artaxerxes Cyrus Cambyses Antiochus Seleucus Attalus
  Mithridates Tigranes Stephen Étienne Esteban Stefano Estêvão Stephan István Béla Bela Ladislaus Ladislas László Casimir
  Kazimierz Sigismund Sigismond Segismundo Władysław Wladyslaw Boleslaw Bolesław Mieszko Wenceslaus Václav Ottokar
  Kamehameha Rama Sebastian Sebastião Sebastián Dinis Duarte Miguel Michael Albert Leopold Léopold Leopoldo Amadeus
  Amedeo Lothair Lothaire Pepin Clovis Childeric Dagobert Alexios Alexius Andronikos Romanos Nikephoros Basil Valentinian
  Tiberius Hassan Mohammed Abdullah Faisal Fayçal Farouk Fuad Menelik Tewodros Yohannes Baudouin Rainier Juliana Beatrix
  Wilhelmina Christina Christine Cristina Margaret Marguerite Margarita Margherita Margarida Margarethe Joanna Juana Jeanne
  Giovanna Joana Johanna Ulrika Eleanor Leonor Blanche Urraca Theodora Irene Arsinoe Berenice Paulo
`);

/** Queens and empresses, for the languages whose ordinals agree with the ruler ("Isabel segunda", "Elisabeth die Zweite"). */
const FEMININE = words(`
  Elizabeth Elisabeth Élisabeth Elisabetta Isabel Isabella Isabelle Isabela Mary Marie María Maria Anne Anna Ana Victoria
  Vittoria Catherine Catalina Caterina Katharina Cleopatra Cléopâtre Kleopatra Juliana Beatrix Wilhelmina Christina
  Christine Cristina Margaret Marguerite Margarita Margherita Margarida Margarethe Joanna Juana Jeanne Giovanna Joana
  Johanna Ulrika Eleanor Leonor Blanche Urraca Theodora Irene Arsinoe Berenice
`);

/* ------------------------------------------------------ centuries and the like */

// A numeral right before one of these nouns is an ordinal: "the XIX century", "XIXe siècle",
// "XIX secolo", "II guerra mondiale", "XIX. Jahrhundert". Value = true for feminine nouns.
const ORD_NOUNS: Record<Lang, Record<string, boolean>> = {
  en: nounGender("century centuries millennium millennia dynasty dynasties olympiad olympics olympic corps", ""),
  fr: nounGender(
    "siècle siècles millénaire millénaires arrondissement arrondissements étage régiment corps concile congrès plan reich empire",
    "dynastie dynasties république armée symphonie législature croisade olympiade internationale",
  ),
  es: nounGender("congreso concilio milenio imperio reich ejército cuerpo", "guerra república dinastía legislatura cruzada olimpiada"),
  it: nounGender(
    "secolo secoli millennio millenni concilio congresso reich impero corpo",
    "guerra dinastia repubblica legislatura crociata olimpiade armata",
  ),
  pt: nounGender("congresso concílio milénio milênio império exército", "guerra república dinastia legislatura cruzada olimpíada"),
  de: nounGender(
    "jahrhundert jahrhunderts jahrhunderte jahrtausend jahrtausends weltkrieg weltkriegs weltkrieges reich reichs korps " +
      "konzil kongress parteitag kreuzzug",
    "dynastie armee symphonie sinfonie internationale legislaturperiode republik olympiade",
  ),
};

function nounGender(masc: string, fem: string): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const w of masc.trim().split(/\s+/)) if (w) out[w] = false;
  for (const w of fem.trim().split(/\s+/)) if (w) out[w] = true;
  return out;
}

/* ----------------------------------------------------------- other names */

/**
 * Capitalised words that are not names, so "<Word> XIII" is not "Apollo XIII": sentence
 * openers, articles and imperatives ("Start IV fluids", "Give IX…"), in the six languages.
 */
const NOT_NAMES = words(`
  a an the and or but if in on at of for to by with from as is was are were be been this that these those it he she we
  they you his her their our my your its also then now so yes not all some many most each every both only just even
  here there where what which who whom whose how why when while after before since until see use give start begin stop
  take get make let try note remember consider administer continue check add apply read write compare look watch think
  imagine recall review draw label name list find solve calculate avoid keep set put call ask tell show explain describe
  define identify choose pick answer size vitamin hepatitis day days week month year dr mr mrs ms prof sir dear hi hello
  thanks fig figure table page grade stage via per than like about into onto over under between during
  le la les un une des du de et ou en au aux ce cette il elle nous vous ils sur dans par pour avec sans
  el los las uno una y o con por para del al este esta lo gli e di da su tra fra della nel nella
  os um uma em do da no na der die das ein eine und oder im am an auf mit von vom zu zum zur für bei nach aus seit über unter
`);

/** Multi-letter numerals that are just as often abbreviations ("Washington DC", "size XL", "the LV wall", "XX chromosomes"). */
const ACRONYM_LIKE = words("XL XC XX XXX LI LV LX LXX LIV LIX DC CD CV CC CI CL CM DI DL DV DX MC MD MI ML MM MV MX MIX DIX CIV DIV MCM MDI DVI CDI CCC MMM");

/** After a keyword the field is narrower, but these still read as abbreviations first ("type DC motor", "class MI"). */
const ACRONYM_AFTER_KEYWORD = words("CC CD CL CM DC DL DI DV DX MC MD MI ML MM MV MX CI CV");

/** "IV" before these is intravenous, whatever comes before it ("Rocky IV" yes, "Morphine IV infusion" no). */
const IV_MEDICAL = words(`
  fluid fluids drip drips line lines access antibiotic antibiotics therapy infusion infusions bolus dose doses route
  administration cannula catheter push injection injections morphine drug drugs medication medications iron contrast
  hydration saline paracetamol acetaminophen insulin furosemide ceftriaxone vancomycin
`);

// German case in front of a ruler, so the ordinal agrees: "unter Ludwig dem Vierzehnten".
const DE_DATIVE = words("mit von vom bei beim nach zu zum zur seit aus unter gegenüber dem");
const DE_ACCUSATIVE = words("für gegen durch ohne um den");
const DE_TITLES = words("König Königin Kaiser Kaiserin Papst Zar Zarin Pharao Sultan Herzog Herzogin Fürst Kurfürst Prinz Prinzessin Graf");

// Elements whose charge is written as a numeral: "iron(III) oxide" is said "iron three oxide".
const ELEMENTS = words(`
  iron fer hierro ferro eisen copper cuivre cobre rame kupfer lead plomb plomo piombo chumbo blei tin étain estaño stagno
  estanho zinn manganese manganèse manganeso manganês mangan chromium chrome cromo chrom cobalt cobalto kobalt nickel
  níquel nichel mercury mercure mercurio mercúrio quecksilber gold oro ouro silver argent plata argento prata silber
  platinum platine platino platina platin titanium titane titanio titânio titan vanadium vanadio vanádio sulfur sulphur
  soufre azufre zolfo enxofre schwefel nitrogen azote nitrógeno azoto nitrogénio stickstoff phosphorus phosphore fósforo
  fosforo phosphor chlorine chlore cloro chlor carbon carbone carbono carbonio kohlenstoff uranium uranio urânio uran
  cerium thallium osmium molybdenum tungsten tungstène wolframio wolfram palladium paladio palladio antimony antimoine
  antimonio antimon arsenic arsenico arsen bismuth bismuto bismut
  Fe Cu Pb Sn Mn Cr Co Ni Hg Au Ag Pt Ti V Mo W Ce Eu Tl U Os Ru Ir Pd Sb As Bi S N P Cl
`);

/* ------------------------------------------------------------------- scanner */

interface Word {
  w: string;
  s: number;
  e: number;
}

interface Ctx {
  text: string;
  lang: Lang;
  words: Word[];
  nums: Array<Numeral | null>;
  /** How each word was rewritten: "kw" after a keyword (so a list can carry on: "Types I and II"). */
  done: string[];
  /** The keyword flags behind each "kw" rewrite, so "siglos XV y XVI" reads both as ordinals. */
  flags: number[];
}

interface Edit {
  s: number;
  e: number;
  text: string;
  mode: string;
  flags?: number;
}

/** What sits right after a numeral. */
interface After {
  /** Nothing more, or punctuation that closes the phrase: "grade IV.", "Act I, Scene I", "Type I (juvenile)". */
  stop: boolean;
  /** "type I or type II": a connector, the same kind of keyword again, then a numeral. */
  parallel: boolean;
  /** The next word when only spaces separate them, lower-cased; "" otherwise. */
  word: string;
  /** Another numeral follows in a list: "I and II", "III/IV", "I–II". */
  chain: boolean;
  /** "Henry VIII's". */
  possessive: boolean;
}

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const MATH_LEFT = /[=+×·*^<>≈≤≥−÷]$/;
const MATH_RIGHT = /^[=+×·*^<>≈≤≥−÷]/;

/**
 * The characters around a word show when it is part of something else and must be left
 * alone: a number or code ("IV2", "x_i", "`MIX`"), a URL or address, a contraction ("I'm"),
 * an abbreviation ("i.e."), a formula ("V = IR", "I/O").
 */
function edges(text: string, s: number, e: number): { ok: boolean; possessive: boolean; slash: boolean; listOnly: boolean } {
  const res = { ok: false, possessive: false, slash: false, listOnly: false };
  const before = text[s - 1] || "";
  const after = text[e] || "";
  const after2 = text[e + 1] || "";
  // After a slash it can only be the next item of a list ("Stage III/IV"); decide() checks that.
  res.listOnly = before === "/" && /\p{L}/u.test(text[s - 2] || "");
  if (/[\p{N}_@#$%&*+=<>|\\`^~.]/u.test(before) || (before === "/" && !res.listOnly)) return res;
  if (/[\p{N}_@#$%&*+=<>|\\`^~]/u.test(after)) return res;
  if ((after === "." || after === ":") && LETTER_OR_DIGIT.test(after2)) return res;
  if (after === "'" || after === "’") {
    if (/s/i.test(after2) && !LETTER_OR_DIGIT.test(text[e + 2] || "")) res.possessive = true;
    else if (/\p{L}/u.test(after2)) return res;
  }
  res.slash = after === "/";
  let ticks = 0;
  for (let k = text.indexOf("`"); k !== -1 && k < s; k = text.indexOf("`", k + 1)) ticks++;
  if (ticks % 2) return res;
  const chunkStart = Math.max(text.lastIndexOf(" ", s), text.lastIndexOf("\n", s)) + 1;
  const spaceAfter = text.slice(e).search(/\s/);
  const chunk = text.slice(chunkStart, spaceAfter < 0 ? text.length : e + spaceAfter);
  if (/:\/\/|www\.|@/.test(chunk)) return res;
  if (MATH_LEFT.test(text.slice(0, s).trimEnd()) || MATH_RIGHT.test(text.slice(e).trimStart())) return res;
  res.ok = true;
  return res;
}

/** A lone I/V/X, or a longer numeral: what may continue a list ("Types I and II", not "grades I and C"). */
function listable(n: Numeral | null): boolean {
  return !!n && n.kind !== "ord" && (n.roman.length > 1 || /^[IVXivx]$/.test(n.roman));
}

/** Index of the next numeral in a list after word i ("III/IV", "I, II and III", "XV y XVI"), else -1. */
function chainNext(ctx: Ctx, i: number): number {
  const { text, words, nums, lang } = ctx;
  const me = nums[i];
  const a = words[i + 1];
  if (!me || !a) return -1;
  const same = (k: number) => listable(nums[k]) && nums[k].upper === me.upper;
  const gap = text.slice(words[i].e, a.s).trim();
  if (/^[,/&+–—-]$/.test(gap) && same(i + 1)) return i + 1;
  if ((gap === "" || gap === ",") && CONNECTORS[lang].has(a.w.toLowerCase())) {
    const b = words[i + 2];
    if (b && /^\s+$/.test(text.slice(a.e, b.s)) && same(i + 2)) return i + 2;
  }
  return -1;
}

function afterInfo(ctx: Ctx, i: number, possessive: boolean): After {
  const { text, words, nums, lang } = ctx;
  const nx = words[i + 1];
  const g = text.slice(words[i].e, nx ? nx.s : text.length).trim();
  const kw = words[i + 2];
  const parallel =
    !!nx &&
    !!kw &&
    g === "" &&
    CONNECTORS[lang].has(nx.w.toLowerCase()) &&
    KEYWORDS[lang][kw.w.toLowerCase()] !== undefined &&
    !!nums[i + 3];
  return {
    parallel,
    stop: g === "" ? !nx : /^[.,;:!?()[\]{}”"'’»…–—]/.test(g),
    word: g === "" && nx ? nx.w.toLowerCase() : "",
    chain: chainNext(ctx, i) >= 0,
    possessive,
  };
}

/** The start of the text or a line, or right after ":" / ";" / a bullet: where list markers live. */
function listStart(text: string, pos: number): boolean {
  const pre = text.slice(0, pos).replace(/[ \t\xA0]+$/, "");
  return pre === "" || /[\n:;]$/.test(pre) || /(^|\n)\s*[-*•·–—]$/.test(pre);
}

/** First word of a sentence ("Start IV fluids", "Give IX…"), where a capital proves nothing. */
function sentenceStart(text: string, pos: number): boolean {
  const pre = text.slice(0, pos).replace(/[ \t\xA0"'“‘«¿¡([*_]+$/, "");
  return pre === "" || /[.!?:;…\n]$/.test(pre);
}

/** "(v)" is item five only when "(iv)" or "(vi)" is nearby; alone it is usually a symbol ("velocity (v)"). */
function hasSibling(text: string, n: Numeral): boolean {
  for (const v of [n.value - 1, n.value + 1]) {
    if (v < 1) continue;
    const r = n.upper ? toRoman(v) : toRoman(v).toLowerCase();
    if (text.includes(`(${r})`) || new RegExp(`(^|[\\s(])${r}\\)|(^|\\n)\\s*${r}\\.\\s`).test(text)) return true;
  }
  return false;
}

/** "(iv)", "ii)", "iii." at a line start: list markers, read as plain numbers. */
function listMarker(ctx: Ctx, i: number, n: Numeral): string | null {
  const { text, words } = ctx;
  const w = words[i];
  if (n.kind || !(n.upper ? /^[IVX]+$/ : /^[ivx]+$/).test(n.roman)) return null;
  const before = text[w.s - 1] || "";
  const after = text[w.e] || "";
  const single = n.roman.length === 1;
  const say = String(n.value);
  // A lone v or x opens a list only after iv or ix; on its own it is a variable ("(x) is unknown", "x) = 2").
  if (single && !/^[iI]$/.test(n.roman) && !hasSibling(text, n)) return null;
  if (before === "(" && after === ")") {
    const pc = text[w.s - 2] || "";
    if (/\p{L}/u.test(pc)) return null; // "f(x)", "iron(III)"
    if (/[\p{N})]/u.test(pc)) return say; // "clause 3(iii)", "(a)(iv)"
    if (!single && !n.upper) return say; // "(ii)", "(iv)": lower-case list numerals
    if (listStart(text, w.s - 1)) return say;
    // Mid-sentence "(IV)" or "(v)" is usually an abbreviation or a symbol, unless its neighbours are there too.
    return hasSibling(text, n) ? say : null;
  }
  if (after === ")" && before !== "(") {
    if (listStart(text, w.s)) return say;
    // Mid-sentence "ii)" counts when its neighbour is there too: "i) mix ii) heat".
    if (/[\s,;:]$/.test(before) && hasSibling(text, n)) return say;
    return null;
  }
  if (after === "." && /\s/.test(text[w.e + 1] || "") && listStart(text, w.s)) {
    // "I. M. Pei" is initials, not item one.
    if (single && /^\.\s+\p{Lu}\./u.test(text.slice(w.e))) return null;
    return say;
  }
  return null;
}

/** "iron(III) oxide", "copper (II) sulfate", "Fe(III)" → the charge as a number. */
function oxidationState(ctx: Ctx, i: number, n: Numeral): string | null {
  const { text, words } = ctx;
  const w = words[i];
  if (!n.upper || n.kind || n.value > 8 || text[w.s - 1] !== "(" || text[w.e] !== ")") return null;
  const prev = words[i - 1];
  const gap = prev ? text.slice(prev.e, w.s) : "";
  // Symbols must touch the bracket ("Fe(III)"); a spaced "As (II)" is more likely a sentence.
  if (!prev || (gap !== "(" && !(gap === " (" && prev.w.length > 2))) return null;
  return ELEMENTS.has(prev.w) || ELEMENTS.has(prev.w.toLowerCase()) ? String(n.value) : null;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** French ordinal endings as a French voice reads them: "XIXe" → "19e", "Ier" → "premier". */
function frenchOrdinal(n: Numeral, fem: boolean): string {
  if (n.value === 1) return fem || /^(re|ère|ʳᵉ)$/.test(n.suffix) ? "première" : "premier";
  const end = n.suffix === "ème" || n.suffix === "eme" ? "ème" : "e";
  return `${n.value}${end}`;
}

/** German ruler numbers agree with the case around them: "unter Ludwig dem Vierzehnten". */
function germanRuler(ctx: Ctx, k: number, value: number, fem: boolean, genitive: boolean): string {
  if (value > 30) return `${value}.`;
  const { text, words } = ctx;
  let j = k - 1;
  // Walk back over the rest of the name and any title: "Kaiser Wilhelm II.", "Papst Johannes Paul II."
  for (let steps = 0; j >= 0 && steps < 3; steps++, j--) {
    const w = words[j].w;
    if (!/^\s+$/.test(text.slice(words[j].e, words[j + 1].s))) break;
    if (!REGNAL.has(w) && !DE_TITLES.has(w) && !(w.endsWith("s") && REGNAL.has(w.slice(0, -1)))) break;
  }
  const lw = j >= 0 ? words[j].w.toLowerCase() : "";
  let kase: "nom" | "gen" | "dat" | "acc" = "nom";
  if (genitive || lw === "des") kase = "gen";
  else if (DE_DATIVE.has(lw) || (fem && lw === "der")) kase = "dat";
  else if (DE_ACCUSATIVE.has(lw)) kase = "acc";
  const stem = DE_ORD[value];
  if (fem) return kase === "gen" || kase === "dat" ? `der ${stem}en` : `die ${stem}e`;
  return { nom: `der ${stem}e`, gen: `des ${stem}en`, dat: `dem ${stem}en`, acc: `den ${stem}en` }[kase];
}

/** "Henry VIII", "Louis XIV", "John Paul II", "Felipe II", "Ludwig XIV." */
function regnal(ctx: Ctx, i: number, n: Numeral, after: After): Edit | null {
  const { text, words, lang } = ctx;
  const w = words[i];
  const k = i - 1;
  if (k < 0 || !n.upper || n.kind === "sub") return null;
  if (n.kind === "ord" && lang !== "fr" && lang !== "en") return null;
  const prev = words[k];
  if (!/^\s+$/.test(text.slice(prev.e, w.s))) return null;
  let name = prev.w;
  let genitive = false;
  if (!REGNAL.has(name)) {
    // German genitive: "die Herrschaft Ludwigs XIV."
    if (lang === "de" && name.endsWith("s") && REGNAL.has(name.slice(0, -1))) {
      name = name.slice(0, -1);
      genitive = true;
    } else return null;
  }
  if (!/^[IVXL]+$/.test(n.roman) || n.value > 89) return null;
  if (name === "Malcolm" && n.roman === "X") return null;
  if (lang === "en" && n.roman === "I") {
    // "Mary I think…", "told Peter I would…": the pronoun, not a numeral.
    if (REGNAL_PRONOUN_NEXT.has(after.word)) return null;
    const before = words[k - 1];
    if (before && TELL_VERBS.has(before.w.toLowerCase())) return null;
  }
  const fem = FEMININE.has(name);
  let say: string;
  let end = w.e;
  if (lang === "en") say = `the ${cap(enOrdinalWord(n.value))}`;
  else if (lang === "fr") say = n.kind === "ord" || n.value === 1 ? frenchOrdinal(n, fem) : String(n.value);
  else if (lang === "es" || lang === "pt") say = iberianOrdinal(lang, n.value, fem);
  else if (lang === "it") say = italianOrdinal(n.value, fem);
  else {
    say = germanRuler(ctx, k, n.value, fem, genitive);
    // "Ludwig XIV." — the dot marks the ordinal. Mid-sentence it goes ("Friedrich II. war…" →
    // "Friedrich der Zweite war…"); before a capital or at the end it may also end the sentence, so it stays.
    if (text[w.e] === "." && /^\.\s*[,\p{Ll}]/u.test(text.slice(w.e)) && !say.endsWith(".")) end = w.e + 1;
  }
  return { s: w.s, e: end, text: say, mode: "name" };
}

/** The keyword right before word i ("grade", "Chapter", "vol.", "No.", "World War"), if any. */
function keywordBefore(ctx: Ctx, i: number): { flags: number; title: boolean } | null {
  const { text, words, lang } = ctx;
  const keys = KEYWORDS[lang];
  const keyAt = (k: number, next: number): string | null => {
    if (k < 0) return null;
    const gap = text.slice(words[k].e, words[next].s);
    const lw = words[k].w.toLowerCase();
    if (/^\s+$/.test(gap) || gap === "-") return lw; // "grade IV", "Typ-II-Diabetes"
    if (/^\.\s+$/.test(gap)) return `${lw}.`; // "vol. IV", "No. 9"
    if (/^°\s*$/.test(gap)) return `${lw}°`; // "N° IV"
    return null;
  };
  let k = i - 1;
  const key = keyAt(k, i);
  if (key === null) return null;
  let flags = keys[key];
  if (lang === "en" && (key === "war" || key === "wars") && keyAt(k - 1, k) === "world") {
    flags = WAR;
    k -= 1;
  } else if (flags !== undefined && flags & SIGN) {
    // "Symphony No. IX", "Psalm No. XXIII": the real keyword is before the sign.
    const key2 = keyAt(k - 1, k);
    if (key2 !== null && keys[key2] !== undefined && !(keys[key2] & SIGN)) {
      flags = keys[key2];
      k -= 1;
    }
  }
  if (flags === undefined) return null;
  const kw = words[k].w;
  // A keyword in capitals is shouting or an acronym ("PART II" in a heading); only "CN" (cranial nerve) is written that way.
  if (/^\p{Lu}{2,}$/u.test(kw) && kw !== "CN") return null;
  return { flags, title: /^\p{Lu}/u.test(kw) };
}

/** Whether numeral n may be read as a number after a keyword with these flags. */
function keywordAllows(n: Numeral, flags: number, title: boolean, after: After, lang: Lang): boolean {
  if (n.kind === "ord") return false;
  const multi = n.roman.length > 1;
  if (!n.upper) return multi; // "page xiv", "section iii"; a lone "i", "v", "x" is a variable
  if (flags & MULTI) return multi && !n.kind;
  if (multi) return n.kind === "sub" || !ACRONYM_AFTER_KEYWORD.has(n.roman);
  const L = n.roman;
  if (L !== "I" && L !== "V" && L !== "X") return false; // "grade C", "vitamin D", "size L"
  if (L === "X" && flags & NO_X) return false; // "Generation X", "Model X"
  if (L === "V" && flags & NO_V) return false; // "unit V" = volts
  if (n.kind === "sub") return true; // "Type Ia", "factor Xa", "Stage IB"
  const noun = I_NOUN_NEXT.has(after.word);
  const proof = after.stop || after.chain || after.parallel || after.possessive || noun || I_VERB_NEXT.has(after.word);
  if (flags & SIGN) return proof; // "No. I disagree" is an answer, not a number
  // Only English has the pronoun "I"; elsewhere just a lone V or X after "type"/"classe"… may be a variable.
  if (lang !== "en") return L === "I" || !(flags & VAR) || after.chain || after.stop || title;
  if (flags & WAR) return L !== "I" || !I_PRONOUN_NEXT.has(after.word);
  if (L === "I") {
    if (proof) return true;
    if (!after.word || I_PRONOUN_NEXT.has(after.word)) return false;
    return title; // "Phase I Trial" yes; "the class I teach" no
  }
  // V or X: after "type", "class", "volume"… it may be a variable ("the volume V of the gas").
  if (flags & VAR) return after.chain || after.parallel || noun || (title && after.stop);
  return true;
}

function keywordSay(n: Numeral, flags: number, lang: Lang): string {
  if (flags & ORD) {
    if (lang === "it") return italianOrdinal(n.value, false);
    if (lang === "es" || lang === "pt") return iberianOrdinal(lang, n.value, false);
  }
  return String(n.value) + (n.kind === "sub" ? n.suffix : "");
}

/** Word i continues a list that started after a keyword: the "II" in "Types I and II". */
function chainedFrom(ctx: Ctx, i: number, n: Numeral, after: After): number | null {
  for (const j of [i - 1, i - 2]) {
    if (j < 0 || ctx.done[j] !== "kw" || chainNext(ctx, j) !== i) continue;
    if (n.roman.length === 1 && !/^[IVXivx]$/.test(n.roman)) return null;
    if (ctx.lang === "en" && n.roman === "I" && I_PRONOUN_NEXT.has(after.word)) return null;
    return ctx.flags[j];
  }
  return null;
}

/** A noun after the numeral (or after a list of them) that makes it an ordinal: "XIX century", "XV y XVI". */
function ordinalNoun(ctx: Ctx, i: number): { fem: boolean; direct: boolean } | null {
  const { text, words, lang } = ctx;
  let j = i;
  for (let step = 0; step < 4; step++) {
    const next = chainNext(ctx, j);
    if (next < 0) break;
    j = next;
  }
  const w = words[j];
  const nx = words[j + 1];
  if (!nx) return null;
  const gap = text.slice(w.e, nx.s);
  const dot = lang === "de" && /^\.\s+$/.test(gap);
  if (!/^\s+$/.test(gap) && !dot && !(lang === "en" && gap === "-")) return null;
  const fem = ORD_NOUNS[lang][nx.w.toLowerCase()];
  if (fem === undefined) return null;
  return { fem, direct: j === i };
}

/** "XIXe siècle", "Ier", "the XIXth", "XIX century", "II guerra mondiale", "XIX. Jahrhundert". */
function ordinal(ctx: Ctx, i: number, n: Numeral): Edit | null {
  const { text, words, lang } = ctx;
  const w = words[i];
  if (!n.upper || n.kind === "sub" || !/^[IVXLC]+$/.test(n.roman) || n.value > 40) return null;
  if (n.roman.length === 1 && !/^[IVX]$/.test(n.roman)) return null;
  const noun = ordinalNoun(ctx, i);
  const at = (say: string, end = w.e): Edit => ({ s: w.s, e: end, text: say, mode: "ord" });
  if (n.kind === "ord") {
    if (lang === "fr" && (n.value === 1 || n.roman.length > 1 || noun)) return at(frenchOrdinal(n, !!noun?.fem));
    if (lang === "en" && (n.roman.length > 1 || noun)) return at(enOrdinalDigits(n.value));
    return null;
  }
  if (!noun) return null;
  switch (lang) {
    case "en":
      return at(enOrdinalDigits(n.value));
    case "fr":
      return at(n.value === 1 ? (noun.fem ? "première" : "premier") : `${n.value}e`);
    case "es": {
      const say = iberianOrdinal("es", n.value, noun.fem);
      // Spanish shortens these right before a masculine noun: "I Congreso" → "primer Congreso".
      return at(noun.direct && !noun.fem ? say.replace(/^(prim|terc)ero$/, "$1er") : say);
    }
    case "pt":
      return at(iberianOrdinal("pt", n.value, noun.fem));
    case "it":
      return at(italianOrdinal(n.value, noun.fem));
    case "de":
      // German writes the ordinal as a number with a dot: "19. Jahrhundert".
      return at(text[w.e] === "." ? `${n.value}` : `${n.value}.`);
  }
  return null;
}

/** "Apollo XIII", "Super Bowl LVII", "Final Fantasy VII": a capitalised name, then a multi-letter numeral. */
function otherName(ctx: Ctx, i: number, n: Numeral, after: After): string | null {
  const { text, words } = ctx;
  if (!n.upper || n.kind || n.roman.length < 2 || !/^[IVXL]+$/.test(n.roman) || n.value > 89) return null;
  if (ACRONYM_LIKE.has(n.roman)) return null;
  const prev = words[i - 1];
  if (!prev || !/^\s+$/.test(text.slice(prev.e, words[i].s))) return null;
  if (!/^\p{Lu}[\p{Ll}\p{M}]/u.test(prev.w) || NOT_NAMES.has(prev.w.toLowerCase())) return null;
  // "Morphine IV infusion", "Start IV fluids": intravenous, not four.
  if ((n.roman === "IV" || n.roman === "IX") && (sentenceStart(text, prev.s) || IV_MEDICAL.has(after.word))) return null;
  return String(n.value);
}

function decide(ctx: Ctx, i: number, n: Numeral): Edit | null {
  const { text, words, lang } = ctx;
  const w = words[i];
  const edge = edges(text, w.s, w.e);
  if (!edge.ok) return null;
  const after = afterInfo(ctx, i, edge.possessive);
  if (edge.slash && !after.chain) return null; // "I/O", "V/R"
  const at = (say: string, mode: string, flags = 0): Edit => ({ s: w.s, e: w.e, text: say, mode, flags });
  if (edge.listOnly) {
    const listFlags = chainedFrom(ctx, i, n, after);
    return listFlags === null ? null : at(keywordSay(n, listFlags, lang), "kw", listFlags);
  }

  const marker = listMarker(ctx, i, n);
  if (marker) return at(marker, "list");
  const charge = oxidationState(ctx, i, n);
  if (charge) return at(charge, "ox");
  const ruler = regnal(ctx, i, n, after);
  if (ruler) return ruler;
  const kw = keywordBefore(ctx, i);
  if (kw && keywordAllows(n, kw.flags, kw.title, after, lang)) return at(keywordSay(n, kw.flags, lang), "kw", kw.flags);
  const listFlags = chainedFrom(ctx, i, n, after);
  if (listFlags !== null) return at(keywordSay(n, listFlags, lang), "kw", listFlags);
  const ord = ordinal(ctx, i, n);
  if (ord) return ord;
  const name = otherName(ctx, i, n, after);
  if (name) return at(name, "name");
  return null;
}

function rewrite(text: string, lang: Lang): string {
  const list: Word[] = [];
  for (const m of text.matchAll(/[\p{L}\p{M}]+/gu)) list.push({ w: m[0], s: m.index ?? 0, e: (m.index ?? 0) + m[0].length });
  const ctx: Ctx = {
    text,
    lang,
    words: list,
    nums: list.map((w) => (/^[IVXLCDMivx]/.test(w.w) ? parseNumeral(w.w, lang) : null)),
    done: list.map(() => ""),
    flags: list.map(() => 0),
  };
  const edits: Edit[] = [];
  for (let i = 0; i < list.length; i++) {
    const n = ctx.nums[i];
    if (!n) continue;
    const edit = decide(ctx, i, n);
    if (!edit) continue;
    edits.push(edit);
    ctx.done[i] = edit.mode;
    ctx.flags[i] = edit.flags || 0;
  }
  let out = text;
  for (let j = edits.length - 1; j >= 0; j--) out = out.slice(0, edits[j].s) + edits[j].text + out.slice(edits[j].e);
  return out;
}

/**
 * `text` as it should be spoken in `lang` (a BCP-47 tag or base code; default English):
 * Roman numerals that mean numbers become what a reader would say ("grade IV" → "grade 4",
 * "Henry VIII" → "Henry the Eighth", "XIXe siècle" → "19e siècle"); everything else is
 * returned exactly as it was. Idempotent, and never throws (on any surprise the text is
 * returned untouched).
 */
export function forSpeech(text: string, lang?: string): string {
  if (typeof text !== "string") return "";
  try {
    const base = baseLang(lang);
    if (!base || !text || !/[IVXLCDMivx]/.test(text)) return text;
    return rewrite(text, base);
  } catch {
    return text;
  }
}
