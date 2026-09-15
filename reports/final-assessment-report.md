# Thaura AI — SQA Technical Assessment

**Prepared for:** Qtec Solutions Limited — SQA Engineer Assessment
**Application under test:** Thaura AI (https://thaura.ai / https://backend.thaura.ai)
**Assessment window:** 2026-09-14 to 2026-09-15
**Companion documents:** `docs/task-01-gap-analysis.md`, `docs/task-03-reflection.md`, `reports/thaura-bug-report.xlsx`

---

## 1. Executive Summary

Thaura AI is a consumer chat application ("ethical AI companion") with a free tier (5 messages / 5 hours), file upload/analysis, an automatic long-term memory subsystem, an Incognito mode, and a separate OpenAI-compatible paid developer API. This assessment covered functional, session/security, quota, file-handling, memory/incognito, and API testing (Task 01); website technical/functional/performance/security testing (Task 02); and a personal reflection on AI-assisted testing practice (Task 03).

**Overall result:** the product behaves correctly and safely across the large majority of tested scenarios. No exploitable security vulnerability was found. One reproducible frontend defect was found (a React hydration error present on every marketing page). A handful of nuanced observations are documented — most notably around how the automatic memory feature actually triggers, and a wording precision gap between marketing copy and the legal Data Processing Addendum regarding encryption. A defined, small set of deeper API behaviors remain billing-gated and were deliberately not pursued, with reasoning documented below (see §11 and the gap analysis).

## 2. Test Scope

- **In scope:** Web application (chat, auth, quota, file upload, memory, incognito), marketing website (functional/SEO/performance/security), developer API (structural/auth/zero-balance behavior), and a written reflection on AI-assisted testing.
- **Out of scope / explicitly excluded:** use of another real person's account; abusive load/DoS testing; paid API spend beyond what was pre-approved (none was spent); deliberately malicious prompts intended to crash the model.

## 3. Test Environment

- **Account:** single QA test account ("Qa Test", Free Plan), created for this assessment.
- **Browser automation:** Playwright (Chromium, headless), Node.js.
- **API testing:** direct HTTP calls via Playwright's request context, both with the developer API key (zero balance) and with the authenticated session cookie.
- **Auxiliary tools:** Google Lighthouse (performance/SEO/accessibility/best practices), Apache JMeter (conservative baseline load test), Python 3 + openpyxl/Pillow (report generation, evidence redaction).
- **Evidence:** `discovery-evidence/` (raw JSON/HTML/screenshots), `performance/jmeter/` (load test artifacts).

## 4. Test Approach

Testing combined scripted, evidence-generating automation (Playwright) with manual interpretation of results, deliberately favoring a small number of well-designed, information-dense test messages over exhaustive brute-force testing — the free tier's 5-message/5-hour quota made this a hard constraint, not a stylistic choice. Where a test's own automation logic produced a surprising result (e.g. an apparent incognito "leak"), the underlying DOM/network evidence was re-inspected before accepting the result, which caught two automation bugs (a broken incognito-toggle selector, and an over-broad sidebar-text selector) that would otherwise have produced false findings. This distinction — verified finding vs. automation artifact — is preserved throughout this report and the gap analysis.

---

## 5. Task 01 — Web Application Testing

*(Full requirement-by-requirement detail: `docs/task-01-gap-analysis.md`)*

### Authentication & Session
Passwordless OTP signup/login works correctly end-to-end (email → OTP request → OTP verify → session). The session cookie (`thaura_token`) is httpOnly, Secure, SameSite=Lax, with a ~1-year expiry (documented as an OBSERVATION, not a vulnerability — see §9). Logout correctly invalidates the token server-side (a replayed old token returns 401, not just a cleared client-side cookie) and, notably, invalidates *all* of the account's active sessions, not only the one that logged out — a stricter behavior than a per-device model, and not a weakness. Non-admin and anonymous users cannot reach any privileged view.

### Free Tier & Quota
The 5-message/5-hour free quota is enforced **server-side**, confirmed by directly calling the chat-send endpoint after client-side exhaustion (`429 rate_limit_exceeded`) and by polling `GET /api/chats/rate-limit/check` independently of the UI. The 5-hour reset window was confirmed via `resetAt` timestamps on two separate occasions. Incognito-mode messages consume the same quota as normal messages.

**Failed/errored response and quota:** this could not be conclusively tested. A safe, realistic attempt (interrupting a streamed reply by reloading mid-stream) revealed that Thaura's backend uses a **resumable-turn architecture** — the response completed successfully server-side regardless of the client disconnect, and the UI resumed and displayed it correctly after reload. That is a successful-but-interrupted response, not a failed one, and quota was consumed accordingly (correctly). A second safe probe showed malformed requests are rejected with a clean `400` without consuming quota, independent of quota state. Neither test reproduces a genuine assistant-side (generation) failure, and none could be safely, deliberately triggered without abusive techniques. This item is marked **NOT TESTED** rather than assumed.

### File Upload & Data Integrity
The full requested matrix (valid PDF/XLSX/PNG, empty, corrupted, password-protected, oversized 8MB/60MB) was exercised. All invalid-file cases were rejected cleanly with no crashes, no server 5xx errors, and no sensitive data in error responses. Valid-file extraction is accurate: the upload API returns exact embedded text for PDF and XLSX (verified against known planted markers), and — importantly — a live, non-quota-blocked chat turn confirmed the **assistant itself** correctly reads and quotes that extracted content, not just the upload endpoint. One notable, non-bug inconsistency: a corrupted PNG is accepted (200) while a corrupted PDF is rejected (400) — explained by the image pipeline treating all images as opaque at the extraction stage. Image-embedded-text readability via the assistant's multimodal path specifically was not re-verified live this session (budget was prioritized toward memory/incognito/isolation) and is marked NOT TESTED for that narrow question.

### File / Session Isolation
Direct access to another (own) file by ID returns 401 (unauthenticated) / 404 (authenticated, wrong context) — no path exposed file content. In a fresh conversation, the assistant explicitly and correctly denied having access to a file uploaded in a different conversation. Cross-*account* isolation (a second real account) was not tested, by design, per the assessment's own constraint against using another real person's account.

### Memory
This was the most nuanced area, and the finding materially improved once a dedicated **"Memory" settings panel** was discovered and inspected (Account menu → Memory). Key facts:
- A verbal "please remember this fact" instruction is **not** persisted across conversations — the assistant explicitly discloses this limitation in-line, and a later, unrelated conversation correctly reported not knowing the planted fact.
- A **separate, genuine automatic memory subsystem exists**, backed by `GET /api/memories` (`{"content":"","capacity":{"ceiling":12000,"hardCap":18000}}`) and `GET /api/memories/scopes`. The UI states: *"As you chat, Thaura writes down what is worth keeping."* After our short, synthetic test conversations this store was still empty — consistent with, and explaining, the earlier recall failure. This is evidence the feature works by the system's own judgment over real usage, not by direct command — not evidence the feature is broken.

### Incognito
Verified correctly, after catching and fixing an automation bug (the toggle's accessible label was on a screen-reader-only `<span>` inside a `<button>`; the first click attempt silently failed). Once corrected: incognito conversations do not appear in chat history, get no persistent `?chatId=` URL (unlike normal chats), the assistant explicitly confirms nothing carries forward, and exiting incognito works cleanly. An automated "leak into sidebar" flag from the first attempt was investigated and confirmed to be a **false positive** caused by an over-broad text selector capturing the live chat transcript rather than the actual sidebar element — this is called out explicitly to avoid overstating a finding that didn't hold up under inspection.

### API Testing
Structural validation (missing/invalid `messages`, invalid model, legacy `functions`/`function_call` parameters) is correct and returns clean `400` errors, verified both against the developer API and directly against the session-authenticated endpoint. Zero-balance requests correctly return `402 insufficient_balance` with a clear minimum-balance message, and no charges were incurred. Deeper behavioral tests (temperature bounds, token caps, parameter precedence, tool-calling, streaming, usage accounting) are gated behind a funded balance, because the billing check runs before model execution. **Funding decision: DO NOT FUND** (see §11 and gap analysis for full cost/value reasoning) — these remaining checks validate generic OpenAI-API-compatible pass-through behavior rather than Thaura-specific logic, and the platform's $10 minimum top-up is disproportionate to their assessment value.

### Negative & Boundary Testing
Unicode/RTL/emoji/long-string input round-trips correctly through form fields. Blank/invalid form submissions are blocked client-side with visible errors. The API validation batch (14 distinct structural/boundary cases) produced correct, well-formed errors in every reachable case.

---

## 6. Task 02 — Website Technical Testing

*(Task 02 was substantially complete before this finalization pass; evidence was reviewed for consistency, not re-collected.)*

### Functional / Data
All 16 crawled public pages return `200` with no broken links or redirect loops. Contact form validation correctly blocks blank/invalid submissions. Pricing is internally consistent: annual $12/month (billed $144/year) is exactly 20% off the $15/month monthly rate, matching the advertised "Save 20%" badge.

### SEO / Metadata
Lighthouse SEO score is 1.0 (perfect) on every page tested (home, pricing, api-platform, faq). Canonical tags, Open Graph, and Twitter Card metadata are present and correct.

### Performance
Lighthouse performance scores range 0.72–0.82 across the 4 pages tested, with LCP between 4.5s–6.2s — acceptable but not exceptional; the FAQ and home pages are the slowest (LCP 6.2s / 5.7s), likely worth a look at largest-contentful-paint asset loading if performance is a priority. A conservative JMeter baseline (5 concurrent users, public static pages only, no chat/billing/authenticated endpoints touched) showed 0% errors across 45 requests with average response times of 0.9–1.1s — healthy for a light load, and explicitly **not** a capacity/stress test.

### Security
Standard security headers (HSTS, X-Content-Type-Options, X-Frame-Options: DENY, Referrer-Policy, Permissions-Policy) are present on every page. The CSP is reasonably strict (`default-src 'self'`, `object-src 'none'`) with two caveats documented as Security Observations, not vulnerabilities, in §9. No secrets, API keys, or credentials were found in the client-side bundle scan.

### Console / Network
One reproducible defect was found here: a React hydration error (minified error #418) fires on every page load across all 4 pages audited via Lighthouse (home, pricing, api-platform, faq) — see §8, BUG-001. No functional/visual break was observed as a consequence in manual testing, but it indicates a real server/client render mismatch and pollutes the console. This was not caught by the project's earlier general console-message capture (which only logged 2 benign messages on its pass), and was found specifically through the Lighthouse best-practices audit — a useful illustration of why running the same page through more than one type of tooling matters.

### Technical Claims
Marketing claims were checked against the Privacy Policy, Terms of Service, Constitution, and Data Processing Addendum. One wording-precision nuance is documented (§9, OBS-007): homepage/privacy-policy copy broadly states "encrypted at rest," while the DPA specifies application-level field encryption for "selected sensitive fields" specifically. This is flagged for copy/legal review, not reported as a false claim — the DPA separately describes disk/object-storage-level encryption elsewhere, which we have no way to verify or refute from the client side.

---

## 7. Task 03 — AI & Testing Reflection

See `docs/task-03-reflection.md` for full answers. In summary: AI is expected to keep collapsing the time between having a test idea and having evidence for it, while human judgment remains essential for classification calls (bug vs. observation vs. false positive) — exactly the kind of calls this assessment repeatedly required. Claude Code was used throughout this assessment itself, for writing/running the Playwright automation, generating deterministic test fixtures, debugging a real selector bug live, and drafting this structured evidence into reports.

---

## 8. Defects / Findings

Full detail with request/response and evidence paths: `reports/thaura-bug-report.xlsx` (Bugs sheet) and `docs/task-01-gap-analysis.md`.

| ID | Title | Severity | Status |
|---|---|---|---|
| BUG-001 | React hydration mismatch (error #418) fires on every marketing page load | Low | Open |

No other reproducible functional defects were found in either the web application or the marketing site during this assessment.

## 9. Security Observations

*(No exploitable vulnerability was demonstrated. All items below are informational/awareness-level, per the assessment's explicit instruction not to overstate security findings.)*

| ID | Observation | Assessment |
|---|---|---|
| SEC-001 | CSP `connect-src` includes `http://127.0.0.1:*` / `http://localhost:*` | Likely dev-config leftover; only relevant given an independent script-injection primitive, none found. |
| SEC-002 | Session cookie has a ~1-year expiry | Mitigated by httpOnly/Secure/SameSite=Lax; no hijack/fixation impact demonstrated; a deliberate UX choice for a consumer app. |
| SEC-003 | A few endpoints (e.g. plugin catalog) are reachable pre-auth | Returns public, non-user data by design; not a vulnerability. |
| SEC-004 | Hydration error stack trace names internal build chunk files | Standard, content-hashed Next.js output; no source/secrets exposed. |

## 10. Performance Results

| Page | Lighthouse Performance | LCP | TBT | Total Size |
|---|---|---|---|---|
| Home | 0.73 | 5.7s | 230ms | 1,794 KiB |
| Pricing | 0.82 | 4.6s | 140ms | 890 KiB |
| API Platform | 0.82 | 4.5s | 150ms | 876 KiB |
| FAQ | 0.72 | 6.2s | 160ms | 907 KiB |

JMeter conservative baseline (5 users, 3 loops, public pages only): 45 requests, **0% errors**, avg 1,035.7ms, p95 1,191.6ms. This is a light health-check, not a capacity test — see `performance/jmeter/results-summary.json`.

## 11. API Testing Summary

Zero-balance testing fully exercised structural validation, model validation, legacy-parameter rejection, and the billing gate itself (14 distinct cases, all correct). Deeper behavioral tests (temperature bounds, `max_tokens`/`max_completion_tokens`, the 32000 cap, parameter precedence, ignored parameters, `tools`/`tool_choice`, streaming, usage accounting) require a funded balance because the billing check runs before model execution.

**Decision: DO NOT FUND.** Estimated remaining scope is ~10–13 minimal calls, plausibly under $0.05 in actual usage — against a $10 platform minimum top-up — to validate generic OpenAI-API-compatible parameter pass-through rather than Thaura-specific logic. These items are documented as **BLOCKED (billing-gated)** rather than silently omitted. No paid API calls were made.

## 12. Automation Strategy

**Automate (Playwright + scripts, already demonstrated in this repo's `scratch-*.js`):**
- Auth/OTP flow, session/logout invalidation checks
- Chat quota exhaustion and reset-window verification
- File upload matrix (valid/invalid/boundary) and extraction-accuracy assertions
- Navigation/link/redirect checks, metadata/canonical checks, pricing-toggle consistency
- API structural/negative/boundary validation (a natural fit for a Playwright-API or Postman/Newman collection)
- Console/network error monitoring as a standing regression check (would have caught BUG-001 automatically if wired into CI)

**JMeter:** conservative load/performance baselining on public pages, expanded deliberately and incrementally if real load testing is later authorized.

**Lighthouse:** performance/SEO/accessibility/best-practices scoring, run per-release against a fixed page set.

**Keep manual/hybrid:**
- AI response quality and extraction-accuracy *judgment* (automation can capture the response; a human should judge whether it's actually correct/appropriate)
- Memory semantics (the automatic memory subsystem responds to real usage patterns over time, not a single scripted probe)
- Incognito behavior interpretation (as this assessment showed, automated leak-detection selectors can produce false positives that need human DOM-level verification before being trusted)
- Security interpretation and severity classification (a 400/401/402 status code is easy to assert in a script; whether a given behavior constitutes a real security concern is a judgment call)

This assessment deliberately did not build a full automation framework — the priority was completing manual/hybrid verification of every requirement first. The scripts in this repo are a reasonable starting point for a future framework, not a finished one.

## 13. Limitations / Not Tested

Full detail: `docs/task-01-gap-analysis.md` (per-requirement) and `reports/thaura-bug-report.xlsx` (Not Tested / Limitations sheet). Summary:
- Genuine assistant-side (generation) failure and its quota impact — not safely reproducible without abusive techniques.
- Image-embedded-text readability by the assistant in a live chat turn — deprioritized under the free-tier message budget.
- Cross-account file isolation — scope-limited to the single authorized test account.
- Deeper API parameter/behavioral tests and rate/concurrency limits — billing-gated; funding evaluated and not recommended.
- Incognito behavior under a mid-session refresh specifically — not directly re-exercised.

## 14. Final Conclusion

Thaura AI's core flows — authentication, quota enforcement, file handling, conversation/file isolation, incognito mode, and API input validation — all behave correctly and match their stated or reasonably-inferred design intent, with server-side enforcement backing the client-side UX in every case checked (quota, auth, file access). The one reproducible defect found (a site-wide React hydration error) is low-severity and does not affect functionality as observed, but is worth fixing for console cleanliness and render correctness. Security posture is solid: no exploitable vulnerability was found, and every flagged item is explicitly scoped as an observation rather than a demonstrated risk, in line with the assessment's instruction not to overstate findings. The remaining gaps (a subset of API behavioral tests, one narrow file-type question, cross-account isolation) are explicitly scoped, justified, and documented rather than silently skipped or fabricated.
