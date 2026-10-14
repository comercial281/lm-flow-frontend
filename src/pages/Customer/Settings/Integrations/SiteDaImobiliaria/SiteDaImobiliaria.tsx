// src/pages/Customer/Settings/Integrations/SiteDaImobiliaria/SiteDaImobiliaria.tsx
// Integrações → Sistemas → Site da imobiliária (13/10/2026). Spec: LM FLOW/specs/2026-10-13-importar-lista-externa-design.md.
// O gestor cola o endereço do arquivo que o site gera, vê a prévia e confirma; depois a
// leitura é de hora em hora no servidor. O site sempre ganha: o que vem dele fica travado no imóvel.
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { BaseHeader, Carregando, EmptyState, Pagina } from '@/components/base';
import { Secao, Secoes } from '@/components/base/Secao';
import { CampoTexto } from '@/components/base/Campo';
import Aviso from '@/components/base/Aviso';
import BaseStatusBadge from '@/components/base/BaseStatusBadge';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { useCan } from '@/hooks/useCan';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { siteFeedService, type FonteDoSite, type Previa } from '@/services/properties/siteFeedService';
import { resumoDaMudanca, situacaoDoSite } from '@/features/properties/situacaoDoSite';
import PreviaDaImportacao from './PreviaDaImportacao';

const ESPERA_MS = 4000;
const TENTATIVAS = 15;

export default function SiteDaImobiliaria() {
  const pode = useCan();
  const podeMexer = pode('properties', 'create');
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [fonte, setFonte] = useState<FonteDoSite | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [endereco, setEndereco] = useState('');
  const [editando, setEditando] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const pedido = useRef(0);
  const timer = useRef<number | null>(null);
  const vivo = useRef(true);

  const carregar = useCallback(async () => {
    const meu = ++pedido.current;
    setFalhou(false);
    try {
      const f = await siteFeedService.get();
      if (meu !== pedido.current) return;
      setFonte(f);
      setEndereco(f.url ?? '');
    } catch {
      if (meu === pedido.current) setFalhou(true);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; if (timer.current != null) window.clearTimeout(timer.current); };
  }, []);

  // Depois de confirmar/atualizar, a leitura roda no servidor: confere a cada 4 s até a data mudar.
  const acompanhar = useCallback((antes?: string | null) => {
    let n = 0;
    if (timer.current != null) window.clearTimeout(timer.current);
    const agendar = () => { timer.current = window.setTimeout(passo, ESPERA_MS); };
    const passo = async () => {
      if (!vivo.current) return;
      n += 1;
      try {
        const f = await siteFeedService.get();
        if (!vivo.current) return;
        setFonte(f);
        if (f.last_checked_at !== antes && f.state !== 'waiting') return;
      } catch { /* tenta de novo */ }
      if (n < TENTATIVAS && vivo.current) agendar();
    };
    agendar();
  }, []);

  const lerArquivo = async () => {
    setLendo(true); setErro(null); setPrevia(null);
    try {
      setPrevia(await siteFeedService.previa(endereco.trim()));
    } catch (e) {
      setErro(apiErrorMessage(e, 'Não deu pra ler o arquivo agora. Confira o endereço e tente de novo.'));
    } finally {
      setLendo(false);
    }
  };

  const importar = async () => {
    if (!previa) return;
    const mesmoAssim = previa.shrunk;
    if (previa.counts.inactivate > 0) {
      const ok = await confirmar({
        titulo: 'Confirmar a importação',
        descricao: `${previa.counts.inactivate} imóveis que não estão no arquivo vão ficar Inativos (a IA para de oferecer). Nada é excluído.`,
        rotuloDaAcao: 'Confirmar e importar',
      });
      if (!ok) return;
    }
    const antes = fonte?.last_checked_at;
    try {
      setFonte(await siteFeedService.confirmar(endereco.trim(), { mesmoAssim }));
      setPrevia(null); setEditando(false);
      toast.success('Lendo o arquivo agora. Os imóveis aparecem em alguns minutos.');
      acompanhar(antes);
    } catch (e) {
      setErro(apiErrorMessage(e, 'Não deu pra importar agora. Tente de novo.'));
    }
  };

  const atualizar = async (mesmoAssim = false) => {
    const antes = fonte?.last_checked_at;
    try {
      setFonte(await siteFeedService.atualizarAgora({ mesmoAssim }));
      toast.success('Lendo o arquivo agora.');
      acompanhar(antes);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não deu pra atualizar agora.'));
    }
  };

  const desligar = async () => {
    const ok = await confirmar({
      titulo: 'Desligar a leitura do site',
      descricao: 'Os imóveis que vieram do site ficam como estão e voltam a poder ser editados. Ninguém é excluído.',
      rotuloDaAcao: 'Desligar',
      destrutivo: true,
    });
    if (!ok) return;
    try {
      setFonte(await siteFeedService.desligar());
      toast.success('Leitura do site desligada');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não deu pra desligar agora.'));
    }
  };

  const cabecalho = (
    <BaseHeader title="Site da imobiliária" subtitle="Seus imóveis do site entram e se atualizam sozinhos no LM Flow." />
  );

  if (falhou) {
    return <Pagina estreita cabecalho={cabecalho}><EmptyState tipo="erro" aoTentarDeNovo={() => { void carregar(); }} /></Pagina>;
  }
  if (!fonte) {
    return <Pagina estreita cabecalho={cabecalho}><Carregando variante="texto" /></Pagina>;
  }

  const situacao = situacaoDoSite(fonte);
  const mudanca = resumoDaMudanca(fonte.last_summary);
  const mostrarFormulario = podeMexer && (!fonte.configured || editando || fonte.state === 'off');

  return (
    <Pagina estreita cabecalho={cabecalho}>
      <Secoes>
        {fonte.configured && (
          <Secao titulo="Situação">
            <div className="flex flex-wrap items-center gap-2">
              <BaseStatusBadge status={situacao.selo} text={situacao.rotulo} />
              {situacao.detalhe && <span className="text-sm text-muted-foreground">{situacao.detalhe}</span>}
            </div>
            {mudanca && <p className="text-sm text-muted-foreground">Última mudança: {mudanca}</p>}
            {fonte.url && <p className="break-all text-sm text-muted-foreground">Endereço: {fonte.url}</p>}
            {podeMexer && fonte.state !== 'off' && (
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => { void atualizar(); }}>Atualizar agora</Button>
                {fonte.state === 'problem' && (
                  <Button type="button" variant="outline" onClick={() => { setEditando(true); void lerArquivo(); }}>Ver prévia</Button>
                )}
                <Button type="button" variant="outline" onClick={() => { setEditando(true); setPrevia(null); }}>Trocar endereço</Button>
                <Button type="button" variant="ghost" onClick={() => { void desligar(); }}>Desligar</Button>
              </div>
            )}
          </Secao>
        )}

        {mostrarFormulario && (
          <Secao titulo={fonte.configured ? 'Endereço do arquivo' : 'Ligar'}
            descricao="Cole o endereço do arquivo de imóveis que o seu site gera pros portais (ZAP, Viva Real). Se não souber, peça pra quem cuida do site ou fale com o suporte.">
            <CampoTexto id="site-endereco" rotulo="Endereço do arquivo de imóveis" valor={endereco} aoMudar={setEndereco}
              placeholder="https://www.seusite.com.br/..." />
            <div>
              <Button type="button" onClick={() => { void lerArquivo(); }} disabled={lendo || !endereco.trim()}>
                {lendo && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Ler arquivo
              </Button>
            </div>
            {erro && <Aviso tom="erro">{erro}</Aviso>}
            {previa && <PreviaDaImportacao previa={previa} aoConfirmar={() => { void importar(); }} />}
          </Secao>
        )}
      </Secoes>
      {dialogoDeConfirmacao}
    </Pagina>
  );
}
