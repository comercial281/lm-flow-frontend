// "Preencher a partir de um texto": cola o texto (ou sobe .txt, book em PDF,
// Word ou foto) e os campos do cadastro se preenchem LOCALMENTE, sem IA. Só na
// criação. O texto fica na página porque o "Gerar com IA" da descrição também o usa.
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Upload, Wand2 } from 'lucide-react';
import { Button, Textarea } from '@/components/ui/ds';
import { propertiesService, type PropertyFormData } from '@/services/properties/propertiesService';
import { PROPERTY_FEATURES, CONDO_FEATURES } from '@/features/properties/amenities';
import { cleanTypologies } from '@/features/properties/typologies';
import { plural } from '@/lib/formato';

interface Props {
  form: PropertyFormData;
  setF: (patch: Partial<PropertyFormData>) => void;
  texto: string;
  aoMudarTexto: (texto: string) => void;
}

export default function PreencherPorTexto({ form, setF, texto, aoMudarTexto }: Props) {
  const [aiOpen, setAiOpen]       = useState(false);
  const [aiRunning, setAiRunning] = useState(false);
  const [pdfReading, setPdfReading] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Preenche o formulário a partir de um texto/TXT — 100% LOCAL (sem IA/API).
  // A descrição NÃO é preenchida aqui: é opcional, por botão (handleGenerateDescription).
  const doParseText = async (text: string) => {
    if (!text.trim()) { toast.error('Cole um texto ou envie um .txt do imóvel'); return; }
    setAiRunning(true);
    try {
      const r = await propertiesService.parseText(text);
      const patch: Partial<PropertyFormData> = {};
      const put = <K extends keyof PropertyFormData>(k: K, v: PropertyFormData[K] | null | undefined) => {
        if (v !== null && v !== undefined && v !== '') patch[k] = v;
      };
      if (form.listing_kind !== 'development') put('transaction_type', r.transaction_type);
      put('property_type', r.property_type);
      put('sale_price', r.sale_price);
      put('rent_price', r.rent_price);
      put('condo_fee', r.condo_fee);
      put('iptu', r.iptu);
      put('bedrooms', r.bedrooms);
      put('bathrooms', r.bathrooms);
      put('suites', r.suites);
      put('parking_spaces', r.parking_spaces);
      put('useful_area_m2', r.useful_area_m2);
      put('total_area_m2', r.total_area_m2);
      put('address_neighborhood', r.address_neighborhood);
      put('address_city', r.address_city);
      put('address_state', r.address_state);
      // Características/comodidades: só aplica quando achou algo (não apaga o que o
      // corretor já marcou) e mantém só slugs válidos do catálogo.
      const featSet = new Set(PROPERTY_FEATURES.map(a => a.slug));
      const condoSet = new Set(CONDO_FEATURES.map(a => a.slug));
      const feats = (r.features ?? []).filter(s => featSet.has(s));
      const condos = (r.condo_features ?? []).filter(s => condoSet.has(s));
      if (feats.length) patch.features = feats;
      if (condos.length) patch.condo_features = condos;
      // Tipologias achadas no book: só aplica quando veio alguma (não apaga as
      // que o corretor já digitou) e mantém as dele na frente.
      const found = cleanTypologies(r.typologies);
      if (found.length && form.listing_kind === 'development') patch.typologies = [...cleanTypologies(form.typologies), ...found];
      const filled = Object.keys(patch).length;
      if (!filled) { toast.error('Não achei dados reconhecíveis no texto. Revise e preencha manualmente.'); return; }
      setF(patch);
      toast.success(`Preenchi ${plural(filled, 'campo', 'campos')} do texto. Revise antes de salvar.`);
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      toast.error(msg || 'Não consegui ler o texto.');
    } finally {
      setAiRunning(false);
    }
  };

  const runParseText = () => doParseText(texto.trim());

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
  const extractPdfText = async (buf: ArrayBuffer): Promise<string> => {
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
  const extractDocxText = async (buf: ArrayBuffer): Promise<string> => {
    await loadScriptOnce('https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mammoth = (window as any).mammoth;
    const out = await mammoth.extractRawText({ arrayBuffer: buf });
    return String(out?.value ?? '').trim();
  };

  // OCR em português (Tesseract via CDN) — foto ou PDF escaneado (sem camada de texto).
  const ocrImage = async (img: Blob | HTMLCanvasElement): Promise<string> => {
    await loadScriptOnce('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Tesseract = (window as any).Tesseract;
    const { data } = await Tesseract.recognize(img, 'por');
    return String(data?.text ?? '').trim();
  };

  // PDF escaneado: renderiza cada página num canvas e passa por OCR (lento — limita 5 págs).
  const ocrPdfScanned = async (buf: ArrayBuffer): Promise<string> => {
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

  // TXT, book em PDF, Word ou FOTO: extrai o texto no navegador e preenche os
  // campos LOCALMENTE (sem IA). PDF sem texto (escaneado) e imagens passam por OCR.
  const onPickBook = async (file: File | undefined) => {
    if (!file) return;
    const isTxt = file.type === 'text/plain' || /\.txt$/i.test(file.name);
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const isDocx = /officedocument\.wordprocessingml|\.docx$/i.test(`${file.type} ${file.name}`);
    const isImage = /^image\//i.test(file.type) || /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(file.name);
    if (!isTxt && !isPdf && !isDocx && !isImage) {
      toast.error('Envie um .txt, ou o book em PDF, Word (.docx) ou foto (imagem).');
      return;
    }
    setPdfReading(true);
    try {
      let text = '';
      if (isTxt) {
        text = await file.text();
        if (!text.trim()) { toast.error('Esse .txt está vazio.'); return; }
      } else if (isDocx) {
        text = await extractDocxText(await file.arrayBuffer());
        if (!text) { toast.error('Não achei texto nesse Word.'); return; }
      } else if (isImage) {
        toast.info('Lendo a foto com OCR (pode levar alguns segundos)...');
        text = await ocrImage(file);
        if (!text) { toast.error('Não consegui ler texto nessa foto.'); return; }
      } else {
        // PDF: tenta a camada de texto; se vazio (escaneado), cai pro OCR.
        text = await extractPdfText(await file.arrayBuffer());
        if (!text) {
          toast.info('PDF escaneado: lendo com OCR (pode levar alguns segundos)...');
          text = await ocrPdfScanned(await file.arrayBuffer());
        }
        if (!text) { toast.error('Não consegui extrair texto desse PDF.'); return; }
      }
      aoMudarTexto(texto ? `${texto}\n\n${text}` : text);
      await doParseText(text);
    } catch {
      toast.error('Não consegui ler o arquivo. Tente colar o texto.');
    } finally {
      setPdfReading(false);
    }
  };

  // Preencher a partir de um texto/TXT — 100% local (sem IA/tokens)
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
      <button
        type="button"
        onClick={() => setAiOpen(o => !o)}
        className="flex w-full items-center gap-2 text-sm font-medium text-primary"
      >
        <Wand2 className="h-4 w-4" />
        Preencher a partir de um texto
        <span className="ml-auto text-xs font-normal text-muted-foreground">
          {aiOpen ? 'ocultar' : 'cole o texto ou suba um .txt / book'}
        </span>
      </button>

      {aiOpen && (
        <div className="mt-3 space-y-2">
          <Textarea
            value={texto}
            onChange={e => aoMudarTexto(e.target.value)}
            placeholder="Cole aqui as informações do imóvel (texto do book, anúncio...). Preenche os campos e as características automaticamente, no seu servidor, sem IA. Nada é obrigatório."
            className="min-h-[100px]"
          />

          {/* TXT / book: input escondido + botão que lê no navegador */}
          <input
            ref={pdfInputRef}
            type="file"
            accept="text/plain,.txt,application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*"
            className="hidden"
            onChange={e => { onPickBook(e.target.files?.[0]); e.target.value = ''; }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => pdfInputRef.current?.click()}
            disabled={pdfReading || aiRunning}
          >
            {pdfReading
              ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Lendo o arquivo...</>
              : <><Upload className="mr-1 h-4 w-4" /> Subir .txt, book (PDF, Word ou foto)</>}
          </Button>

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Preenche os campos localmente (sem IA). A descrição é gerada à parte, no botão.
            </p>
            <Button type="button" size="sm" onClick={runParseText} disabled={aiRunning || pdfReading}>
              {aiRunning
                ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Lendo...</>
                : <><Wand2 className="mr-1 h-4 w-4" /> Preencher</>}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
