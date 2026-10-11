// Ensinar · Instruções: o texto corrido da casa (`instructions`), gravado ao sair do
// campo, e a faixa "Instrução ou regra?" que separa as duas pela FORMA (spec §2.1).
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { Secao, Secoes } from '@/components/base/Secao';
import TextoNaHora from '../../../configurar/TextoNaHora';
import type { PropsDaPaginaDoEnsinar } from './tipos';

export default function Instrucoes({ agent, gravar, irPara }: PropsDaPaginaDoEnsinar) {
  return (
    <Secoes>
      <Secao titulo="Instruções da casa" descricao="Quem vocês são, o tom de voz e o que ela precisa saber da operação. Valem acima do estilo padrão dela.">
        <TextoNaHora id="en-instrucoes" rotulo="Instruções da casa" tipo="varias" rows={11} salvo={agent.instructions ?? ''}
          placeholder="Ex.: Somos uma imobiliária familiar na zona leste. A maioria dos clientes compra o primeiro imóvel. Fale simples, sem termo técnico."
          ajuda="Grava sozinho quando você sai do campo."
          aoGravar={(t) => gravar({ instructions: t.trim() ? t : null })} />
      </Secao>
      <Secao titulo="Instrução ou regra?" descricao="Texto corrido vai aqui. Ordem curta, que dá pra pausar depois, vai em Regras.">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 rounded-lg border border-border bg-background p-4">
            <p className="text-sm font-semibold">Instruções</p>
            <p className="text-sm text-muted-foreground">“Somos a Imobiliária Bloco, na zona leste, há 12 anos. Quase todo cliente compra pelo Minha Casa Minha Vida.”</p>
            <p className="text-xs text-muted-foreground">O contexto, em texto livre.</p>
          </div>
          <div className="space-y-1.5 rounded-lg border border-border bg-background p-4">
            <p className="text-sm font-semibold">Regras</p>
            <p className="text-sm text-muted-foreground">“Nunca fale de preço antes de saber a faixa de valor do lead.”</p>
            <p className="text-xs text-muted-foreground">Uma ordem por linha, com chave.</p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => irPara('regras')}>
          Ir pra Regras <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
        </Button>
      </Secao>
    </Secoes>
  );
}
