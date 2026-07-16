import LogsView from '@/pages/SuperAdmin/ClientInstances/LogsView';

/**
 * Auditoria — reusa o LogsView que já existia como aba dentro de Clientes.
 * Aqui ele ganha URL própria (/admin/auditoria) em vez de viver escondido
 * atrás de um clique de aba.
 */
export default function AdminAuditoria() {
  return (
    <div className="p-6">
      <div className="mb-4 border-l-4 border-primary pl-3">
        <h1 className="text-xl font-semibold">Auditoria</h1>
        <p className="text-sm text-muted-foreground">Tudo que aconteceu, por cliente</p>
      </div>
      <LogsView />
    </div>
  );
}
