import { useId, useRef, useState, type DragEvent } from 'react';
import { ImagePlus, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { cn } from '@/lib/utils';

// Caixa grande de imagem do Meu site (logo, ícone da aba), no molde da tela
// "Aparência" do Kenlo: a imagem inteira sobre fundo xadrez (pra ver a
// transparência), Trocar e Remover embaixo. Clique ou arraste o arquivo.
//
// Quem usa decide o que é "enviar" (subir o arquivo e gravar o endereço no
// formulário) e o que é "remover" (gravar null). A caixa cuida do resto: escolher
// o arquivo, conferir tipo (PNG, JPG, WEBP) e tamanho, girar enquanto sobe, avisar se falhou e
// pedir confirmação antes de remover.

// Sem SVG: o armazenamento entrega SVG como download, então ele não apareceria
// nem como imagem no site nem como ícone da aba.
const TIPOS_ACEITOS = ['image/png', 'image/jpeg', 'image/webp'];
const EXTENSOES_ACEITAS = /\.(png|jpe?g|webp)$/i;

const TAMANHO: Record<'logo' | 'icone', string> = {
  logo: 'h-48 w-full max-w-[440px]',
  icone: 'h-32 w-32',
};

// Xadrez cinza e branco: o que é transparente na imagem aparece como xadrez.
const FUNDO_XADREZ = {
  backgroundColor: '#ffffff',
  backgroundImage: 'conic-gradient(#e5e7eb 25%, transparent 0 50%, #e5e7eb 0 75%, transparent 0)',
  backgroundSize: '16px 16px',
};

interface Props {
  /** Nome do que vai na caixa, como na tela: "Logo do site", "Ícone da aba". */
  rotulo: string;
  url: string | null | undefined;
  /** Sobe o arquivo e grava. Lançar erro faz a caixa mostrar o aviso de falha. */
  enviar: (arquivo: File) => Promise<void>;
  /** Grava null no campo. Só é chamado depois da confirmação. */
  aoRemover: () => void;
  confirmacao: { titulo: string; descricao: string };
  variante?: 'logo' | 'icone';
  tamanhoMaximoMb?: number;
}

function aceita(arquivo: File) {
  return TIPOS_ACEITOS.includes(arquivo.type) || (!arquivo.type && EXTENSOES_ACEITAS.test(arquivo.name));
}

export default function EnvioDeImagem({
  rotulo, url, enviar, aoRemover, confirmacao, variante = 'logo', tamanhoMaximoMb = 8,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [imagemQuebrada, setImagemQuebrada] = useState<string | null>(null);
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const idFormatos = useId();

  const nome = rotulo.toLowerCase();
  const temImagem = !!url;
  const icone = variante === 'icone';

  const escolher = () => { if (!enviando) inputRef.current?.click(); };

  const receber = async (arquivo: File | undefined) => {
    if (!arquivo || enviando) return;
    if (!aceita(arquivo)) { setErro('Use uma imagem PNG, JPG ou WEBP.'); return; }
    if (arquivo.size > tamanhoMaximoMb * 1024 * 1024) {
      setErro(`A imagem passa de ${tamanhoMaximoMb} MB. Use uma menor.`);
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      await enviar(arquivo);
    } catch {
      setErro('Não foi possível enviar a imagem. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  };

  const remover = async () => {
    const ok = await confirmar({ ...confirmacao, rotuloDaAcao: 'Remover', destrutivo: true });
    if (!ok) return;
    setErro(null);
    aoRemover();
  };

  const soltar = (e: DragEvent) => {
    e.preventDefault();
    setArrastando(false);
    void receber(e.dataTransfer.files?.[0]);
  };
  const arrastarPorCima = (e: DragEvent) => {
    e.preventDefault();
    if (!arrastando) setArrastando(true);
  };

  const caixa = cn(
    'relative flex items-center justify-center overflow-hidden rounded-xl border-2 transition-colors',
    TAMANHO[variante],
    arrastando ? 'border-primary' : temImagem ? 'border-border' : 'border-dashed border-border',
  );

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept={TIPOS_ACEITOS.join(',')}
        className="hidden"
        aria-label={`Escolher arquivo: ${nome}`}
        onChange={e => {
          const arquivo = e.target.files?.[0];
          e.target.value = '';
          void receber(arquivo);
        }}
      />

      {temImagem ? (
        <div
          className={caixa}
          style={FUNDO_XADREZ}
          onDragOver={arrastarPorCima}
          onDragLeave={() => setArrastando(false)}
          onDrop={soltar}
        >
          {imagemQuebrada === url ? (
            <p className="px-3 text-center text-sm text-muted-foreground">Não deu pra mostrar a imagem.</p>
          ) : (
            <img
              src={url!}
              alt={rotulo}
              className={cn('h-full w-full object-contain', icone ? 'p-3' : 'p-4')}
              onError={() => setImagemQuebrada(url!)}
            />
          )}
          {enviando && <Girando />}
        </div>
      ) : (
        <button
          type="button"
          aria-label={`Enviar ${nome}`}
          aria-describedby={idFormatos}
          disabled={enviando}
          onClick={escolher}
          onDragOver={arrastarPorCima}
          onDragLeave={() => setArrastando(false)}
          onDrop={soltar}
          className={cn(
            caixa,
            'flex-col gap-2 bg-muted/30 px-3 text-center text-muted-foreground hover:border-primary hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait',
          )}
        >
          {enviando ? <Girando /> : (
            <>
              <ImagePlus className={icone ? 'h-6 w-6' : 'h-8 w-8'} aria-hidden />
              <span className={icone ? 'text-xs' : 'text-sm'}>
                {icone ? 'Arraste ou clique' : 'Arraste a imagem aqui ou clique para enviar'}
              </span>
            </>
          )}
        </button>
      )}

      <p id={idFormatos} className="text-xs text-muted-foreground">PNG, JPG ou WEBP, até {tamanhoMaximoMb} MB.</p>

      {temImagem && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={enviando} onClick={escolher}
            aria-label={`Trocar ${nome}`} aria-describedby={idFormatos}>
            <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden /> Trocar
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={enviando} onClick={remover}
            aria-label={`Remover ${nome}`} className="text-destructive hover:text-destructive">
            <Trash2 className="mr-1.5 h-4 w-4" aria-hidden /> Remover
          </Button>
        </div>
      )}

      {erro && <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">{erro}</p>}
      {dialogoDeConfirmacao}
    </div>
  );
}

function Girando() {
  return (
    <span className="absolute inset-0 flex items-center justify-center gap-2 bg-background/70 text-sm text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Enviando...
    </span>
  );
}
