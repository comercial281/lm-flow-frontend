import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/ds';

// A barra fixa no pé do cadastro. Fica fora da área que rola (último item da
// coluna da página), então nunca cobre a última seção e respeita a largura do
// menu, como a BarraSalvar.
export default function BarraDoCadastro({ editando, salvando, aoCancelar, aoSalvarRascunho, aoCriar, aoSalvar }: {
  editando: boolean;
  salvando: boolean;
  aoCancelar: () => void;
  aoSalvarRascunho: () => void;
  aoCriar: () => void;
  aoSalvar: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
      {salvando && <Loader2 className="mr-auto h-4 w-4 animate-spin text-muted-foreground" aria-label="Salvando" />}
      <Button type="button" variant="outline" onClick={aoCancelar} disabled={salvando}>Cancelar</Button>
      {editando ? (
        <Button type="button" onClick={aoSalvar} disabled={salvando}>Salvar</Button>
      ) : (
        <>
          <Button type="button" variant="outline" onClick={aoSalvarRascunho} disabled={salvando}>Salvar rascunho</Button>
          <Button type="button" onClick={aoCriar} disabled={salvando}>Criar e escolher onde divulgar →</Button>
        </>
      )}
    </div>
  );
}
