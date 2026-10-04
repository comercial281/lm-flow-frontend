/*
  Consulta do mapa da página pública do imóvel.
  Privacidade (decisão de 03/10): revenda sai só com a região (o servidor manda
  latitude/longitude nulos); empreendimento sai com o ponto exato.
*/
export interface DadosDoMapa {
  latitude?: number | null;
  longitude?: number | null;
  address_neighborhood?: string;
  address_city?: string;
  address_state?: string;
}

export interface ConsultaDoMapa { q: string; legenda: string; exato: boolean }

export function consultaDoMapa(p: DadosDoMapa): ConsultaDoMapa | null {
  const legenda = [p.address_neighborhood, p.address_city, p.address_state].filter(Boolean).join(', ');
  if (typeof p.latitude === 'number' && typeof p.longitude === 'number'
    && Number.isFinite(p.latitude) && Number.isFinite(p.longitude)) {
    return { q: `${p.latitude},${p.longitude}`, legenda, exato: true };
  }
  if (!legenda) return null;
  return { q: encodeURIComponent(legenda), legenda, exato: false };
}
