# NAFA Ledger — Private Financial and Evidence Workstation

NAFA Ledger is a browser-based organizational and analytical tool for privately reviewing financial and legal records. It preserves original source files separately from extracted text and requires review before machine-extracted information is treated as verified. It is not a lawyer, financial adviser, court-certified system, or substitute for checking the original record.

## Current capabilities

- Project-scoped accounts, documents, transactions, rules, review items, audit logs, and chat history.
- Original source-file blobs and extracted page text stored separately in IndexedDB.
- SHA-256 source checksums and content-based duplicate warnings.
- PDF.js selectable-text extraction with exact page boundaries.
- Bundled same-origin Tesseract.js OCR for PNG, JPG/JPEG, WebP, and selected scanned-PDF pages. OCR confidence remains visible.
- Central browser-side routes for PDF, images, TXT, CSV, DOCX, XLSX, and unsupported files.
- Reviewable transaction candidates linked to document, page/line, excerpt, engine, confidence, and timestamp.
- Separate legal candidates for allegations, statements, evidence references, findings, and orders.
- Lightweight JSON metadata backup plus a checksum-verified `.nafa.zip` archive engine containing originals and extracted text.
- Static Vite build compatible with Cloudflare Pages.

Only transactions explicitly marked `confirmed` or `corrected` are eligible for verified calculations. Legacy/manual records require review during migration; uncertainty and approximate references must remain labeled.

## What “local” and “offline” mean

Document bytes and extracted text are processed in the browser and are not sent to an OCR or AI service by default. Optional cloud AI is disabled in this private-use phase. The site and OCR language/worker assets must first be downloaded and cached; an initial load, a cache miss, browser eviction, or a service-worker update can require internet access. Browser storage can be cleared, evicted, or isolated by browser profile and site origin, so it is not a replacement for independently backed-up originals.

The service worker caches the application shell and same-origin responses it encounters. It does not guarantee that every OCR asset is available offline. Test the exact browser/device offline before relying on it.

## Status language

- **Uploaded:** the browser accepted the selection.
- **Stored:** the original blob exists in NAFA’s IndexedDB for this browser/site.
- **Previewed:** the browser displayed the original; no reading is implied.
- **Read/extracted:** a named parser produced text, with page mapping and warnings recorded.
- **OCR processed:** Tesseract attempted image recognition; confidence is not verification.
- **Reviewed:** a person evaluated a candidate.
- **Imported:** a transaction record was created.
- **Confirmed/corrected:** the user intentionally approved or corrected the record; only these states may affect verified analysis.

## Install and validate

Requires a maintained Node.js LTS release.

```bash
npm install
npm run lint
npm run test
npm run build
npm run dev
```

Cloudflare Pages settings: build command `npm run build`, output directory `dist`, framework preset `Vite`. Do not add document-analysis API keys to client environment variables.

## Backup formats

- `.nafa-backup.json` is a lightweight, unencrypted metadata backup. It does not contain original blobs or independently stored extracted text.
- `.nafa.zip` is an unencrypted complete project archive format with a versioned manifest, workspace data, original source files, extracted text, and SHA-256 verification. Treat either format as sensitive evidence material and store it securely.

Archive import must create/open a separate project unless the user explicitly confirms replacement. It must not claim a source file was restored when its blob is absent.

## Privacy and security notes

This GitHub repository is public. Never commit real statements, court records, screenshots, extracted text, names, addresses, account numbers, API keys, or `.env` files. Test fixtures must be fictional and privacy-safe. Production code must not log source contents or extracted personal data.

The browser still communicates with the site host to load application assets, and package assets may be fetched during initial setup. No backup is encrypted unless a later implementation explicitly adds authenticated encryption and documents key handling.

## Controlled acceptance

Before real records, follow [the manual acceptance checklist](docs/MANUAL_ACCEPTANCE_CHECKLIST.md) with synthetic fixtures. Begin real-document testing with one low-sensitivity, searchable PDF; verify its checksum, exact pages, extracted text, candidate gating, archive export, and archive restoration into a new project before adding more records.

Known limits: DOCX has no inherent PDF-style page mapping; spreadsheet row confirmation remains intentionally manual; large OCR/archive jobs depend on device memory and can be slow on mobile hardware; OCR assets add roughly 30 MB to a deployment; and generated reports remain organizational work product rather than proof of admissibility.

For the committed fictional fixture inventory, automated coverage, production-browser procedure, Cloudflare preview checks, privacy inspection, and known limitations, see [Pre-Merge Synthetic Acceptance Testing](docs/SYNTHETIC_ACCEPTANCE.md).

The processing libraries are lazy-loaded: PDF.js only for PDF work, Tesseract only when OCR starts, Mammoth only for DOCX, SheetJS only for CSV/XLSX, and JSZip only for complete archives. PDF/OCR workers, language data, cores, and standard fonts are served from the same application origin and can be cached by the service worker after first use.
