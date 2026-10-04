import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ImagePlus, Loader2, Send, X } from 'lucide-react';
import { Button, Textarea } from '@/components/ui/ds';
import { juntarImagens } from './imagensSuporte';

interface Props {
  onEnviar: (body: string, imagens: File[]) => Promise<void>;
  placeholder?: string;
  /** Abrir chamado: a primeira mensagem precisa de texto. */
  exigeTexto?: boolean;
  /** Algo ao lado do Enviar (no admin: "Resolver"). */
  extra?: ReactNode;
  /** Texto que já entra escrito (a busca sem resultado do Início). */
  textoInicial?: string;
}

/**
 * Caixa de texto do chat de suporte (cliente e admin). Aceita print colado
 * (Ctrl+V) e anexado. Só limpa quando o envio deu certo: falhou, o texto fica.
 */
export default function SupportComposer({ onEnviar, placeholder = 'Escreva sua mensagem', exigeTexto, extra, textoInicial }: Props) {
  const [texto, setTexto] = useState(textoInicial ?? '');
  const [imagens, setImagens] = useState<File[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  const miniaturas = useMemo(() => imagens.map(f => ({ f, url: URL.createObjectURL(f) })), [imagens]);
  useEffect(() => () => miniaturas.forEach(m => URL.revokeObjectURL(m.url)), [miniaturas]);

  const adicionar = (novas: File[]) => {
    if (!novas.length) return;
    const r = juntarImagens(imagens, novas);
    setImagens(r.imagens);
    setErro(r.erro);
  };

  const podeEnviar = !enviando && (texto.trim().length > 0 || (!exigeTexto && imagens.length > 0));

  const enviar = async () => {
    if (!podeEnviar) return;
    setEnviando(true);
    try {
      await onEnviar(texto.trim(), imagens);
      setTexto('');
      setImagens([]);
      setErro(null);
    } catch {
      // Quem chamou mostra o erro (toast); aqui só não perde o que foi escrito.
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-2 border-t border-border p-3">
      {miniaturas.length > 0 && (
        <div className="flex gap-2">
          {miniaturas.map(({ f, url }, i) => (
            <div key={url} className="relative">
              <img src={url} alt={f.name} className="h-14 w-14 rounded-md border border-border object-cover" />
              <button
                type="button"
                aria-label={`Tirar ${f.name}`}
                onClick={() => setImagens(imagens.filter((_, j) => j !== i))}
                className="absolute -right-1.5 -top-1.5 rounded-full bg-foreground p-0.5 text-background"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {erro && <p className="text-xs text-destructive">{erro}</p>}
      <Textarea
        value={texto}
        onChange={e => setTexto(e.target.value)}
        onPaste={e => adicionar(Array.from(e.clipboardData?.files ?? []))}
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void enviar();
        }}
        placeholder={placeholder}
        rows={3}
        maxLength={4000}
      />
      <div className="flex items-center justify-between gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ImagePlus className="h-4 w-4" aria-hidden="true" />
          <span>Imagem</span>
          <input
            ref={arquivo}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            aria-label="Anexar imagem"
            className="sr-only"
            onChange={e => {
              adicionar(Array.from(e.target.files ?? []));
              if (arquivo.current) arquivo.current.value = '';
            }}
          />
        </label>
        <div className="flex items-center gap-2">
          {extra}
          <Button size="sm" onClick={() => void enviar()} disabled={!podeEnviar}>
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar
          </Button>
        </div>
      </div>
    </div>
  );
}
