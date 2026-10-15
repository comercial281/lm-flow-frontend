// Janela de criar/editar MÓDULO (Leal Mídia): nome, curso, capa, quem assiste,
// em quais clientes aparece (só com cliente no endereço) e Avançado.

import { useState } from 'react';
import { useCreateModule, useUpdateModule, useCourses, TENANT_SLUG, type KnowledgeModule, type QuemAssiste } from '@/hooks/useKnowledge';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/ds';
import { CampoTexto, CampoTextoLongo } from '@/components/base/Campo';
import CartoesDeEscolha from '@/components/base/CartoesDeEscolha';
import { Seletor } from '@/components/base/Seletor';
import { CampoDaJanela, GradeDaJanela } from '@/components/base/janela';
import { GrupoDaJanela } from '@/components/base/janela';
import CoverPicker from './CoverPicker';
import AvancadoDoBloqueio from './AvancadoDoBloqueio';
import type { LockConfig } from './LockConfigFields';
import { quemAssiste } from './quemVe';

const OPCOES_QUEM: { valor: QuemAssiste; rotulo: string; descricao: string }[] = [
  { valor: 'all', rotulo: 'Todos', descricao: 'Corretores, gestores e administradores' },
  { valor: 'managers', rotulo: 'Só gestores e administradores', descricao: 'Some da tela do corretor' },
];

export default function ModuleForm({ editing, defaultCourseId, onClose }: {
  editing: KnowledgeModule | null;
  defaultCourseId?: string | null;
  onClose: () => void;
}) {
  const createModule = useCreateModule();
  const updateModule = useUpdateModule();
  const { data: courses = [] } = useCourses();

  const [titulo, setTitulo] = useState(editing?.titulo ?? '');
  const [descricao, setDescricao] = useState(editing?.descricao ?? '');
  const [capaUrl, setCapaUrl] = useState(editing?.capa_url ?? '');
  const [courseId, setCourseId] = useState<string>(editing?.course_id ?? defaultCourseId ?? '');
  const [audience, setAudience] = useState<QuemAssiste>(editing ? quemAssiste(editing) : 'all');
  const [scope, setScope] = useState<'global' | 'tenant'>(editing?.tenant_slug ? 'tenant' : 'global');
  const [lock, setLock] = useState<LockConfig>({
    access: editing?.access ?? 'free',
    lock_cta_type: editing?.lock_cta_type ?? 'whatsapp',
    lock_cta_label: editing?.lock_cta_label ?? '',
    lock_cta_value: editing?.lock_cta_value ?? '',
    lock_message: editing?.lock_message ?? '',
  });

  const busy = createModule.isPending || updateModule.isPending;
  const temCliente = Boolean(TENANT_SLUG);

  async function submit() {
    if (!titulo.trim()) return;
    const base = {
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      capa_url: capaUrl.trim() || null,
      course_id: courseId || null,
      tenant_slug: temCliente ? (scope === 'tenant' ? TENANT_SLUG : null) : (editing?.tenant_slug ?? null),
      access: lock.access,
      lock_cta_type: lock.lock_cta_type,
      lock_cta_label: lock.lock_cta_label.trim() || null,
      lock_cta_value: lock.lock_cta_value.trim() || null,
      lock_message: lock.lock_message.trim() || null,
    };
    try {
      if (editing) {
        // Só manda "quem assiste" se mudou: produção pode ainda não ter a coluna.
        const mudouQuem = audience !== quemAssiste(editing);
        await updateModule.mutateAsync({ id: editing.id, ...base, ...(mudouQuem ? { audience } : {}) });
      } else {
        await createModule.mutateAsync({ ...base, ...(audience === 'managers' ? { audience } : {}) });
      }
      onClose();
    } catch {
      /* o hook já avisa o erro; a janela continua aberta */
    }
  }

  return (
    <Dialog open onOpenChange={(aberto) => { if (!aberto && !busy) onClose(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>{editing ? 'Editar módulo' : 'Novo módulo'}</DialogTitle></DialogHeader>
        <div className="grid gap-6">
          <GrupoDaJanela titulo="Módulo">
            <GradeDaJanela>
              <CampoTexto id="modulo-nome" rotulo="Nome do módulo" valor={titulo} aoMudar={setTitulo} className="sm:col-span-2" />
              <CampoDaJanela rotulo="Curso" htmlFor="modulo-curso" colunas={2}>
                <Seletor id="modulo-curso" value={courseId} onChange={(e) => setCourseId(e.target.value)} className="w-full">
                  <option value="">Fora de curso (aula avulsa)</option>
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
                </Seletor>
              </CampoDaJanela>
            </GradeDaJanela>
            <CampoTextoLongo id="modulo-descricao" rotulo="Descrição (opcional)" valor={descricao} aoMudar={setDescricao} rows={2} />
            <CoverPicker value={capaUrl} onChange={setCapaUrl} />
          </GrupoDaJanela>
          <GrupoDaJanela titulo="Quem vê">
            <CartoesDeEscolha rotulo="Quem assiste" valor={audience} opcoes={OPCOES_QUEM} aoEscolher={setAudience} />
          </GrupoDaJanela>
          {temCliente && (
            <GrupoDaJanela titulo="Em quais clientes aparece">
              <CartoesDeEscolha rotulo="Em quais clientes aparece" valor={scope} aoEscolher={setScope} opcoes={[
                { valor: 'global', rotulo: 'Todos os clientes', descricao: 'Aparece em todas as imobiliárias' },
                { valor: 'tenant', rotulo: 'Só este cliente', descricao: TENANT_SLUG },
              ]} />
            </GrupoDaJanela>
          )}
          <GrupoDaJanela titulo="Avançado">
            <AvancadoDoBloqueio lock={lock} onChange={(patch) => setLock((v) => ({ ...v, ...patch }))}
              alvo={editing ? { tipo: 'module', id: editing.id } : null} />
          </GrupoDaJanela>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" type="button" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button type="button" onClick={submit} disabled={busy || !titulo.trim()}>
            {busy ? 'Salvando...' : editing ? 'Salvar' : 'Criar módulo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
