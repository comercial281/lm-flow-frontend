// Book (PDF) do imóvel, dentro de "Fotos e vídeos". Na criação o arquivo fica
// escolhido e sobe depois de criar o imóvel; na edição grava na hora e devolve
// o imóvel atualizado. Empreendimento sobe/troca; revenda só vê/remove.
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { FileText, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { useAlteracoesNaoSalvas } from '@/hooks/useAlteracoesNaoSalvas';
import { propertiesService, type Property } from '@/services/properties/propertiesService';
import PropertyBookDialog from '@/components/properties/PropertyBookDialog';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { numero } from '@/lib/formato';

const LIMITE_MB = 200;
const LIMITE_BYTES = LIMITE_MB * 1024 * 1024;

/** Mensagem de erro do arquivo escolhido, ou null quando ele serve de book. */
export function validarBook(file: File): string | null {
  const ehPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!ehPdf) return 'O book precisa ser um PDF';
  if (file.size > LIMITE_BYTES) return `O book passa de ${LIMITE_MB} MB`;
  return null;
}

interface Props {
  kind: 'development' | 'resale' | string;
  editando: Property | null;
  book: File | null;
  aoMudarBook: (f: File | null) => void;
  aoMudarImovel: (p: Property) => void;
  desabilitado?: boolean;
}

export default function BlocoDoBook({ kind, editando, book, aoMudarBook, aoMudarImovel, desabilitado }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [verAberto, setVerAberto] = useState(false);
  const [progresso, setProgresso] = useState<number | null>(null);
  const [removendo, setRemovendo] = useState(false);

  const enviando = progresso !== null;
  // Sair da tela com envio/remoção em andamento perde o resultado: pergunta antes.
  // (O hook registra por id de instância, então convive com o da página.)
  useAlteracoesNaoSalvas(enviando || removendo);

  const empreendimento = kind === 'development';
  const temBook = !!editando?.has_book;
  // Revenda: só aparece quando já há book (e só na edição).
  if (!empreendimento && !temBook) return null;

  const travado = !!desabilitado || enviando || removendo;

  const escolher = (file: File | undefined) => {
    if (!file) return;
    const erro = validarBook(file);
    if (erro) { toast.error(erro); return; }
    if (!editando) { aoMudarBook(file); return; }
    void enviar(editando, file);
  };

  const enviar = async (imovel: Property, file: File) => {
    const tinha = !!imovel.has_book;
    setProgresso(0);
    try {
      const atualizado = await propertiesService.uploadBook(imovel.id, file, setProgresso);
      aoMudarImovel(atualizado);
      toast.success(tinha ? 'Book atualizado' : 'Book salvo');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não consegui enviar o book'));
    } finally {
      setProgresso(null);
    }
  };

  const remover = async () => {
    if (!editando) return;
    if (!(await confirmar({
      titulo: 'Remover book',
      descricao: <>Remover o book de <strong>{editando.title}</strong>?</>,
      rotuloDaAcao: 'Remover',
      destrutivo: true,
    }))) return;
    setRemovendo(true);
    try {
      aoMudarImovel(await propertiesService.removeBook(editando.id));
      toast.success('Book removido');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não consegui remover o book'));
    } finally {
      setRemovendo(false);
    }
  };

  const botaoSubir = (rotulo: string) => (
    <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={travado} className="gap-1">
      <Upload className="h-4 w-4" />
      {rotulo}
    </Button>
  );

  return (
    <div className="mt-4 rounded-lg border p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <FileText className="h-4 w-4" />
        Book
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        data-testid="entrada-do-book"
        onChange={e => { escolher(e.target.files?.[0]); e.target.value = ''; }}
      />

      {editando ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {temBook && <span className="flex-1 truncate text-sm">{editando.book_file_name || 'book.pdf'}</span>}
          {enviando && (
            <span role="status" className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {progresso === 100 ? 'Guardando o book…' : `Enviando… ${progresso}%`}
            </span>
          )}
          {temBook ? (
            <>
              <Button type="button" size="sm" variant="secondary" onClick={() => setVerAberto(true)} disabled={travado}>Ver book</Button>
              {empreendimento && botaoSubir('Trocar')}
              <Button type="button" size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={remover} disabled={travado}>
                Remover
              </Button>
            </>
          ) : botaoSubir('Subir book (PDF)')}
        </div>
      ) : book ? (
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className="flex-1 truncate">{book.name}</span>
          <span className="text-xs text-muted-foreground">{numero(book.size / 1024 / 1024, 1)} MB</span>
          <Button type="button" size="sm" variant="outline" onClick={() => aoMudarBook(null)} disabled={travado}>Remover</Button>
        </div>
      ) : (
        <div className="mt-2">{botaoSubir('Subir book (PDF)')}</div>
      )}

      {!editando && (
        <p className="mt-2 text-xs text-muted-foreground">O book é o PDF que a IA e o corretor mandam no chat.</p>
      )}
      {verAberto && editando && <PropertyBookDialog property={editando} onClose={() => setVerAberto(false)} />}
      {dialogoDeConfirmacao}
    </div>
  );
}
