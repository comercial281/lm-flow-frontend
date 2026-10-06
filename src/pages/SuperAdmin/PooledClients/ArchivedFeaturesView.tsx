import { useCallback, useEffect, useState } from 'react';
import { Archive } from 'lucide-react';
import Chave from '@/components/base/Chave';
import EmptyState from '@/components/base/EmptyState';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import api from '@/services/core/api';
import { CORPO_SECAO, ESQUELETO, SECAO, SELO, SUBTITULO_SECAO, TITULO_SECAO } from '@/pages/Admin/Area/estilo';

interface CatalogItem {
  key: string;
  label: string;
  group: string;
}

// Convenção do catálogo (config/lm_flow_features.yml, backend): o primeiro item
// de cada grupo tem key === group — é o toggle do MENU INTEIRO. Aqui só faz
// sentido arquivar menus inteiros, não funções soltas de dentro deles.
function menuLevelItems(catalog: CatalogItem[]): CatalogItem[] {
  return catalog.filter(item => item.key === item.group);
}

/**
 * Plataforma → Menus arquivados.
 *
 * Um menu arquivado some do CRM para TODO MUNDO (clientes, equipe e o próprio
 * super-admin) até ser desarquivado aqui. Por isso arquivar confirma (06/10);
 * desarquivar devolve o menu e não pergunta.
 */
export default function ArchivedFeaturesView() {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [archivedKeys, setArchivedKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErro(false);
    try {
      const res = await api.get('/super/pooled_tenants/archived_features');
      setCatalog(res.data?.data?.catalog ?? []);
      setArchivedKeys(res.data?.data?.keys ?? []);
    } catch {
      setErro(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // A Chave vira na hora; `false` desiste (volta sem aviso) e erro do servidor a
  // faz voltar com o motivo.
  const mudar = async (item: CatalogItem, arquivar: boolean): Promise<boolean> => {
    if (
      arquivar &&
      !(await confirmar({
        titulo: `Esconder ${item.label} de todos os clientes?`,
        descricao: 'Some também para você e para a equipe.',
        rotuloDaAcao: 'Arquivar',
        destrutivo: true,
      }))
    ) {
      return false;
    }
    const res = await api.patch('/super/pooled_tenants/update_archived_features', { key: item.key, archived: arquivar });
    setArchivedKeys(
      res.data?.data?.keys ?? (arquivar ? [...archivedKeys, item.key] : archivedKeys.filter(k => k !== item.key)),
    );
    return true;
  };

  const items = menuLevelItems(catalog);

  return (
    <div className="mx-auto max-w-2xl">
      <section aria-labelledby="menus-arquivados" className={SECAO}>
        <div className="flex items-start gap-3">
          <Archive className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h3 id="menus-arquivados" className={TITULO_SECAO}>Menus arquivados</h3>
            <p className={SUBTITULO_SECAO}>
              Um menu arquivado some do CRM para todo mundo (os clientes, a equipe e você) até ser
              desarquivado aqui. Serve para tirar do ar uma tela em construção sem mexer em código. É
              diferente das Funções de cada cliente: lá se liga e desliga por cliente; aqui sai do sistema
              inteiro.
            </p>
          </div>
        </div>
        <div className={CORPO_SECAO}>
          {loading ? (
            <div className={`${ESQUELETO} h-48`} />
          ) : erro ? (
            <EmptyState tipo="erro" aoTentarDeNovo={() => void load()} className="py-8" />
          ) : items.length === 0 ? (
            <EmptyState
              title="Nenhum menu no catálogo"
              description="O catálogo de funções do servidor não devolveu nenhum menu."
              className="py-8"
            />
          ) : (
            <ul className="divide-y rounded-lg border">
              {items.map(item => {
                const arquivado = archivedKeys.includes(item.key);
                return (
                  <li key={item.key} className="flex items-center gap-3 px-3 py-2.5">
                    <Chave
                      className="flex-1"
                      rotulo={`Arquivar ${item.label}`}
                      ligada={arquivado}
                      aoMudar={v => mudar(item, v)}
                    />
                    {arquivado && <span className={`${SELO} text-muted-foreground`}>Fora do ar</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
      {dialogoDeConfirmacao}
    </div>
  );
}
