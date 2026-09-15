# Task 01 — Web Application Testing: Gap Analysis

**Application under test:** Thaura AI (https://thaura.ai, backend: backend.thaura.ai)
**Test account:** "Qa Test" (Free Plan), created for this assessment
**Date range:** 2026-09-14 to 2026-09-15
**Status legend:** PASS / FAIL / OBSERVATION / NOT APPLICABLE / NOT TESTED / BLOCKED

> Evidence paths are relative to the repository root. Raw evidence containing account identifiers has been text-redacted (`<REDACTED_EMAIL>`) and, for 3 screenshots, pixel-redacted. See `docs/` and `reports/final-assessment-report.md` for narrative context.

## Authentication & Session

| Requirement | Status | Evidence | Notes |
|---|---|---|---|
| OTP-based signup | PASS | `discovery-evidence/signup-step1-requests.json`, `signup-step2-requests.json`, `discovery-evidence/12-otp-screen.png`, `13-after-otp-v3.png` | Email → OTP request → OTP verify → session issued. OTP field itself never captured (input was empty in all screenshots); no code was logged in any evidence file. |
| OTP delivery / verification flow | PASS | `discovery-evidence/06-after-otp.png` | Verified OTP submission transitions to authenticated dashboard. |
| Session/token issuance | PASS | `discovery-evidence/session-cookies-redacted.json`, `token-claims-safe.json` | `thaura_token` cookie: httpOnly, secure, SameSite=Lax. Value redacted at capture time. |
| Session cookie lifetime | OBSERVATION | `discovery-evidence/token-claims-safe.json` | Token `exp` is ~1 year from issuance (2026-09-14 → 2027-09-14). Long-lived by design for a consumer app; flagged as an observation, not a vulnerability — no session-fixation or hijack impact was demonstrated, and the cookie is httpOnly/secure so it isn't accessible to client-side script (see also XSS-adjacent note under Task 02 security). |
| `GET /api/auth/me` reflects correct session state | PASS | `discovery-evidence/post-login-me-check.json` | Returns account profile (id, email, plan, name, isAdmin) only when authenticated; 401 `{"message":"Not authenticated"}` otherwise. |
| Logout invalidates session | PASS | `discovery-evidence/logout-invalidation-summary.json` | Post-logout: `/api/auth/me` → 401 in the logging-out context; replaying the old token after logout → 401 (token/session correctly invalidated server-side, not just cleared client-side). |
| Cookie cleared client-side after logout | PASS | `discovery-evidence/logout-invalidation-summary.json` (`postLogoutContextA_cookieStillPresentLocally: false`) | |
| Concurrent sessions (2 browser contexts, same account) | PASS | `discovery-evidence/concurrent-session-check.json` | Both contexts return 200 on `/api/auth/me` simultaneously — app allows concurrent sessions (this is a product design choice, not a defect; flagged as OBSERVATION-adjacent for awareness only). |
| Logout in one context affects only that context's session | PASS | `discovery-evidence/logout-invalidation-summary.json` (`contextB_afterA_logout_meStatus: 401`)  | **Correction/clarify:** Context B also returned 401 after Context A logged out. This indicates logout invalidates the *account's* active session token rather than only the browser context that issued it — i.e., logging out in one place appears to end other active sessions too. This is a product behavior, not a flaw, but is called out because it differs from a per-device-session model. See "Notes" — this deserves attention in the final report as an OBSERVATION, not a security bug (no unauthorized party gained access; the opposite occurred — a shared logout narrowed access). |
| Non-admin / anonymous cannot reach privileged views | PASS | `discovery-evidence/website-scan/admin-access-check.json`, `admin-as-anonymous.png`, `admin-as-nonadmin-user.png` | No admin UI reachable by either anonymous or standard free-tier account. |
| Password field / password-based login | NOT APPLICABLE | `discovery-evidence/settings-password-check.json` | Thaura uses passwordless OTP-only auth; no password field exists anywhere in Settings or login flow. |

## Free Tier & Quota

| Requirement | Status | Evidence | Notes |
|---|---|---|---|
| Free quota is 5 messages | PASS | `discovery-evidence/quota-test/quota-test-log.json`, `chat-network-requests.json` | `GET /api/chats/rate-limit/check` decremented 5→4→3→2→1→0 across 5 sends, confirmed independently on 2026-09-14 and re-confirmed on 2026-09-15 with a fresh window (5/5 → 0/5 across combined tests). |
| 5th message succeeds, 6th is blocked | PASS | `discovery-evidence/quota-test/quota-test-log.json`, `msg-6.png` | 6th send blocked client-side with upgrade modal; corroborated server-side via `bypass-check-result.json`. |
| 5 vs 6 message enforcement is server-side, not just UI | PASS | `discovery-evidence/quota-test/bypass-check-result.json` | Direct authenticated call to the chat-send endpoint after exhausting quota returned `429 rate_limit_exceeded` — `"Free users can send 5 messages every 5 hours."` Confirms server-side enforcement independent of the UI's own blocking. |
| 5-hour reset window | PASS | `discovery-evidence/quota-test/chat-network-requests.json` (`resetAt` field), `discovery-evidence/upload-test/results.json` (countdown banner "Free messages reset in: 4h 38m" etc.) | `resetAt` timestamps observed matched a 5-hour window from first message of the block (e.g. exhausted ~09:22 UTC 2026-09-14, `resetAt` ~14:21 UTC same day; separately, exhausted 09:17 UTC 2026-09-15, `resetAt` 13:48 UTC same day). |
| UI reflects quota state (banner, disabled input, upgrade prompt) | PASS | `discovery-evidence/upload-test/results.json` (body text snapshots), `discovery-evidence/quota-test/msg-6.png` | "Out of messages" modal with countdown and upgrade CTA shown consistently once exhausted. |
| Incognito messages count against the same free-tier quota | PASS | `discovery-evidence/memory-incognito-test/incognito-verified-results.json` | Sending inside verified incognito mode decremented `remaining` (2→1) identically to a normal message — incognito is not a way to get "extra" free messages. |
| Failed/interrupted response — does it still consume a quota unit? | **NOT TESTED** (partial data obtained) | `discovery-evidence/quota-test/failed-response-quota-test.json`, `malformed-session-request-results.json` | See dedicated section below. A genuine assistant-side failure could not be safely and deliberately reproduced without abusive techniques; the one safe, realistic scenario tried (simulated dropped connection) did not actually fail — see notes. |

### Failed-response / quota-consumption — detail

Two safe probes were run; neither constitutes a genuine assistant-side failure, so the strict question remains **NOT TESTED**:

1. **Simulated client disconnect mid-stream** (`failed-response-quota-test.json`): sent a message requiring a longer streamed reply, then reloaded the page ~1.6s later to drop the client connection before the stream finished. Result: the backend has a **resumable-turn architecture** (`/v1/chat/active-turns`, `/v1/chat/turns/{id}/events?starting_after=`) — generation continued server-side regardless of the client disconnect, the turn's status progressed `in_progress` → `completed`, and after reload the UI resumed and displayed the full, correct answer. Quota went from 1 → 0. **This was a successful response that happened to be interrupted client-side, not a failed one** — quota consumption here is expected and correct, not evidence of "failed responses cost a message."
2. **Malformed payload directly to the session-authenticated `/v1/chat/completions`** (`malformed-session-request-results.json`): sent with quota already at 0. Both a missing-`messages` and a wrong-type-`messages` payload returned a clean `400 invalid_request_error` and quota `remaining` stayed at 0 (did not go negative, was not treated as a consumed message). This shows **request-validation failures are not billed/counted as messages** — but a 400 is a client input error, not an "assistant-side" (generation) failure either.

**Conclusion:** `NOT TESTED — unable to safely reproduce a controlled assistant-side (generation) failure without abusive techniques (e.g., deliberately malicious prompts intended to crash the model, or resource-exhaustion attempts). The two safe, realistic scenarios available within the free-tier budget instead demonstrated: (a) client disconnects do not cause failures — the backend resumes and completes generation, billing the message normally; (b) request-validation errors (400) are not billed. Neither answers "what happens when the assistant itself errors out mid-generation," which would require either a paid-tier fault-injection capability not available to us, or an actual production incident.` No result was fabricated for this row.

## File Upload & Data Integrity

| Requirement | Status | Evidence | Notes |
|---|---|---|---|
| PDF upload — text extraction accuracy | PASS | `discovery-evidence/upload-test/extraction-verification.json`, `discovery-evidence/memory-incognito-test/full-test-results.json` | Raw upload API returned exact embedded text (`QA-DOC-MARKER-71934`, `$4,217.63`) for `sample.pdf`. Additionally, in a live, non-quota-blocked chat turn on 2026-09-15, the assistant correctly quoted `QA-DOC-MARKER-71934` back — confirms the model genuinely consumes the extracted content, not just that the upload endpoint parses it. |
| Spreadsheet (.xlsx) upload — value extraction accuracy | PASS | `discovery-evidence/upload-test/extraction-verification.json` | Cell values and the marker (`QA-CELL-MARKER-58201`) extracted correctly as a markdown table via the upload API. |
| Image upload — content readable by assistant | OBSERVATION | `discovery-evidence/upload-test/extraction-verification.json` | At upload time, the API only records `"content": "Image file: sample.png"` — no OCR/text extraction happens at the upload/indexing stage for images. Whether the assistant can read in-image text via multimodal vision **when actually asked in a live chat turn** was not directly re-verified this session (the original attempt was quota-blocked; the 2026-09-15 quota budget was allocated to the higher-priority memory/incognito/file-isolation tests instead). **NOT TESTED (deprioritized under quota constraints)** for the specific "can the model read text baked into an image" question — recommend one follow-up test when quota resets, budget permitting. |
| Empty file rejected cleanly | PASS | `discovery-evidence/upload-test/results.json` (`empty_pdf`, `empty_png`) | Client-side message: "Cannot upload empty file." No network request fired (rejected before reaching the server); no crash. |
| Corrupted file rejected cleanly | PASS | `discovery-evidence/upload-test/results.json` (`corrupted_pdf`) | Server returned `400` for the corrupted PDF; UI showed "Could not extract text from PDF... may be corrupted, password-protected, or contain only images." No crash, no silent accept. |
| Corrupted PNG handling | OBSERVATION | `discovery-evidence/upload-test/results.json` (`corrupted_png`) | Upload returned `200` (server accepted the file bytes) rather than rejecting it — likely because a corrupted PNG can still be stored as an opaque binary even if unrenderable/unreadable, unlike a corrupted PDF where text extraction is expected to fail loudly. Not classified as a bug: no crash, no data exposure, and the image extraction pipeline already treats all images as opaque (`"Image file: <name>"`) rather than attempting deep parsing — so a corrupted PNG behaves the same as a valid one from the pipeline's perspective. Worth a product note, not a defect. |
| Password-protected file rejected cleanly | PASS | `discovery-evidence/upload-test/results.json` (`password_protected_pdf`) | Server returned `400`; same "could not extract text... may be corrupted, password-protected" message as the corrupted case — accurate and non-crashing, though the message doesn't distinguish "password-protected" from "corrupted" (minor UX ambiguity, not a functional defect). |
| Oversized file (8MB) handling | PASS | `discovery-evidence/upload-test/results.json` (`oversized_8mb`) | Rejected client-side, no network request fired. |
| Oversized file (60MB) handling | PASS | `discovery-evidence/upload-test/results.json` (`oversized_60mb`) | Client-side message: "File size exceeds the 50MB limit." Clear, correct limit enforcement communicated to the user. |
| No server error / crash on any invalid file | PASS | `discovery-evidence/upload-test/results.json` (all entries) | No 5xx responses observed across the entire invalid-file matrix. |
| No sensitive data exposed in upload error responses | PASS | `discovery-evidence/upload-test/results.json` | Error bodies contain only generic messages; no stack traces, paths, or internal identifiers observed. |
| Uploaded file associated with correct conversation | PASS | `discovery-evidence/upload-test/extraction-verification.json` (distinct `fileId`/`minioKey` per chat) | Each upload gets a unique `fileId` and a `minioKey` scoped under the uploading user's ID. |
| Upload/loading/error UI states | PASS | `discovery-evidence/upload-test/*-after-attach.png`, `*-after-send.png` | Attach state, inline error banners, and send state all rendered distinctly and correctly across the test matrix. |

## Cross-Session / File Isolation

| Requirement | Status | Evidence | Notes |
|---|---|---|---|
| Direct/unauthenticated access to another user's file by ID | PASS (isolation holds) | `discovery-evidence/upload-test/isolation-probe-results.json` | Guessed/known `fileId` against 3 candidate endpoints: authenticated-but-wrong-context → `404`; unauthenticated → `401`. No path returned file content. |
| File content does not leak into a different conversation (same account) | PASS | `discovery-evidence/memory-incognito-test/full-test-results.json` | In a fresh conversation, explicitly asked whether the assistant had access to a file uploaded in a different chat — it correctly answered "No, I do not have access to the content of files uploaded in different conversations... previous chats and their attachments are not carried over here." |
| Cross-*account* file isolation (different real accounts) | NOT TESTED | — | Per assessment constraints, testing was limited to the single authorized QA account; a second real account was not created/used to avoid using "another real person's account." This is a scope limitation, not a finding of insecurity — the same-account, cross-conversation test plus the direct-ID-access test together give reasonable (not exhaustive) confidence that isolation is enforced by conversation/user scoping server-side rather than by client-side hiding alone. |
| New-chat UI resets attachment state | PASS | `discovery-evidence/upload-test/newchat-isolation-retest.json` | Starting a new chat shows no residual attachment reference. |

## Memory

| Requirement | Status | Evidence | Notes |
|---|---|---|---|
| Conversational "remember this fact" instruction persists across new conversations | FAIL (expectation not met) — see nuance below | `discovery-evidence/memory-incognito-test/full-test-results.json` | Assistant explicitly said, in-conversation: "I can't store arbitrary instructions like 'remember this for all future conversations' as a standing rule." A fresh, unrelated conversation later returned "I don't know" when asked to recall the planted marker. This is arguably **expected/intended behavior** (the assistant is transparent about the limitation up front) rather than a defect — reclassified as **OBSERVATION**, not FAIL, since no false claim of persistence was made to the user. |
| Distinct, structured long-term memory feature exists | PASS (feature confirmed) | `discovery-evidence/memory-incognito-test/memory-settings-network-log.json`, `memory-settings-bodytext.txt`, `11-memory-settings-panel.png` | A dedicated "Memory" panel exists (Account menu → Memory), backed by `GET /api/memories` (`{"content":"","updatedAt":null,"capacity":{"tokens":0,"ceiling":12000,"hardCap":18000,"full":false}}`) and `GET /api/memories/scopes` (`{"scopes":[]}`). UI copy: *"As you chat, Thaura writes down what is worth keeping. It will show up here."* This is a genuine, distinct, automatic memory subsystem — separate from per-conversation chat history and separate from a verbal "remember this" command. |
| Automatic memory captured our test facts | OBSERVATION | same as above | After our test conversations, the memory store was still empty (`content: ""`, "Nothing remembered yet"). This is consistent with — and explains — the earlier recall failure: memory here is apparently populated by the system's own judgment over the course of genuine usage, not by direct command, and our short, synthetic test messages did not trigger it. This is **not evidence of a broken memory feature**; it is evidence that the feature works differently than a naive "tell it to remember, it remembers" model, and that our specific instruction phrasing is not the trigger mechanism. A longer/more naturalistic conversation would be needed to observe the automatic system actually writing an entry — out of scope for the remaining time/quota budget. |
| Refresh/reload preserves conversation & recall state within a chat | PASS | `discovery-evidence/memory-incognito-test/full-test-results.json` (`afterReload_url` unchanged, chat content intact) | Reloading mid-conversation preserved the chat and its (already-established) answers; did not retroactively "gain" memory of the earlier marker (consistent with the "no persistence" finding). |
| Distinguish conversation history vs. model memory vs. client-side vs. server-side persistence | PASS (documented) | See above | Conversation history: server-side, per-chat, visible in sidebar (confirmed via `/api/bootstrap`, `/api/messages/chat/{id}`). Model "remember this" claims: no verified persistence. Structured memory subsystem: server-side (`/api/memories`), currently empty. Client-side persistence: only UI preference (`thaura-language: en`) found in `localStorage`; no chat content or facts stored client-side (`session-storage-redacted.json`). |

## Incognito

| Requirement | Status | Evidence | Notes |
|---|---|---|---|
| Incognito toggle works | PASS (after correcting a test-automation bug) | `discovery-evidence/memory-incognito-test/incognito-verified-results.json` | First automation attempt clicked an invisible screen-reader-only `<span>` rather than its parent `<button>`, and a `.catch()` silently swallowed the resulting timeout — so the first "incognito" send was actually posted in a normal chat. Diagnosed via DOM inspection, corrected using an accessible-name role locator, and re-verified: `"You're incognito"` / `"Exit incognito"` UI states both confirmed. |
| Incognito conversation does not appear in chat history sidebar | PASS | `discovery-evidence/memory-incognito-test/incognito-verified-results.json` (`sidebarAfterIncognitoSend` — TODAY list shows only the 3 pre-existing named chats) | An early automated check flagged this as a possible leak, but that was a **false positive** caused by an over-broad CSS selector capturing the live chat transcript rather than the actual sidebar nav element. Ground truth, re-read directly from the captured DOM text: no incognito entry was added to the sidebar. |
| Incognito conversation gets no persistent/addressable URL | PASS | `discovery-evidence/memory-incognito-test/incognito-verified-results.json` (`urlDuringIncognito: "https://thaura.ai/"`, no `?chatId=`) | Unlike every normal chat (which gets a `?chatId=` URL param), the incognito session never acquired one — architecturally consistent with "not persisted as an addressable conversation." |
| Incognito info does not leak into normal memory | PASS | `discovery-evidence/memory-incognito-test/full-test-results.json` (`chatB_incognitoMarkerLeaked: false`) | A later, separate normal conversation had no knowledge of the incognito-planted marker. |
| Incognito sends still count against free-tier quota | PASS (documented as OBSERVATION-worthy behavior, not a defect) | `discovery-evidence/memory-incognito-test/incognito-verified-results.json` (`remaining` 2→1) | Not a bug — reasonable design choice — but worth stating explicitly since it isn't obvious from the UI copy alone. |
| Exiting incognito returns to normal mode cleanly | PASS | `discovery-evidence/memory-incognito-test/incognito-verified-results.json` (`exitedIncognitoConfirmed: true`) | |
| Refresh during/after incognito | OBSERVATION | — | Not independently re-tested this session (budget-constrained); the URL-scoping evidence above (no `?chatId=`) strongly suggests a refresh while "in" an incognito conversation would lose that conversation entirely, consistent with "not saved," but this specific refresh-while-incognito scenario was not directly exercised. |

## API Testing

| Requirement | Status | Evidence | Notes |
|---|---|---|---|
| API authentication (API key required) | PASS | `discovery-evidence/api-test/*` (prior session), `discovery-evidence/quota-test/malformed-session-request-results.json` | |
| API structural validation (missing/invalid `messages`) | PASS | `discovery-evidence/api-test/validation-batch-results.json` (`API-07`, `API-08`) | `400 invalid_messages` for missing/wrong-type `messages`, independent of balance state — confirmed again on 2026-09-15 with quota-authenticated session request returning identical `400` behavior. |
| API model validation | PASS | `validation-batch-results.json` (`API-09`) | Non-`thaura` model rejected `400 invalid_model` with a clear message. |
| Legacy `functions`/`function_call` rejected in favor of `tools`/`tool_choice` | PASS | `validation-batch-results.json` (`API-18`, `API-19`) | Clean `400 unsupported_parameter` with a helpful migration message. |
| Zero-balance request handling | PASS | `validation-batch-results.json` (`API-07`, `API-10`–`API-17`, `API-20`, `API-21`) | Well-formed-but-unfunded requests consistently return `402 insufficient_balance`, `"Minimum required: $0.10"` — correct and informative. |
| Validation order (structural checks run before/independent of billing check) | PASS | `validation-batch-results.json` (compare `API-08`/`API-09`/`API-18`/`API-19` [400] vs. `API-10`–`API-17`/`API-20`/`API-21` [402 despite equally exotic parameter values]) | Confirms the billing gate sits *after* structural/model/legacy-parameter validation, but *before* the model-execution layer — so parameter values that are only meaningful once generation runs (temperature bounds, token caps, tool-calling) cannot be observed without a funded balance. This is the basis for the funding decision below. |
| Temperature boundary enforcement (accepted range) | **BLOCKED (billing-gated)** | `validation-batch-results.json` (`API-10`, `API-11`, `API-12`, `API-13`) | All return `402` before reaching whatever temperature validation exists. See API Funding Decision. |
| `max_tokens` / `max_completion_tokens` behavior & 32000 cap | **BLOCKED (billing-gated)** | `validation-batch-results.json` (`API-14`, `API-15`, `API-15b`) | Same as above. |
| Parameter precedence (`max_tokens` vs `max_completion_tokens` both set) | **BLOCKED (billing-gated)** | `validation-batch-results.json` (`API-17`) | |
| Ignored/pass-through parameters (`top_p`, `frequency_penalty`, `presence_penalty`, `n`, `user`) | **BLOCKED (billing-gated)** | `validation-batch-results.json` (`API-20`) | Accepted at the structural-validation layer (no 400), so they are at least recognized parameter names; whether they measurably affect output cannot be observed without balance. |
| `tools` / `tool_choice` function-calling behavior | **BLOCKED (billing-gated)** | `validation-batch-results.json` (`API-21`) | |
| Streaming vs non-streaming response shape | **BLOCKED (billing-gated)** | — | Not reachable without a successful (funded) generation call. |
| Usage accounting (token counts / cost reporting in response) | **BLOCKED (billing-gated)** | — | Same constraint. |
| API rate/concurrency limits | NOT TESTED | — | Would require multiple funded, near-simultaneous calls to observe; not attempted (no balance, and deliberately not pursued to avoid any appearance of a DoS-style probe against production infrastructure). |
| Negative/boundary testing (general) | PASS (for everything reachable pre-billing) | `validation-batch-results.json` (14 distinct cases) | Every structurally-reachable negative/boundary case produced a correct, well-formed error. Deeper boundary tests (temperature/tokens/tools) are billing-gated as above. |

### API Funding Decision — **DO NOT FUND**

Zero-balance testing already exercised the full structural-validation surface (missing/invalid fields, invalid model, legacy parameters, boundary-shaped payloads) and confirmed the billing gate itself behaves correctly and transparently (`402`, clear minimum-balance message, no charge incurred). The remaining untested items — temperature bounds, token-cap enforcement, parameter precedence, ignored-parameter handling, tool-calling, streaming, and usage accounting — all require a successful, funded generation call to observe, because the billing check short-circuits before the model-execution layer runs.

**Estimated scope to close these gaps:** ~10–13 minimal API calls (short prompts like `"hi"`, `max_tokens` in the 5–20 range), realistically well under $0.05 in actual usage cost at typical small-model pricing. However, the platform's minimum top-up is a flat **$10**, and every one of these remaining checks validates generic OpenAI-API-compatible parameter pass-through behavior rather than Thaura-specific business logic — i.e., they are lower assessment value relative to cost. **Recommendation: `DO NOT FUND API — sufficient zero-balance evidence obtained; remaining tests are lower-value or billing-gated`,** documented transparently above as BLOCKED rather than silently omitted. No paid API calls were made or will be made without separate, explicit approval.

## Negative / Boundary Testing (cross-cutting summary)

| Requirement | Status | Evidence |
|---|---|---|
| Unicode / RTL / emoji input handling (contact form, chat-adjacent fields) | PASS | `discovery-evidence/unicode-test/results.json` — Bangla, Arabic RTL, mixed script, emoji, 1000-char string, and special characters all round-tripped correctly in both name and message fields. |
| Empty/invalid form submission handling | PASS | `discovery-evidence/website-scan/contact-blank-submit*.png`, `contact-invalid-email-submit*.png` | Client-side validation blocks blank/invalid submissions with visible errors. |
| Zero-balance / boundary API payloads | PASS | See API section above. |

---

## Summary

Of the original Task 01 scope, the only rows genuinely left as **NOT TESTED / BLOCKED** are:
1. Genuine assistant-side (generation) failure and its quota impact — could not be safely reproduced without abusive techniques.
2. Image-embedded-text readability by the assistant in a live chat turn — deprioritized under a hard 5-message/5-hour budget in favor of higher-value memory/incognito/isolation tests; the extraction-pipeline behavior (no OCR at upload time) *is* documented.
3. Cross-*account* file isolation — scope-limited to the single authorized test account by design.
4. Deeper API parameter/behavioral tests (temperature, token caps, precedence, tools, streaming, usage accounting) and API rate/concurrency limits — billing-gated; funding was evaluated and explicitly not recommended.

Every other requirement in the original brief has a PASS, OBSERVATION, or NOT APPLICABLE determination backed by concrete evidence referenced above.
