import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { BaseHeader, Pagina } from '@/components/base';
import RolesPage from '@/pages/Customer/Settings/Roles';

/* Lista completa e antiga de cargos (editar, duplicar, histórico, excluir), na
   moldura da casa. Fica fora da aba Cargos, que mostra só os cartões. */
export default function RolesFullListPage() {
  return (
    <Pagina
      acima={
        <Link to="/equipe?aba=cargos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Voltar para os cargos
        </Link>
      }
      cabecalho={<BaseHeader title="Lista completa de permissões" subtitle="Editar, duplicar, ver o histórico e excluir cargos" />}
    >
      <RolesPage embedded />
    </Pagina>
  );
}
