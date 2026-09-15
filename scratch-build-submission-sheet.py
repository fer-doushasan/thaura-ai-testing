import openpyxl
from openpyxl.styles import Font, Alignment, PatternFill
from openpyxl.utils import get_column_letter

wb = openpyxl.Workbook()
HEADER_FILL = PatternFill(start_color="1F2937", end_color="1F2937", fill_type="solid")
HEADER_FONT = Font(color="FFFFFF", bold=True)
WRAP = Alignment(wrap_text=True, vertical="top")

def style_header(ws, ncols):
    for c in range(1, ncols + 1):
        cell = ws.cell(row=1, column=c)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(vertical="center", wrap_text=True)
    ws.freeze_panes = "A2"

def fill_sheet(ws, headers, rows, widths):
    ws.append(headers)
    style_header(ws, len(headers))
    for row in rows:
        ws.append(row)
    for r in range(2, ws.max_row + 1):
        for c in range(1, len(headers) + 1):
            ws.cell(row=r, column=c).alignment = WRAP
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w

# ===========================================================================
# SHEET 1: Test Cases / Results
# ===========================================================================
tc_headers = ["Test ID", "Task", "Module", "Test Scenario", "Preconditions", "Steps",
              "Expected Result", "Actual Result", "Status", "Evidence", "Remarks"]

tc_rows = [
    # --- Authentication & Session (Task 01) ---
    ["AUTH-001", "Task 01", "Authentication", "OTP-based signup end-to-end",
     "No existing account for the test email.",
     "1) Enter email 2) Request OTP 3) Enter OTP 4) Set name",
     "Account created, session issued, redirected to authenticated dashboard.",
     "Flow completed exactly as expected; session established.",
     "PASS", "discovery-evidence/signup-step1-requests.json, signup-step2-requests.json, 06-after-otp.png", "OTP code never captured/logged in any evidence."],
    ["AUTH-002", "Task 01", "Authentication", "Session cookie security attributes",
     "Authenticated session.", "1) Inspect thaura_token cookie via Playwright context",
     "Cookie should be httpOnly, Secure, with a reasonable SameSite policy.",
     "httpOnly=true, Secure=true, SameSite=Lax confirmed.",
     "PASS", "discovery-evidence/session-cookies-redacted.json", "Value itself redacted at capture time."],
    ["AUTH-003", "Task 01", "Authentication", "Session cookie lifetime",
     "Authenticated session.", "1) Decode token exp claim (safe fields only)",
     "N/A - informational.", "exp is ~1 year from issuance (2026-09-14 to 2027-09-14).",
     "OBSERVATION", "discovery-evidence/token-claims-safe.json", "Long-lived by design; mitigated by httpOnly/Secure flags; no exploit demonstrated."],
    ["AUTH-004", "Task 01", "Authentication", "Logout invalidates session server-side",
     "Authenticated session.", "1) Logout 2) Call GET /api/auth/me 3) Replay old token",
     "Both should return 401 after logout - token truly invalidated, not just cleared client-side.",
     "Both returned 401 as expected.", "PASS", "discovery-evidence/logout-invalidation-summary.json", ""],
    ["AUTH-005", "Task 01", "Authentication", "Logout scope across concurrent contexts",
     "Two browser contexts logged into the same account.", "1) Logout in Context A 2) Check /api/auth/me in Context B",
     "Undefined by spec - logged as observation regardless of outcome.",
     "Context B also returned 401 - logout invalidates all of the account's active sessions, not just the originating context.",
     "OBSERVATION", "discovery-evidence/logout-invalidation-summary.json", "Stricter than a per-device model; not a weakness (access was reduced, not gained)."],
    ["AUTH-006", "Task 01", "Authentication", "Concurrent sessions allowed",
     "Two browser contexts, same account.", "1) Authenticate both 2) Call /api/auth/me in both simultaneously",
     "N/A - documenting behavior.", "Both return 200 simultaneously - concurrent sessions are permitted.",
     "OBSERVATION", "discovery-evidence/concurrent-session-check.json", "Product design choice, not a defect."],
    ["AUTH-007", "Task 01", "Authentication", "Non-admin/anonymous cannot reach privileged views",
     "One anonymous context, one standard Free Plan account.", "1) Attempt to access admin views as each",
     "No privileged UI/data reachable by either.", "No admin UI reachable by anonymous or standard account.",
     "PASS", "discovery-evidence/website-scan/admin-access-check.json, admin-as-anonymous.png, admin-as-nonadmin-user.png", ""],
    ["AUTH-008", "Task 01", "Authentication", "Password-based login exists",
     "N/A", "1) Inspect Settings and login flow for a password field",
     "N/A", "No password field anywhere - Thaura is OTP-only (passwordless).",
     "NOT APPLICABLE", "discovery-evidence/settings-password-check.json", ""],

    # --- Free Tier & Quota (Task 01) ---
    ["QUOTA-001", "Task 01", "Free Tier Quota", "Free tier allows exactly 5 messages per 5 hours",
     "Fresh quota window (remaining=5).", "1) Send 5 messages sequentially 2) Poll GET /api/chats/rate-limit/check after each",
     "remaining decrements 5->4->3->2->1->0.", "Confirmed exactly as expected on two separate occasions.",
     "PASS", "discovery-evidence/quota-test/quota-test-log.json, chat-network-requests.json", ""],
    ["QUOTA-002", "Task 01", "Free Tier Quota", "6th message is blocked",
     "Quota exhausted (remaining=0).", "1) Attempt to send a 6th message via UI",
     "Message blocked; upgrade prompt shown.", "Blocked as expected with upgrade modal.",
     "PASS", "discovery-evidence/quota-test/msg-6.png", ""],
    ["QUOTA-003", "Task 01", "Free Tier Quota", "Quota enforcement is server-side (UI bypass attempt)",
     "Quota exhausted.", "1) Call the chat-send endpoint directly (bypassing the UI) after exhaustion",
     "Server should independently reject the request.", "429 rate_limit_exceeded returned - enforcement confirmed server-side, not only client-side.",
     "PASS", "discovery-evidence/quota-test/bypass-check-result.json", "Direct API/session bypass attempt."],
    ["QUOTA-004", "Task 01", "Free Tier Quota", "5-hour reset window",
     "Quota exhausted.", "1) Read resetAt timestamp from rate-limit/check response",
     "resetAt should be ~5 hours after the window's first message.", "Confirmed on two separate occasions (~5h delta both times).",
     "PASS", "discovery-evidence/quota-test/chat-network-requests.json", ""],
    ["QUOTA-005", "Task 01", "Free Tier Quota", "UI reflects quota state",
     "Quota exhausted.", "1) Observe UI after 6th send attempt",
     "Clear banner/modal communicating quota exhaustion and reset countdown.", "\"Out of messages\" modal with countdown and upgrade CTA shown consistently.",
     "PASS", "discovery-evidence/quota-test/msg-6.png, discovery-evidence/upload-test/results.json", ""],
    ["QUOTA-006", "Task 01", "Free Tier Quota", "Incognito messages consume the same quota",
     "Verified incognito mode active, quota remaining=2.", "1) Send 1 message while in incognito 2) Check rate-limit/check before/after",
     "N/A - documenting behavior.", "remaining decremented 2->1 identically to a normal message.",
     "OBSERVATION", "discovery-evidence/memory-incognito-test/incognito-verified-results.json", "Not a bug; not obvious from UI copy alone."],
    ["QUOTA-007", "Task 01", "Free Tier Quota", "Does a failed/errored assistant response still consume a quota unit?",
     "Fresh/available quota.", "1) Send a message requiring a long streamed reply 2) Reload page ~1.6s later to drop the client connection mid-stream 3) Observe backend turn state and quota",
     "Determine whether a failure consumes a message.", "The backend has a resumable-turn architecture - generation completed successfully server-side regardless of the disconnect, and the UI resumed and displayed the full answer after reload. This is a successful, not failed, response; quota was correctly consumed for a successful turn. A separate probe (malformed payload) showed 400 validation errors do NOT consume quota. Neither is a genuine assistant-side (generation) failure.",
     "NOT TESTED", "discovery-evidence/quota-test/failed-response-quota-test.json, malformed-session-request-results.json", "Could not safely, deliberately reproduce a genuine generation failure without abusive techniques."],

    # --- File Upload & Data Integrity (Task 01) ---
    ["FILE-001", "Task 01", "File Upload", "Valid PDF upload and text extraction accuracy",
     "Authenticated session.", "1) Upload a PDF with a known embedded marker 2) Ask the assistant to quote it",
     "Upload succeeds; extracted text is accurate; assistant correctly uses it in a reply.",
     "Upload API returned the exact embedded text; a live chat turn confirmed the assistant correctly quoted the marker back.",
     "PASS", "discovery-evidence/upload-test/extraction-verification.json, discovery-evidence/memory-incognito-test/full-test-results.json", ""],
    ["FILE-002", "Task 01", "File Upload", "Valid XLSX upload and cell-value extraction accuracy",
     "Authenticated session.", "1) Upload an XLSX with known cell values/marker",
     "Extracted values match source exactly.", "Cell values and marker extracted correctly as a markdown table.",
     "PASS", "discovery-evidence/upload-test/extraction-verification.json", ""],
    ["FILE-003", "Task 01", "File Upload", "Valid PNG image upload",
     "Authenticated session.", "1) Upload a PNG with readable embedded text",
     "Upload succeeds; content is accessible to the assistant.", "Upload succeeds; upload-time API only records a generic \"Image file: <name>\" placeholder (no OCR at that stage). Whether the assistant can read the embedded text via multimodal vision in a live chat turn was not independently re-verified this round.",
     "OBSERVATION / NOT TESTED (partial)", "discovery-evidence/upload-test/extraction-verification.json", "Deprioritized under free-tier quota budget in favor of memory/incognito/isolation tests."],
    ["FILE-004", "Task 01", "File Upload", "Empty file rejected",
     "Authenticated session.", "1) Attempt to upload a 0-byte PDF and PNG",
     "Rejected client-side with a clear message; no crash.", "\"Cannot upload empty file.\" shown; no network request fired.",
     "PASS", "discovery-evidence/upload-test/results.json (empty_pdf, empty_png)", ""],
    ["FILE-005", "Task 01", "File Upload", "Corrupted PDF rejected",
     "Authenticated session.", "1) Attempt to upload a corrupted PDF",
     "Rejected with a clear message; no crash; no silent accept.", "Server returned 400; UI showed \"Could not extract text... may be corrupted, password-protected, or contain only images.\"",
     "PASS", "discovery-evidence/upload-test/results.json (corrupted_pdf)", ""],
    ["FILE-006", "Task 01", "File Upload", "Corrupted PNG handling",
     "Authenticated session.", "1) Attempt to upload a corrupted PNG",
     "Consistent handling with corrupted PDF case.", "Upload accepted (200) rather than rejected - inconsistent with the PDF case, but explained by the image pipeline treating all images as opaque binaries (no content parsing at upload time). No crash, no data exposure.",
     "OBSERVATION", "discovery-evidence/upload-test/results.json (corrupted_png)", "Not classified as a bug - no functional/security impact demonstrated."],
    ["FILE-007", "Task 01", "File Upload", "Password-protected PDF rejected",
     "Authenticated session.", "1) Attempt to upload a password-protected PDF",
     "Rejected with a clear, accurate message.", "Server returned 400 with the same message as the corrupted case (accurate but does not disambiguate cause).",
     "PASS", "discovery-evidence/upload-test/results.json (password_protected_pdf)", "Minor UX clarity note only."],
    ["FILE-008", "Task 01", "File Upload", "Oversized file (8MB) handling",
     "Authenticated session.", "1) Attempt to upload an 8MB file",
     "Rejected cleanly if over the limit.", "Rejected client-side, no network request fired.",
     "PASS", "discovery-evidence/upload-test/results.json (oversized_8mb)", ""],
    ["FILE-009", "Task 01", "File Upload", "Oversized file (60MB) handling",
     "Authenticated session.", "1) Attempt to upload a 60MB file",
     "Rejected cleanly with a clear size-limit message.", "\"File size exceeds the 50MB limit.\" shown correctly.",
     "PASS", "discovery-evidence/upload-test/results.json (oversized_60mb)", ""],
    ["FILE-010", "Task 01", "File Upload", "No server error/crash across the entire invalid-file matrix",
     "Authenticated session.", "1) Review all invalid-file test network responses",
     "No 5xx responses anywhere in the matrix.", "Confirmed - no 5xx responses observed.",
     "PASS", "discovery-evidence/upload-test/results.json", ""],
    ["FILE-011", "Task 01", "File Upload", "No sensitive data exposed in upload error responses",
     "Authenticated session.", "1) Inspect all error response bodies",
     "Only generic messages; no stack traces/paths/internal identifiers.", "Confirmed - error bodies contain only generic user-facing messages.",
     "PASS", "discovery-evidence/upload-test/results.json", ""],
    ["FILE-012", "Task 01", "File Upload", "Upload/loading/error UI states are distinct and correct",
     "Authenticated session.", "1) Review attach-state and send-state screenshots across the full matrix",
     "Distinct, correct visual states for attach/loading/error/success.", "Confirmed across the full valid + invalid file matrix.",
     "PASS", "discovery-evidence/upload-test/*-after-attach.png, *-after-send.png", ""],

    # --- Cross-Session / File Isolation (Task 01) ---
    ["ISO-001", "Task 01", "File Isolation", "Direct/unauthenticated access to a file by ID",
     "A known fileId from a prior upload.", "1) Request the file via 3 candidate endpoints, authenticated (wrong context) and unauthenticated",
     "No path should return file content to an unauthorized requester.", "Authenticated-wrong-context -> 404; unauthenticated -> 401. No path exposed content.",
     "PASS", "discovery-evidence/upload-test/isolation-probe-results.json", ""],
    ["ISO-002", "Task 01", "File Isolation", "File content does not leak into a different conversation (same account)",
     "A file uploaded in Chat A.", "1) Start a new, unrelated Chat B 2) Ask whether the assistant has access to the file from Chat A",
     "Assistant should not have access to Chat A's file content in Chat B.", "Assistant correctly stated it does not have access to files uploaded in a different conversation.",
     "PASS", "discovery-evidence/memory-incognito-test/full-test-results.json", ""],
    ["ISO-003", "Task 01", "File Isolation", "Cross-account file isolation (two distinct real accounts)",
     "Two distinct real user accounts.", "N/A - not executed", "N/A",
     "Not executed - assessment scope excludes using another real person's account.",
     "NOT TESTED", "N/A", "Same-account cross-conversation test (ISO-002) plus direct-ID-access test (ISO-001) used as the closest safe proxy."],
    ["ISO-004", "Task 01", "File Isolation", "New-chat UI resets attachment state",
     "A chat with an attached file.", "1) Start a new chat 2) Check for any residual attachment reference",
     "No residual attachment shown in the new chat.", "Confirmed - no residual reference.",
     "PASS", "discovery-evidence/upload-test/newchat-isolation-retest.json", ""],

    # --- Memory (Task 01) ---
    ["MEM-001", "Task 01", "Memory", "Verbal \"remember this fact\" instruction persists across conversations",
     "Authenticated session.", "1) In Chat A, instruct the assistant to remember a unique fact 2) In new Chat B, ask it to recall the fact",
     "Undefined - documenting actual behavior.", "Assistant explicitly stated it cannot store such instructions as a standing rule; Chat B correctly reported not knowing the fact. No false claim of persistence was made.",
     "OBSERVATION", "discovery-evidence/memory-incognito-test/full-test-results.json", "Reclassified from initial FAIL framing - the assistant is transparent about the limitation, so no expectation was actually violated."],
    ["MEM-002", "Task 01", "Memory", "Distinct automatic long-term Memory subsystem exists",
     "Authenticated session.", "1) Open Account menu -> Memory 2) Inspect GET /api/memories and /api/memories/scopes",
     "N/A - feature discovery.", "A dedicated Memory panel exists, backed by a real API (capacity ceiling 12000 tokens, hard cap 18000). UI states: \"As you chat, Thaura writes down what is worth keeping.\"",
     "PASS", "discovery-evidence/memory-incognito-test/memory-settings-network-log.json, memory-settings-bodytext.txt, 11-memory-settings-panel.png", "Materially refines MEM-001 - a real memory feature exists, just not triggered by a verbal command."],
    ["MEM-003", "Task 01", "Memory", "Automatic memory captured our test conversations",
     "Same session as MEM-001/MEM-002.", "1) Re-check GET /api/memories after the test conversations",
     "N/A - documenting behavior.", "Memory store was still empty (\"Nothing remembered yet\") after our short, synthetic test conversations.",
     "OBSERVATION", "discovery-evidence/memory-incognito-test/memory-settings-network-log.json", "Not evidence of a broken feature - suggests it triggers on the system's own judgment over genuine usage, not on short synthetic probes."],
    ["MEM-004", "Task 01", "Memory", "Refresh/reload preserves in-chat state",
     "An active chat with established answers.", "1) Reload the page mid-conversation",
     "Chat content and prior answers preserved; no retroactive memory gain.", "Confirmed - chat preserved, no retroactive recall of the earlier marker (consistent with no-persistence finding).",
     "PASS", "discovery-evidence/memory-incognito-test/full-test-results.json", ""],

    # --- Incognito (Task 01) ---
    ["INCOG-001", "Task 01", "Incognito", "Incognito toggle activates correctly",
     "Authenticated session.", "1) Click the Incognito mode control",
     "UI shows an active-incognito state.", "\"You're incognito\" / \"Exit incognito\" states confirmed after correcting an initial automation selector bug.",
     "PASS", "discovery-evidence/memory-incognito-test/incognito-verified-results.json", "First attempt clicked an invisible sr-only span and silently failed; corrected via an accessible-name role locator."],
    ["INCOG-002", "Task 01", "Incognito", "Incognito conversation does not appear in chat history",
     "Verified incognito mode active.", "1) Send a message while incognito 2) Inspect the sidebar TODAY list",
     "No new entry for the incognito conversation.", "Confirmed - TODAY list showed only the 3 pre-existing named chats.",
     "PASS", "discovery-evidence/memory-incognito-test/incognito-verified-results.json", "An earlier automated flag of a possible leak was a false positive from an over-broad selector; corrected on re-inspection."],
    ["INCOG-003", "Task 01", "Incognito", "Incognito conversation gets no persistent/addressable URL",
     "Verified incognito mode active.", "1) Inspect the browser URL while incognito",
     "N/A - documenting behavior.", "URL stayed at the bare origin with no ?chatId= parameter, unlike every normal chat.",
     "PASS", "discovery-evidence/memory-incognito-test/incognito-verified-results.json", ""],
    ["INCOG-004", "Task 01", "Incognito", "Incognito content does not leak into normal memory",
     "A marker planted while incognito.", "1) Exit incognito 2) Start a new normal chat 3) Ask to recall the incognito marker",
     "Assistant should not know the incognito marker.", "Confirmed - no knowledge of the incognito-planted marker.",
     "PASS", "discovery-evidence/memory-incognito-test/full-test-results.json", ""],
    ["INCOG-005", "Task 01", "Incognito", "Exiting incognito returns to normal mode cleanly",
     "Verified incognito mode active.", "1) Click Exit incognito",
     "UI returns to normal mode with no residual incognito state.", "Confirmed clean exit.",
     "PASS", "discovery-evidence/memory-incognito-test/incognito-verified-results.json", ""],

    # --- Developer API (Task 01) ---
    ["API-001", "Task 01", "Developer API", "Missing messages field rejected",
     "Valid API key.", "1) POST to /v1/chat/completions with no messages field",
     "400 structural validation error.", "400 invalid_messages - \"messages array is required\".",
     "PASS", "discovery-evidence/api-test/validation-batch-results.json (API-07)", ""],
    ["API-002", "Task 01", "Developer API", "Wrong-type messages field rejected",
     "Valid API key.", "1) POST with messages as a string instead of an array",
     "400 structural validation error.", "400 invalid_messages, same message as above.",
     "PASS", "discovery-evidence/api-test/validation-batch-results.json (API-08)", "Also independently re-confirmed against the session-authenticated endpoint on 2026-09-15."],
    ["API-003", "Task 01", "Developer API", "Invalid model rejected",
     "Valid API key.", "1) POST with model set to a non-\"thaura\" value",
     "400 with a clear message.", "400 invalid_model - \"Only 'thaura' model is supported.\"",
     "PASS", "discovery-evidence/api-test/validation-batch-results.json (API-09)", ""],
    ["API-004", "Task 01", "Developer API", "Legacy functions/function_call parameters rejected",
     "Valid API key.", "1) POST with functions param 2) POST with function_call param",
     "400 with a migration-oriented message.", "400 unsupported_parameter - directs caller to tools/tool_choice.",
     "PASS", "discovery-evidence/api-test/validation-batch-results.json (API-18, API-19)", ""],
    ["API-005", "Task 01", "Developer API", "Zero-balance request handling",
     "Valid API key, $0 balance.", "1) POST a well-formed, valid request",
     "402 with a clear minimum-balance message; no charge incurred.", "402 insufficient_balance - \"Minimum required: $0.10\". No cost incurred.",
     "PASS", "discovery-evidence/api-test/validation-batch-results.json (API-07, API-10 to API-17, API-20, API-21)", ""],
    ["API-006", "Task 01", "Developer API", "Validation order (structural checks vs. billing gate)",
     "Valid API key, $0 balance.", "1) Compare 400-case payloads vs. 402-case payloads across the batch",
     "N/A - documenting architecture.", "Structural/model/legacy-parameter validation runs before the billing gate; billing gate runs before model execution.",
     "PASS", "discovery-evidence/api-test/validation-batch-results.json (full batch)", "Basis for the funding decision - deeper behavioral tests need a funded call."],
    ["API-007", "Task 01", "Developer API", "Temperature boundary enforcement",
     "Funded balance required.", "N/A - not executed", "N/A",
     "Not executed - billing gate returns 402 before temperature validation/execution can be observed.",
     "BLOCKED", "discovery-evidence/api-test/validation-batch-results.json (API-10 to API-13)", "Billing-gated; funding not recommended (see API Funding Decision)."],
    ["API-008", "Task 01", "Developer API", "max_tokens / max_completion_tokens behavior and 32000 cap",
     "Funded balance required.", "N/A - not executed", "N/A",
     "Not executed - same billing-gate constraint.",
     "BLOCKED", "discovery-evidence/api-test/validation-batch-results.json (API-14, API-15, API-15b)", ""],
    ["API-009", "Task 01", "Developer API", "Parameter precedence (max_tokens vs max_completion_tokens)",
     "Funded balance required.", "N/A - not executed", "N/A", "Not executed - same billing-gate constraint.",
     "BLOCKED", "discovery-evidence/api-test/validation-batch-results.json (API-17)", ""],
    ["API-010", "Task 01", "Developer API", "Ignored/pass-through parameters (top_p, frequency_penalty, presence_penalty, n, user)",
     "Funded balance required.", "N/A - not executed", "N/A",
     "Accepted at structural-validation layer; effect on generation not observed - same billing-gate constraint.",
     "BLOCKED", "discovery-evidence/api-test/validation-batch-results.json (API-20)", ""],
    ["API-011", "Task 01", "Developer API", "tools / tool_choice function-calling behavior",
     "Funded balance required.", "N/A - not executed", "N/A", "Not executed - same billing-gate constraint.",
     "BLOCKED", "discovery-evidence/api-test/validation-batch-results.json (API-21)", ""],
    ["API-012", "Task 01", "Developer API", "Streaming vs non-streaming response shape",
     "Funded balance required.", "N/A - not executed", "N/A", "Not reachable without a successful funded generation call.",
     "BLOCKED", "N/A", ""],
    ["API-013", "Task 01", "Developer API", "Usage accounting (token counts / cost reporting)",
     "Funded balance required.", "N/A - not executed", "N/A", "Not reachable without a successful funded generation call.",
     "BLOCKED", "N/A", ""],
    ["API-014", "Task 01", "Developer API", "API rate/concurrency limits",
     "Multiple funded, near-simultaneous calls required.", "N/A - not executed", "N/A",
     "Not attempted - no balance, and deliberately avoided to prevent any appearance of a DoS-style probe against production infrastructure.",
     "NOT TESTED", "N/A", ""],

    # --- Negative & Boundary Testing (Task 01, cross-cutting) ---
    ["NEG-001", "Task 01", "Negative/Boundary", "Unicode / RTL / emoji / long-string input handling",
     "N/A", "1) Submit Bangla, Arabic RTL, mixed-script, emoji, 1000-char, and special-character strings into name/message fields",
     "All strings round-trip correctly with no corruption.", "Confirmed - all 6 samples round-tripped correctly in both fields.",
     "PASS", "discovery-evidence/unicode-test/results.json", ""],
    ["NEG-002", "Task 01", "Negative/Boundary", "Blank/invalid form submission handling",
     "N/A", "1) Submit the contact form blank 2) Submit with an invalid email",
     "Client-side validation blocks submission with visible errors.", "Confirmed on both cases.",
     "PASS", "discovery-evidence/website-scan/contact-blank-submit.png, contact-invalid-email-submit-attempt.png", ""],
    ["NEG-003", "Task 01", "Negative/Boundary", "API structural/boundary negative-case batch",
     "Valid API key.", "1) Execute the 14-case validation batch (missing/invalid fields, invalid model, legacy params, boundary parameter values)",
     "Every case produces a correct, well-formed error.", "Confirmed - all 14 cases produced correct 400/402 responses as designed.",
     "PASS", "discovery-evidence/api-test/validation-batch-results.json", ""],

    # --- Task 02: Functional / Data ---
    ["WEB-001", "Task 02", "Functional/Data", "Full site crawl returns 200 with no broken links",
     "N/A", "1) Crawl all 16 public pages 2) Check HTTP status and internal links",
     "All pages 200, no broken links/redirect loops.", "Confirmed - all 16 pages returned 200, no broken links found.",
     "PASS", "discovery-evidence/website-scan/scan-results.json", ""],
    ["WEB-002", "Task 02", "Functional/Data", "Contact form field validation",
     "N/A", "1) Inspect contact form required/optional fields 2) Submit blank and invalid-email cases",
     "Correct required-field enforcement and email format validation.", "Confirmed - name/email/message required, subject optional; invalid submissions blocked client-side.",
     "PASS", "discovery-evidence/website-scan/contact-form-fields.json, contact-blank-submit.png, contact-invalid-email-submit-attempt.png", ""],

    # --- Task 02: Links & Redirects ---
    ["LINK-001", "Task 02", "Links/Redirects", "No broken links or unexpected redirects across the site",
     "N/A", "1) Extract and follow every internal link from the homepage",
     "All links resolve without error or unexpected redirect.", "Confirmed - no broken links or redirect anomalies found.",
     "PASS", "discovery-evidence/website-scan/scan-results.json, extracted-links.txt, homepage-links.json", ""],

    # --- Task 02: Pricing ---
    ["PRICE-001", "Task 02", "Pricing", "Monthly vs annual pricing internal consistency",
     "N/A", "1) Read default, monthly-selected, and annual-selected pricing states",
     "Annual price should reflect the advertised 20% discount consistently.", "$15/month monthly; $12/month annual (billed $144/year) = exactly 20% off, matching the \"Save 20%\" badge.",
     "PASS", "discovery-evidence/website-scan/pricing-toggle-result.json, pricing-default-state.png, pricing-monthly-selected.png, pricing-annual-selected.png", ""],

    # --- Task 02: SEO / Metadata ---
    ["SEO-001", "Task 02", "SEO/Metadata", "Canonical tags and Open Graph / Twitter Card metadata present",
     "N/A", "1) Inspect head metadata on home/pricing/api-platform/faq",
     "Correct canonical, OG, and Twitter Card tags present on each page.", "Confirmed present and correct on all pages checked.",
     "PASS", "discovery-evidence/website-scan/scan-results.json", ""],
    ["SEO-002", "Task 02", "SEO/Metadata", "Lighthouse SEO score",
     "N/A", "1) Run Lighthouse SEO audit on home/pricing/api-platform/faq",
     "High SEO score.", "Perfect 1.0 SEO score on all 4 pages tested.",
     "PASS", "discovery-evidence/lighthouse/summary.json", ""],

    # --- Task 02: Performance ---
    ["PERF-001", "Task 02", "Performance", "Lighthouse performance scoring across key pages",
     "N/A", "1) Run Lighthouse performance audit on home/pricing/api-platform/faq",
     "N/A - documenting measured results.", "Scores 0.72-0.82; LCP 4.5s-6.2s (FAQ and home are the slowest).",
     "OBSERVATION", "discovery-evidence/lighthouse/summary.json", "Acceptable but not exceptional; worth a look at LCP asset loading if performance is a priority."],
    ["PERF-002", "Task 02", "Performance", "Conservative baseline load test (public pages only)",
     "N/A", "1) Run JMeter: 5 concurrent users, 3 loops, GET /home, /pricing, /faq only",
     "No errors under light load.", "45 requests, 0% errors, avg 1035.7ms, p95 1191.6ms.",
     "PASS", "performance/jmeter/results-summary.json", "Explicitly a light health-check, not a capacity/stress test - backend.thaura.ai and chat/billing endpoints were deliberately excluded."],

    # --- Task 02: Console / Network ---
    ["CONSOLE-001", "Task 02", "Console/Network", "Browser console error scan across key pages",
     "N/A", "1) Run Lighthouse best-practices audit (errors-in-console) on home/pricing/api-platform/faq",
     "No unresolved JS errors logged to console.", "A React hydration error (minified #418) fires on every one of the 4 pages tested. See BUG-001.",
     "FAIL (see BUG-001)", "discovery-evidence/lighthouse/home-full-report.json, pricing-full-report.json, api-full-report.json, faq-full-report.json", "Not caught by the project's earlier general console-message capture script; found via Lighthouse specifically."],

    # --- Task 02: Security ---
    ["WEBSEC-001", "Task 02", "Security", "Standard security headers present",
     "N/A", "1) Fetch response headers for all public pages",
     "HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, CSP all present.",
     "Confirmed present on every page tested.", "PASS", "discovery-evidence/website-scan/security-headers.txt", ""],
    ["WEBSEC-002", "Task 02", "Security", "Content-Security-Policy strictness",
     "N/A", "1) Inspect the CSP directive set",
     "Reasonably strict default-src/object-src policy.", "default-src 'self', object-src 'none' confirmed; connect-src additionally allows http://127.0.0.1:* and http://localhost:* (see SECOBS-001).",
     "PASS (with observation)", "discovery-evidence/website-scan/security-headers.txt", ""],
    ["WEBSEC-003", "Task 02", "Security", "Client-side bundle secret-pattern scan",
     "N/A", "1) Scan downloaded JS chunks for API-key/secret-like patterns",
     "No secrets/keys/tokens present in client-side code.", "No secrets found in the client bundle scan.",
     "PASS", "discovery-evidence/source-scan/", ""],
    ["WEBSEC-004", "Task 02", "Security", "Pre-authentication endpoint exposure check",
     "Anonymous context.", "1) Call GET /api/plugins/list and related bootstrap endpoints without auth",
     "N/A - documenting behavior.", "Returns a public plugin catalog (non-user data); no sensitive information exposed.",
     "OBSERVATION", "discovery-evidence/auth-requests-redacted.json, signup-step1-requests.json", "Expected/by-design public endpoint, not a vulnerability."],

    # --- Task 02: Technical Claims ---
    ["CLAIM-001", "Task 02", "Technical Claims", "Encryption wording consistency across marketing and legal pages",
     "N/A", "1) Compare encryption claims on home/privacy-policy/terms vs. the Data Processing Addendum",
     "Marketing claims should not contradict the detailed legal documentation.", "Homepage/privacy-policy broadly state \"encrypted at rest (AES-256-GCM)\"; the DPA specifies application-level field encryption for \"selected sensitive fields\" specifically (with separate disk/object-storage-level encryption described elsewhere). A wording-precision nuance, not a demonstrated false claim.",
     "OBSERVATION", "discovery-evidence/claims-check/home-text.txt, privacy-policy-text.txt, data-processing-addendum-text.txt", "Flagged for legal/copy review, not reported as a security defect - implementation details cannot be verified from the client side."],
]

fill_sheet(wb.active, tc_headers, tc_rows,
           [10, 8, 16, 34, 20, 30, 30, 40, 16, 40, 34])
wb.active.title = "Test Cases - Results"

# ===========================================================================
# SHEET 2: Bug Report
# ===========================================================================
ws_bugs = wb.create_sheet("Bug Report")
bug_headers = ["Bug ID", "Title", "Module", "Severity", "Priority", "Preconditions",
               "Steps to Reproduce", "Expected Result", "Actual Result", "Impact", "Evidence", "Status"]
bug_rows = [
    ["BUG-001",
     "React hydration mismatch (minified error #418) fires on every marketing page load",
     "Frontend - Marketing site (home, pricing, api-platform, faq)",
     "Low", "Medium",
     "None - reproducible on a clean, unauthenticated page load.",
     "1) Open a fresh/incognito browser session. 2) Navigate to https://thaura.ai/ (also reproduced on /pricing, /api-platform, /faq). 3) Open DevTools Console. 4) Observe the page load complete.",
     "No JavaScript exceptions logged to console; server-rendered HTML matches the client's initial render.",
     "Console logs \"Error: Minified React error #418\" (hydration mismatch) on every one of the 4 pages audited. Pages remain visually correct and interactive in manual testing - no visible functional break observed.",
     "Low functional impact observed; indicates a real SSR/CSR markup mismatch, forces a client-side re-render of the affected subtree, and pollutes the console (which could mask other real errors in production monitoring).",
     "discovery-evidence/lighthouse/home-full-report.json, pricing-full-report.json, api-full-report.json, faq-full-report.json (audits.errors-in-console)",
     "Open"],
]
fill_sheet(ws_bugs, bug_headers, bug_rows, [10, 34, 26, 10, 10, 24, 36, 30, 40, 34, 40, 10])

# ===========================================================================
# SHEET 3: Observations
# ===========================================================================
ws_obs = wb.create_sheet("Observations")
obs_headers = ["Observation ID", "Area", "Observation", "Evidence", "Impact/Risk", "Classification"]
obs_rows = [
    ["OBS-001", "File Upload", "A corrupted PNG is accepted (200) while a corrupted PDF is rejected (400).",
     "discovery-evidence/upload-test/results.json", "No crash/data exposure - the image pipeline treats all images as opaque at upload time regardless of validity.", "OBSERVATION"],
    ["OBS-002", "File Upload", "Password-protected PDF error message is identical to the generic corrupted-file message.",
     "discovery-evidence/upload-test/results.json", "Minor UX clarity gap only - message is accurate, just not specific.", "OBSERVATION"],
    ["OBS-003", "Session Management", "Logging out in one browser context invalidates the session in a second concurrent context on the same account too.",
     "discovery-evidence/logout-invalidation-summary.json", "No unauthorized access resulted; a stricter, more conservative behavior than a per-device model.", "OBSERVATION"],
    ["OBS-004", "Quota", "Incognito-mode messages count against the same 5-message/5-hour free-tier quota as normal messages.",
     "discovery-evidence/memory-incognito-test/incognito-verified-results.json", "Consistent, expected enforcement; simply not obvious from UI copy alone.", "OBSERVATION"],
    ["OBS-005", "Memory", "A verbal \"remember this fact\" instruction is not persisted as durable memory; a separate genuine automatic Memory subsystem exists but was empty after our short test conversations.",
     "discovery-evidence/memory-incognito-test/full-test-results.json, memory-settings-network-log.json", "No false claim of persistence was made to the user; feature works on the system's own judgment over real usage, not on direct command.", "OBSERVATION"],
    ["OBS-006", "Reliability/Architecture", "A dropped client connection mid-response does not fail the reply - the backend resumes and completes generation server-side via a resumable-turn architecture.",
     "discovery-evidence/quota-test/failed-response-quota-test.json", "Positive resilience finding; included for completeness rather than as a defect.", "OBSERVATION"],
    ["OBS-007", "Legal/Marketing Wording", "Homepage/privacy-policy broadly state \"encrypted at rest\", while the Data Processing Addendum specifies application-level field encryption for \"selected sensitive fields\" specifically.",
     "discovery-evidence/claims-check/home-text.txt, privacy-policy-text.txt, data-processing-addendum-text.txt", "Wording-precision nuance for legal/copy review, not a demonstrated false claim - other encryption layers are described elsewhere in the DPA and cannot be verified client-side.", "OBSERVATION"],
    ["OBS-008", "File Upload", "Images are not OCR'd/text-extracted at upload time - the upload API records only a generic \"Image file: <name>\" placeholder.",
     "discovery-evidence/upload-test/extraction-verification.json", "Describes documented pipeline behavior; whether the assistant can still read image text via multimodal vision at chat-turn time was not independently re-verified this round.", "OBSERVATION"],
]
fill_sheet(ws_obs, obs_headers, obs_rows, [14, 22, 46, 40, 44, 16])

# ===========================================================================
# SHEET 4: Security Observations
# ===========================================================================
ws_sec = wb.create_sheet("Security Observations")
sec_headers = ["Sec Obs ID", "Area", "Observation", "Evidence", "Impact/Risk", "Classification"]
sec_rows = [
    ["SECOBS-001", "CSP (Content-Security-Policy)", "The main app's CSP connect-src directive includes http://127.0.0.1:* and http://localhost:* alongside production origins.",
     "discovery-evidence/website-scan/security-headers.txt", "No exploitability demonstrated - likely a local-dev config leftover; only relevant given an independent script-injection primitive, which was not found.", "SECURITY OBSERVATION"],
    ["SECOBS-002", "Session Cookie Lifetime", "The thaura_token session cookie has an expiry of approximately 1 year from issuance.",
     "discovery-evidence/session-cookies-redacted.json, token-claims-safe.json", "Mitigated by httpOnly + Secure + SameSite=Lax flags. No session-fixation or token-theft impact demonstrated; a common consumer-app UX choice.", "SECURITY OBSERVATION"],
    ["SECOBS-003", "Pre-authentication endpoint exposure", "GET /api/plugins/list and a few bootstrap-type endpoints are reachable without authentication.",
     "discovery-evidence/auth-requests-redacted.json, signup-step1-requests.json", "Returns a public plugin catalog only - no user data. Expected/by-design public endpoint.", "SECURITY OBSERVATION"],
    ["SECOBS-004", "Build artifact naming in error output", "The React hydration error (BUG-001) surfaces internal, content-hashed Next.js build chunk filenames in the console.",
     "discovery-evidence/lighthouse/home-full-report.json", "Standard, intended Next.js output; no source/secrets exposed.", "SECURITY OBSERVATION"],
]
fill_sheet(ws_sec, sec_headers, sec_rows, [14, 26, 46, 40, 44, 18])

# ===========================================================================
# SHEET 5: Not Tested / Blocked
# ===========================================================================
ws_nt = wb.create_sheet("Not Tested - Blocked")
nt_headers = ["Requirement", "Status", "Reason", "Limitation", "Evidence/Reference"]
nt_rows = [
    ["Genuine assistant-side (generation) failure and its effect on quota", "NOT TESTED",
     "Could not be safely and deliberately reproduced without abusive techniques (e.g. adversarial prompts intended to crash the model, or resource-exhaustion attempts), which were explicitly out of scope.",
     "Two safe probes were run instead: a simulated dropped connection (revealed a resumable-turn architecture - the response completed successfully, so this is not a failure) and a malformed payload (correctly rejected 400, not billed). Neither answers the strict question of what happens when generation itself errors out.",
     "discovery-evidence/quota-test/failed-response-quota-test.json, malformed-session-request-results.json"],
    ["Image-embedded text readability by the assistant in a live chat turn", "NOT TESTED",
     "Deprioritized under a hard 5-message/5-hour free-tier budget in favor of higher-value memory/incognito/file-isolation tests.",
     "The upload-time extraction pipeline behavior (no OCR, opaque \"Image file\" placeholder) is documented; whether the model can still read image text via multimodal vision when asked directly was not independently re-confirmed this session.",
     "discovery-evidence/upload-test/extraction-verification.json"],
    ["Cross-account file isolation (two distinct real accounts)", "NOT TESTED",
     "Assessment scope explicitly excludes using another real person's account.",
     "Same-account cross-conversation isolation and direct-file-ID access (401/404) were tested instead as the closest safe proxy; not exhaustive proof of cross-account isolation.",
     "discovery-evidence/upload-test/isolation-probe-results.json, memory-incognito-test/full-test-results.json"],
    ["API: temperature boundary enforcement", "BLOCKED",
     "The zero-balance account receives 402 insufficient_balance before any temperature validation/execution logic can run.",
     "Funding was evaluated and not recommended - see API Funding Decision (DO NOT FUND).",
     "discovery-evidence/api-test/validation-batch-results.json (API-10 to API-13)"],
    ["API: max_tokens / max_completion_tokens behavior and 32000 cap", "BLOCKED",
     "Same billing-gate constraint as above.", "Same as above.",
     "discovery-evidence/api-test/validation-batch-results.json (API-14, API-15, API-15b)"],
    ["API: max_tokens vs max_completion_tokens precedence", "BLOCKED",
     "Same billing-gate constraint as above.", "Same as above.",
     "discovery-evidence/api-test/validation-batch-results.json (API-17)"],
    ["API: ignored/pass-through parameters (top_p, frequency_penalty, presence_penalty, n, user)", "BLOCKED",
     "Same billing-gate constraint as above.", "Parameters are accepted at the structural-validation layer; their effect on generation cannot be observed without a funded call.",
     "discovery-evidence/api-test/validation-batch-results.json (API-20)"],
    ["API: tools / tool_choice function-calling behavior", "BLOCKED",
     "Same billing-gate constraint as above.", "Same as above.",
     "discovery-evidence/api-test/validation-batch-results.json (API-21)"],
    ["API: streaming vs non-streaming response shape", "BLOCKED",
     "Not reachable without a successful (funded) generation call.", "Same as above.", "N/A"],
    ["API: usage accounting (token counts / cost reporting)", "BLOCKED",
     "Not reachable without a successful (funded) generation call.", "Same as above.", "N/A"],
    ["API: rate/concurrency limits", "NOT TESTED",
     "Would require multiple funded, near-simultaneous calls; not attempted both due to lack of balance and to avoid any appearance of a DoS-style probe against production infrastructure.",
     "No data obtained on this requirement.", "N/A"],
    ["Incognito behavior under a mid-session refresh specifically", "NOT TESTED",
     "Not directly re-exercised this session under the quota budget.",
     "URL-scoping evidence (no persistent ?chatId= while incognito) strongly implies a refresh would lose the conversation, consistent with \"not saved\", but this exact scenario was not run.",
     "discovery-evidence/memory-incognito-test/incognito-verified-results.json"],
]
fill_sheet(ws_nt, nt_headers, nt_rows, [46, 12, 50, 50, 46])

# ===========================================================================
# SHEET 0: Summary (front)
# ===========================================================================
ws0 = wb.create_sheet("Summary", 0)
ws0["A1"] = "Thaura AI — SQA Assessment — Test & Bug Report"
ws0["A1"].font = Font(size=14, bold=True)
ws0["A3"] = "Prepared for"; ws0["B3"] = "Qtec Solutions Limited — SQA Engineer Assessment"
ws0["A4"] = "Application"; ws0["B4"] = "Thaura AI (https://thaura.ai)"
ws0["A5"] = "Assessment window"; ws0["B5"] = "2026-09-14 to 2026-09-15"
ws0["A7"] = "Sheet"; ws0["B7"] = "Count"
ws0["A7"].font = Font(bold=True); ws0["B7"].font = Font(bold=True)
ws0["A8"] = "Test Cases / Results"; ws0["B8"] = len(tc_rows)
ws0["A9"] = "Bugs (reproducible defects)"; ws0["B9"] = len(bug_rows)
ws0["A10"] = "Observations"; ws0["B10"] = len(obs_rows)
ws0["A11"] = "Security Observations"; ws0["B11"] = len(sec_rows)
ws0["A12"] = "Not Tested / Blocked"; ws0["B12"] = len(nt_rows)
ws0["A14"] = ("Classification policy: only reproducible deviations from expected behavior with demonstrated impact "
              "are listed as Bugs. Interesting-but-unproven technical behavior is listed as an Observation. Potential "
              "security concerns without demonstrated exploitable impact are listed as Security Observations, not "
              "escalated as vulnerabilities. No exploitable security vulnerability was identified within the scope of "
              "the security checks performed; this does not constitute a complete security audit.")
ws0["A14"].alignment = Alignment(wrap_text=True)
ws0.merge_cells("A14:D14")
ws0.row_dimensions[14].height = 90
ws0["A16"] = "API Funding Decision:"; ws0["A16"].font = Font(bold=True)
ws0["B16"] = "DO NOT FUND — sufficient zero-balance evidence obtained; remaining tests are billing-gated and lower-value relative to the platform's $10 minimum top-up."
ws0["B16"].alignment = Alignment(wrap_text=True)
ws0.merge_cells("B16:D16")
ws0.row_dimensions[16].height = 40
for i, w in enumerate([26, 60, 15, 15], start=1):
    ws0.column_dimensions[get_column_letter(i)].width = w

out_path = "reports/thaura-submission-workbook.xlsx"
wb.save(out_path)
print("Saved:", out_path)
print("Sheets:", wb.sheetnames)
