/**
 * Tests for src/lib/pdf/checkpoints.ts: how a PDF is split into the stretches that
 * each get a quiz, and which stretch a page belongs to.
 *
 * Run: node --test scripts/tests/
 *
 * The rule these guard most is that the split only depends on the pages' word
 * counts: the server keeps one quiz per (first page, last page), so a range that
 * moved between two openings of the same PDF would never find its questions again.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  CHECKPOINT_PAGES,
  CHECKPOINT_WORDS,
  checkpointForPage,
  checkpointTitle,
  pdfCheckpoints,
  pdfPageBlocks,
  wordCount,
} from "../../src/lib/pdf/checkpoints.ts";

/** Pages 1..n with these word counts. */
const pages = (...words: number[]) => words.map((w, i) => ({ page: i + 1, words: w }));
/** Just the ranges, for short assertions. */
const ranges = (cps: { first: number; last: number }[]) => cps.map((c) => `${c.first}-${c.last}`);

describe("pdfCheckpoints", () => {
  test("a dense page is a checkpoint of its own", () => {
    const cps = pdfCheckpoints(pages(520, 480, 610));
    assert.deepEqual(ranges(cps), ["1-1", "2-2", "3-3"]);
    assert.deepEqual(cps[0], { topicId: "pdfq-1-1", first: 1, last: 1, title: "Page 1", anchorPage: 1 });
  });

  test("light slides group up to four", () => {
    const cps = pdfCheckpoints(pages(60, 70, 50, 80, 60, 70, 50, 80), "Slide");
    assert.deepEqual(ranges(cps), ["1-4", "5-8"]);
    assert.equal(cps[0].title, "Slides 1–4");
    assert.equal(cps[1].topicId, "pdfq-5-8");
  });

  test("a group closes as soon as it reaches the word target", () => {
    // 150 + 150 = 300, + 150 = 450 >= 400: closes after page 3.
    const cps = pdfCheckpoints(pages(150, 150, 150, 150, 150, 150));
    assert.deepEqual(ranges(cps), ["1-3", "4-6"]);
    assert.equal(CHECKPOINT_WORDS, 400);
    assert.equal(CHECKPOINT_PAGES, 4);
  });

  test("a light last group joins the one before it", () => {
    // 1-3 closes at 450 words; page 4 alone (90 words) is too little to stop for.
    assert.deepEqual(ranges(pdfCheckpoints(pages(150, 150, 150, 90))), ["1-4"]);
  });

  test("a last group with enough words stands on its own", () => {
    assert.deepEqual(ranges(pdfCheckpoints(pages(150, 150, 150, 130))), ["1-3", "4-4"]);
  });

  test("a single light page is still a checkpoint when it is all there is", () => {
    assert.deepEqual(ranges(pdfCheckpoints(pages(45))), ["1-1"]);
  });

  test("groups with no words are dropped", () => {
    // Four picture pages in the middle make a group of their own with nothing to ask about.
    const cps = pdfCheckpoints(pages(500, 0, 0, 0, 0, 450));
    assert.deepEqual(ranges(cps), ["1-1", "6-6"]);
    assert.deepEqual(pdfCheckpoints(pages(0, 0, 0)), []);
    assert.deepEqual(pdfCheckpoints([]), []);
  });

  test("a merged tail never makes a range longer than the server takes", () => {
    const cps = pdfCheckpoints(pages(90, 90, 90, 90, 20, 20, 20, 20));
    assert.deepEqual(ranges(cps), ["1-8"]);
    for (const c of pdfCheckpoints(pages(...Array.from({ length: 40 }, (_, i) => (i * 37) % 130)))) {
      assert.ok(c.last - c.first + 1 <= 8, `${c.first}-${c.last} is longer than 8 pages`);
    }
  });

  test("the lesson stops on the last page with real text, not a picture", () => {
    const [cp] = pdfCheckpoints(pages(120, 150, 5, 0));
    assert.equal(cp.first, 1);
    assert.equal(cp.last, 4);
    assert.equal(cp.anchorPage, 2);
  });

  test("with no page full enough, the anchor is the last with any text", () => {
    const [cp] = pdfCheckpoints(pages(30, 30, 30, 0), "Slide");
    assert.equal(cp.anchorPage, 3);
  });

  test("the same pages always give the same ranges, in whatever order they report", () => {
    const words = [310, 45, 0, 220, 90, 90, 600, 12, 140, 75, 0, 0, 300, 260];
    const inOrder = pdfCheckpoints(pages(...words));
    const shuffled = pages(...words).sort((a, b) => ((a.page * 7919) % 13) - ((b.page * 7919) % 13));
    assert.deepEqual(pdfCheckpoints(shuffled), inOrder);
    assert.deepEqual(pdfCheckpoints(pages(...words)), inOrder);
  });

  test("every page with text is in exactly one checkpoint, and they don't overlap", () => {
    const words = [310, 45, 0, 220, 90, 90, 600, 12, 140, 75, 0, 0, 300, 260, 5];
    const cps = pdfCheckpoints(pages(...words));
    for (let i = 1; i < cps.length; i++) assert.ok(cps[i].first > cps[i - 1].last);
    words.forEach((w, i) => {
      if (w > 0) assert.equal(cps.filter((c) => i + 1 >= c.first && i + 1 <= c.last).length, 1, `page ${i + 1}`);
    });
  });

  test("a page that never reported splits the run", () => {
    const cps = pdfCheckpoints([
      { page: 1, words: 200 },
      { page: 2, words: 150 },
      { page: 4, words: 300 },
    ]);
    assert.deepEqual(ranges(cps), ["1-2", "4-4"]);
  });

  test("duplicate and broken entries are ignored", () => {
    const cps = pdfCheckpoints([
      { page: 1, words: 100 },
      { page: 1, words: 500 },
      { page: 0, words: 300 },
      { page: 2.5, words: 300 },
      { page: 2, words: Number.NaN },
      { page: 3, words: -4 },
    ]);
    // Page 1 counts once (the later report), 2 and 3 have nothing: 1 closes on its own.
    assert.deepEqual(ranges(cps), ["1-1"]);
  });
});

describe("checkpointTitle", () => {
  test("pages and slides, with an en dash", () => {
    assert.equal(checkpointTitle(3, 3), "Page 3");
    assert.equal(checkpointTitle(3, 5), "Pages 3–5");
    assert.equal(checkpointTitle(4, 4, "Slide"), "Slide 4");
    assert.equal(checkpointTitle(4, 7, "Slide"), "Slides 4–7");
  });
});

describe("checkpointForPage", () => {
  const cps = pdfCheckpoints(pages(500, 0, 0, 0, 0, 300, 200, 450));
  // 1-1, [2-5 dropped], 6-7, 8-8

  test("the checkpoint a page is in", () => {
    assert.deepEqual(ranges(cps), ["1-1", "6-7", "8-8"]);
    assert.equal(checkpointForPage(cps, 1)?.topicId, "pdfq-1-1");
    assert.equal(checkpointForPage(cps, 7)?.topicId, "pdfq-6-7");
    assert.equal(checkpointForPage(cps, 8)?.topicId, "pdfq-8-8");
  });

  test("a page in no checkpoint gets the next one, else the last", () => {
    assert.equal(checkpointForPage(cps, 3)?.topicId, "pdfq-6-7");
    assert.equal(checkpointForPage(cps, 40)?.topicId, "pdfq-8-8");
  });

  test("nothing to quiz", () => {
    assert.equal(checkpointForPage([], 1), null);
  });
});

describe("wordCount", () => {
  test("counts words however they are spaced", () => {
    assert.equal(wordCount(""), 0);
    assert.equal(wordCount("   "), 0);
    assert.equal(wordCount("Light is absorbed by chlorophyll."), 5);
    assert.equal(wordCount("  two\n\twords "), 2);
  });
});

describe("pdfPageBlocks", () => {
  test("pages not laid out yet are left out", () => {
    const root = { querySelector: () => null } as unknown as ParentNode;
    assert.deepEqual(pdfPageBlocks(3, 5, root), []);
  });
});
