import { BaseHeader, Pagina } from '@/components/base';
import Carregando from '@/components/base/Carregando';
import EmptyState from '@/components/base/EmptyState';
import { Card } from '@/components/ui/ds';
import {
  MetricasOficiais,
  ModelosOficiais,
  NumerosOficiais,
  SemNumeroOficial,
  useNumerosOficiais,
} from './WhatsappOficialPartes';

// Integrações → WhatsApp Oficial (16/10/2026): o que era das abas Templates,
// Canais oficiais e Métricas do Disparos. Três partes na mesma página, sem abas.
export default function WhatsappOficial() {
  const { numeros, carregando, erro, carregar } = useNumerosOficiais();

  return (
    <Pagina
      cabecalho={
        <BaseHeader
          title="WhatsApp Oficial"
          subtitle="Seus números oficiais, os modelos de mensagem aprovados pela Meta e o custo dos envios."
        />
      }
    >
      {carregando ? (
        <Carregando variante="texto" linhas={4} rotulo="Carregando números..." />
      ) : erro ? (
        <EmptyState tipo="erro" aoTentarDeNovo={carregar} />
      ) : numeros.length === 0 ? (
        <SemNumeroOficial />
      ) : (
        <div className="space-y-6">
          <Card className="p-4 space-y-3">
            <h2 className="text-base font-semibold">Números oficiais</h2>
            <NumerosOficiais numeros={numeros} />
          </Card>
          <Card className="p-4 space-y-3">
            <h2 className="text-base font-semibold">Modelos</h2>
            <ModelosOficiais numeros={numeros} />
          </Card>
          <Card className="p-4 space-y-3">
            <h2 className="text-base font-semibold">Métricas</h2>
            <MetricasOficiais />
          </Card>
        </div>
      )}
    </Pagina>
  );
}
