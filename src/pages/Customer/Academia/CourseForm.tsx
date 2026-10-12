// Janela de criar/editar CURSO (Leal Mídia): nome, capa,
// em quais clientes aparece (só com cliente no endereço) e Avançado.

import { useState } from 'react';
import { useCreateCourse, useUpdateCourse, TENANT_SLUG, type KnowledgeCourse } from '@/hooks/useKnowledge';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/ds';
import { CampoTexto, CampoTextoLongo } from '@/components/base/Campo';
import CartoesDeEscolha from '@/components/base/CartoesDeEscolha';
import CoverPicker from './CoverPicker';
import AvancadoDoBloqueio from './AvancadoDoBloqueio';
import type { LockConfig } from './LockConfigFields';

export default function CourseForm({ editing, onClose }: {
  editing: KnowledgeCourse | null;
  onClose: () => void;
}) {
  const createCourse = useCreateCourse();
  const updateCourse = useUpdateCourse();

  const [titulo, setTitulo] = useState(editing?.titulo ?? '');
  const [descricao, setDescricao] = useState(editing?.descricao ?? '');
  const [capaUrl, setCapaUrl] = useState(editing?.capa_url ?? '');
  const [scope, setScope] = useState<'global' | 'tenant'>(editing?.tenant_slug ? 'tenant' : 'global');
  const [lock, setLock] = useState<LockConfig>({
    access: editing?.access ?? 'free',
    lock_cta_type: editing?.lock_cta_type ?? 'whatsapp',
    lock_cta_label: editing?.lock_cta_label ?? '',
    lock_cta_value: editing?.lock_cta_value ?? '',
    lock_message: editing?.lock_message ?? '',
  });

  const busy = createCourse.isPending || updateCourse.isPending;
  const temCliente = Boolean(TENANT_SLUG);

  async function submit() {
    if (!titulo.trim()) return;
    const base = {
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      capa_url: capaUrl.trim() || null,
      tenant_slug: temCliente ? (scope === 'tenant' ? TENANT_SLUG : null) : (editing?.tenant_slug ?? null),
      access: lock.access,
      lock_cta_type: lock.lock_cta_type,
      lock_cta_label: lock.lock_cta_label.trim() || null,
      lock_cta_value: lock.lock_cta_value.trim() || null,
      lock_message: lock.lock_message.trim() || null,
    };
    if (editing) await updateCourse.mutateAsync({ id: editing.id, ...base });
    else await createCourse.mutateAsync(base);
    onClose();
  }

  return (
    <Dialog open onOpenChange={(aberto) => { if (!aberto && !busy) onClose(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>{editing ? 'Editar curso' : 'Novo curso'}</DialogTitle></DialogHeader>
        <div className="grid gap-5">
          <CampoTexto id="curso-nome" rotulo="Nome do curso" valor={titulo} aoMudar={setTitulo} />
          <CampoTextoLongo id="curso-descricao" rotulo="Descrição (opcional)" valor={descricao} aoMudar={setDescricao} rows={2} />
          <CoverPicker value={capaUrl} onChange={setCapaUrl} />
          {temCliente && (
            <div className="grid gap-2">
              <p className="text-sm font-medium">Em quais clientes aparece</p>
              <CartoesDeEscolha rotulo="Em quais clientes aparece" valor={scope} aoEscolher={setScope} opcoes={[
                { valor: 'global', rotulo: 'Todos os clientes', descricao: 'Aparece em todas as imobiliárias' },
                { valor: 'tenant', rotulo: 'Só este cliente', descricao: TENANT_SLUG },
              ]} />
            </div>
          )}
          <AvancadoDoBloqueio lock={lock} onChange={(patch) => setLock((v) => ({ ...v, ...patch }))}
            alvo={editing ? { tipo: 'course', id: editing.id } : null} />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" type="button" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button type="button" onClick={submit} disabled={busy || !titulo.trim()}>
            {busy ? 'Salvando...' : editing ? 'Salvar' : 'Criar curso'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
