import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Button, Input } from '@/components/ui/ds';
import { CampoDaJanela, GrupoDaJanela } from '@/components/base/janela';
import Aviso from '@/components/base/Aviso';

/**
 * Janela "Publicar página de anúncio" (leva 3 das janelas, lote F): UMA peça só
 * pra publicar pela lista (LandingsPanel) e pelo editor (PublishLandingButton).
 * Só o visual é comum: quem chama decide o que "Publicar" grava.
 */
export default function JanelaPublicarLanding({
  aberta, aoFechar, nome, aoMudarNome, endereco, aoPublicar, ocupado = false, salvaAntes = false, idDoCampo,
}: {
  aberta: boolean;
  aoFechar: () => void;
  nome: string;
  aoMudarNome: (nome: string) => void;
  /** Endereço final já calculado a partir do nome; vazio = ainda não dá pra publicar. */
  endereco: string;
  aoPublicar: () => void;
  ocupado?: boolean;
  /** Há alteração aberta no editor: ela é salva antes de publicar. */
  salvaAntes?: boolean;
  idDoCampo: string;
}) {
  return (
    <Dialog open={aberta} onOpenChange={(v) => { if (!v) aoFechar(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publicar página de anúncio</DialogTitle>
          <DialogDescription>
            O nome vira o endereço da página. É esse link que você cola no anúncio.
          </DialogDescription>
        </DialogHeader>
        <GrupoDaJanela titulo="Página">
          <CampoDaJanela rotulo="Nome da página" htmlFor={idDoCampo} obrigatorio
            ajuda={<span className="break-all font-mono">{endereco || 'Digite um nome para ver o endereço'}</span>}>
            <Input
              id={idDoCampo}
              value={nome}
              onChange={(e) => aoMudarNome(e.target.value)}
              placeholder="Ex.: Lançamento Jardim Europa"
              autoFocus
            />
          </CampoDaJanela>
          {salvaAntes && (
            <Aviso tom="info" compacto>As alterações abertas são salvas antes de publicar.</Aviso>
          )}
        </GrupoDaJanela>
        <DialogFooter>
          <Button variant="outline" onClick={aoFechar}>Cancelar</Button>
          <Button onClick={aoPublicar} disabled={ocupado || !endereco}>
            {ocupado ? 'Publicando…' : 'Publicar e copiar link'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
