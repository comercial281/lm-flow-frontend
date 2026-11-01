// Ensinar · Regras e objeções da casa (no lugar das Instruções, Tarefa 75). Regras da casa: até 30 linhas de
// 200 letras, uma ordem por linha, que vale pra casa toda. Objeções da casa: até 10 (objeção + como a casa responde).
// Grava na hora, só `house_rules` e `house_objections`. A tela recusa apresentação ANTES de gravar (quem a IA é
// mora na ficha) com a frase do servidor; se o servidor recusar, a gravação mostra a frase que veio.
// Condição e imóvel moram no cadastro e na campanha: valor em reais ou código de imóvel avisa, mas não trava.
import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/ds';
import { Secao, Secoes } from '@/components/base/Secao';
import { CampoTexto, CampoTextoLongo } from '@/components/base/Campo';
import Aviso from '@/components/base/Aviso';
import BotaoMaisAcoes from '@/components/base/BotaoMaisAcoes';
import type { RegraDaCasa } from '@/services/salesAgents/salesAgentsService';
import {
  TETO_DA_OBJECAO, TETO_DA_REGRA, TETO_DA_RESPOSTA, TETO_DE_OBJECOES, TETO_DE_REGRAS, avisoDeProduto, motivoDeRecusa,
} from '@/features/salesAgents/regrasDaCasa';
import type { PropsDaPaginaDoEnsinar } from './tipos';

export default function RegrasDaCasa({ agent, gravar, confirmar }: PropsDaPaginaDoEnsinar) {
  const regras = agent.house_rules ?? [];
  const objecoes = agent.house_objections ?? [];
  const [nova, setNova] = useState('');
  const [editando, setEditando] = useState<{ i: number; texto: string } | null>(null);
  const [objecao, setObjecao] = useState('');
  const [resposta, setResposta] = useState('');
  const [gravando, setGravando] = useState(false);

  const cheia = regras.length >= TETO_DE_REGRAS;
  const recusaDaNova = nova.trim() ? motivoDeRecusa(nova) : null;
  const avisoDaNova = nova.trim() ? avisoDeProduto(nova) : null;
  const recusaDaEdicao = editando?.texto.trim() ? motivoDeRecusa(editando.texto) : null;
  // Aviso que o servidor devolveu na última gravação (ele conhece os códigos ativos do cadastro).
  const avisosDoServidor = agent.house_rules_notices ?? [];

  const gravarRegras = async (lista: string[]) => {
    setGravando(true);
    try { return await gravar({ house_rules: lista }); } finally { setGravando(false); }
  };
  const adicionar = async () => {
    const t = nova.trim();
    if (!t || cheia || recusaDaNova || gravando) return;
    if (await gravarRegras([...regras, t])) setNova('');
  };
  const salvarEdicao = async () => {
    if (!editando || !editando.texto.trim() || recusaDaEdicao || gravando) return;
    const texto = editando.texto.trim();
    if (await gravarRegras(regras.map((r, j) => (j === editando.i ? texto : r)))) setEditando(null);
  };
  const apagarRegra = async (i: number) => {
    if (gravando) return;
    if (!(await confirmar({ titulo: 'Excluir regra da casa', descricao: regras[i], rotuloDaAcao: 'Excluir', destrutivo: true }))) return;
    // A edição aberta aponta pra regra pela POSIÇÃO, que anda quando uma sai.
    setEditando(null);
    await gravarRegras(regras.filter((_, j) => j !== i));
  };

  const objecoesCheias = objecoes.length >= TETO_DE_OBJECOES;
  const gravarObjecoes = async (lista: RegraDaCasa[]) => {
    setGravando(true);
    try { return await gravar({ house_objections: lista }); } finally { setGravando(false); }
  };
  const adicionarObjecao = async () => {
    const o = objecao.trim();
    const r = resposta.trim();
    if (!o || !r || objecoesCheias || gravando) return;
    if (await gravarObjecoes([...objecoes, { objecao: o, resposta: r }])) { setObjecao(''); setResposta(''); }
  };
  const apagarObjecao = async (i: number) => {
    if (gravando) return;
    if (!(await confirmar({ titulo: 'Excluir objeção da casa', descricao: objecoes[i].objecao, rotuloDaAcao: 'Excluir', destrutivo: true }))) return;
    await gravarObjecoes(objecoes.filter((_, j) => j !== i));
  };

  return (
    <Secoes>
      <Secao titulo="Regras da casa" descricao={`Ordens curtas que valem em toda conversa, uma por linha (até ${TETO_DE_REGRAS}, de ${TETO_DA_REGRA} letras). Quem a IA é fica na ficha, em Números e usuários.`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <CampoTexto id="en-nova-regra-casa" rotulo="Nova regra" className="flex-1" valor={nova} aoMudar={setNova}
            placeholder="Ex.: Nunca prometa aprovação de financiamento."
            erro={recusaDaNova ?? undefined} aviso={!recusaDaNova ? avisoDaNova ?? undefined : undefined}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void adicionar(); } }} />
          <Button type="button" className="sm:mt-[1.625rem]" onClick={() => void adicionar()} disabled={!nova.trim() || cheia || !!recusaDaNova || gravando}>
            <Plus className="mr-1 h-4 w-4" aria-hidden /> Adicionar regra
          </Button>
        </div>
        <p className="text-sm text-muted-foreground"><b className="text-foreground">{`${regras.length} de ${TETO_DE_REGRAS}`}</b></p>
        {cheia && <p className="text-sm text-amber-700 dark:text-amber-400">{`Chegou em ${TETO_DE_REGRAS} regras. Exclua uma pra escrever outra.`}</p>}
        {avisosDoServidor.map((a) => <Aviso key={a} tom="atencao" compacto>{a}</Aviso>)}
        {regras.length > 0 && (
          <ul className="divide-y divide-border">
            {regras.map((r, i) => (
              <li key={`${i}-${r}`} className="flex items-start gap-3 py-3">
                {editando?.i === i ? (
                  <div className="flex flex-1 flex-col gap-2">
                    <CampoTexto id={`en-regra-casa-${i}`} rotulo="Editar regra" valor={editando.texto} aoMudar={(t) => setEditando({ i, texto: t })}
                      erro={recusaDaEdicao ?? undefined} />
                    <div className="flex gap-2">
                      <Button type="button" size="sm" onClick={() => void salvarEdicao()} disabled={!editando.texto.trim() || !!recusaDaEdicao || gravando}>Pronto</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
                    </div>
                  </div>
                ) : <p className="flex-1 pt-1 text-[15px] leading-snug">{r}</p>}
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <BotaoMaisAcoes aria-label={`Ações da regra ${r}`} className="shrink-0 text-muted-foreground" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditando({ i, texto: r })}>
                      <Pencil className="h-4 w-4" aria-hidden /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => void apagarRegra(i)}>
                      <Trash2 className="h-4 w-4" aria-hidden /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao titulo="Objeções da casa" descricao={`Como a casa responde às objeções que valem pra qualquer imóvel (até ${TETO_DE_OBJECOES}). Sem nenhuma, ela usa o padrão de fábrica.`}>
        <div className="grid gap-3">
          <CampoTexto id="en-objecao-casa" rotulo="Objeção" maxLength={TETO_DA_OBJECAO} valor={objecao} aoMudar={setObjecao} placeholder="Ex.: Achei caro" />
          <CampoTextoLongo id="en-objecao-resposta" rotulo="Resposta da casa" rows={3} maxLength={TETO_DA_RESPOSTA} valor={resposta} aoMudar={setResposta}
            placeholder="Ex.: Mostre a parcela e o que a entrada com FGTS muda, antes do valor total." />
          <div>
            <Button type="button" onClick={() => void adicionarObjecao()} disabled={!objecao.trim() || !resposta.trim() || objecoesCheias || gravando}>
              <Plus className="mr-1 h-4 w-4" aria-hidden /> Adicionar objeção
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground"><b className="text-foreground">{`${objecoes.length} de ${TETO_DE_OBJECOES}`}</b></p>
        {objecoes.length > 0 && (
          <ul className="divide-y divide-border">
            {objecoes.map((o, i) => (
              <li key={`${i}-${o.objecao}`} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-[15px] font-semibold leading-snug">{o.objecao}</p>
                  <p className="text-[15px] leading-snug text-muted-foreground">{o.resposta}</p>
                </div>
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <BotaoMaisAcoes aria-label={`Ações da objeção ${o.objecao}`} className="shrink-0 text-muted-foreground" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem variant="destructive" onSelect={() => void apagarObjecao(i)}>
                      <Trash2 className="h-4 w-4" aria-hidden /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}
      </Secao>
    </Secoes>
  );
}
