# Assignment PRD — E‑Invoicing Readiness & Gap Analyzer

**Duration:** 4 days (solo)  
**Stack:** Your choice (must meet HTTP contract)  
**Difficulty:** Medium FE + Medium BE  
**Persistence:** **Required in P0** using **any durable datastore** (PostgreSQL/MySQL/SQLite/MongoDB/Supabase/Firestore/DynamoDB/etc.). In‑memory only is **not** acceptable.  
**Working Tool:** This is a **full working web tool**, not just APIs. A functional UI is **required** and is a major part of grading.

---

## 1) Problem Statement & Outcome
Organizations need a quick way to see how close their invoice data is to a standard (GETS) and what to fix first. Build a tool that:
1) Ingests a small CSV/JSON sample of invoices.  
2) Maps/detects fields against a **mock GETS v0.1** schema (≤25 keys).  
3) Runs **5 rule checks**.  
4) Computes category scores + overall readiness (0–100).  
5) Persists and serves a **JSON report** via shareable URL (survives restart).  
6) Presents results in a **clear, interactive UI** that a non‑developer can understand.

The best entry may be adapted into a public website tool that deep‑links into our **Testbed**.

---

## 2) Scope (P0 / P1 / P2)

### P0 — **Required (must‑have for passing)**
**Frontend (Medium)**
- **3‑step wizard**: (1) Context → (2) Upload/Paste → (3) Results
- **Table preview**: first 20 rows with type badges (number/date/text), empty/error/loading states
- **Coverage panel**: shows **Matched / Close / Missing** vs mock GETS keys
- **Four score bars**: Data, Coverage, Rules, Posture + aggregated **Overall**
- **Rule findings panel**: list of 5 checks with pass/fail; on fail show a concise detail (e.g., offending value or example line)
- **Actions**: Download **Report JSON**; **Copy shareable link** to `GET /report/:id`

**Backend (Medium)**
- **Formats**: accept CSV & JSON (cap parsing at the first **200 rows**)
- **Field detection**: name normalization (lowercase, strip `_`/spaces); simple similarity (contains/startsWith or edit distance) gated by basic type compatibility
- **Rules (5)**:  
  1. TOTALS_BALANCE — `total_excl_vat + vat_amount == total_incl_vat` (±0.01)  
  2. LINE_MATH — `line_total == qty * unit_price` (±0.01); include `exampleLine` when false  
  3. DATE_ISO — `invoice.issue_date` matches `YYYY-MM-DD`  
  4. CURRENCY_ALLOWED — currency ∈ `[AED, SAR, MYR, USD]`; include bad `value` when false  
  5. TRN_PRESENT — `buyer.trn` and `seller.trn` non‑empty
- **Scoring** (ints 0–100): Data(25%) + Coverage(35%) + Rules(30%) + Posture(10%); **Overall** = weighted sum (document your weights)
- **Persistence (DB‑agnostic)**: store uploads/reports in any durable datastore; reports must survive process restarts for **≥7 days**
- **API (must implement)**: `POST /upload`, `POST /analyze`, `GET /report/:reportId` (see §5)
- **Performance**: analyze the provided samples in **≤5s**

**Acceptance Criteria (UI)**
1) Wizard visible with clear progress (Context → Upload → Results)  
2) Table preview (first 20 rows) with type badges  
3) Coverage map rendering Matched/Close/Missing  
4) Four score bars + Overall score  
5) Rule findings list with example where applicable  
6) Download JSON + shareable link UI

---

### P1 — **Nice‑to‑have (earns extra points)**
**AI‑lite clarity & guidance**
- **Close‑match hints**: for each `coverage.close` item, generate a short suggestion (≤120 chars) like “`seller_trn` likely maps to `seller.trn` (name similarity)”. Use any free model, local lib, or simple template logic.
- **Human‑readable rule explanations**: when a rule fails, add a one‑liner fix tip (e.g., “Use ISO dates like `2025-01-31`”).

**Export & sharing**
- **PDF export** of the report (1–2 pages; same content as JSON, simple layout)  
- **Share page**: a minimal read‑only HTML view of report (`/share/:id`) in addition to raw JSON

**Light data management**
- **Recent reports**: `GET /reports?limit=10` + a small UI list/table (date, id, overall score); link to each report/share page
- **Config**: environment‐based config for DB connection & allowed file size (e.g., 5MB)

**Polish**
- **Responsive** layout (mobile & desktop), accessible labels, keyboard focus for primary actions  
- Basic **error boundary**/toasts for upload & analyze steps

---

### P2 — **Stretch (only attempt after P0 works)**
**Cloud & ops**
- **Object storage** for uploads/reports (S3/Supabase/Cloud Storage) via pre‑signed URLs  
- **Email the report link** (SES/SendGrid/Resend) with opt‑in checkbox
- **Serverless analyze** (Lambda/Cloud Run/Functions) to demonstrate scaling path
- **Observability**: minimal request logging + timing metrics; `/health` endpoint returns DB status & storage status

**Product depth**
- **Country presets**: selecting UAE/KSA/MY enables 1–2 extra checks (currency whitelist by country, mandatory TRN lengths) with clear UI labels
- **Mapping skeleton**: downloadable stub JSON mapping `{sourceField -> getsPath}` derived from coverage.matches/close
- **Testbed handoff CTA**: “Open in Testbed” button that packages a normalized payload and explains what will happen (mock deep link is fine)

**UX**
- **Theming**: light/dark toggle; consistent spacing scale; improved empty/edge states  
- **i18n hooks**: extract all UI strings to a single file; default English

---

## 3) Mock GETS v0.1 (Schema Summary)
**Header**: `invoice.id`, `invoice.issue_date` (YYYY‑MM‑DD), `invoice.currency` (AED|SAR|MYR|USD), `invoice.total_excl_vat`, `invoice.vat_amount`, `invoice.total_incl_vat`  
**Seller**: `seller.name`, `seller.trn`, `seller.country` (ISO‑2), `seller.city`  
**Buyer**: `buyer.name`, `buyer.trn`, `buyer.country` (ISO‑2), `buyer.city`  
**Lines**: `lines[].sku`, `lines[].description`, `lines[].qty`, `lines[].unit_price`, `lines[].line_total`

(Reference JSON provided as `gets_v0_1_schema.json`).

---

## 4) Scoring Details
Return **integers** 0–100:
- **Data (25%)** — share of rows parsed; basic type inference success  
- **Coverage (35%)** — matched required fields vs GETS (weight header/seller/buyer slightly higher than lines)  
- **Rules (30%)** — equality‑weighted across the 5 checks  
- **Posture (10%)** — from questionnaire (`webhooks`, `sandbox_env`, `retries`) scaled to 0–100  
- **Overall** — weighted sum; show a readiness label (Low/Med/High) based on your thresholds

Document your exact weights in the README.

---

## 5) API Contract (must implement)
### `POST /upload`
**Body (choose one):**
- Multipart: `file` = CSV/JSON file  
**OR**  
- JSON: `{ "text":"<CSV or JSON string>", "country":"...", "erp":"..." }`

**Response:**
```json
{ "uploadId": "u_xxx" }
```

### `POST /analyze`
**Body:**
```json
{
  "uploadId": "u_xxx",
  "questionnaire": { "webhooks": true, "sandbox_env": true, "retries": false }
}
```
**Response:** Report JSON (see §6) including `"reportId"`.

### `GET /report/:reportId`
**Response:** same Report JSON (read‑only). **Must be returned from your datastore** if present.

### (P1) `GET /reports?limit=10`
Recent report summaries for a small “Recent” list in the UI (optional but recommended).

---

## 6) Report JSON (Schema & Example)
Shape must include keys below; your exact values may vary:

```json
{
  "reportId": "r_123",
  "scores": {
    "data": 0,
    "coverage": 0,
    "rules": 0,
    "posture": 0,
    "overall": 0
  },
  "coverage": {
    "matched": ["buyer.trn", "invoice.id"],
    "close": [
      { "target":"seller.trn", "candidate":"seller_tax_id", "confidence": 0.86 }
    ],
    "missing": ["invoice.currency"]
  },
  "ruleFindings": [
    { "rule":"TOTALS_BALANCE", "ok": true },
    { "rule":"LINE_MATH", "ok": false, "exampleLine": 2, "expected": 120, "got": 118 },
    { "rule":"DATE_ISO", "ok": true },
    { "rule":"CURRENCY_ALLOWED", "ok": false, "value": "EURO" },
    { "rule":"TRN_PRESENT", "ok": true }
  ],
  "gaps": ["Missing buyer.trn", "Invalid currency EURO"],
  "meta": {
    "rowsParsed": 120,
    "linesTotal": 320,
    "country": "UAE",
    "erp": "SAP",
    "db": "postgres"
  }
}
```

---

## 7) Persistence (DB‑agnostic P0 requirement)
- Use **any durable datastore** (Postgres/MySQL/SQLite/MongoDB/Supabase/Firestore/DynamoDB/etc.).  
- Reports must be retrievable **after process restarts** for **≥7 days**.  
- Include `meta.db` in the report (e.g., `"db":"postgres"`) or provide `/health` showing DB type/status.  
- Minimal logical model (example):
  - `uploads`: `{ id, created_at, country, erp, rows_parsed, pii_masked, raw_ref? }`
  - `reports`: `{ id, upload_id, created_at, scores_overall, report_json, expires_at? }`
- Storing the full **report JSON** as a text/blob field is acceptable.

---

## 8) Sample Data (provided)
- `sample_clean.json` — should mostly pass  
- `sample_flawed.csv` — contains: invalid currency `EURO`, invalid date `2025-13-12`, and a line‑math error

---

## 9) Testing & Grading
**Automated (API):** we will hit the 3 endpoints with both samples and validate schema & expected rule outcomes.  
**UI verification:** we will open your **live URL** and verify the **UI Acceptance Criteria** in §P0. (We may use a headless probe to check for wizard steps, table preview, coverage badges, 4 score bars, and a download button.)

**Submission:** Live URL, Repo URL, README (≤400 words; include DB choice/setup), Postman/Bruno or curl, optional Loom.

---

## 10) Evaluation Rubric (100)
- **Correctness (55)** — schema‑true report; clean sample passes all rules; flawed sample flags currency/date/line math; coverage thresholds met  
- **Frontend UX (25)** — meets **UI Acceptance Criteria**; readable; proper error/empty/loading states  
- **Persistence (10)** — durable datastore used; reports retrievable after restart; `meta.db` or `/health` present  
- **Input Safety (5)** — validation; consistent error JSON  
- **DX/Docs (5)** — concise README; working Postman or curl

**Tiebreakers:** code clarity, small focused components/functions, sane commits.

---

## 11) Constraints & Tips
- Limit processing to **≤200 rows** and analyze in **≤5s** for the provided samples.  
- Prefer deterministic outputs: same input → same report.  
- If you add AI (P1/P2), include a flag to **disable** external calls (we may grade offline).  
- Keep the UI straightforward; aim for clarity over fancy effects.

---

## 12) FAQ
**Q:** Can I use any database?  
**A:** Yes. Use what you know: Postgres/MySQL/SQLite/MongoDB/Supabase/Firestore/DynamoDB, etc.

**Q:** What file size limits?  
**A:** 2–5 MB recommended. We’ll only grade the first 200 rows anyway.

Good luck! Build something you’d be happy to use yourself.
