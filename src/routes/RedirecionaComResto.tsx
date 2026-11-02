import { Navigate, useLocation } from 'react-router-dom';

// Redirecionamento de endereço antigo que MANTÉM o resto do endereço (busca e trecho).
// O `<Navigate to="/x" />` solto joga fora o `?...#...` e quebra link salvo.
export default function RedirecionaComResto({ para }: { para: string }) {
  const { search, hash } = useLocation();
  return <Navigate to={{ pathname: para, search, hash }} replace />;
}
