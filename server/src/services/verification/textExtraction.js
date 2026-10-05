// Text extraction for uploaded evidence (PDF, PNG, JPEG).
// PDFs: embedded text first; if a PDF is a scan (little or no text), bounded
// pages are rendered to images before Tesseract.js, whose core interface does
// not read PDFs directly. Images go straight to Tesseract.js.
const path = require('path');
const env = require('../../config/env');

const MAX_PAGES = 10; // NFR03 ten-page limit
const OCR_PAGES = 3; // certificates carry their key fields on the first pages
const MIN_EMBEDDED_TEXT = 40;
// pdfjs expects a forward-slash path with a trailing slash, even on Windows.
const STANDARD_FONTS =
  path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts').replace(/\\/g, '/') + '/';

let pdfjsPromise = null;
const loadPdfjs = () => (pdfjsPromise ||= import('pdfjs-dist/legacy/build/pdf.mjs'));

let workerPromise = null;
async function getOcrWorker() {
  if (!workerPromise) {
    const { createWorker } = require('tesseract.js');
    // Language data is downloaded once and cached locally.
    workerPromise = createWorker('eng', 1, {
      cachePath: path.join(env.serverRoot, '.tesseract-cache'),
    }).catch((err) => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

async function ocrImage(buffer) {
  const worker = await getOcrWorker();
  const { data } = await worker.recognize(buffer);
  return { text: data.text || '', confidence: data.confidence ?? null };
}

async function openPdf(buffer) {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    standardFontDataUrl: STANDARD_FONTS,
  });
  const pdf = await task.promise;
  // pdfjs v6 releases resources through the loading task.
  pdf.close = () => task.destroy();
  return pdf;
}

// Rebuilds reading-order lines from positioned text items.
function itemsToLines(items) {
  const rows = [];
  for (const item of items) {
    if (!item.str || !item.str.trim()) continue;
    const y = Math.round(item.transform[5]);
    let row = rows.find((r) => Math.abs(r.y - y) <= 3);
    if (!row) {
      row = { y, parts: [] };
      rows.push(row);
    }
    row.parts.push({ x: item.transform[4], str: item.str });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((r) =>
      r.parts
        .sort((a, b) => a.x - b.x)
        .map((p) => p.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .join('\n');
}

async function renderPage(page) {
  const { createCanvas } = require('@napi-rs/canvas');
  const viewport = page.getViewport({ scale: 2 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, canvas, viewport }).promise;
  return canvas.toBuffer('image/png');
}

/** Returns the number of pages, or 1 for images. Used to enforce the page limit. */
async function countPages(buffer, mimeType) {
  if (mimeType !== 'application/pdf') return 1;
  const pdf = await openPdf(buffer);
  const pages = pdf.numPages;
  await pdf.close();
  return pages;
}

/**
 * @returns {Promise<{text: string, method: 'pdf-text'|'pdf-ocr'|'image-ocr', pages: number, confidence: number|null}>}
 */
async function extractText(buffer, mimeType) {
  if (mimeType !== 'application/pdf') {
    const { text, confidence } = await ocrImage(buffer);
    return { text, method: 'image-ocr', pages: 1, confidence };
  }

  const pdf = await openPdf(buffer);
  try {
    if (pdf.numPages > MAX_PAGES) throw new Error(`PDF has ${pdf.numPages} pages; the limit is ${MAX_PAGES}.`);
    const pageTexts = [];
    for (let n = 1; n <= pdf.numPages; n += 1) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      pageTexts.push(itemsToLines(content.items));
    }
    const embedded = pageTexts.join('\n').trim();
    if (embedded.replace(/\s/g, '').length >= MIN_EMBEDDED_TEXT) {
      return { text: embedded, method: 'pdf-text', pages: pdf.numPages, confidence: null };
    }

    // Scanned PDF: render the first pages and OCR them.
    const ocrTexts = [];
    const confidences = [];
    for (let n = 1; n <= Math.min(pdf.numPages, OCR_PAGES); n += 1) {
      const image = await renderPage(await pdf.getPage(n));
      const { text, confidence } = await ocrImage(image);
      ocrTexts.push(text);
      if (confidence != null) confidences.push(confidence);
    }
    return {
      text: ocrTexts.join('\n'),
      method: 'pdf-ocr',
      pages: pdf.numPages,
      confidence: confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : null,
    };
  } finally {
    await pdf.close();
  }
}

async function shutdown() {
  if (workerPromise) {
    const worker = await workerPromise.catch(() => null);
    workerPromise = null;
    if (worker) await worker.terminate();
  }
}

module.exports = { extractText, countPages, shutdown, MAX_PAGES };
