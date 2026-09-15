# Thaura AI — SQA Assessment (Qtec Solutions Limited)

This repository contains the SQA Engineer assessment testing for **Thaura AI** (https://thaura.ai), covering web application testing, website technical testing, and an AI-in-testing reflection, as assigned by Qtec Solutions Limited.

## Purpose & Scope

- **Task 01 — Web Application Testing:** authentication/OTP, session handling, free-tier quota enforcement, file upload & data-integrity, memory, incognito mode, and API testing.
- **Task 02 — Website Technical Testing:** functional/data correctness, SEO/metadata, performance, security headers, and technical-claims review.
- **Task 03 — AI & Testing Reflection:** a written reflection on how AI is used in this assessment's own testing practice.
- **Final deliverables:** a consolidated technical report, a classified bug/observation report (Excel), and a gap analysis mapping every original requirement to a tested outcome.

Explicitly out of scope: use of another real person's account, abusive/load-testing techniques against production infrastructure, and any paid API spend (a funding decision was evaluated and documented instead of spent — see `docs/task-01-gap-analysis.md`).

## Test Environment

- **Application:** https://thaura.ai (frontend), https://backend.thaura.ai (API)
- **Test account:** a single dedicated QA account ("Qa Test", Free Plan) created for this assessment — not a real third-party account.
- **Automation:** Playwright (Chromium, headless) + Node.js.
- **Auxiliary tools:** Google Lighthouse (performance/SEO/accessibility/best practices), Apache JMeter (conservative load baseline), Python 3 with `openpyxl` (Excel report generation) and `Pillow` (evidence image redaction).

## Repository Structure

```
.
├── discovery-evidence/        # Raw test evidence: JSON, HTML, screenshots, network/console logs
│   ├── api-test/               # Developer API key/billing UI evidence
│   ├── claims-check/           # Marketing/legal page text extracts for claims review
│   ├── lighthouse/             # Full Lighthouse JSON reports per page
│   ├── memory-incognito-test/  # Memory subsystem + Incognito mode evidence
│   ├── quota-test/             # Free-tier quota exhaustion, reset, and failed-response tests
│   ├── source-scan/            # Client bundle secret-pattern scan
│   ├── unicode-test/           # Unicode/RTL/emoji input handling
│   ├── upload-test/            # File upload matrix (valid/invalid/boundary) + extraction verification
│   └── website-scan/           # Site crawl, admin-access checks, contact form, pricing consistency
├── test-data/                  # Deterministic test fixtures (valid/invalid/boundary files)
│   └── generate_fixtures.py    # Regenerates the fixtures from scratch
├── performance/jmeter/          # JMeter test plan (.jmx), raw results (.jtl), and summary
├── docs/
│   ├── task-01-gap-analysis.md # Every Task 01 requirement mapped to PASS/FAIL/OBSERVATION/NOT TESTED/BLOCKED
│   └── task-03-reflection.md   # AI-in-testing reflection (Task 03 answers)
├── reports/
│   ├── final-assessment-report.md   # Consolidated technical report (start here)
│   └── thaura-bug-report.xlsx       # Classified bugs / observations / security observations / not-tested
├── scratch-*.js / .py          # Individual Playwright/Python test scripts, one per test area
├── .state/                     # Session cookie & API key (gitignored — never committed)
└── .gitignore
```

**Where to start:** read `reports/final-assessment-report.md` first, then `docs/task-01-gap-analysis.md` for per-requirement detail, then the raw files under `discovery-evidence/` for underlying proof of any specific line item.

## How to Run the Safe Automated Tests

All scripts assume a valid session has already been captured into `.state/session.json` (via the login scripts) and are run from the repository root with Node.js and the local `playwright` dependency:

```bash
npm install            # installs playwright / playwright-core from package.json
node scratch-login.js  # establishes .state/session.json (interactive OTP step required once)
```

Individual test areas can then be re-run independently, e.g.:

```bash
node scratch-website-scanner.js       # site crawl: links, metadata, console/network errors
node scratch-unicode-test.js          # Unicode/RTL/emoji input round-trip
node scratch-upload-full.js           # file upload matrix (WARNING: consumes free-tier quota)
node scratch-check-quota-now.js       # read-only quota check (no cost)
```

**Quota-safety note:** several scripts (upload, quota, memory/incognito, failed-response tests) send real chat messages and consume the account's 5-message/5-hour free-tier quota. `scratch-check-quota-now.js` reads `GET /api/chats/rate-limit/check` without sending a message — always check remaining quota before re-running anything that sends messages.

## Performance Testing

JMeter test plan: `performance/jmeter/thaura-conservative-load-test.jmx`. This is a **conservative baseline only** — 5 concurrent users against public static pages (`/home`, `/pricing`, `/faq`), explicitly excluding `backend.thaura.ai`, `/v1/chat/completions`, and any authenticated/billing endpoint. Run via:

```bash
jmeter -n -t performance/jmeter/thaura-conservative-load-test.jmx -l performance/jmeter/results.jtl
```

Do not increase concurrency/duration against the production target without explicit authorization — this was intentionally scoped as a light health check, not a capacity or stress test.

## Evidence & Reporting Policy

- All raw evidence lives under `discovery-evidence/`, organized by test area, in the original JSON/HTML/PNG form produced by the test scripts.
- The Excel bug report (`reports/thaura-bug-report.xlsx`) classifies findings strictly: **Bugs** (reproducible defects only), **Observations** (interesting behavior, not a proven defect), **Security Observations** (potential concern, no demonstrated exploit), and **Not Tested / Limitations** (explicitly scoped-out or blocked items, never silently omitted).
- Findings are not escalated beyond what evidence supports — e.g. a long-lived session cookie or a permissive local-dev CSP entry is documented as an observation, not reported as a vulnerability, unless actual exploitable impact was demonstrated.

## Security & Sensitive-Data Policy

- **Never committed:** `.state/` (session cookie, API key), `.env`, real OTP codes, JWT/session token values, or account passwords (Thaura has no password auth — OTP-only).
- Session cookie values are captured only as `<REDACTED>` with metadata (httpOnly/Secure/SameSite flags, length) — never the raw value.
- The QA test account's personal email address was found unredacted in several evidence JSON/text files and in 3 screenshots (email-entry, OTP, and settings screens) from earlier testing; both were corrected during finalization — text values replaced with `<REDACTED_EMAIL>`, and the 3 screenshots pixel-redacted with a solid black box over the email field (verified by re-inspection, not just visually covered in a viewer).
- OTP input screenshots were verified empty (no real OTP digit was ever captured in evidence).
- `.gitignore` excludes `.state/`, `.env*`, logs, and an unrelated project folder (`medha ai testing/`) that is physically present in this working directory from an earlier, already-corrected accidental repository merge (see `git log`/`git reflog` — a `backup-before-medha-cleanup` branch preserves that history; the folder itself is untouched, just excluded from this repo going forward).

## Known Limitations

See `docs/task-01-gap-analysis.md` §Summary and `reports/thaura-bug-report.xlsx` (Not Tested / Limitations sheet) for the authoritative list. In short: a genuine assistant-side generation failure could not be safely reproduced; image-embedded-text reading by the assistant in a live chat turn wasn't re-verified under the free-tier budget; cross-*account* file isolation wasn't tested (by design — no second real account was used); and a defined set of deeper API parameter/behavioral tests remain billing-gated, with funding evaluated and explicitly not recommended given cost-to-value.
