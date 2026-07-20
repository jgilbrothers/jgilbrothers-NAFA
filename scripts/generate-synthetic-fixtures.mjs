import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import JSZip from 'jszip';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';

const output = process.env.SYNTHETIC_OUTPUT || new URL('../test/fixtures/synthetic/', import.meta.url).pathname;
const build = process.env.SYNTHETIC_BUILD || new URL('../test/fixtures/.build/', import.meta.url).pathname;
await mkdir(output, { recursive: true });
await mkdir(build, { recursive: true });

const disclaimer = 'SYNTHETIC TEST DOCUMENT — NOT A REAL RECORD — NOT FOR COURT USE';
const savePdf = async (name, drawPages) => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  await drawPages(pdf, font);
  await writeFile(join(output, name), await pdf.save());
};

const drawLines = (page, font, lines, options = {}) => {
  let y = options.y || 735;
  for (const line of lines) {
    page.drawText(line, { x: options.x || 45, y, size: options.size || 10, font, color: options.color || rgb(0.08, 0.1, 0.14), rotate: options.rotate || degrees(0) });
    y -= options.leading || 22;
  }
};

await savePdf('synthetic-text-bank-statement.pdf', async (pdf, font) => {
  const pages = [
    [disclaimer, 'EXAMPLE BANK — Statement for Example Person — account ending 0000', 'Statement period: 2026-01-28 through 2026-02-28', 'Opening balance: $1,250.00', '01/29/2026 Deposit — Example Payroll +$900.00', '01/30/2026 Purchase — Example Market -$42.18', '01/31/2026 Transfer — Example Savings -$100.00', 'Page 1 of 2'],
    [disclaimer, 'EXAMPLE BANK — account ending 0000', '02/01/2026 Purchase — Example Market -$18.55', '02/03/2026 Fee — Monthly test fee -$5.00', '02/10/2026 Purchase — AMBIGUOUS TEST ENTRY -$27.40', '02/12/2026 Refund — Example Market +$10.00', '02/20/2026 Transfer — Example Savings +$75.00', 'Closing balance: $2,041.87', 'Page 2 of 2'],
  ];
  pages.forEach(lines => drawLines(pdf.addPage([612, 792]), font, lines));
});

await savePdf('synthetic-scan-page-source.pdf', async (pdf, font) => {
  const first = pdf.addPage([612, 792]);
  drawLines(first, font, [disclaimer, 'NOT A REAL BANK STATEMENT — EXAMPLE BANK — ending 0000', 'SCAN PAGE ONE', '03/01/2026 Example Grocery -$24.10', '03/02/2026 Example Fuel -$30.00', '03/03/2026 Example Deposit +$500.00', 'Page 1 of 2'], { rotate: degrees(0.8) });
  const second = pdf.addPage([612, 792]);
  drawLines(second, font, [disclaimer, 'NOT A REAL BANK STATEMENT — EXAMPLE BANK — ending 0000', 'SCAN PAGE TWO', '03/04/2026 Example Pharmacy -$12.25', '03/05/2026 Example Refund +$4.00', '03/06/2026 Example Utility -$80.00'], {});
  drawLines(second, font, ['LOW CONTRAST TEST SECTION — REVIEW REQUIRED', 'Page 2 of 2'], { y: 560, color: rgb(0.55, 0.55, 0.55) });
});

await savePdf('synthetic-receipt-source.pdf', async (pdf, font) => {
  drawLines(pdf.addPage([360, 600]), font, [disclaimer, 'EXAMPLE CORNER MARKET', 'Date: 2026-03-07', 'Test Item Alpha  $3.00', 'Test Item Beta   $4.50', 'Test Item Gamma  $2.00', 'Subtotal          $9.50', 'Tax               $0.76', 'TOTAL            $10.26', 'Payment: TEST CARD ending 0000'], { x: 24, y: 560, size: 11, leading: 32 });
});

const makeDocx = async (name, paragraphs) => {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  const xml = paragraphs.map(text => `<w:p><w:r><w:t>${text.replaceAll('&', '&amp;')}</w:t></w:r></w:p>`).join('');
  zip.file('word/document.xml', `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${xml}</w:body></w:document>`);
  await writeFile(join(output, name), await zip.generateAsync({ type: 'uint8array' }));
};

await makeDocx('synthetic-legal-order.docx', [disclaimer, 'FICTIONAL EXAMPLE TRIBUNAL — TEST-CASE-001', 'Party allegation (paragraph 1): Example Person alleges a test transfer was omitted.', 'Opposing-party allegation (paragraph 2): Example Respondent disputes that allegation.', 'Court finding (paragraph 3): The court finds only that the synthetic account exists for testing.', 'Ordered action (paragraph 4): It is ordered that Example Person shall preserve the synthetic records.', 'Effective date: 2026-04-01', 'Judge label: Example Judge — FICTIONAL']);
await makeDocx('synthetic-legal-narrative-no-order.docx', [disclaimer, 'TEST-CASE-002 — NARRATIVE ONLY', 'Example Person alleges a test payment was late.', 'Example Respondent disputes the claim.', 'These are unverified allegations. This document contains no court finding and no operative order.']);

const xmlEscape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;');
const sheetXml = rows => `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((row, r) => `<row r="${r + 1}">${row.map((cell, c) => cell?.formula ? `<c r="${String.fromCharCode(65 + c)}${r + 1}"><f>${cell.formula}</f><v>${cell.value}</v></c>` : `<c r="${String.fromCharCode(65 + c)}${r + 1}" t="inlineStr"><is><t>${xmlEscape(cell ?? '')}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`;
const xlsx = new JSZip();
xlsx.file('[Content_Types].xml', `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${[1,2,3].map(i => `<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
xlsx.file('_rels/.rels', `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
xlsx.file('xl/workbook.xml', `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${['Transactions','Accounts','Notes'].map((name, i) => `<sheet name="${name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`);
xlsx.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${[1,2,3].map(i => `<Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`).join('')}</Relationships>`);
xlsx.file('xl/worksheets/sheet1.xml', sheetXml([['SYNTHETIC TRANSACTION WORKBOOK — NOT REAL'], ['Date','Description','Debit','Credit'], ['2026-05-01','Example Market','12.00',''], ['2026-05-02','Example Deposit','','200.00'], [], ['2026-05-03','Malformed Test','NOT-A-NUMBER',''], ['2026-05-01','Example Market','12.00',''], ['2026-05-04','Formula Test',{ formula: '10+5', value: 15 },'']]));
xlsx.file('xl/worksheets/sheet2.xml', sheetXml([['Account','Ending'],['Example Checking','0000']]));
xlsx.file('xl/worksheets/sheet3.xml', sheetXml([[disclaimer],['Review all candidates before confirmation.']]));
await writeFile(join(output, 'synthetic-financial-workbook.xlsx'), await xlsx.generateAsync({ type: 'uint8array' }));

await writeFile(join(output, 'synthetic-comma.csv'), `${disclaimer}\nDate,Description,Amount\n2026-06-01,Example Merchant,-12.34\n2026-06-02,"Quoted description, with comma",5.00\n`);
await writeFile(join(output, 'synthetic-debit-credit.csv'), `${disclaimer}\nDate,Description,Debit,Credit\n06/03/2026,Example Utility,75.00,\n2026-06-04,Example Refund,,10.00\n,Blank date test,4.00,\nmalformed-row\n2026-06-05,Café Example UTF-8,3.50,\n`);
await writeFile(join(output, 'expected.json'), JSON.stringify({ disclaimer, textPdf: { pages: 2, accountEnding: '0000', statementPeriod: ['2026-01-28','2026-02-28'], transactionCount: 9, closingBalance: 2041.87 }, scannedPdf: { pages: 2, importantTokens: ['EXAMPLE BANK','SCAN PAGE ONE','SCAN PAGE TWO','03/06/2026'] }, receipt: { merchant: 'EXAMPLE CORNER MARKET', date: '2026-03-07', total: 10.26, ending: '0000' }, legalOrder: { caseId: 'TEST-CASE-001', kinds: ['allegation','finding','order'] }, legalNarrative: { caseId: 'TEST-CASE-002', forbiddenKinds: ['finding','order'] }, workbook: { sheets: ['Transactions','Accounts','Notes'], headerRow: 2, candidateRows: [3,4,6,7,8] } }, null, 2));

if (process.argv.includes('--finalize-images')) {
  const scanPdf = await PDFDocument.create();
  for (const name of ['scan-page-1.png', 'scan-page-2.png']) {
    const image = await scanPdf.embedPng(await readFile(join(build, name)));
    const page = scanPdf.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }
  await writeFile(join(output, 'synthetic-scanned-bank-statement.pdf'), await scanPdf.save());
  await writeFile(join(output, 'synthetic-receipt.png'), await readFile(join(build, 'receipt.png')));
  await rm(join(output, 'synthetic-scan-page-source.pdf'));
  await rm(join(output, 'synthetic-receipt-source.pdf'));
}
