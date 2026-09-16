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

def autosize(ws, widths):
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w

# ---------------------------------------------------------------------------
# Sheet 1: Bugs
# ---------------------------------------------------------------------------
ws = wb.active
ws.title = "Bugs"
bug_headers = ["Bug ID", "Title", "Module", "Severity", "Priority", "Preconditions",
               "Steps to Reproduce", "Expected Result", "Actual Result", "Environment",
               "Evidence", "Request/Response", "Console/Network Evidence", "Status"]
ws.append(bug_headers)
style_header(ws, len(bug_headers))

bugs = [
    [
        "BUG-001",
        "React hydration mismatch (minified error #418) fires on every marketing page load",
        "Frontend - Marketing site (Next.js, all public pages)",
        "Low",
        "Medium",
        "None - reproducible on a clean, unauthenticated page load.",
        "1) Open a fresh browser/incognito session.\n2) Navigate to https://thaura.ai/ (also reproduced on /pricing, /api-platform, /faq).\n3) Open DevTools Console.\n4) Observe the page load complete.",
        "No JavaScript exceptions should be logged to the console during a normal page load. Server-rendered HTML should match the client's initial render (no hydration mismatch).",
        "Console logs: \"Error: Minified React error #418; visit https://react.dev/errors/418...\" - a React hydration-mismatch error, thrown from the app's main JS bundle (_next/static/chunks/3hjxeh11go9q8.js) on every one of the 4 pages audited via Lighthouse (home, pricing, api-platform, faq). Pages remain visually correct and interactive in manual testing (no visible functional break was observed), but the error indicates the server-rendered markup does not match the initial client render, forcing React to discard and re-render the affected subtree client-side.",
        "Chromium (Playwright-driven) + Google Lighthouse CLI, tested against production https://thaura.ai, 2026-09-14/15.",
        "discovery-evidence/lighthouse/home-full-report.json, pricing-full-report.json, api-full-report.json, faq-full-report.json (audits.errors-in-console)",
        "N/A (client-side rendering error, not a network request)",
        "See evidence files - audits.errors-in-console[0] in each Lighthouse report contains the full stack trace (source-mapped chunk + line/column).",
        "Open",
    ],
]
for row in bugs:
    ws.append(row)
    ws.cell(row=ws.max_row, column=1).alignment = Alignment(vertical="top")
for r in range(2, ws.max_row + 1):
    for c in range(1, len(bug_headers) + 1):
        ws.cell(row=r, column=c).alignment = WRAP
autosize(ws, [10, 32, 24, 10, 10, 22, 30, 28, 40, 26, 40, 20, 30, 10])
ws.row_dimensions[2].height = 220

# ---------------------------------------------------------------------------
# Sheet 2: Observations
# ---------------------------------------------------------------------------
ws2 = wb.create_sheet("Observations")
obs_headers = ["Obs ID", "Area", "Observation", "Why Not Classified as a Bug", "Evidence"]
ws2.append(obs_headers)
style_header(ws2, len(obs_headers))

observations = [
    ["OBS-001", "File Upload",
     "A corrupted PNG is accepted by the upload API (200), while a corrupted PDF with the same intent is rejected (400).",
     "The image pipeline treats all images as opaque binaries (no content parsing/OCR at upload time - even valid images just get \"Image file: <name>\"), so a corrupted PNG behaves identically to a valid one from the pipeline's perspective. No crash, no data exposure, no functional impact demonstrated.",
     "discovery-evidence/upload-test/results.json (corrupted_pdf vs corrupted_png)"],
    ["OBS-002", "File Upload",
     "The error message for a password-protected PDF is identical to the generic corrupted-file message (\"may be corrupted, password-protected, or contain only images\").",
     "The message is accurate (it correctly covers the password-protected case) even though it doesn't disambiguate the exact cause. Minor UX clarity note, not a functional defect.",
     "discovery-evidence/upload-test/results.json (password_protected_pdf)"],
    ["OBS-003", "Session Management",
     "Logging out in one browser context also invalidates the session in a second, concurrently-open context on the same account (both return 401 afterward).",
     "This is a stricter, more security-conservative behavior than a per-device session model, not a weaker one. No unauthorized access resulted; if anything, access was reduced beyond what was strictly requested.",
     "discovery-evidence/logout-invalidation-summary.json"],
    ["OBS-004", "Quota",
     "Messages sent while in Incognito mode count against the same 5-message/5-hour free-tier quota as normal messages.",
     "Consistent, expected quota-enforcement behavior; simply not obvious from the UI copy alone, so called out for completeness.",
     "discovery-evidence/memory-incognito-test/incognito-verified-results.json"],
    ["OBS-005", "Memory",
     "A verbal \"please remember this fact\" instruction is not persisted as durable memory across conversations; the assistant explicitly discloses this limitation in its reply.",
     "The assistant does not falsely claim persistence - it states the limitation up front. A separate, genuine automatic memory subsystem exists (Account -> Memory, backed by GET /api/memories); it had not captured anything after our short synthetic test conversations, but was subsequently confirmed working (2026-09-16) when the tester shared a real CV in genuine usage - the store populated with substantive content, phrased oddly as a second-person instruction rather than a neutral summary.",
     "discovery-evidence/memory-incognito-test/full-test-results.json, memory-settings-network-log.json, memory-panel-cv-capture.json"],
    ["OBS-006", "Reliability/Architecture",
     "Interrupting the client connection mid-stream (e.g., a page reload) does not cause the assistant's response to fail - the backend has a resumable-turn architecture (/v1/chat/active-turns) that completes generation server-side and lets the client resume and display the full answer after reconnecting.",
     "This is a positive architectural finding (resilience to dropped connections), included here for completeness rather than because it's a defect.",
     "discovery-evidence/quota-test/failed-response-quota-test.json"],
    ["OBS-007", "Legal/Marketing Wording",
     "Public-facing pages (home, privacy policy, terms) broadly state conversations are \"encrypted at rest (AES-256-GCM)\", while the more detailed Data Processing Addendum specifies application-level field encryption applies to \"selected sensitive fields\" in the primary database (with separate, full disk/object-storage-level encryption described for backups and uploaded files).",
     "This is a precision/wording nuance between marketing copy and a legal annex, not a demonstrated false claim - the DPA describes additional storage-level encryption elsewhere, and we have no way to verify server-side implementation details from the client side. Flagged for legal/copy review, not as a security defect.",
     "discovery-evidence/claims-check/home-text.txt, privacy-policy-text.txt, data-processing-addendum-text.txt"],
    ["OBS-008", "File Upload",
     "Images are not OCR'd or text-extracted at upload time; the upload API records only a generic \"Image file: <name>\" placeholder rather than any parsed content.",
     "This describes the extraction pipeline's documented behavior, not a failure - re-verified 2026-09-16 that the assistant can still read image-embedded text via multimodal vision at chat-turn time (asked to quote text from sample.png, correctly replied with the exact baked-in marker QA-IMG-MARKER-30457), so end-user-visible functionality is unaffected.",
     "discovery-evidence/upload-test/extraction-verification.json, image-ocr-verification.json"],
    ["OBS-009", "Developer API",
     "The documented 8-concurrent-requests-per-key rate limit did not trigger: 9 genuinely concurrent requests (fired via Promise.all, each in-flight ~570-630ms, confirmed non-overlapping with the separately-tested 60/min window) all returned 402 insufficient_balance, none returned 429. The documented 60-requests/minute limit, by contrast, was confirmed exactly - requests 1-60 reached the billing gate, 61-65 were correctly rejected with 429.",
     "Not a security risk - a laxer-than-documented concurrency limit is permissive, not exploitable, and no abuse was demonstrated. This is a discrepancy between the published API contract at thaura.ai/api-platform and observed behavior, flagged for docs/product review rather than as a defect. Only 9 concurrent requests were tried once, to stay within a single safe probe rather than approaching anything resembling load-testing production.",
     "discovery-evidence/api-test/rate-limit-test-results.json, concurrency-test-isolated-results.json"],
    ["OBS-010", "Settings/Account UI",
     "The Settings 'Name' field enforces a genuine maxlength=80 attribute (confirmed by direct attribute inspection), but an 80-character unbroken name overflows the \"Happy Wednesday, {name}\" greeting header and the sidebar profile label - neither has truncation/ellipsis handling for a name at that length.",
     "Length validation itself works correctly (not a data-integrity issue); this is a display/layout polish gap for an edge case (a real name is unlikely to be 80 characters with no spaces). Blank-name submission is correctly blocked (Save button disabled), and a script/HTML injection payload in the same field was fully sanitized with no XSS - both PASS.",
     "discovery-evidence/settings-negative-test/results.json, field-attributes-and-email-check.json, 02-long-name-after-save.png"],
]
for row in observations:
    ws2.append(row)
for r in range(2, ws2.max_row + 1):
    for c in range(1, len(obs_headers) + 1):
        ws2.cell(row=r, column=c).alignment = WRAP
autosize(ws2, [10, 20, 46, 46, 40])

# ---------------------------------------------------------------------------
# Sheet 3: Security Observations
# ---------------------------------------------------------------------------
ws3 = wb.create_sheet("Security Observations")
sec_headers = ["Sec Obs ID", "Area", "Observation", "Exploitability / Impact", "Evidence"]
ws3.append(sec_headers)
style_header(ws3, len(sec_headers))

sec_obs = [
    ["SEC-001", "CSP (Content-Security-Policy)",
     "The main app's CSP connect-src directive includes http://127.0.0.1:* and http://localhost:* alongside the production origins.",
     "No exploitability demonstrated. This is a common leftover from local-development CSP configuration being reused in production. It only matters if an attacker already has a script-injection primitive (e.g. XSS) on the page, which was not found. Not independently actionable on its own.",
     "discovery-evidence/website-scan/security-headers.txt"],
    ["SEC-002", "Session Cookie Lifetime",
     "The thaura_token session cookie has an expiry of approximately 1 year from issuance.",
     "Mitigated by httpOnly + Secure + SameSite=Lax flags (not readable by client-side script, not sent cross-site on unsafe requests). No session-fixation or token-theft impact was demonstrated. Long-lived sessions are a common, deliberate UX choice for consumer apps; flagged for awareness, not as a vulnerability.",
     "discovery-evidence/session-cookies-redacted.json, token-claims-safe.json"],
    ["SEC-003", "Pre-authentication endpoint exposure",
     "GET /api/plugins/list and a handful of bootstrap-type endpoints are reachable without authentication.",
     "Content returned is a public plugin catalog (names/descriptions/icons/URLs) intended for anonymous visitors - not user data. No sensitive information disclosed. Expected/by-design public endpoint, not a vulnerability.",
     "discovery-evidence/auth-requests-redacted.json, signup-step1-requests.json"],
    ["SEC-004", "Client-side error detail / build artifact naming",
     "The React hydration error (see BUG-001) surfaces a minified stack trace referencing internal Next.js build chunk filenames (content-hashed, e.g. 3hjxeh11go9q8.js) in the browser console.",
     "Content-hashed build filenames are standard, intended Next.js output and are not sensitive (no source code, secrets, or internal paths beyond the public static asset structure are exposed). Informational only.",
     "discovery-evidence/lighthouse/home-full-report.json"],
]
for row in sec_obs:
    ws3.append(row)
for r in range(2, ws3.max_row + 1):
    for c in range(1, len(sec_headers) + 1):
        ws3.cell(row=r, column=c).alignment = WRAP
autosize(ws3, [10, 26, 46, 46, 40])

# ---------------------------------------------------------------------------
# Sheet 4: Not Tested / Limitations
# ---------------------------------------------------------------------------
ws4 = wb.create_sheet("Not Tested - Limitations")
nt_headers = ["Item", "Area", "Reason Not Tested", "Evidence / Partial Data"]
ws4.append(nt_headers)
style_header(ws4, len(nt_headers))

not_tested = [
    ["Genuine assistant-side (generation) failure and its effect on quota", "Chat / Quota",
     "Could not be safely and deliberately reproduced without abusive techniques (e.g., adversarial prompts intended to crash the model, or resource-exhaustion attempts), which were explicitly out of scope. Two safe, realistic probes were run instead (simulated dropped connection; malformed request payload) but neither constitutes a genuine assistant-side failure - see gap analysis for full detail.",
     "discovery-evidence/quota-test/failed-response-quota-test.json, malformed-session-request-results.json"],
    ["API: temperature boundary enforcement", "API",
     "Billing-gated - the zero-balance account receives 402 insufficient_balance before any temperature validation/execution logic can run. Funding was evaluated and not recommended (see API Funding Decision).",
     "discovery-evidence/api-test/validation-batch-results.json (API-10 to API-13)"],
    ["API: max_tokens / max_completion_tokens behavior and 32000 cap", "API",
     "Billing-gated, same reason as above.",
     "discovery-evidence/api-test/validation-batch-results.json (API-14, API-15, API-15b)"],
    ["API: max_tokens vs max_completion_tokens precedence", "API",
     "Billing-gated, same reason as above.",
     "discovery-evidence/api-test/validation-batch-results.json (API-17)"],
    ["API: ignored/pass-through parameters (top_p, frequency_penalty, presence_penalty, n, user)", "API",
     "Billing-gated, same reason as above - parameters are accepted at the structural-validation layer, but their effect on generation cannot be observed without a funded call.",
     "discovery-evidence/api-test/validation-batch-results.json (API-20)"],
    ["API: tools / tool_choice function-calling behavior", "API",
     "Billing-gated, same reason as above.",
     "discovery-evidence/api-test/validation-batch-results.json (API-21)"],
    ["API: streaming vs non-streaming response shape", "API",
     "Billing-gated - not reachable without a successful (funded) generation call.",
     "N/A"],
    ["API: usage accounting (token counts / cost reporting)", "API",
     "Billing-gated, same reason as above.",
     "N/A"],
    ["API: rate/concurrency limits", "API",
     "Would require multiple funded, near-simultaneous calls to observe meaningfully; not attempted, both due to lack of balance and to avoid any appearance of a DoS-style probe against production infrastructure.",
     "N/A"],
    ["Incognito behavior specifically under a mid-session refresh", "Incognito",
     "Not directly re-exercised this session under the quota budget; the URL-scoping evidence (no persistent ?chatId= while incognito) strongly implies a refresh would lose the conversation, consistent with \"not saved\", but this exact scenario was not run.",
     "discovery-evidence/memory-incognito-test/incognito-verified-results.json"],
]
for row in not_tested:
    ws4.append(row)
for r in range(2, ws4.max_row + 1):
    for c in range(1, len(nt_headers) + 1):
        ws4.cell(row=r, column=c).alignment = WRAP
autosize(ws4, [46, 18, 60, 46])

# ---------------------------------------------------------------------------
# Sheet 0 (moved to front): Summary
# ---------------------------------------------------------------------------
ws0 = wb.create_sheet("Summary", 0)
ws0["A1"] = "Thaura AI — SQA Assessment Bug & Findings Report"
ws0["A1"].font = Font(size=14, bold=True)
ws0["A3"] = "Generated"
ws0["B3"] = "2026-09-16"
ws0["A4"] = "Application"
ws0["B4"] = "Thaura AI (https://thaura.ai)"
ws0["A5"] = "Tester"
ws0["B5"] = "Qtec Solutions Limited SQA Assessment"
ws0["A7"] = "Sheet"
ws0["B7"] = "Count"
ws0["A7"].font = Font(bold=True)
ws0["B7"].font = Font(bold=True)
ws0["A8"] = "Bugs (reproducible defects)"
ws0["B8"] = len(bugs)
ws0["A9"] = "Observations"
ws0["B9"] = len(observations)
ws0["A10"] = "Security Observations"
ws0["B10"] = len(sec_obs)
ws0["A11"] = "Not Tested / Limitations"
ws0["B11"] = len(not_tested)
ws0["A13"] = "Classification policy: only reproducible deviations from expected behavior with demonstrated impact are listed as Bugs. Interesting-but-unproven technical behavior is listed as an Observation. Potential security concerns without demonstrated exploitable impact are listed as Security Observations, not escalated as vulnerabilities."
ws0["A13"].alignment = Alignment(wrap_text=True)
ws0.merge_cells("A13:D13")
ws0.row_dimensions[13].height = 60
autosize(ws0, [30, 40, 15, 15])

out_path = "reports/thaura-bug-report.xlsx"
wb.save(out_path)
print("Saved:", out_path)
