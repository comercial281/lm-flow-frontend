// Pede um item por vez, em lotes paralelos de `size`, e entrega cada resultado
// assim que ele chega (a tabela vai se preenchendo cliente a cliente).
//
// - Falha de um item vira `{ ok: false }` para ELE; o lote segue.
// - `isStale()` verdadeiro = a tela já pediu outra leitura (Atualizar): não
//   começa lote novo e descarta o que chegar, para a leitura velha não
//   sobrescrever a nova.

export type BatchResult<T> = { ok: true; value: T } | { ok: false; error: unknown };

export async function loadInBatches<T>(
  ids: string[],
  size: number,
  fetchOne: (id: string) => Promise<T>,
  onResult: (id: string, result: BatchResult<T>) => void,
  isStale: () => boolean = () => false,
): Promise<void> {
  for (let i = 0; i < ids.length; i += size) {
    if (isStale()) return;
    const batch = ids.slice(i, i + size);
    await Promise.all(
      batch.map(async id => {
        let result: BatchResult<T>;
        try {
          result = { ok: true, value: await fetchOne(id) };
        } catch (error) {
          result = { ok: false, error };
        }
        if (!isStale()) onResult(id, result);
      }),
    );
  }
}
