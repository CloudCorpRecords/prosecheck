import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { checkProse, countWords, VERSION } from "../src/core.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const fx = (n: string) => readFileSync(join(FIXTURES, n), "utf8");

describe("prosecheck canonical #3312 cases", () => {
  it("version is 0.1.0", () => assert.equal(VERSION, "0.1.0"));

  it("#3312 original PR body FAILS", () => {
    const r = checkProse("pr-body", fx("pr3312-original-body.txt"));
    assert.equal(r.verdict, "FAIL");
    assert.ok((r.counts["PR-BODY-TOO-LONG"] ?? 0) >= 1, "expected PR-BODY-TOO-LONG");
    assert.ok((r.counts["TEST-REPORT-DUMP"] ?? 0) >= 1, "expected TEST-REPORT-DUMP");
  });

  it("#3312 trimmed PR body PASSES", () => {
    const r = checkProse("pr-body", fx("pr3312-trimmed-body.txt"));
    assert.equal(r.verdict, "PASS");
    assert.equal(r.findings.filter((f) => f.severity === "high").length, 0);
  });

  it("#3312 original commit FAILS", () => {
    const r = checkProse("commit", fx("pr3312-original-commit.txt"));
    assert.equal(r.verdict, "FAIL");
    assert.ok((r.counts["SUBJECT-TOO-LONG"] ?? 0) + (r.counts["COMMIT-BODY-TOO-LONG"] ?? 0) >= 1);
  });

  it("short commit PASSES", () => {
    const r = checkProse("commit", fx("short-commit.txt"));
    assert.equal(r.verdict, "PASS");
  });

  it("long reviewer reply FAILS", () => {
    const r = checkProse("comment", fx("long-reply.txt"));
    assert.equal(r.verdict, "FAIL");
    assert.ok((r.counts["COMMENT-TOO-LONG"] ?? 0) >= 1);
  });

  it("short reviewer reply PASSES", () => {
    const r = checkProse("comment", fx("short-reply.txt"));
    assert.equal(r.verdict, "PASS");
  });
});

describe("prosecheck other rules", () => {
  it("headings >3 FAILS a PR body", () => {
    const body = "# A\n\nx\n\n## B\n\ny\n\n## C\n\nz\n\n## D\n\nw\n";
    assert.equal(checkProse("pr-body", body).verdict, "FAIL");
    assert.ok((checkProse("pr-body", body).counts["TOO-MANY-HEADINGS"] ?? 0) >= 1);
  });
  it("bullets >7 FAILS a PR body", () => {
    const body = "Fix\n\n" + Array.from({ length: 8 }, (_, i) => `- item ${i}`).join("\n") + "\n";
    assert.equal(checkProse("pr-body", body).verdict, "FAIL");
  });
  it("stock phrase is warn only, still PASS", () => {
    const body = "Fixes #1\n\nThis is a comprehensive fix for the skip bug.\n";
    const r = checkProse("pr-body", body);
    assert.equal(r.verdict, "PASS");
    assert.ok((r.counts["STOCK-AI-PHRASE"] ?? 0) >= 1);
  });
  it("countWords works", () => {
    assert.equal(countWords(""), 0);
    assert.equal(countWords("one two  three"), 3);
  });
});
