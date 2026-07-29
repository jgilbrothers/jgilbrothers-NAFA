# Pre-Merge Synthetic Acceptance Testing

NAFA acceptance fixtures are fictional. They contain obvious labels such as **SYNTHETIC TEST DOCUMENT**, **NOT A REAL RECORD**, account ending `0000`, and `TEST-CASE-001`. They are not valid financial statements or legal process and must never be substituted for original records.

## Archive compatibility and safety policy

Complete project archives use `nafa-archive-v2`. Version 2 places each retained source-file metadata record inside the signed manifest artifact set, including its exact byte size and SHA-256 digest. Metadata also repeats the verified source digest, and restore validates the document ID, filename, MIME type, byte size, upload timestamp, and source digest before using any metadata value.

Version 1 archives are intentionally rejected with instructions to re-export them from a compatible NAFA Ledger build. Version 1 did not checksum-protect file metadata, so silently treating it as version 2 would weaken the integrity boundary.

Restore uses a validation-first, commit-second design. All paths, JSON, sizes, checksums, metadata, extracted text, ID mappings, and destination collisions are validated in memory before a write occurs. Source files and extracted text remain in separate IndexedDB databases, so a single browser transaction cannot span both stores. If a commit-stage storage error occurs, the importer tracks every new record and performs compensating rollback; it reports success only after all records commit.

Browser-oriented archive limits are centralized in `ARCHIVE_LIMITS`: 1 GB compressed archive, 500 documents, 250 MB per source file, 25 MB workspace JSON, 25 MB per extracted-text artifact, 64 KiB per metadata record, 2 GB declared decompressed total, 512-character paths, and a 200:1 maximum per-entry compression ratio. These limits are designed for a private court-preparation workstation while rejecting unreasonable ZIP expansion and deceptive declarations.

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
