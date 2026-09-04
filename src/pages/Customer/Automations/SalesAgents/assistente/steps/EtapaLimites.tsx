import type { AssistenteAnswers } from '../assistenteMapping';
import { CampoLinhas, LinhaMarcar, Secao } from './Campos';

/**
 * Etapa 4 — Limites. O que a IA nunca faz, e quando chama gente na hora.
 */
export default function EtapaLimites({
  a, set,
}: {
  a: AssistenteAnswers;
  set: (patch: Partial<AssistenteAnswers>) => void;
}) {
  return (
    <div className="space-y-8">
      <Secao titulo="O que ela nunca diz nem promete" ajuda="Se perguntada, ela encaminha para o corretor com naturalidade.">
        <div className="rounded-lg border border-sidebar-border p-3">
          <LinhaMarcar checked={a.limite_endereco} onChange={(v) => set({ limite_endereco: v })} titulo="Não passar endereço exato do imóvel" />
          <LinhaMarcar checked={a.limite_desconto} onChange={(v) => set({ limite_desconto: v })} titulo="Não negociar desconto" />
          <LinhaMarcar checked={a.limite_preco} onChange={(v) => set({ limite_preco: v })} titulo="Não fechar preço final / proposta" />
          <LinhaMarcar checked={a.limite_iptu} onChange={(v) => set({ limite_iptu: v })} titulo="Não informar IPTU" />
        </div>
        <CampoLinhas id="as_lim_livres" label="Outros limites (opcional)" value={a.limites_livres} onChange={(v) => set({ limites_livres: v })}
          placeholder={'Ex: Não fala de vaga de garagem antes da visita\nNão promete data de entrega'}
          ajuda="Um por linha, na forma de proibição." />
      </Secao>

      <Secao titulo="Passar pro humano na hora quando…" ajuda="Estes três valem em qualquer cenário de repasse — inclusive lead irritado.">
        <div className="rounded-lg border border-sidebar-border p-3">
          <LinhaMarcar checked={a.escalate_on_frustration} onChange={(v) => set({ escalate_on_frustration: v })}
            titulo="O lead se irritar" desc="Detecta frustração ou reclamação e passa pro corretor com jeito." />
          <LinhaMarcar checked={a.escalate_on_human_request} onChange={(v) => set({ escalate_on_human_request: v })}
            titulo="O lead pedir uma pessoa" desc="Quando pede para falar com um corretor ou humano." />
          <LinhaMarcar checked={a.escalate_on_ai_detected} onChange={(v) => set({ escalate_on_ai_detected: v })}
            titulo="O lead perceber que é IA" desc={'Se perguntar "é um robô?", ela não mente e passa para uma pessoa.'} />
        </div>
        <p className="text-xs text-muted-foreground">Quando ela passa nos outros casos — por dúvida, por temperatura, depois da visita — é a próxima etapa.</p>
      </Secao>
    </div>
  );
}
