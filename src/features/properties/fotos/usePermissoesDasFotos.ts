import { useCan } from '@/hooks/useCan';

// Mesmas chaves que o servidor confere em cada ação (PermissionRegistry:
// `property_photos.<ação>`). Corretor de fábrica: ver, ordenar e capa.
export function usePermissoesDasFotos() {
  const can = useCan();
  return {
    subir: can('property_photos', 'upload'),
    porEndereco: can('property_photos', 'create'),
    capa: can('property_photos', 'set_as_cover'),
    ordem: can('property_photos', 'reorder'),
    ocultar: can('property_photos', 'update'),
    excluir: can('property_photos', 'delete'),
  };
}
