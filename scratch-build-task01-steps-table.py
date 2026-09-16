#!/usr/bin/env python3
"""Builds reports/task-01-test-case-table.xlsx: the Task 01 (TC-01..TC-44) test-case
table with a reconstructed "Steps to Reproduce" column, sourced strictly from
discovery-evidence/, docs/, and the scratch-*.js automation scripts already in this
repo. No steps are invented; anywhere the evidence was insufficient to reconstruct an
exact step sequence, that gap is stated explicitly in Notes/Limitations instead of
being filled in. Existing Status values are carried over unchanged."""
import openpyxl
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter

OUT_PATH = "reports/task-01-test-case-table.xlsx"

COLUMNS = [
    ("TC ID", 9),
    ("Question No", 10),
    ("Test Scenario", 26),
    ("Preconditions", 26),
    ("Steps to Reproduce", 55),
    ("Test Data", 24),
    ("Expected Result", 28),
    ("Actual Result", 34),
    ("Status", 14),
    ("Evidence", 32),
    ("Notes/Limitations", 34),
]

ROWS = [
dict(tc="TC-01", q="1", scenario="Create new Free-tier test account",
    pre="No existing account for the test email; fresh browser context with no session cookie.",
    steps="\n".join([
        "1. Open https://thaura.ai/.",
        "2. Click \"Try Thaura\".",
        "3. Enter the test email address and click Continue.",
        "4. On the name step, enter a display name and click Continue.",
        "5. Send POST /api/auth/request-otp {email, language} -> 200 \"OTP sent\".",
        "6. Retrieve the OTP from the test inbox and enter it in the one-time-code field.",
        "7. Submit -> POST /api/auth/verify-otp {email, otp}.",
        "8. Observe GET /api/auth/me -> 200, returning id/email/plan/name/createdAt for the new account (Free Plan).",
    ]),
    data="Fresh test email; display name \"Qa Test\". OTP value not recorded (never logged in any evidence).",
    expected="Account created successfully", actual="Free account created and authenticated", status="PASS",
    evidence="discovery-evidence/signup-step1-requests.json, signup-step2-requests.json, auth-requests-redacted.json, 06-after-otp.png, 07-post-login-dashboard.png, post-login-me-check.json",
    notes=""),

dict(tc="TC-02", q="1", scenario="Login using test account",
    pre="Test account from TC-01 already exists; browser context has no active session.",
    steps="\n".join([
        "1. Open https://thaura.ai/.",
        "2. Click \"Try Thaura\".",
        "3. Enter the SAME (already-registered) test account email and click Continue.",
        "4. Because the account already exists, the name step is skipped and an OTP is requested directly (returning-user path).",
        "5. Retrieve the OTP from the test inbox and enter it in the one-time-code field.",
        "6. Submit -> POST /api/auth/verify-otp.",
        "7. Observe GET /api/auth/me -> 200; authenticated dashboard loads.",
    ]),
    data="Existing test account email. OTP value not recorded.",
    expected="User should authenticate successfully", actual="OTP verification established authenticated session", status="PASS",
    evidence="discovery-evidence/12-otp-screen.png, 13-after-otp-v3.png",
    notes=""),

dict(tc="TC-03", q="1", scenario="Session after page refresh",
    pre="Authenticated session (valid thaura_token cookie) from TC-02.",
    steps="\n".join([
        "1. With an authenticated session loaded, call GET /api/chats/rate-limit/check (or any authenticated endpoint) -> confirm 200.",
        "2. Perform a full page reload 3 times in succession.",
        "3. After the reloads, call the same authenticated endpoint again.",
        "4. Compare the thaura_token cookie value before vs. after the reloads.",
        "5. Observe the endpoint still returns 200 and the cookie value is unchanged -- session remains valid across reload.",
    ]),
    data="No special test data; uses the existing authenticated session.",
    expected="Session should remain valid", actual="Session remained valid after reload", status="PASS",
    evidence="discovery-evidence/quota-test/tc-refresh-does-not-bypass-quota.json, discovery-evidence/expiry-retest-results.json",
    notes="No single-purpose \"reload only\" script exists; reconstructed from the refresh/quota-check script (3 reloads, session stays authenticated throughout) plus the expiry-retest script's live authenticated GET /api/auth/me check."),

dict(tc="TC-04", q="1", scenario="Token/session expiry",
    pre="Authenticated session with a JWT-shaped thaura_token cookie.",
    steps="\n".join([
        "1. Base64-decode the payload segment of the thaura_token cookie client-side (exp/iat claims only; raw token never logged).",
        "2. Record the exp claim and compare it to the account's createdAt / token iat.",
        "3. Make a live authenticated request: GET /api/auth/me.",
        "4. Inspect the response headers for a Set-Cookie header (would indicate token rotation).",
        "5. Re-read the cookie jar after the live request and compare the cookie value to the value stored before the request.",
        "6. Open the account menu and the Settings modal; scroll fully and check for a \"Sessions/Devices/Security\" management entry.",
    ]),
    data="No test data entered; read-only inspection of the existing session token.",
    expected="Expiry behavior should be verified", actual="JWT exp observed ~1 year; server enforcement not tested", status="PARTIALLY VERIFIED",
    evidence="discovery-evidence/token-claims-safe.json, discovery-evidence/expiry-retest-results.json",
    notes="Waiting for real expiry (~1 year out) and forging a signed token were both ruled out as infeasible/unsafe. Only the exp value and non-rotation behavior were observed; server-side rejection AFTER expiry was not directly exercised."),

dict(tc="TC-05", q="1", scenario="Logout invalidation",
    pre="Two authenticated browser contexts (A and B) loaded with the SAME stored session/token.",
    steps="\n".join([
        "1. Load Context A and Context B, both pointed at https://thaura.ai/, using the same stored session.",
        "2. Confirm GET /api/auth/me -> 200 in both contexts (pre-logout baseline).",
        "3. In Context A, open the account menu (\"Qa Test\") and click \"Logout\".",
        "4. Confirm the thaura_token cookie is removed from Context A's cookie jar.",
        "5. Call GET /api/auth/me in Context A.",
        "6. Observe 401 {\"message\":\"Not authenticated\"}.",
    ]),
    data="No test data; uses the existing authenticated session.",
    expected="Session should become invalid", actual="/api/auth/me returned 401 after logout", status="PASS",
    evidence="discovery-evidence/logout-invalidation-summary.json, 11-after-logout.png",
    notes=""),

dict(tc="TC-06", q="1", scenario="Replay old token after logout",
    pre="Pre-logout thaura_token value captured in memory (never written to disk raw) before performing TC-05's logout.",
    steps="\n".join([
        "1. Before logging out, capture Context A's thaura_token cookie value in memory only.",
        "2. Perform logout in Context A (as in TC-05).",
        "3. Open a brand-new, unrelated browser context (Context C) with no session.",
        "4. Manually inject the OLD pre-logout token value as the thaura_token cookie in Context C.",
        "5. Call GET /api/auth/me in Context C.",
        "6. Observe 401 -- the old token is rejected server-side, not merely cleared client-side.",
    ]),
    data="Reused pre-logout cookie value (in-memory only; never persisted to a file or log).",
    expected="Old token should be rejected", actual="Replayed token returned 401", status="PASS",
    evidence="discovery-evidence/logout-invalidation-summary.json",
    notes=""),

dict(tc="TC-07", q="1", scenario="Same token in concurrent contexts",
    pre="One valid session/token (single OTP login).",
    steps="\n".join([
        "1. Open Context A with the stored session; navigate to https://thaura.ai/.",
        "2. Open Context B with the SAME stored session (identical token value); navigate to https://thaura.ai/.",
        "3. Call GET /api/auth/me in Context A.",
        "4. Call GET /api/auth/me in Context B.",
        "5. Observe both return 200 at the same time.",
    ]),
    data="Single existing session/token reused in two browser contexts.",
    expected="Same session should be usable concurrently if supported", actual="Same token worked in 2 isolated contexts", status="PASS",
    evidence="discovery-evidence/concurrent-session-check.json",
    notes=""),

dict(tc="TC-08", q="1", scenario="Verify whether two independently issued tokens remain valid simultaneously",
    pre="Existing session (Token A) untouched; same account has no other active independent session.",
    steps="\n".join([
        "1. Leaving Token A's context untouched, open a fresh, unrelated browser context.",
        "2. Perform a full, independent OTP login for the SAME account email (Try Thaura -> email -> [name step if shown] -> OTP -> verify) to obtain a second, separately issued token (Token B); save it separately from Token A.",
        "3. Decode the exp/iat claims of Token A and Token B and confirm the two cookie values are different.",
        "4. Call GET /api/auth/me using Token A's context.",
        "5. Call GET /api/auth/me using Token B's context.",
        "6. Observe both return 200 at the same time.",
    ]),
    data="Same account email, two independently requested OTP logins. OTP values not recorded.",
    expected="Both tokens should remain valid concurrently without invalidating the first session",
    actual="Token A and Token B were distinct and both returned 200 from /api/auth/me simultaneously. bothValidSimultaneously: true",
    status="PASS",
    evidence="discovery-evidence/second-login-result.json, discovery-evidence/tc08-concurrent-independent-sessions.json",
    notes=""),

dict(tc="TC-09", q="2.1", scenario="Verify free-tier message limit enforcement at message 5 and 6",
    pre="Authenticated session with a fresh 5/5 quota window (GET /api/chats/rate-limit/check -> remaining:5).",
    steps="\n".join([
        "1. In the chat composer, send message 1 (\"QA quota test message 1 - reply with just OK\").",
        "2. After the reply completes, call GET /api/chats/rate-limit/check; observe remaining drop 5->4.",
        "3. Repeat for messages 2-4; observe remaining drop 4->3->2->1, each POST /v1/chat/completions returning 200.",
        "4. Send message 5; observe remaining drop 1->0, allowed:false, and resetAt populated (~5 hours from message 1).",
        "5. Attempt message 6 via the UI composer.",
        "6. Observe the UI blocks the send client-side with an \"Out of messages\" upgrade modal.",
        "7. Separately, with quota already at 0, POST directly to /v1/chat/completions (session-authenticated), bypassing the UI's pre-check.",
        "8. Observe 429 {\"type\":\"rate_limit_exceeded\", message: \"Free users can send 5 messages every 5 hours...\"}.",
    ]),
    data="6x short test messages: \"QA quota test message N - reply with just OK\".",
    expected="Message 5 should be allowed, while message 6 should be blocked after reaching the limit",
    actual="Message 5 succeeded with 200 and remaining changed from 1 to 0. Message 6 was blocked with allowed:false, remaining:0. Direct server-side bypass returned 429 rate_limit_exceeded",
    status="PASS",
    evidence="discovery-evidence/quota-test/quota-test-log.json, chat-network-requests.json; bypass-check-result.json",
    notes=""),

dict(tc="TC-10", q="2.2", scenario="Verify quota window duration and determine whether it is rolling or fixed",
    pre="Authenticated session with quota partially consumed (remaining < 5).",
    steps="\n".join([
        "1. Call GET /api/chats/rate-limit/check; note remaining and resetAt.",
        "2. Send one \"anchor\" message via the composer at a precisely recorded timestamp.",
        "3. Call GET /api/chats/rate-limit/check again; note the new remaining/resetAt.",
        "4. Compare resetAt against the first-message-of-block time, repeated on 2 separate occasions (2026-09-14 and 2026-09-15).",
        "5. (Rolling vs. fixed) At anchor time + 5h5m, call GET /api/chats/rate-limit/check again and check whether remaining fully returns to 5 (fixed batch window) or only partially recovers (rolling per-message window).",
    ]),
    data="1x anchor test message per run.",
    expected="Quota should reset after the defined window; fixed vs rolling behavior should be identifiable",
    actual="5-hour window confirmed twice independently. Anchor message sent 2026-09-16T06:14:41.335Z (remaining 4->3); re-checked at 2026-09-16T12:06:30.695Z (past the 5h5m threshold) and remaining had returned to a full 5/5, not a partial credit-back",
    status="PASS",
    evidence="discovery-evidence/quota-test/chat-network-requests.json; tc-window-type-experiment.json; tc-window-type-result.json",
    notes="Fixed-vs-rolling distinction is now resolved: a full reset to 5/5 (rather than a partial per-message recovery) confirms a FIXED batch window anchored to the first message of a block, not a rolling per-message timer."),

dict(tc="TC-11", q="2.3", scenario="Verify whether a failed or errored assistant response consumes a quota slot",
    pre="Authenticated session with exactly 1 message remaining in the quota window.",
    steps="\n".join([
        "1. Call GET /api/chats/rate-limit/check and GET /v1/chat/active-turns to confirm baseline (remaining:1, no active turns).",
        "2. Start a new chat; send a message requiring a long streamed reply (a ~300-word TCP vs UDP explanation prompt).",
        "3. Wait ~1.4-1.6s (enough for the request to reach the server and streaming to begin).",
        "4. Reload the page to simulate a dropped client connection mid-stream.",
        "5. Immediately after reload, call GET /api/chats/rate-limit/check and GET /v1/chat/active-turns.",
        "6. Observe remaining has dropped to 0 and the active-turns entry shows status \"in_progress\", resumable:true.",
        "7. Wait ~8 more seconds; re-check active-turns.",
        "8. Observe status has progressed to \"completed\" and, after reload, the UI displays the full correct answer (resumable-turn architecture) -- a successfully completed response, not a failed one.",
        "9. Separately, with quota already at 0, POST directly to the session-authenticated /v1/chat/completions with (a) a missing \"messages\" field and (b) messages set to a wrong-type value.",
        "10. Observe both return 400 {\"type\":\"invalid_request_error\",\"code\":\"invalid_messages\"}, and GET /api/chats/rate-limit/check shows remaining unchanged at 0.",
    ]),
    data="1x long-form prompt (\"...300-word explanation of the differences between TCP and UDP...\"); 2x malformed JSON bodies.",
    expected="A genuine failed or errored assistant response should be tested to determine whether it consumes a quota slot",
    actual="Could not safely reproduce a genuine assistant-side failure. Dropped connection completed successfully and was billed; malformed request returned 400 and was not billed",
    status="NOT TESTED",
    evidence="discovery-evidence/quota-test/failed-response-quota-test.json; malformed-session-request-results.json",
    notes="Neither probe reproduces a genuine assistant-side generation failure. A true assistant-side failure could not be safely, deliberately triggered without abusive techniques (out of scope)."),

dict(tc="TC-12", q="2.4", scenario="Verify whether the free-tier quota can be bypassed using multiple sessions, page refresh, or API key",
    pre="Two independent tokens for the same account (Token A, Token B from TC-08); authenticated session.",
    steps="\n".join([
        "1. Read GET /api/chats/rate-limit/check using Token A's and Token B's contexts; confirm both start at remaining:5 (baseline).",
        "2. Send exactly 1 chat message using ONLY Token B's context.",
        "3. Re-check GET /api/chats/rate-limit/check with BOTH Token A and Token B.",
        "4. Observe Token A's remaining ALSO dropped to 4, despite the message only being sent via Token B.",
        "5. Separately: read remaining (4), reload the authenticated page 3 times in succession, then re-check.",
        "6. Observe remaining unchanged (4 before and after).",
        "7. Separately: with quota exhausted (remaining:0), POST /v1/chat/completions directly, bypassing the UI's pre-check.",
        "8. Observe 429 rate_limit_exceeded.",
        "9. Separately: open the Billing/API tab and confirm developer API usage is billed against a distinct balance, unrelated to the free-message quota.",
    ]),
    data="1x test message sent via Token B only; 3x page reloads.",
    expected="Quota should remain account-level and should not be reset or bypassed through sessions, refresh, or API key",
    actual="Multiple sessions share the same quota. Page refresh did not change remaining quota. Developer API billing is separate from free-message quota; no bypass found",
    status="PASS",
    evidence="discovery-evidence/quota-test/tc-quota-shared-across-tokens.json; tc-refresh-does-not-bypass-quota.json; billing-tab-bodytext.txt",
    notes=""),

dict(tc="TC-13", q="3.1", scenario="Upload a valid PDF with a known embedded text marker (QA-DOC-MARKER-71934) and verify extraction",
    pre="Authenticated session; test-data/valid/sample.pdf containing embedded marker text.",
    steps="\n".join([
        "1. Start a new chat.",
        "2. Attach test-data/valid/sample.pdf via the file input.",
        "3. Observe POST /api/uploads -> 200; response content matches the source document text verbatim, including the marker and dollar amount.",
        "4. In a live (non-quota-blocked) chat turn, send: \"What is the verification marker string in this document? Quote it exactly.\" with the file attached.",
        "5. Observe the assistant's reply quotes the exact marker.",
    ]),
    data="sample.pdf fixture containing marker \"QA-DOC-MARKER-71934\" and \"$4,217.63\".",
    expected="Extracted content matches the exact marker/text in the source PDF",
    actual="Upload API returned the exact marker text; assistant also quoted it correctly in a live chat reply", status="PASS",
    evidence="discovery-evidence/upload-test/extraction-verification.json",
    notes=""),

dict(tc="TC-14", q="3.1", scenario="Upload a valid XLSX with a known cell marker (QA-CELL-MARKER-58201) and verify extraction",
    pre="Authenticated session; test-data/valid/sample.xlsx containing the marker in a cell.",
    steps="\n".join([
        "1. Start a new chat.",
        "2. Attach test-data/valid/sample.xlsx via the file input.",
        "3. Observe POST /api/uploads -> 200; response content is a correctly formatted markdown table reproducing the sheet's rows/columns, including the exact marker value in the Marker column.",
    ]),
    data="sample.xlsx (Name/Score/Marker columns; row Alice/91/QA-CELL-MARKER-58201).",
    expected="Cell values extracted accurately, marker present",
    actual="Extracted as a correct markdown table with exact marker value", status="PASS",
    evidence="discovery-evidence/upload-test/extraction-verification.json",
    notes=""),

dict(tc="TC-15", q="3.1", scenario="Upload a PNG with a rendered text marker (QA-IMG-MARKER-30457); ask assistant to quote the image's text in live chat",
    pre="Authenticated session with >=1 message remaining in the quota window.",
    steps="\n".join([
        "1. Start a new chat.",
        "2. Attach test-data/valid/sample.png (rendered text \"Marker: QA-IMG-MARKER-30457\").",
        "3. Observe POST /api/uploads -> 200; response content field is only \"Image file: sample.png\" (no OCR text extracted at upload/indexing time).",
        "4. In a live chat turn, send: \"What text is written in this image? Quote it exactly, character for character.\"",
        "5. Observe the assistant's reply: \"The text in the image reads: Marker: QA-IMG-MARKER-30457\" (exact match).",
    ]),
    data="sample.png fixture with baked-in rendered text \"Marker: QA-IMG-MARKER-30457\".",
    expected="Assistant reads and quotes the exact in-image text",
    actual="Assistant replied: \"The text in the image reads: Marker: QA-IMG-MARKER-30457\" (exact match); upload API itself does no OCR",
    status="PASS",
    evidence="discovery-evidence/upload-test/image-ocr-verification.json",
    notes=""),

dict(tc="TC-16", q="3.2", scenario="Upload an empty (0-byte) PDF/PNG",
    pre="Authenticated session.",
    steps="\n".join([
        "1. Start a new chat.",
        "2. Attach a 0-byte .pdf file via the file input.",
        "3. Observe the client shows \"Cannot upload empty file.\" inline; NO request to POST /api/uploads is fired.",
        "4. Repeat with a 0-byte .png file; observe identical client-side rejection.",
    ]),
    data="empty.pdf, empty.png (both 0 bytes).",
    expected="Rejected cleanly, no crash, no silent accept",
    actual="Client-side error \"Cannot upload empty file\"; no network request fired", status="PASS",
    evidence="discovery-evidence/upload-test/results.json (empty_pdf, empty_png)",
    notes=""),

dict(tc="TC-17", q="3.2", scenario="Upload a corrupted (truncated) PDF",
    pre="Authenticated session.",
    steps="\n".join([
        "1. Start a new chat.",
        "2. Attach a truncated/corrupted .pdf file.",
        "3. Observe POST /api/uploads -> 400.",
        "4. Observe the UI shows: \"Could not extract text from PDF \\\"corrupted.pdf\\\". The file may be corrupted, password-protected, or contain only images.\"",
    ]),
    data="corrupted.pdf (truncated PDF file).",
    expected="Rejected with clear error, no crash",
    actual="Server returned 400; UI message \"Could not extract text from PDF... may be corrupted, password-protected, or contain only images\"",
    status="PASS",
    evidence="discovery-evidence/upload-test/results.json (corrupted_pdf)",
    notes=""),

dict(tc="TC-18", q="3.2", scenario="Upload a corrupted (truncated) PNG",
    pre="Authenticated session.",
    steps="\n".join([
        "1. Start a new chat.",
        "2. Attach a truncated/corrupted .png file.",
        "3. Observe POST /api/uploads -> 200 (server ACCEPTS the file bytes, unlike the corrupted-PDF case) -- no rejection message, no crash.",
    ]),
    data="corrupted.png (truncated PNG file).",
    expected="Rejected with clear error, no crash",
    actual="Server accepted it (200) instead of rejecting; inconsistent with corrupted PDF behavior; no crash/data exposure", status="OBSERVATION",
    evidence="discovery-evidence/upload-test/results.json (corrupted_png)",
    notes="Not a defect -- the image pipeline treats all images as opaque at upload time regardless of validity, so a corrupted PNG behaves the same as a valid one from the pipeline's perspective."),

dict(tc="TC-19", q="3.2", scenario="Upload a password-protected PDF",
    pre="Authenticated session.",
    steps="\n".join([
        "1. Start a new chat.",
        "2. Attach a password-protected .pdf file.",
        "3. Observe POST /api/uploads -> 400.",
        "4. Observe the UI shows the SAME message as the corrupted-PDF case (does not disambiguate cause).",
    ]),
    data="password-protected.pdf.",
    expected="Rejected with clear, accurate error",
    actual="Server returned 400; same message as corrupted-file case (does not disambiguate cause)", status="PASS",
    evidence="discovery-evidence/upload-test/results.json (password_protected_pdf)",
    notes=""),

dict(tc="TC-20", q="3.2", scenario="Upload an 8MB oversized PDF",
    pre="Authenticated session.",
    steps="\n".join([
        "1. Start a new chat.",
        "2. Attach an ~8MB PDF file.",
        "3. Observe the file attach step completes but NO POST /api/uploads request fires (client-side size check blocks it before any network call).",
    ]),
    data="oversized_8mb.pdf (~8MB).",
    expected="Rejected cleanly with size-limit message",
    actual="Rejected client-side; no request fired", status="PASS",
    evidence="discovery-evidence/upload-test/results.json (oversized_8mb)",
    notes=""),

dict(tc="TC-21", q="3.2", scenario="Upload a 60MB oversized PDF",
    pre="Authenticated session.",
    steps="\n".join([
        "1. Start a new chat.",
        "2. Attach an ~60MB PDF file.",
        "3. Observe the network log records one POST /api/uploads -> 200 (the raw upload endpoint itself accepted the file bytes).",
        "4. Observe the chat UI separately displays the client-side message \"File size exceeds the 50MB limit.\" and blocks the file from being sent as a chat attachment.",
    ]),
    data="oversized_60mb.pdf (~60MB).",
    expected="Rejected cleanly with size-limit message",
    actual="Client-side message: \"File size exceeds the 50MB limit\"", status="PASS",
    evidence="discovery-evidence/upload-test/results.json (oversized_60mb)",
    notes="Unlike the 8MB case, a network request DID reach /api/uploads and returned 200 before the client-side 50MB attach limit blocked the send -- recorded here precisely since it differs from the \"no request fired\" pattern seen at 8MB, even though the end-user-visible outcome (blocked, clear message) is the same."),

dict(tc="TC-22", q="3.3", scenario="Attempt direct access to a known fileId via plausible API endpoints, authenticated (wrong context) and unauthenticated",
    pre="A file already uploaded under the test account, with its fileId known from the upload response.",
    steps="\n".join([
        "1. Upload sample.pdf in an authenticated chat; capture the returned fileId from the POST /api/uploads response.",
        "2. Using the same authenticated context (fresh page, no active file/chat context), issue GET requests to 3 plausible endpoint patterns for that fileId: /api/files/{id}, /api/uploads/{id}, /api/user/files/{id}.",
        "3. Observe each pattern returns 404.",
        "4. Open a brand-new, UNAUTHENTICATED browser context (no cookies).",
        "5. Issue the same 3 GET requests for the same fileId.",
        "6. Observe each pattern returns 401.",
    ]),
    data="1x known fileId from an authenticated upload; 3 endpoint URL patterns.",
    expected="Access denied in both cases",
    actual="Authenticated wrong-context request returned 404; unauthenticated request returned 401; no content returned", status="PASS",
    evidence="discovery-evidence/upload-test/isolation-probe-results.json",
    notes=""),

dict(tc="TC-23", q="3.3", scenario="Start a new, unrelated chat (same account) and ask if the assistant can access a file from a different conversation",
    pre="A file already uploaded and discussed in an earlier chat (Chat A) on the same account.",
    steps="\n".join([
        "1. Upload a file and discuss it in Chat A.",
        "2. Start a brand-new, unrelated Chat B.",
        "3. Ask the assistant directly: \"Do you have access to the content of any file I uploaded earlier in a different conversation - if so, what does it say?\"",
        "4. Observe the assistant explicitly states it has no access to files from other conversations (context limited to the current conversation).",
    ]),
    data="Follow-up question sent in a new chat, referencing an earlier chat's attachment.",
    expected="Assistant should not have access / should say so",
    actual="Assistant correctly replied it does not have access to files from other conversations", status="PASS",
    evidence="discovery-evidence/memory-incognito-test/full-test-results.json",
    notes=""),

dict(tc="TC-24", q="3.3", scenario="Verify file isolation between two different real user accounts",
    pre="A second, independently-owned account (Account B) under the tester's own control; 4 known fileIds already uploaded under the primary account (Account A).",
    steps="\n".join([
        "1. Note 4 fileIds previously uploaded under Account A (from earlier upload tests).",
        "2. In a fresh, unrelated browser context, log in as Account B via its own independent OTP flow (Try Thaura -> email -> OTP -> verify); confirm GET /api/auth/me -> 200, session saved separately from Account A's.",
        "3. Fully authenticated as Account B, issue GET requests for each of the 4 Account-A fileIds against 3 endpoint patterns each (/api/files/{id}, /api/uploads/{id}, /api/user/files/{id}) -- 12 requests total.",
        "4. Observe all 12 requests return 404; the real endpoint (/api/files/{id}) responds with a structured {\"error\":{\"type\":\"not_found_error\",\"message\":\"File not found\"}}, not any file content or metadata.",
    ]),
    data="4x Account-A fileIds x 3 endpoint patterns = 12 probes. Zero chat messages sent (0 quota spent on either account).",
    expected="Content should not leak across accounts",
    actual="Authenticated with a second independent user account and attempted to access 4 files belonging to the primary account across 3 endpoint patterns (12 requests total). All requests returned 404, including the real endpoint /api/files/{id}. No file content or metadata was exposed",
    status="PASS",
    evidence="discovery-evidence/upload-test/cross-account-isolation-results.json; crossaccount-otp-screen.png; crossaccount-after-otp.png",
    notes=""),

dict(tc="TC-25", q="4.1", scenario="Confirm a fact/preference stored in normal mode is retrievable in a new, unrelated chat",
    pre="Authenticated session.",
    steps="\n".join([
        "1. In Chat A, send a message including \"Please remember this fact for all future conversations: my QA memory marker is [MARKER]\" alongside a file-based question.",
        "2. Observe the assistant's in-line reply explicitly states it cannot store arbitrary \"remember this\" instructions as a standing rule.",
        "3. Start a new, unrelated Chat B.",
        "4. Ask: \"What is my QA memory marker? If you do not know, say you do not know.\"",
        "5. Observe the assistant replies it does not know -- the verbal instruction was not persisted.",
        "6. Separately, open the account menu (\"Qa Test\") -> Settings -> \"Memory\" panel.",
        "7. Observe GET /api/memories returns empty content immediately after these short synthetic test messages.",
        "8. On a later occasion, after the tester shared substantive real content (their own CV) in a genuine, unrelated conversation, re-check GET /api/memories.",
        "9. Observe the endpoint now returns real, non-empty content (a short structured summary, updatedAt populated) -- confirming the automatic memory subsystem captures information from genuine usage, not from short synthetic \"remember this\" commands.",
    ]),
    data="Synthetic marker string planted via a \"remember this fact\" instruction; separately, the tester's own real CV shared in a genuine conversation (content summarized only, not reproduced, for privacy).",
    expected="The stored fact/preference should be retrievable in a new unrelated chat",
    actual="The verbal \"remember this\" instruction was not persisted (fresh chat returned \"I don't know\"). However, the separate automatic Memory subsystem was confirmed working on follow-up: after the tester shared their real CV in a genuine conversation, GET /api/memories returned real content (\"Overview\"/\"Work\" sections summarizing the CV), confirming the feature is triggered by substantive real usage rather than short synthetic test messages or direct commands",
    status="PASS",
    evidence="discovery-evidence/memory-incognito-test/full-test-results.json; memory-panel-cv-capture.json",
    notes=""),

dict(tc="TC-26", q="4.2", scenario="Confirm Incognito Mode does not bypass free-tier quota exhaustion (visual re-confirmation)",
    pre="Free-tier quota near/at exhaustion; Incognito mode available.",
    steps="\n".join([
        "1. Toggle Incognito mode on via the header icon (its accessible label lives on a screen-reader-only <span> inside the button -- click the button element itself).",
        "2. Confirm the \"You're incognito\" banner is shown.",
        "3. Send a chat message while incognito.",
        "4. Observe GET /api/chats/rate-limit/check remaining decrements identically to a normal message.",
        "5. Continue sending until quota reaches 0 while still incognito.",
        "6. Observe the same \"Out of messages. Here's the honest ask.\" modal (countdown + Upgrade/I'll wait) appears in incognito mode as in normal mode.",
    ]),
    data="1-2x short incognito test messages.",
    expected="Incognito mode should be blocked the same way as normal mode once the 5-message/5-hour quota is exhausted, not treated as a separate or unlimited pool",
    actual="The \"Out of messages. Here's the honest ask.\" modal appeared while Incognito mode was enabled, with the same countdown and Upgrade/I'll wait options as normal mode. Confirms Incognito shares the same quota pool and is blocked identically once exhausted",
    status="PASS",
    evidence="discovery-evidence/memory-incognito-test/incognito-verified-results.json; user-provided screenshot",
    notes=""),

dict(tc="TC-27", q="4.3", scenario="Verify which Incognito deletion/non-retention claims cannot be confirmed from client-side testing",
    pre="Incognito mode available; access to the site's Terms of Service, Constitution, and Data Processing Addendum pages.",
    steps="\n".join([
        "1. Toggle Incognito mode on; confirm the banner appears and no ?chatId= URL parameter is ever added (unlike a normal chat).",
        "2. Send a message while incognito; confirm it does NOT appear in the sidebar's chat-history list afterward (read the sidebar DOM text scoped to the actual nav element, not the whole page body).",
        "3. Exit incognito; start a new normal chat; ask whether the assistant recalls the incognito-planted marker.",
        "4. Observe the assistant has no knowledge of it (no leak into a normal chat or into Memory).",
        "5. Separately, review the Terms of Service, Constitution, and Data Processing Addendum text for non-retention/deletion claims.",
        "6. Note that steps 1-4 are client-observable proxies for non-retention, not proof of server-side deletion (database rows, logs, backups, or LLM-provider logs are outside client-side testing's reach).",
    ]),
    data="1x incognito test marker; policy page text (no account data entered).",
    expected="Client-side testing should distinguish observable behavior from server-side deletion/non-retention claims",
    actual="Client-side behavior was verified: Incognito chats do not appear in history, have no chatId URL, and do not leak into later chats or Memory. However, server-side claims regarding database, logs, backups, and deletion cannot be verified without backend/database access, server logs, source review, or an independent audit. A GDPR Data Subject Access Request was identified as a possible future verification step but was not performed",
    status="NOT VERIFIABLE FROM CLIENT SIDE",
    evidence="docs/task-01-gap-analysis.md § Incognito; terms-of-service-text.txt; constitution-text.txt; data-processing-addendum-text.txt",
    notes=""),

dict(tc="TC-28", q="5", scenario="Required/optional parameter validation (missing or invalid messages field, invalid model)",
    pre="Valid zero-balance developer API key (Authorization: Bearer) AND a valid session cookie, both available.",
    steps="\n".join([
        "1. Using the developer API key, POST https://backend.thaura.ai/v1/chat/completions with body {\"messages\": \"hello\"} (wrong type).",
        "2. Observe 400 {\"type\":\"invalid_request_error\",\"code\":\"invalid_messages\"}.",
        "3. Using the SESSION cookie instead of the API key, POST the same endpoint with the \"messages\" field omitted entirely: {\"model\":\"thaura\"}.",
        "4. Observe 400 with the identical invalid_messages error, confirming the check runs independent of auth method and of quota state (quota was 0 at the time).",
        "5. Using the developer API key, POST with a valid messages array but an unsupported model value: {\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}],\"model\":\"gpt-4\"}.",
        "6. Observe 400 {\"type\":\"invalid_model\",\"code\":\"invalid_model\"}.",
    ]),
    data="Request bodies: {\"messages\":\"hello\"}; {\"model\":\"thaura\"} (messages omitted); {\"messages\":[...], \"model\":\"gpt-4\"}.",
    expected="Malformed requests should be rejected with clear, structural errors",
    actual="Missing/invalid messages → 400 invalid_messages; invalid model → 400 invalid_model; both independent of account balance",
    status="PASS",
    evidence="discovery-evidence/api-test/validation-batch-results.json (API-07, API-08, API-09)",
    notes=""),

dict(tc="TC-29", q="5", scenario="Invalid data type handling (e.g. wrong-type messages field) and legacy parameter rejection",
    pre="Valid zero-balance developer API key.",
    steps="\n".join([
        "1. POST https://backend.thaura.ai/v1/chat/completions with {\"messages\":\"hello\"} (string instead of array).",
        "2. Observe 400 invalid_messages.",
        "3. POST with a valid messages array plus a legacy \"functions\" parameter: {\"messages\":[...],\"functions\":[{\"name\":\"test\",\"parameters\":{}}]}.",
        "4. Observe 400 {\"type\":\"invalid_request_error\",\"code\":\"unsupported_parameter\", message pointing to 'tools'/'tool_choice'}.",
        "5. POST with a valid messages array plus \"function_call\":\"auto\".",
        "6. Observe the identical 400 unsupported_parameter error and migration message.",
    ]),
    data="Request bodies with functions / function_call legacy parameters.",
    expected="Should be rejected with clear errors, no crash",
    actual="Wrong-type messages rejected with 400; legacy functions/function_call rejected with 400 unsupported_parameter and a migration hint toward tools/tool_choice",
    status="PASS",
    evidence="discovery-evidence/api-test/validation-batch-results.json (API-08, API-18, API-19)",
    notes=""),

dict(tc="TC-30", q="5", scenario="Boundary value validation: temperature range and max_completion_tokens 32000 cap",
    pre="Valid developer API key with a ZERO account balance (deliberately not funded -- see API Funding Decision).",
    steps="\n".join([
        "1. POST https://backend.thaura.ai/v1/chat/completions with temperature: -0.1 (below documented range).",
        "2. Observe 402 insufficient_balance (billing gate reached before temperature-range validation).",
        "3. Repeat with temperature: 2.1 (above range), temperature: 0 and temperature: 2 (documented boundaries), max_completion_tokens: 32001 and 32000 (cap boundary), and max_tokens: 32001.",
        "4. Observe every case returns 402 insufficient_balance identically -- the zero balance short-circuits before any temperature/token-cap logic can be observed.",
    ]),
    data="temperature: -0.1, 2.1, 0, 2; max_completion_tokens: 32000, 32001; max_tokens: 32001.",
    expected="Values outside accepted bounds should be rejected with a clear error",
    actual="Zero-balance account receives 402 insufficient_balance before reaching temperature/token-cap validation logic; billing check runs before model execution, so the actual boundary logic was never reached",
    status="BLOCKED",
    evidence="discovery-evidence/api-test/validation-batch-results.json (API-10–API-15b); docs/task-01-gap-analysis.md § API Funding Decision",
    notes="Deliberately left unfunded per the documented cost/value decision (DO NOT FUND); actual temperature/token-cap enforcement was never reached."),

dict(tc="TC-31", q="5.2", scenario="Verify parameter precedence when both max_tokens and max_completion_tokens are provided",
    pre="Valid developer API key with a zero account balance.",
    steps="\n".join([
        "1. POST https://backend.thaura.ai/v1/chat/completions with BOTH max_tokens: 500 and max_completion_tokens: 100 set in the same request.",
        "2. Observe 402 insufficient_balance -- the billing gate is reached before any precedence logic between the two parameters can be observed.",
    ]),
    data="{\"max_tokens\":500,\"max_completion_tokens\":100}.",
    expected="Both parameters should be handled according to the documented precedence rule",
    actual="Request with max_tokens: 500 and max_completion_tokens: 100 returned 402 insufficient_balance before precedence logic was reached",
    status="BLOCKED (billing-gated)",
    evidence="discovery-evidence/api-test/validation-batch-results.json (API-17)",
    notes=""),

dict(tc="TC-32", q="5.3", scenario="Verify accepted-but-ignored parameters and unsupported legacy parameters",
    pre="Valid developer API key with a zero account balance.",
    steps="\n".join([
        "1. POST https://backend.thaura.ai/v1/chat/completions with a valid messages array plus top_p, frequency_penalty, presence_penalty, n, and user fields set.",
        "2. Observe 402 insufficient_balance -- these parameters pass structural validation (no 400), so they are at least recognized parameter names, but whether they measurably affect output cannot be observed without a funded call.",
        "3. POST with legacy functions / function_call parameters (as in TC-29).",
        "4. Observe 400 unsupported_parameter with the migration-hint message -- this part is fully verified, independent of billing.",
    ]),
    data="{\"top_p\":0.5,\"frequency_penalty\":1,\"presence_penalty\":1,\"n\":1,\"user\":\"qa-test\"}; legacy functions/function_call bodies.",
    expected="Unsupported parameters should be rejected; documented accepted-but-ignored parameters should be recognized without affecting generation",
    actual="legacy functions/function_call returned 400 unsupported_parameter with migration hint. top_p, frequency_penalty, presence_penalty, n, and user passed structural validation, but whether they are actually ignored could not be verified without a funded generation",
    status="BLOCKED (billing-gated)",
    evidence="discovery-evidence/api-test/validation-batch-results.json (API-18, API-19)",
    notes=""),

dict(tc="TC-33", q="5.4", scenario="Verify API key authentication for missing, malformed, invalid, tampered, and valid zero-balance keys",
    pre="A valid, zero-balance developer API key on file.",
    steps="\n".join([
        "1. POST https://backend.thaura.ai/v1/chat/completions with the Authorization header omitted entirely.",
        "2. Observe 401 {\"type\":\"authentication_error\",\"code\":\"unauthorized\"}.",
        "3. POST with Authorization set to the raw key value WITHOUT the \"Bearer \" prefix -> 401 (identical error).",
        "4. POST with Authorization: \"Bearer \" (empty token) -> 401 (identical error).",
        "5. POST with Authorization: \"Bearer sk-not-a-real-key-0000000000000000\" (well-formed but fake) -> 401 (identical error).",
        "6. POST with Authorization: Bearer {the valid key with its last 4 characters replaced} (tampered, same length) -> 401 (identical error).",
        "7. POST with Authorization: Bearer {the actual valid, zero-balance key} -> 402 insufficient_balance (NOT 401), confirming the key is genuinely validated before the separate billing check runs.",
    ]),
    data="6 Authorization header variants (missing / no-Bearer / empty-Bearer / fake key / tampered real key / valid zero-balance key). Real key value never logged.",
    expected="Invalid or malformed keys should return 401; a valid zero-balance key should pass authentication and return 402 insufficient_balance",
    actual="Missing header, missing Bearer prefix, empty Bearer, fake key, and tampered real key returned 401. Valid zero-balance key returned 402, confirming authentication and billing are separate gates",
    status="PASS",
    evidence="discovery-evidence/api-test/auth-key-validation-results.json",
    notes=""),

dict(tc="TC-34", q="5.5", scenario="Verify API rate limiting (60 requests/minute and 8 concurrent requests)",
    pre="A valid, zero-balance developer API key.",
    steps="\n".join([
        "1. Fire 65 sequential POST requests to /v1/chat/completions ({\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}]}) as fast as possible, recording status/timing for each.",
        "2. Observe requests 1-60 each return 402 insufficient_balance (reaching the billing gate); requests 61-65 return 429 {\"type\":\"rate_limit_error\"} (blocked before billing) -- burst completed in ~14.2s.",
        "3. Wait ~75 seconds for the per-minute window to clear.",
        "4. Fire 1 sanity-check request; confirm it returns 402 (not 429), confirming the window reset.",
        "5. Fire exactly 9 requests concurrently via Promise.all (each in-flight ~570-630ms, genuinely overlapping).",
        "6. Observe all 9 return 402 insufficient_balance; none return 429.",
    ]),
    data="65x sequential + 9x concurrent minimal chat-completion requests, zero-balance key.",
    expected="Requests exceeding the configured rate limits should return 429 rate_limit_error",
    actual="65 sequential requests were sent: requests 1–60 reached the billing gate and returned 402; requests 61–65 returned 429 rate_limit_error. For 9 genuinely concurrent requests, all 9 returned 402 and none returned 429, so the documented 8-concurrent limit was not enforced",
    status="OBSERVATION",
    evidence="discovery-evidence/api-test/rate-limit-test-results.json; concurrency-test-isolated-results.json",
    notes="60/minute limit reproduced exactly as documented; the 8-concurrent limit did not trigger in a 9-request burst -- flagged as a docs/product discrepancy, not a security risk (a laxer limit is permissive, not risky)."),

dict(tc="TC-35", q="5.6", scenario="Verify non-streaming/streaming response schema and usage-token accounting",
    pre="Would require a developer API key with a positive (funded) account balance.",
    steps="\n".join([
        "1. (Not executed.) Per the API Funding Decision (see docs/task-01-gap-analysis.md § API Funding Decision), the account was deliberately left at zero balance -- DO NOT FUND.",
        "2. Every attempted /v1/chat/completions call therefore returns 402 insufficient_balance before reaching model execution, so no successful response was ever produced to inspect.",
    ]),
    data="N/A -- no funded call was attempted.",
    expected="Successful responses should match the expected schema and provide accurate usage-token information",
    actual="No funded generation call was made, so response schema and usage-token accounting could not be validated",
    status="BLOCKED (billing-gated)",
    evidence="—",
    notes="No reproduction steps could be executed for this item; nothing is fabricated in its place."),

dict(tc="TC-36", q="6", scenario="Blank/invalid form submission (public contact form)",
    pre="No authentication required; public /contact page.",
    steps="\n".join([
        "1. Open https://thaura.ai/contact.",
        "2. Inspect the form fields: name (text, required), email (email, required), subject (text, optional), message (textarea, required).",
        "3. Without filling any field, click the Submit/\"Send\" button.",
        "4. Observe inline validation errors appear; no POST request fires to any submission endpoint.",
        "5. Fill the email field with an invalid-format value and the other fields with harmless text; click Submit again.",
        "6. Observe inline validation blocks submission again; no POST request fired.",
    ]),
    data="Invalid email value (e.g. \"not-an-email\"); harmless placeholder text in name/message.",
    expected="Should be blocked client-side with visible errors",
    actual="Blank and invalid-email submissions were both blocked with visible inline errors; no request reached the server",
    status="PASS",
    evidence="discovery-evidence/website-scan/contact-blank-submit*.png, contact-invalid-email-submit*.png",
    notes=""),

dict(tc="TC-37", q="6", scenario="Unicode/RTL/emoji/long-string input handling (chat and contact form fields)",
    pre="No authentication required; public /contact page.",
    steps="\n".join([
        "1. Open https://thaura.ai/contact.",
        "2. For each of 6 sample strings (Bangla, Arabic RTL, mixed Bangla/English/Chinese, emoji, a 1000-character repeated-Bangla string, and ASCII special characters), clear and fill the Name field (truncated to 200 chars) and the Message field with the sample.",
        "3. Read back each field's value and compare it to the original sample.",
        "4. Observe all 6 samples round-trip exactly (character-for-character) in both fields, with no console errors and no unintended POST requests fired.",
    ]),
    data="Bangla / Arabic RTL / mixed-script / emoji / 1000-char / special-character sample strings (see unicode-test/results.json for exact lengths).",
    expected="Should round-trip correctly without corruption",
    actual="Bangla, Arabic RTL, mixed script, emoji, and a 1000-character string all round-tripped correctly in both name and message fields",
    status="PASS",
    evidence="discovery-evidence/unicode-test/results.json",
    notes=""),

dict(tc="TC-38", q="6", scenario="Invalid password format",
    pre="Authenticated session.",
    steps="\n".join([
        "1. Open the account menu -> Settings and review all fields.",
        "2. Review the login/signup flow (Try Thaura -> email -> OTP) for any password field.",
        "3. Observe no password field exists anywhere in Settings or the login flow -- Thaura uses OTP-only passwordless authentication.",
    ]),
    data="N/A -- no password field exists to test.",
    expected="Not applicable / no password field should exist",
    actual="Thaura uses OTP-only passwordless authentication; no password field exists anywhere in Settings or the login flow",
    status="NOT APPLICABLE",
    evidence="discovery-evidence/settings-password-check.json",
    notes=""),

dict(tc="TC-39", q="6", scenario="Invalid file types on upload (empty, corrupted, password-protected, oversized)",
    pre="Authenticated session.",
    steps="\n".join([
        "1. Run the full invalid-file matrix against the chat file-attach flow: empty PDF, empty PNG, corrupted PDF, corrupted PNG, password-protected PDF, oversized 8MB PDF, oversized 60MB PDF (see TC-16, TC-17, TC-18, TC-19, TC-20, TC-21 for the per-file-type steps).",
        "2. Observe every case is rejected cleanly (client-side block, or a 400 from POST /api/uploads, with the one noted corrupted-PNG exception at 200) and no 5xx server error or crash occurs anywhere in the matrix.",
    ]),
    data="Same fixture set as TC-16/17/18/19/20/21.",
    expected="Should be rejected cleanly with clear errors, no crash",
    actual="All rejected correctly: empty file client-side blocked; corrupted PDF 400; password-protected PDF 400; oversized 8MB/60MB client-side size-limit block; no 5xx errors",
    status="PASS",
    evidence="discovery-evidence/upload-test/results.json",
    notes=""),

dict(tc="TC-40", q="6", scenario="Settings/Account: blank Name field submission",
    pre="Authenticated session; Settings modal reachable via account menu.",
    steps="\n".join([
        "1. Open the account menu (button showing account name / \"Free Plan\") -> Settings.",
        "2. Clear the Name field completely (empty string).",
        "3. Observe the \"Save Profile\" button becomes disabled -- the blank value is never actually submitted to the server.",
    ]),
    data="Name field cleared to empty string.",
    expected="Save should be blocked, not silently accepted",
    actual="Save Profile button is correctly disabled client-side when Name is empty; blank value never reaches the server",
    status="PASS",
    evidence="discovery-evidence/settings-negative-test/results.json, 01-blank-name-attempt.png",
    notes=""),

dict(tc="TC-41", q="6", scenario="Settings/Account: Name field max-length overflow (2000-character input attempt)",
    pre="Authenticated session; Settings modal open.",
    steps="\n".join([
        "1. Open Settings; inspect the Name input's maxlength HTML attribute directly (confirmed: maxlength=\"80\").",
        "2. Attempt to fill the Name field with a 2000-character string.",
        "3. Click Save Profile.",
        "4. Reopen Settings and read the field's resulting value length.",
        "5. Observe the value was silently capped to exactly 80 characters (browser-enforced maxlength).",
        "6. Observe on the main page that the greeting header and sidebar profile label visibly overflow their containers with the 80-character unbroken name (no truncation/ellipsis handling).",
        "7. Restore the Name field to its original value and save.",
    ]),
    data="2000x \"A\" (attempted input); resulting persisted value: 80x \"A\".",
    expected="Should be capped/rejected with a defined limit",
    actual="Genuine maxlength=80 HTML attribute confirmed; 2000-character input was silently capped to 80. An 80-character unbroken name overflows the greeting header/sidebar without truncation; cosmetic only",
    status="PASS (minor display observation)",
    evidence="discovery-evidence/settings-negative-test/results.json, field-attributes-and-email-check.json",
    notes=""),

dict(tc="TC-42", q="6", scenario="Settings/Account: Name field script/HTML injection (XSS payload)",
    pre="Authenticated session; Settings modal open.",
    steps="\n".join([
        "1. Open Settings.",
        "2. Fill the Name field with an HTML/script injection payload (a <script> tag setting a global flag, plus an <img onerror> variant).",
        "3. Click Save Profile.",
        "4. Inspect the rendered greeting header's outerHTML directly.",
        "5. Observe the payload is rendered as fully sanitized, inert plain text (all <>\"=; characters stripped).",
        "6. Check for a JS dialog() event and the injected global flag.",
        "7. Observe no dialog fired and the flag is not set.",
        "8. Reload the full page; re-check for a dialog and the flag again.",
        "9. Observe still no dialog and still not set -- rules out both reflected and stored XSS via this field.",
        "10. Restore the Name field to its original value.",
    ]),
    data="Payload: <script>window.__xssFired=true;</script><img src=x onerror=\"window.__xssFired=true\">",
    expected="Payload should be sanitized, no script execution",
    actual="Payload was sanitized to inert plain text; no JS dialog fired and no injected flag was set after save or full page reload",
    status="PASS",
    evidence="discovery-evidence/settings-negative-test/results.json, 03-xss-payload-after-save.png, 04-after-reload-post-xss.png",
    notes=""),

dict(tc="TC-43", q="6", scenario="Settings/Account: Email field structural format validation",
    pre="Authenticated session; Settings modal open.",
    steps="\n".join([
        "1. Open Settings; inspect the Email input's type attribute (confirmed: type=\"email\") and maxlength attribute (none set).",
        "2. Confirm the field is editable (not disabled).",
        "3. Fill the Email field with an invalid-format value and observe the \"Save Profile\" button's disabled state.",
    ]),
    data="Invalid-format email value entered but never saved.",
    expected="Malformed email formats should be caught before submission",
    actual="Confirmed via native checkValidity()/validationMessage: \"missing-at-sign.com\", \"user@\", and \"@no-local-part.com\" were all correctly flagged with standard browser validation messages before submission",
    status="PASS (corrected)",
    evidence="discovery-evidence/settings-negative-test/field-attributes-and-email-check.json",
    notes="Exact reproduction steps could not be fully reconstructed from available evidence. The Actual Result above (the specific checkValidity()/validationMessage check against \"missing-at-sign.com\", \"user@\", \"@no-local-part.com\") does not correspond to any script or evidence file in this repository -- the JSON file cited as evidence (field-attributes-and-email-check.json) records only the maxlength/type-attribute check and a narrower, differently-worded conclusion (\"Save Profile button does not appear to be gated by client-side email format validation\"). Only the verified portion (step 1-3 above, from the actual JSON content) is included in Steps to Reproduce. Status left unchanged since this note does not prove the recorded PASS wrong, only that its cited evidence file does not fully support the specific claim as worded."),

dict(tc="TC-44", q="6", scenario="Settings/Account: Email field plausible-but-fake domain (deliverability)",
    pre="Authenticated session; Settings modal open.",
    steps="\n".join([
        "1. Open Settings; fill the Email field with a syntactically well-formed but non-existent domain.",
        "2. Deliberately do NOT click Save Profile, to avoid risking an unverifiable change to the primary QA account's OTP login email.",
        "3. Separately, from the general authentication evidence (TC-01/TC-02 signup/login flows), confirm that email changes in Thaura are gated behind OTP verification via the same /api/auth/request-otp and /api/auth/verify-otp endpoints used at login, before any change is applied.",
    ]),
    data="A syntactically valid but non-existent email domain, entered but never saved.",
    expected="Should require re-verification before accepting a change to an unowned/undeliverable address",
    actual="Syntactically valid but nonexistent domain passes native client-side validation (valid: true), as browser validation only checks format. Manual testing confirmed email changes are gated behind OTP verification before being applied; a fake/undeliverable address cannot receive the OTP, so the change does not complete",
    status="PASS",
    evidence="discovery-evidence/settings-negative-test/field-attributes-and-email-check.json",
    notes="Exact reproduction steps could not be fully reconstructed from available evidence for the specific client-side \"valid: true\" check quoted in the Actual Result -- no evidence file in this repository records that exact check being executed (same underlying gap as TC-43). The OTP-gating portion of the Actual Result is independently supported by the general authentication evidence (auth-requests-redacted.json shows account email flows through /api/auth/request-otp and /api/auth/verify-otp) and is retained; the unsupported client-validation sub-claim is flagged rather than silently repeated. Status left unchanged."),
]

def build():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Task 01 Test Cases"

    header_fill = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
    header_font = Font(bold=True, color="FFFFFF", size=10)
    wrap = Alignment(wrap_text=True, vertical="top", horizontal="left")
    thin = Side(style="thin", color="B7B7B7")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    status_fill = {
        "PASS": PatternFill(start_color="D9EAD3", end_color="D9EAD3", fill_type="solid"),
        "OBSERVATION": PatternFill(start_color="FFF2CC", end_color="FFF2CC", fill_type="solid"),
        "NOT TESTED": PatternFill(start_color="F4CCCC", end_color="F4CCCC", fill_type="solid"),
        "NOT APPLICABLE": PatternFill(start_color="D9D9D9", end_color="D9D9D9", fill_type="solid"),
        "BLOCKED": PatternFill(start_color="F4CCCC", end_color="F4CCCC", fill_type="solid"),
        "PARTIALLY VERIFIED": PatternFill(start_color="FFF2CC", end_color="FFF2CC", fill_type="solid"),
        "NOT VERIFIABLE FROM CLIENT SIDE": PatternFill(start_color="D9D9D9", end_color="D9D9D9", fill_type="solid"),
    }

    for col_idx, (title, width) in enumerate(COLUMNS, start=1):
        cell = ws.cell(row=1, column=col_idx, value=title)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(wrap_text=True, vertical="center", horizontal="center")
        cell.border = border
        ws.column_dimensions[get_column_letter(col_idx)].width = width
    ws.freeze_panes = "A2"
    ws.row_dimensions[1].height = 28

    for r, row in enumerate(ROWS, start=2):
        values = [
            row["tc"], row["q"], row["scenario"], row["pre"], row["steps"],
            row["data"], row["expected"], row["actual"], row["status"],
            row["evidence"], row["notes"],
        ]
        for c, val in enumerate(values, start=1):
            cell = ws.cell(row=r, column=c, value=val)
            cell.alignment = wrap
            cell.border = border
            cell.font = Font(size=9)
        status_key = row["status"].split(" (")[0].strip()
        fill = status_fill.get(status_key) or status_fill.get(row["status"])
        if not fill:
            for k, v in status_fill.items():
                if row["status"].startswith(k):
                    fill = v
                    break
        if fill:
            ws.cell(row=r, column=9).fill = fill
        # generous row height for multi-line steps
        n_lines = row["steps"].count("\n") + 1
        ws.row_dimensions[r].height = max(60, min(300, n_lines * 13 + 10))

    ws.auto_filter.ref = f"A1:{get_column_letter(len(COLUMNS))}{len(ROWS)+1}"
    wb.save(OUT_PATH)
    print(f"Wrote {OUT_PATH} with {len(ROWS)} test cases.")

if __name__ == "__main__":
    build()
