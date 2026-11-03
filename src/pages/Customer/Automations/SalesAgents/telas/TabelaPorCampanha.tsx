import type { WeeklyReportCampaign } from '@/services/salesAgents/salesAgentsService';

// "Por campanha" do relatório semanal (Fase 6): de onde vieram os leads novos da semana e
// até onde cada grupo andou. Os números vêm prontos do servidor; a conversa sem marca vem
// como "Sem campanha". "Leads" são os leads NOVOS da semana, por isso a soma pode ficar
// abaixo do "Leads atendidos" do topo.

const ETAPAS: Array<[keyof WeeklyReportCampaign['pararam'], string]> = [
  ['chegou', 'Chegou'],
  ['respondeu', 'Respondeu'],
  ['passou', 'Passou'],
  ['visita', 'Visita'],
];

function ondePararam(pararam: WeeklyReportCampaign['pararam'] | undefined): string {
  const partes = ETAPAS.filter(([chave]) => (pararam?.[chave] ?? 0) > 0).map(([chave, rotulo]) => `${rotulo} ${pararam![chave]}`);
  return partes.length > 0 ? partes.join(' · ') : '-';
}

export default function TabelaPorCampanha({ campanhas }: { campanhas: WeeklyReportCampaign[] }) {
  if (campanhas.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-md border border-sidebar-border">
        <table className="w-full text-sm" aria-label="Por campanha">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th scope="col" className="px-3 py-2 font-medium">Campanha</th>
              <th scope="col" className="px-3 py-2 font-medium text-right">Leads</th>
              <th scope="col" className="px-3 py-2 font-medium text-right">Responderam</th>
              <th scope="col" className="px-3 py-2 font-medium text-right">Passados</th>
              <th scope="col" className="px-3 py-2 font-medium text-right">Visitas</th>
              <th scope="col" className="px-3 py-2 font-medium text-right">Fora do perfil</th>
              <th scope="col" className="px-3 py-2 font-medium">Onde pararam</th>
            </tr>
          </thead>
          <tbody>
            {campanhas.map((c, i) => (
              <tr key={c.key ?? `sem-${i}`} className="border-t border-sidebar-border">
                <td className="px-3 py-2 font-medium">{c.key == null || c.kind === 'none' ? 'Sem campanha' : c.label}</td>
                <td className="px-3 py-2 text-right">{c.leads}</td>
                <td className="px-3 py-2 text-right">{c.responderam}</td>
                <td className="px-3 py-2 text-right">{c.passados}</td>
                <td className="px-3 py-2 text-right">{c.visitas}</td>
                <td className="px-3 py-2 text-right">{c.fora_do_perfil}</td>
                <td className="px-3 py-2 text-muted-foreground">{ondePararam(c.pararam)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Só leads novos da semana, então a soma pode ficar abaixo dos leads atendidos lá em cima. Em Onde pararam,
        cada lead conta uma vez, na etapa mais avançada que alcançou.
      </p>
    </div>
  );
}
