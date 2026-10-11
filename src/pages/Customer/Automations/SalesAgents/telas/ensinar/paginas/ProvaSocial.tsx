// Ensinar · Prova social: lista de casos, um por linha no MESMO texto `social_proof`
// (decisão 4 do spec). Grava na hora; excluir pede confirmação.
import { useState } from 'react';
import { MoreVertical, Plus, Quote, Star } from 'lucide-react';
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/ds';
import { Secao, Secoes } from '@/components/base/Secao';
import { CampoTexto } from '@/components/base/Campo';
import EmptyState from '@/components/base/EmptyState';
import { casosDe, textoDosCasos } from '../paginas';
import type { PropsDaPaginaDoEnsinar } from './tipos';

export default function ProvaSocial({ agent, gravar, confirmar }: PropsDaPaginaDoEnsinar) {
  const casos = casosDe(agent.social_proof);
  const [novo, setNovo] = useState('');
  const [gravando, setGravando] = useState(false);
  const [editando, setEditando] = useState<{ i: number; texto: string } | null>(null);

  const gravarCasos = async (lista: string[]) => {
    setGravando(true);
    try { return await gravar({ social_proof: textoDosCasos(lista) }); } finally { setGravando(false); }
  };
  const adicionar = async () => {
    const t = novo.trim();
    if (!t || gravando) return;
    if (await gravarCasos([...casos, t])) setNovo('');
  };
  const apagar = async (i: number) => {
    if (!(await confirmar({ titulo: 'Excluir caso', descricao: casos[i], rotuloDaAcao: 'Excluir', destrutivo: true }))) return;
    await gravarCasos(casos.filter((_, j) => j !== i));
  };
  const salvarEdicao = async () => {
    if (!editando || !editando.texto.trim()) return;
    if (await gravarCasos(casos.map((c, j) => (j === editando.i ? editando.texto : c)))) setEditando(null);
  };

  return (
    <div className="space-y-5">
      <Secoes>
        <Secao titulo="Novo caso" descricao="Ela usa um caso por vez, só quando encaixa, e nunca inventa número fora desta lista.">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <CampoTexto id="en-novo-caso" rotulo="Novo caso" className="flex-1" valor={novo} aoMudar={setNovo}
              placeholder="Ex.: Mais de 300 famílias já pegaram a chave com a gente."
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void adicionar(); } }} />
            <Button type="button" onClick={() => void adicionar()} disabled={!novo.trim() || gravando}>
              <Plus className="mr-1 h-4 w-4" aria-hidden /> Adicionar
            </Button>
          </div>
        </Secao>
      </Secoes>

      {casos.length === 0 ? (
        <EmptyState icon={Star} title="Nenhum caso ainda" description="Sem caso aqui, ela não cita número nem história de cliente. Escreva acima o primeiro." />
      ) : (
        <Secoes>
          <ul className="divide-y divide-border">
            {casos.map((c, i) => (
              <li key={`${i}-${c}`} className="flex items-start gap-3 py-4">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Quote className="h-4 w-4" aria-hidden /></span>
                {editando?.i === i ? (
                  <div className="flex flex-1 flex-col gap-2">
                    <CampoTexto id={`en-caso-${i}`} rotulo="Editar caso" valor={editando.texto} aoMudar={(t) => setEditando({ i, texto: t })} />
                    <div className="flex gap-2">
                      <Button type="button" size="sm" onClick={() => void salvarEdicao()} disabled={gravando}>Pronto</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
                    </div>
                  </div>
                ) : <p className="flex-1 pt-1 text-[15px] leading-snug">{c}</p>}
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" aria-label={`Ações do caso ${i + 1}`} className="text-muted-foreground">
                      <MoreVertical className="h-4 w-4" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditando({ i, texto: c })}>Editar</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onSelect={() => void apagar(i)}>Excluir</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        </Secoes>
      )}
    </div>
  );
}
