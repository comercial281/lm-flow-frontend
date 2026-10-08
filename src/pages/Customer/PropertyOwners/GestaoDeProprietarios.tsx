import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { BaseHeader, Pagina } from '@/components/base';
import Abas from '@/components/base/Abas';
import { useCan } from '@/hooks/useCan';
import { useCaptacoesNovas } from '@/features/properties/proprietarios/useCaptacoesNovas';
import ListaDeProprietarios from './ListaDeProprietarios';
import NovasCaptacoes from './NovasCaptacoes';

// ── GESTÃO DE PROPRIETÁRIOS (Imóveis entrega 3, 03/10/2026) ─────────────────
// Duas abas: Proprietários (a lista) e Novas captações (pedidos do formulário
// "Anuncie seu imóvel" do site). A segunda só para quem lê captações; com uma
// aba só, a fileira de abas não aparece (como o Bolsão do corretor).
type Aba = 'proprietarios' | 'captacoes';
const ABA_DE_CAPTACOES = 'captacoes';

export default function GestaoDeProprietarios() {
  const can = useCan();
  const veCaptacoes = can('property_capture_requests', 'read');
  const [params, setParams] = useSearchParams();
  const aba: Aba = veCaptacoes && params.get('aba') === ABA_DE_CAPTACOES ? 'captacoes' : 'proprietarios';
  // Mesma regra da lista: quem edita imóveis cria proprietário.
  const podeGerir = can('properties', 'update');
  const [novoAberto, setNovoAberto] = useState(false);
  const { tem, marcarComoVistas } = useCaptacoesNovas(veCaptacoes);

  // Abrir a aba (clicando ou pelo link ?aba=captacoes) apaga a bolinha. Com a
  // aba aberta, pedido que chega depois também conta como visto na hora.
  const marcouAoEntrar = useRef(false);
  useEffect(() => {
    if (aba !== 'captacoes') { marcouAoEntrar.current = false; return; }
    if (marcouAoEntrar.current && !tem) return;
    marcouAoEntrar.current = true;
    void marcarComoVistas();
  }, [aba, tem, marcarComoVistas]);

  const trocarAba = (chave: string) =>
    setParams(antes => {
      const novos = new URLSearchParams(antes);
      if (chave === 'captacoes') novos.set('aba', ABA_DE_CAPTACOES); else novos.delete('aba');
      return novos;
    }, { replace: true });

  return (
    <Pagina
      cabecalho={
        <BaseHeader
          title="Gestão de proprietários"
          subtitle="Os donos dos imóveis da carteira, com o contato e os imóveis de cada um."
          primaryAction={aba === 'proprietarios' && podeGerir
            ? { label: 'Novo proprietário', icon: <Plus className="h-4 w-4" />, onClick: () => setNovoAberto(true) }
            : undefined}
        />
      }
    >
      {veCaptacoes && (
        <Abas
          rotulo="Gestão de proprietários"
          ativa={aba}
          aoTrocar={trocarAba}
          abas={[
            { chave: 'proprietarios', rotulo: 'Proprietários' },
            { chave: 'captacoes', rotulo: 'Novas captações', marcador: tem },
          ]}
        />
      )}
      {aba === 'captacoes'
        ? <NovasCaptacoes />
        : <ListaDeProprietarios novoAberto={novoAberto} aoFecharNovo={() => setNovoAberto(false)} aoAbrirNovo={() => setNovoAberto(true)} />}
    </Pagina>
  );
}
