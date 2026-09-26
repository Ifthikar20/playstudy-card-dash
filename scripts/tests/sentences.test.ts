/*
  The pieces the voice reads one at a time (src/lib/guide/sentences.ts).

    npm run test
*/
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { MAX_PIECE, splitSentences } from "../../src/lib/guide/sentences.ts";

const LONE_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;

describe("splitSentences", () => {
  test("nothing to say", () => {
    assert.deepEqual(splitSentences(""), []);
    assert.deepEqual(splitSentences("   \n\t "), []);
  });

  test("English: one sentence per piece, abbreviations kept whole", () => {
    assert.deepEqual(splitSentences("Hello there, my friend. How are you doing today? That is fine by me!"), [
      "Hello there, my friend.",
      "How are you doing today?",
      "That is fine by me!",
    ]);
    assert.deepEqual(splitSentences("It works e.g. like this one. Then more follows here."), [
      "It works e.g. like this one.",
      "Then more follows here.",
    ]);
    // A fragment joins the piece before it.
    assert.deepEqual(splitSentences("That is the whole idea. Ok."), ["That is the whole idea. Ok."]);
    // An abbreviation before a capitalised word still ends a piece (as it always did): the
    // short first piece is heard as a beat, never dropped.
    assert.deepEqual(splitSentences("Ask Dr. Smith about it. Ok."), ["Ask Dr.", "Smith about it. Ok."]);
    // Numbers keep their thousands separators.
    assert.deepEqual(splitSentences("It costs 1,000 dollars a year and rises."), ["It costs 1,000 dollars a year and rises."]);
  });

  test("Arabic: ؟ and the full stop end sentences", () => {
    const pieces = splitSentences("الذكاء الاصطناعي مجال واسع؟ نعم، هو كذلك بالتأكيد. وله تطبيقات كثيرة جدا.");
    assert.deepEqual(pieces, ["الذكاء الاصطناعي مجال واسع؟", "نعم، هو كذلك بالتأكيد.", "وله تطبيقات كثيرة جدا."]);
  });

  test("Devanagari: the danda ends a sentence", () => {
    assert.deepEqual(splitSentences("यह एक वाक्य है। यह दूसरा वाक्य है।"), ["यह एक वाक्य है।", "यह दूसरा वाक्य है।"]);
  });

  test("Chinese: 。！？ end sentences with no space after them", () => {
    const text = "人工智能是计算机科学的一个领域。它研究如何让机器完成需要智能的任务！你明白了吗？";
    const pieces = splitSentences(text);
    assert.equal(pieces[0], "人工智能是计算机科学的一个领域。");
    assert.equal(pieces.length, 2); // the short last question joins the sentence before it
    assert.equal(pieces.join("").replace(/ /g, ""), text);
  });

  test("a long sentence breaks at its clauses", () => {
    const words = Array.from({ length: 60 }, (_, i) => `word${i}`);
    const text = words.map((w, i) => (i % 10 === 9 ? `${w},` : w)).join(" ") + ".";
    const pieces = splitSentences(text);
    assert.ok(pieces.length > 1);
    for (const p of pieces) assert.ok(p.length <= 180, p);
    assert.equal(pieces.join(" "), text);
  });

  test("a long Arabic sentence breaks at the Arabic comma", () => {
    const text = Array.from({ length: 60 }, (_, i) => (i % 8 === 7 ? "كلمة،" : "كلمة")).join(" ") + ".";
    const pieces = splitSentences(text);
    assert.ok(pieces.length > 1);
    for (const p of pieces) assert.ok(p.length <= 180, p);
    assert.equal(pieces.join(" "), text);
  });

  test("a long run with no punctuation at all is cut at spaces, never over MAX_PIECE", () => {
    const text = "word ".repeat(400).trim(); // 1,999 characters
    const pieces = splitSentences(text);
    assert.ok(pieces.length >= 7);
    for (const p of pieces) {
      assert.ok(p.length <= MAX_PIECE, `${p.length} > ${MAX_PIECE}`);
      assert.ok(!p.startsWith(" ") && !p.endsWith(" "));
    }
    assert.equal(pieces.join(" ").split(" ").length, 400);
  });

  test("a long Chinese run with no punctuation is cut at the limit", () => {
    const text = "中".repeat(700);
    const pieces = splitSentences(text);
    assert.deepEqual(
      pieces.map((p) => p.length),
      [MAX_PIECE, MAX_PIECE, 700 - 2 * MAX_PIECE],
    );
    assert.equal(pieces.join(""), text);
  });

  test("Chinese with commas breaks into short pieces", () => {
    const text = ("中文句子，".repeat(30) + "。").replace(/，。$/, "。");
    const pieces = splitSentences(text);
    assert.ok(pieces.length > 1);
    for (const p of pieces) assert.ok(p.length <= 80, `${p.length}`);
    assert.equal(pieces.join(""), text);
  });

  test("a hard cut never splits an emoji", () => {
    const text = "a" + "😀".repeat(200);
    const pieces = splitSentences(text);
    for (const p of pieces) {
      assert.ok(p.length <= MAX_PIECE);
      assert.ok(!LONE_SURROGATE.test(p), "a surrogate pair was split");
    }
    assert.equal(pieces.join(""), text);
  });

  test("MAX_PIECE stays well inside the server's 2,000-character limit", () => {
    assert.ok(MAX_PIECE <= 500 && MAX_PIECE >= 200);
  });
});
