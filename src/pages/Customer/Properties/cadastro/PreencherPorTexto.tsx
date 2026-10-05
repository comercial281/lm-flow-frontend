// "Preencher a partir de um texto": cola o texto (ou sobe .txt, book em PDF,
// Word ou foto) e os campos do cadastro se preenchem LOCALMENTE, sem IA. Só na
// criação. O texto fica na página porque o "Gerar com IA" da descrição também o usa.
import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { toast } from 'sonner';
import { Loader2, Upload, Wand2 } from 'lucide-react';
import { Button, Textarea } from '@/components/ui/ds';
import { propertiesService, type PropertyFormData } from '@/services/properties/propertiesService';
import { PROPERTY_FEATURES, CONDO_FEATURES } from '@/features/properties/amenities';
import { cleanTypologies } from '@/features/properties/typologies';
import { plural } from '@/lib/formato';
import { FORMULARIO_VAZIO } from '@/features/properties/cadastro/formularioDoCadastro';
import { formularioNovo } from '@/features/properties/formularioPorTipo';
import { validarBook } from './secoes/BlocoDoBook';
import { extractPdfText, extractDocxText, ocrImage, ocrPdfScanned } from './leituraDeArquivo';

interface Props {
  form: PropertyFormData;
  setF: (patch: Partial<PropertyFormData>) => void;
  texto: string;
  /** O `setState` do texto: a leitura de arquivo soma ao que estiver lá quando terminar. */
  aoMudarTexto: Dispatch<SetStateAction<string>>;
  /** Já há book escolhido pro cadastro (o PDF lido não troca o que o corretor escolheu). */
  temBook: boolean;
  /** Guarda o PDF lido como book do empreendimento. */
  aoEscolherBook: (f: File) => void;
}

/** Campo sem valor: vazio, ou ainda no valor de fábrica (o tipo e a transação já nascem marcados). */
export function campoVazio(form: PropertyFormData, k: keyof PropertyFormData): boolean {
  const v = form[k];
  if (v === null || v === undefined || v === '') return true;
  const fabrica = { ...FORMULARIO_VAZIO, ...formularioNovo(form.listing_kind ?? 'resale') };
  return v === fabrica[k];
}

export default function PreencherPorTexto({ form, setF, texto, aoMudarTexto, temBook, aoEscolherBook }: Props) {
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
      let achou = 0;
      // Só preenche campo vazio: o que o corretor já digitou não muda.
      const put = <K extends keyof PropertyFormData>(k: K, v: PropertyFormData[K] | null | undefined) => {
        if (v === null || v === undefined || v === '') return;
        achou++;
        if (campoVazio(form, k)) patch[k] = v;
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
      if (feats.length) { achou++; patch.features = feats; }
      if (condos.length) { achou++; patch.condo_features = condos; }
      // Tipologias achadas no book: só aplica quando veio alguma (não apaga as
      // que o corretor já digitou) e mantém as dele na frente.
      const found = cleanTypologies(r.typologies);
      if (found.length && form.listing_kind === 'development') achou++;
      if (found.length && form.listing_kind === 'development') patch.typologies = [...cleanTypologies(form.typologies), ...found];
      const filled = Object.keys(patch).length;
      if (!achou) { toast.error('Não achei dados reconhecíveis no texto. Revise e preencha manualmente.'); return; }
      if (!filled) { toast.info('Os campos já estavam preenchidos; nada foi trocado.'); return; }
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
    // O PDF vira o book do empreendimento antes de extrair o texto: fica anexado mesmo se não achar texto.
    if (isPdf && form.listing_kind === 'development' && !temBook && validarBook(file) === null) {
      aoEscolherBook(file);
      toast.success('Book anexado: ele sobe junto quando você cadastrar.');
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
      aoMudarTexto(prev => (prev ? `${prev}\n\n${text}` : text));
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
              {form.listing_kind === 'development' && ' O PDF também fica como book do imóvel.'}
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
