import { Input, Label, Textarea } from '@/components/ui/ds';
import { type SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { CheckRow, Toggle } from '../comum';
import { HandoffPolicySection } from './HandoffPolicySection';
import { HandoffDestinationSection } from './HandoffDestinationSection';
import { PipelineMoveSection } from './PipelineMoveSection';

export function IntelligenceSection({
  agent, onChange, onSave,
}: {
  agent: SalesAgent;
  onChange: (a: SalesAgent) => void;
  onSave: (patch: Partial<SalesAgent>) => void;
}) {
  const limits = agent.ai_limits ?? {};
  const crm = agent.crm_policy ?? {};
  const setLimit = (k: keyof typeof limits, v: boolean) => onSave({ ai_limits: { ...limits, [k]: v } });
  const setCrm = (k: keyof typeof crm, v: boolean) => onSave({ crm_policy: { ...crm, [k]: v } });

  return (
    <div className="pt-2 border-t border-sidebar-border space-y-5">
      {/* Escopo: locação */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Trabalha com locação (aluguel)</div>
          <div className="text-xs text-muted-foreground">
            Desligue se a imobiliária só vende. A IA foca em venda e redireciona quem procura aluguel.
          </div>
        </div>
        <Toggle on={agent.locacao_enabled !== false} onChange={(v) => onSave({ locacao_enabled: v })} rotulo="trabalhar com locação" />
      </div>

      {/* Cenário de repasse: a decisão grande vem ANTES das exceções dela. */}
      <HandoffPolicySection agent={agent} onSave={onSave} />

      {/* E PARA QUEM ela passa. Logo abaixo do QUANDO, de propósito: as duas
          respondem à mesma pergunta, e separá-las faria procurar em dois lugares
          o que acontece quando a IA sai de cena. */}
      <HandoffDestinationSection agent={agent} onSave={onSave} />

      {/* Escalação: passar pro humano */}
      <div>
        <div className="text-sm font-medium mb-1">Passar pro humano na hora quando…</div>
        <div className="text-xs text-muted-foreground mb-1">
          Estes três valem em qualquer cenário escolhido acima — inclusive lead irritado.
        </div>
        <CheckRow checked={agent.escalate_on_frustration !== false} onChange={(v) => onSave({ escalate_on_frustration: v })}
          title="O lead se irritar" desc="Detecta frustração/reclamação e passa pro corretor com jeito." />
        <CheckRow checked={agent.escalate_on_human_request !== false} onChange={(v) => onSave({ escalate_on_human_request: v })}
          title="O lead pedir uma pessoa" desc="Quando pede pra falar com um corretor/humano." />
        <CheckRow checked={agent.escalate_on_ai_detected !== false} onChange={(v) => onSave({ escalate_on_ai_detected: v })}
          title="O lead perceber que é IA" desc={'Se perguntar "é um robô?", ela não mente e passa pra uma pessoa.'} />
      </div>

      {/* Limites da IA */}
      <div>
        <div className="text-sm font-medium mb-1">Limites da IA (o que ela NÃO faz)</div>
        <div className="text-xs text-muted-foreground mb-1">Se perguntada, ela encaminha pro corretor com naturalidade.</div>
        <CheckRow checked={!!limits.address} onChange={(v) => setLimit('address', v)} title="Não passar endereço exato do imóvel" />
        <CheckRow checked={!!limits.discount} onChange={(v) => setLimit('discount', v)} title="Não negociar desconto" />
        <CheckRow checked={!!limits.price} onChange={(v) => setLimit('price', v)} title="Não fechar preço final / proposta" />
        <CheckRow checked={!!limits.iptu} onChange={(v) => setLimit('iptu', v)} title="Não informar IPTU" />
      </div>

      {/* Filtro de qualidade antes do CRM */}
      <div>
        <div className="text-sm font-medium mb-1">Quem vai pro CRM (filtro de qualidade)</div>
        <div className="text-xs text-muted-foreground mb-1">Deixe desligado pra não sujar o CRM com lead ruim. Comprador quente sempre vai.</div>
        <CheckRow checked={!!crm.cold} onChange={(v) => setCrm('cold', v)} title="Enviar leads frios ao CRM" />
        <CheckRow checked={!!crm.capture} onChange={(v) => setCrm('capture', v)}
          title="Enviar captação (quem quer vender) ao CRM de vendas" desc="Desligado: vira etiqueta de captação, não polui o funil de compradores." />
        <CheckRow checked={crm.invalid !== false} onChange={(v) => setCrm('invalid', v)} title="Enviar leads sem contato válido ao CRM" />
      </div>

      {/* Mover o card no funil. Fica logo abaixo do filtro de qualidade porque as
          duas respondem à mesma pergunta — o que a IA faz DENTRO do CRM: a de cima
          decide quem entra, esta decide para onde vai depois que entrou. */}
      <PipelineMoveSection agent={agent} onSave={onSave} />

      {/* Extras */}
      <div>
        <div className="text-sm font-medium mb-1">Extras</div>
        <CheckRow checked={agent.cross_sell_enabled !== false} onChange={(v) => onSave({ cross_sell_enabled: v })}
          title="Oferecer outras opções" desc="Quando não tem o imóvel exato, sugere alternativas reais e não perde o lead." />
        <CheckRow checked={agent.rich_media_enabled !== false} onChange={(v) => onSave({ rich_media_enabled: v })}
          title="Mandar fotos e vídeo do imóvel" desc="A IA escolhe a hora e manda até 5 fotos ou 1 vídeo no WhatsApp, sem link." />
        {/* Sem isto, "Oferecer outras opções" era promessa vazia: a IA só
            enxergava o imóvel do anúncio e não tinha como consultar o cadastro. */}
        <CheckRow checked={agent.catalog_search_enabled !== false} onChange={(v) => onSave({ catalog_search_enabled: v })}
          title="Consultar o cadastro de imóveis"
          desc="Deixa a IA buscar imóveis reais do seu cadastro (bairro, quartos, faixa de preço) pra sugerir alternativa. Sem isso ela só conhece o imóvel do anúncio." />
        {/* O book já está no cadastro do imóvel — não precisa ser subido de novo na
            aba de arquivos. Vale pra todo imóvel que tenha book salvo, inclusive os
            que forem cadastrados depois. */}
        <CheckRow checked={agent.send_property_book_enabled !== false} onChange={(v) => onSave({ send_property_book_enabled: v })}
          title="Mandar o book do imóvel"
          desc="O PDF que já está cadastrado no imóvel. Não precisa subir de novo aqui." />
        {agent.send_property_book_enabled !== false && (
          <div className="mt-2 pl-7">
            <Label htmlFor="book_rule" className="text-xs">Quando ela pode mandar o book</Label>
            <Textarea
              id="book_rule" rows={2} className="mt-1"
              placeholder="Ex: só quando o lead pedir o book, o material completo ou a apresentação do empreendimento"
              defaultValue={agent.book_send_rule ?? ''}
              onBlur={(e) => onSave({ book_send_rule: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Vale pro book de qualquer imóvel. Em branco, ela só manda quando o lead pedir.
            </p>
          </div>
        )}
      </div>

      {/* Avaliação no Google */}
      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Pedir avaliação no Google</div>
            <div className="text-xs text-muted-foreground">Após um bom atendimento, convida o lead a avaliar (reputação/SEO).</div>
          </div>
          <Toggle on={!!agent.ask_google_review} onChange={(v) => onSave({ ask_google_review: v })} rotulo="pedir avaliação no Google" />
        </div>
        {agent.ask_google_review && (
          <div className="mt-2 pl-7">
            <Label htmlFor="g_review" className="text-xs">Link de avaliação do Google</Label>
            <Input id="g_review" placeholder="https://g.page/.../review" className="mt-1"
              value={agent.google_review_link ?? ''}
              onChange={(e) => onChange({ ...agent, google_review_link: e.target.value })}
              onBlur={() => onSave({ google_review_link: (agent.google_review_link ?? '').trim() || null })} />
          </div>
        )}
      </div>
    </div>
  );
}
