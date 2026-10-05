// Leitura de arquivo no navegador (PDF, Word, foto) pra "Preencher a partir de um texto".
// Tudo via CDN, sem IA. Fica à parte pra o teste poder trocá-la.

// Carrega um script UMD do CDN uma vez (usado pelo mammoth pra ler .docx).
const loadScriptOnce = (src: string) =>
  new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('script load failed'));
    document.head.appendChild(s);
  });

// Extrai o texto de um PDF no navegador (pdf.js via CDN). Vazio = PDF escaneado.
export const extractPdfText = async (buf: ArrayBuffer): Promise<string> => {
  const cdnBase = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build';
  // specifier em variável: o TS não tenta resolver o módulo do CDN (não é dep local)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjs: any = await import(/* @vite-ignore */ `${cdnBase}/pdf.min.mjs`);
  pdfjs.GlobalWorkerOptions.workerSrc = `${cdnBase}/pdf.worker.min.mjs`;
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const pages = Math.min(pdf.numPages, 30);
  let text = '';
  for (let p = 1; p <= pages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    text += content.items.map((it: any) => it.str ?? '').join(' ') + '\n';
  }
  return text.trim();
};

// Extrai o texto de um .docx (Word) no navegador (mammoth via CDN).
export const extractDocxText = async (buf: ArrayBuffer): Promise<string> => {
  await loadScriptOnce('https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mammoth = (window as any).mammoth;
  const out = await mammoth.extractRawText({ arrayBuffer: buf });
  return String(out?.value ?? '').trim();
};

// OCR em português (Tesseract via CDN) — foto ou PDF escaneado (sem camada de texto).
export const ocrImage = async (img: Blob | HTMLCanvasElement): Promise<string> => {
  await loadScriptOnce('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Tesseract = (window as any).Tesseract;
  const { data } = await Tesseract.recognize(img, 'por');
  return String(data?.text ?? '').trim();
};

// PDF escaneado: renderiza cada página num canvas e passa por OCR (lento — limita 5 págs).
export const ocrPdfScanned = async (buf: ArrayBuffer): Promise<string> => {
  const cdnBase = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjs: any = await import(/* @vite-ignore */ `${cdnBase}/pdf.min.mjs`);
  pdfjs.GlobalWorkerOptions.workerSrc = `${cdnBase}/pdf.worker.min.mjs`;
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const pages = Math.min(pdf.numPages, 5);
  let text = '';
  for (let p = 1; p <= pages; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, viewport }).promise;
    text += `${await ocrImage(canvas)}\n`;
  }
  return text.trim();
};
