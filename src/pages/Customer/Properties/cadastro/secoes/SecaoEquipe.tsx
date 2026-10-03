import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button, Input, Label as UILabel } from '@/components/ui/ds';
import { Seletor } from '@/components/base/Seletor';
import { labelsService } from '@/services/contacts/labelsService';
import {
  LEAD_DESTINATION_HELP,
  LEAD_DESTINATION_LABEL,
  leadDestinationWarning,
} from '@/features/properties/leadDestination';
import { CLASSE_SELETOR, type PropsDaSecao } from './tipos';

type UsuarioDaLista = { id: string | number; name?: string | null; email?: string | null };

export default function SecaoEquipe({ form: f, setF }: PropsDaSecao) {
  // Usuários do tenant (responsável/captador) e etiquetas. Toleram falha (ficam vazios).
  const [tenantUsers, setTenantUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [labels, setLabels] = useState<Array<{ id: string; title: string }>>([]);
  const [newTagName, setNewTagName] = useState('');
  const [creatingTag, setCreatingTag] = useState(false);

  // Relida a cada abertura do cadastro, pro seletor refletir etiquetas novas
  // (inclusive a etiqueta automática do código do imóvel).
  const loadLabels = useCallback(() => {
    labelsService.getLabels()
      .then(res => setLabels((res.data ?? []).map(l => ({ id: String(l.id), title: l.title }))))
      .catch(() => setLabels([]));
  }, []);

  useEffect(() => {
    // Tolerante a falha: se endpoint retornar erro, mantém array vazio (UI cai pro "Nenhum").
    import('@/services/users/usersService').then(({ default: svc }) => {
      svc.getUsers({ per_page: 100 })
        .then(res => {
          const r = res as { data?: UsuarioDaLista[]; users?: UsuarioDaLista[] } | null;
          const list: Array<{ id: string; name: string }> = (r?.data ?? r?.users ?? [])
            .map(u => ({ id: String(u.id), name: u.name || u.email || `user_${u.id}` }));
          setTenantUsers(list);
        })
        .catch(() => setTenantUsers([]));
    }).catch(() => setTenantUsers([]));
    loadLabels();
  }, [loadLabels]);

  // Cria uma nova tag (Label) direto do cadastro do imóvel e já a seleciona.
  // O backend só aceita título com letras/números/espaço/hífen/underscore, então
  // sanitiza aqui (troca inválidos por espaço, colapsa, tira separador das pontas).
  const createTag = async () => {
    const cleaned = newTagName
      .replace(/[^\p{L}\p{N} _-]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^[ _-]+|[ _-]+$/g, '')
      .slice(0, 60);
    if (!cleaned) { toast.error('Digite um nome válido para a etiqueta'); return; }
    // Se já existe (case-insensitive), só seleciona.
    const existing = labels.find(l => l.title.toLowerCase() === cleaned.toLowerCase());
    if (existing) { setF({ label_id: existing.id }); setNewTagName(''); return; }
    setCreatingTag(true);
    try {
      // createLabel desembrulha pro Label no runtime (o backend normaliza o título
      // pra minúsculo) — o tipo diz LabelResponse, por isso o cast.
      const created = await labelsService.createLabel({ title: cleaned, color: '#34d399', show_on_sidebar: true }) as unknown as { id: string; title: string };
      const item = { id: String(created.id), title: created.title };
      setLabels(prev => (prev.some(l => l.id === item.id) ? prev : [...prev, item]));
      setF({ label_id: item.id });
      setNewTagName('');
      toast.success('Etiqueta criada e selecionada');
    } catch {
      toast.error('Não consegui criar a etiqueta');
    } finally {
      setCreatingTag(false);
    }
  };

  const avisoDeDestino = leadDestinationWarning(f);

  return (
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <UILabel>Corretor responsável</UILabel>
        <Seletor
          value={f.responsible_id ?? ''}
          onChange={e => setF({ responsible_id: e.target.value || null })}
          className={CLASSE_SELETOR}
        >
          <option value="">Nenhum</option>
          {tenantUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Seletor>

        {/* A exceção por IMÓVEL: tira este anúncio da roleta / do destino
            do portal e entrega ao responsável acima. Fica COLADA no
            seletor de propósito — ela decide sobre a pessoa escolhida
            ali, e separá-las faria procurar as duas em lugares
            diferentes. */}
        <label className="mt-2 flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={f.lead_goes_to_responsible === true}
            onChange={e => setF({ lead_goes_to_responsible: e.target.checked })}
          />
          <span>
            {LEAD_DESTINATION_LABEL}
            <span className="mt-0.5 block text-muted-foreground">{LEAD_DESTINATION_HELP}</span>
          </span>
        </label>
        {avisoDeDestino && (
          <p className="mt-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-600 dark:text-amber-400">
            {avisoDeDestino}
          </p>
        )}
      </div>
      <div>
        <UILabel>Captador</UILabel>
        <Seletor
          value={f.captor_id ?? ''}
          onChange={e => setF({ captor_id: e.target.value || null })}
          className={CLASSE_SELETOR}
        >
          <option value="">Nenhum</option>
          {tenantUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Seletor>
      </div>
      {/* Etiqueta do imóvel: o lead que entra pela página deste imóvel é etiquetado
          com essa etiqueta. Assim o funil fica geral e a etiqueta identifica o imóvel. */}
      <div>
        <UILabel>Etiqueta do imóvel</UILabel>
        <Seletor
          value={f.label_id ?? ''}
          onChange={e => setF({ label_id: e.target.value || null })}
          className={CLASSE_SELETOR}
        >
          <option value="">Gerar automaticamente pelo título</option>
          {labels.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
        </Seletor>
        <div className="mt-2 flex gap-2">
          <Input
            value={newTagName}
            onChange={e => setNewTagName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); createTag(); } }}
            placeholder="Criar nova etiqueta…"
            className="flex-1"
          />
          <Button type="button" variant="outline" onClick={createTag} disabled={creatingTag || !newTagName.trim()}>
            {creatingTag ? 'Criando…' : 'Criar e usar'}
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Aplicada ao lead capturado na página deste imóvel. Vazio = cria uma etiqueta
          automática com o título do imóvel.
        </p>
      </div>
    </div>
  );
}
