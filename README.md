# prosecheck

PR prose gate. Checks a pull request body, a commit message, or a reviewer reply before it is posted, and fails the long, report-dumping, AI-sounding prose that maintainers have closed PRs over (Kotlin/kotlinx.serialization #3312, 2026-11-05; qutebrowser #9051).

Test evidence belongs in the internal wave report, not in the PR. A PR body should say, plainly and briefly: what was wrong, what changed, and what test was added.

Major rule (Rene, 2026-11-05): prosecheck is one required step of the full own-tool stack for every PR (Greenlight, racecheck, reprocheck, prosecheck, commitcheck, pr_full_ci_gate, plus prwatch/claimcheck/gatefile/shipcheck/cidiff where they apply) — no PR opens and no reply or fix goes out without the stack run and logged, and a tool error or timeout is unknown, not a pass. See `~/workspace/custom-skills/pr_prose_gate/SKILL.md`.

## Install / run (local, not yet published)

Requires Node 20+.

```sh
npm install
npm run build
node dist/cli.js pr-body ./body.md
node dist/cli.js commit ./commit.txt
node dist/cli.js comment ./reply.txt
cat body.md | node dist/cli.js pr-body -
node dist/cli.js pr-body ./body.md --json
npm test
```

Exit codes: `0` PASS, `1` FAIL, `2` usage/read error.

## CLI

```sh
prosecheck pr-body|commit|comment <file|-> [--json]
prosecheck mcp          # MCP server on stdio, tool: check_prose
prosecheck --version
```

## Rules

Hard FAIL:
| Kind | Rule | Limit |
|---|---|---|
| pr-body | PR-BODY-TOO-LONG | > 120 words |
| pr-body | TEST-REPORT-DUMP | "Test report", "N tests, 0 failures", Gradle/JDK/Temurin/toolchain versions, Gradle test tasks |
| pr-body | TOO-MANY-HEADINGS | > 3 headings |
| pr-body | TOO-MANY-BULLETS | > 7 bullet lines |
| commit | SUBJECT-TOO-LONG | subject > 72 chars |
| commit | COMMIT-BODY-TOO-LONG | body > 60 words (Signed-off-by trailer excluded) |
| commit | TEST-REPORT-DUMP | as above |
| comment | COMMENT-TOO-LONG | > 80 words |
| comment | BOILERPLATE-PHRASE | furthermore / in summary / it's worth noting / in conclusion / "I appreciate your feedback" / "thank you for your thorough" / "please do not hesitate" / "I hope this clarifies" / "let me know if you have any further" etc. |
| comment | TEST-REPORT-DUMP | as above |

Warn only (never fails on its own): stock AI-ish phrases — comprehensive, delve, furthermore, in summary, it's worth noting, moreover, in conclusion — in pr-body / commit.

## Canonical fixtures

`test/fixtures/pr3312-original-body.txt` FAILS (too long + test-report dump), `pr3312-trimmed-body.txt` PASSES, `pr3312-original-commit.txt` FAILS, `short-commit.txt` PASSES, `long-reply.txt` FAILS, `short-reply.txt` PASSES.
