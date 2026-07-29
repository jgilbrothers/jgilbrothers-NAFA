# NAFA Ledger Controlled Private-Use Acceptance Checklist

Use synthetic records first. Keep original real records backed up outside the browser.

1. **New blank project:** Create a project. Expect zero accounts, documents, transactions, and unresolved reviews.
2. **Upload and storage:** Upload each supported fixture. Expect one source-document record, a SHA-256 checksum, and “stored” status. Upload identical bytes under another name; expect a duplicate warning.
3. **Preview and reopen:** Preview the original, close the tab, reopen NAFA, and switch away/back. Expect the original to remain available on the same browser/profile.
4. **Text PDF:** Read a searchable PDF. Expect PDF.js, exact page mapping, preserved empty pages, and no OCR claim.
5. **Scanned and mixed PDF:** Read the PDF, then OCR pages without text. Expect page-level results, confidence, progress, and review warnings. Cancelling must preserve prior text.
6. **Image OCR:** OCR PNG/JPG/WebP fixtures. Expect local Tesseract, visible confidence, and no automatic transaction totals.
7. **TXT/DOCX:** Read fixtures. Expect ordered text and extraction-engine metadata.
8. **CSV/XLSX:** Open each fixture. Expect reviewable sheets/rows; no rows affect totals until confirmed.
9. **Unsupported file:** Upload it. Expect “Stored but not readable automatically” and a visible review item.
10. **Candidate review:** Confirm, correct, exclude, and dispute separate synthetic candidates. Expect only confirmed/corrected rows in totals, charts, reports, summaries, and analysis.
11. **Source references:** Open a report row. Expect document ID, excerpt, engine, timestamp, and an exact page only when mapping is exact.
12. **Legal separation:** Process allegation/finding/order fixtures. Expect separate candidate types; none are accepted without review.
13. **Complete archive:** Export `.nafa.zip`, create a new project, then import. Expect metadata, originals, extracted page text, and checksums to restore without overwriting another project.
14. **Checksum failure:** Alter a copy of an archive entry. Expect import rejection naming the affected document without claiming restoration.
15. **Missing file:** Remove a source entry from a test archive. Expect import rejection or explicit unavailable status.
16. **Mobile:** Test upload, preview, review, and archive download. Expect readable controls; use desktop for large OCR jobs.
17. **Offline:** Load once online so app/OCR assets are cached, disconnect, reopen, and test cached functions. Expect clear failures for any asset not yet cached and no claim of full offline readiness.
