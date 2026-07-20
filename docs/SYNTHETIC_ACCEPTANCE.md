# Pre-Merge Synthetic Acceptance Testing

NAFA acceptance fixtures are fictional. They contain obvious labels such as **SYNTHETIC TEST DOCUMENT**, **NOT A REAL RECORD**, account ending `0000`, and `TEST-CASE-001`. They are not valid financial statements or legal process and must never be substituted for original records.

## Fixture inventory

`test/fixtures/synthetic/` contains:

- a two-page selectable-text PDF statement;
- a two-page image-only PDF statement for local OCR;
- a receipt PNG;
- a fictional DOCX order with separate allegation, finding, and order language;
- a narrative-only DOCX that must not produce findings or orders;
- an XLSX workbook with `Transactions`, `Accounts`, and `Notes` sheets, a title row, blank row, malformed amount, duplicate row, and formula;
- CSV variants covering quoted commas, debit/credit columns, alternate dates, blank cells, malformed rows, and UTF-8 text;
- `expected.json`, which records the expected synthetic facts and important tolerant OCR tokens.

The generator is `scripts/generate-synthetic-fixtures.mjs`. Image conversion requires Poppler's `pdftoppm`; normal users do not need to regenerate committed fixtures.

## Automated checks

```bash
npm install
npm run lint
npm run test
npm run build
npm audit --omit=dev
```

The suite checks SHA-256, duplicate hashes, secure-context failure messaging, exact PDF page retention, image-only PDF detection, local/same-origin asset paths, DOCX legal classification, XLSX sheet/header/source-row behavior, CSV quoting, archive scope, source-byte preservation, structured-data arrays, ID remapping, malformed archives, missing sources, and checksum rejection.

## Browser acceptance

Build and serve the same production output used by Cloudflare Pages:

```bash
npm run build
npm run preview -- --host 127.0.0.1
```

Using a clean browser profile, create a blank synthetic project and upload every fixture through the visible Documents UI. Confirm that:

1. source bytes are retained and duplicate bytes are detected by hash;
2. text-PDF pages and transaction source references remain exact;
3. only selected scanned-PDF pages are sent to bundled local Tesseract;
4. allegations, findings, and orders remain visibly distinct;
5. XLSX sheet and header selection preserves original row numbers, including rows after blanks;
6. unconfirmed candidates do not enter verified calculations;
7. `.nafa.zip` export/import restores original bytes, extracted text, structured data, review state, and hashes;
8. a modified manifest, missing source, or bad checksum is rejected;
9. refresh does not duplicate documents or candidates;
10. browser network logs contain no uploaded document content sent to Gemini, Google AI, OpenAI, or another cloud-AI endpoint.

Repeat a reduced suite at the Cloudflare branch preview over HTTPS. Verify PDF.js and Tesseract worker, core, language, and font assets resolve from that preview's own origin.

## Review and limitations

- Extraction may contain errors. Retain and inspect original documents and verify every candidate before relying on it.
- OCR timing and accuracy vary by browser, CPU, image quality, rotation, and contrast. One synthetic fixture does not establish general performance.
- DOCX does not provide reliable PDF-style page boundaries.
- SHA-256 requires Web Crypto in a secure context: HTTPS or localhost.
- Archives are checksum-verified but unencrypted. Store them as sensitive material.
- NAFA is intended for controlled private use. It is not court-certified, legally validated, infallible, or guaranteed accurate.
