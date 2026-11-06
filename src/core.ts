import type { Finding, Kind, Report, Severity } from "./types.js";

export const VERSION = "0.1.0";
export const PASS_VERDICT = "PASS";
export const FAIL_VERDICT = "FAIL";

export const PR_BODY_WORD_LIMIT = 120;
export const PR_BODY_HEADING_LIMIT = 3;
export const PR_BODY_BULLET_LIMIT = 7;
export const COMMIT_SUBJECT_LIMIT = 72;
export const COMMIT_BODY_WORD_LIMIT = 60;
export const COMMENT_WORD_LIMIT = 80;

export function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

const TEST_REPORT_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\btest report\b/i, label: '"Test report" section' },
  { re: /\b\d+\s+tests?\b[^.\n]*\b0\s+failures?\b/i, label: "test-count dump (N tests, 0 failures)" },
  { re: /\b\d+\s+tests?,\s*\d+\s+failures?,\s*\d+\s+errors?/i, label: "test-count dump (tests/failures/errors)" },
  { re: /\b\d+\s+tests?\b[^.\n]*\b\d+\s+skipped\b/i, label: "test-count dump (skipped count)" },
  { re: /\bgradle\s*\d/i, label: "Gradle version" },
  { re: /\b(jdk|temurin|openjdk)\s*\d/i, label: "JDK/toolchain version" },
  { re: /\btoolchain\b/i, label: "toolchain detail" },
  { re: /:\S*jvmTest\b/i, label: "Gradle test task detail" },
];

// Stock AI-ish phrases: WARN for pr-body/commit, some are hard boilerplate for comments.
export const STOCK_PHRASES = [
  "comprehensive",
  "delve",
  "furthermore",
  "in summary",
  "it's worth noting",
  "its worth noting",
  "it is worth noting",
  "moreover",
  "in conclusion",
];

// Boilerplate essay phrases that hard-FAIL a reviewer comment.
export const BOILERPLATE_PHRASES = [
  "furthermore",
  "in summary",
  "it's worth noting",
  "its worth noting",
  "it is worth noting",
  "in conclusion",
  "i appreciate your feedback",
  "thank you for your thorough",
  "thank you for your valuable",
  "please do not hesitate",
  "please don't hesitate",
  "i hope this clarifies",
  "i hope this helps",
  "let me know if you have any further",
];

function findTestReport(text: string): string[] {
  const hits: string[] = [];
  for (const { re, label } of TEST_REPORT_PATTERNS) {
    if (re.test(text)) hits.push(label);
  }
  return hits;
}

function findPhrases(text: string, phrases: string[]): string[] {
  const lower = text.toLowerCase();
  return phrases.filter((p) => lower.includes(p));
}

export function checkProse(kind: Kind, text: string, target = ""): Report {
  const findings: Finding[] = [];
  const push = (rule: string, severity: Severity, message: string) =>
    findings.push({ rule, severity, message });

  const normalized = text.replace(/\r\n/g, "\n");
  const words = countWords(normalized);
  const testHits = findTestReport(normalized);
  const stock = findPhrases(normalized, STOCK_PHRASES);

  if (kind === "pr-body") {
    if (words > PR_BODY_WORD_LIMIT)
      push("PR-BODY-TOO-LONG", "high", `PR body is ${words} words, over the ${PR_BODY_WORD_LIMIT} word limit. Shorten to a plain summary: what was wrong, what changed, what test was added.`);
    if (testHits.length)
      push("TEST-REPORT-DUMP", "high", `PR body contains a test-report dump: ${testHits.join("; ")}. Test evidence belongs in the wave report, not the PR body.`);
    const headings = normalized.split("\n").filter((l) => /^#{1,6}\s+\S/.test(l.trim())).length;
    if (headings > PR_BODY_HEADING_LIMIT)
      push("TOO-MANY-HEADINGS", "high", `PR body has ${headings} headings, over the limit of ${PR_BODY_HEADING_LIMIT}.`);
    const bullets = normalized.split("\n").filter((l) => /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(l)).length;
    if (bullets > PR_BODY_BULLET_LIMIT)
      push("TOO-MANY-BULLETS", "high", `PR body has ${bullets} bullet lines, over the limit of ${PR_BODY_BULLET_LIMIT}.`);
    for (const p of stock) push("STOCK-AI-PHRASE", "low", `Stock AI-ish phrase "${p}" — warn only; rewrite in plain words if it sounds generated.`);
  } else if (kind === "commit") {
    const lines = normalized.split("\n");
    const subject = (lines[0] ?? "").trim();
    // Body = everything after the subject, minus Signed-off-by trailer lines.
    const bodyFiltered = lines.slice(1).filter((l) => !/^Signed-off-by:/i.test(l.trim()));
    const bodyWords = countWords(bodyFiltered.join("\n"));
    if (subject.length > COMMIT_SUBJECT_LIMIT)
      push("SUBJECT-TOO-LONG", "high", `Commit subject is ${subject.length} chars, over the ${COMMIT_SUBJECT_LIMIT} char limit: "${subject}"`);
    if (bodyWords > COMMIT_BODY_WORD_LIMIT)
      push("COMMIT-BODY-TOO-LONG", "high", `Commit body is ${bodyWords} words, over the ${COMMIT_BODY_WORD_LIMIT} word limit. Keep it to 1-2 short sentences.`);
    if (testHits.length)
      push("TEST-REPORT-DUMP", "high", `Commit message contains a test-report dump: ${testHits.join("; ")}.`);
    for (const p of stock) push("STOCK-AI-PHRASE", "low", `Stock AI-ish phrase "${p}" — warn only.`);
  } else {
    // comment
    if (words > COMMENT_WORD_LIMIT)
      push("COMMENT-TOO-LONG", "high", `Reviewer reply is ${words} words, over the ${COMMENT_WORD_LIMIT} word limit. Reply short and plain: acknowledge, say what changed.`);
    const boiler = findPhrases(normalized, BOILERPLATE_PHRASES);
    for (const p of boiler)
      push("BOILERPLATE-PHRASE", "high", `Reviewer reply contains boilerplate essay phrase "${p}". Cut it and say the thing plainly.`);
    if (testHits.length)
      push("TEST-REPORT-DUMP", "high", `Reviewer reply contains a test-report dump: ${testHits.join("; ")}.`);
    const extraStock = stock.filter((p) => !boiler.includes(p));
    for (const p of extraStock) push("STOCK-AI-PHRASE", "low", `Stock AI-ish phrase "${p}" — warn only.`);
  }

  const hard = findings.filter((f) => f.severity === "high").length;
  const warns = findings.length - hard;
  const verdict = hard > 0 ? FAIL_VERDICT : PASS_VERDICT;
  const counts: Record<string, number> = { words, findings: findings.length, hard, warnings: warns };
  for (const f of findings) counts[f.rule] = (counts[f.rule] ?? 0) + 1;
  return {
    tool: "prosecheck",
    version: VERSION,
    kind,
    target,
    verdict,
    counts,
    findings,
    summary: `${kind}: ${words} words checked, ${findings.length} finding(s) (${hard} hard, ${warns} warn). Verdict ${verdict}.`,
  };
}

export function renderReport(r: Report): string {
  const out = [`prosecheck ${r.kind} ${r.target}: ${r.verdict}`, `  words: ${r.counts["words"] ?? 0}, findings: ${r.counts["findings"] ?? 0} (hard: ${r.counts["hard"] ?? 0}, warn: ${r.counts["warnings"] ?? 0})`];
  for (const f of r.findings) out.push(`  [${f.severity.toUpperCase()}] ${f.rule} ${f.message}`);
  out.push(`  ${r.summary}`);
  return out.join("\n");
}
