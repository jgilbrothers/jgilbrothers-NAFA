export const getLocalPdfAssetPaths = () => {
  const base = new URL(`${(import.meta as any).env?.BASE_URL || '/'}pdf/`, window.location.origin).href;
  return { workerSrc: `${base}pdf.worker.min.mjs`, standardFontDataUrl: `${base}standard_fonts/` };
};
export const getLocalPdfWorkerPath = () => getLocalPdfAssetPaths().workerSrc;

export function configurePdfWorker(pdfjs: { GlobalWorkerOptions: { workerSrc: string } }) {
  if (typeof window !== 'undefined' && typeof Worker !== 'undefined') pdfjs.GlobalWorkerOptions.workerSrc = getLocalPdfWorkerPath();
}
