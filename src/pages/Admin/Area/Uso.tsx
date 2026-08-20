import UserMetricsView from '@/pages/SuperAdmin/ClientInstances/UserMetricsView';

/**
 * Uso — reusa o UserMetricsView que já existia como aba dentro de Clientes.
 * É a base do health score da Fase 2 (dias sem login, tempo por tela).
 */
export default function AdminUso() {
  return (
    <div className="p-6">
      <div className="mb-4 border-l-4 border-primary pl-3">
        <h1 className="text-xl font-semibold">Uso</h1>
        <p className="text-sm text-muted-foreground">Quem usa, quanto tempo, em que tela</p>
      </div>
      <UserMetricsView />
    </div>
  );
}
