/**
 * Persistência local com versão de esquema e validação.
 * Hoje só usa localStorage; a interface `RemoteSync` deixa o caminho pronto para uma sincronização
 * futura (ex.: Supabase) sem mudar quem lê e grava. Nada remoto é implementado nesta etapa.
 */
export interface VersionedStore<T> {
  load(): T;
  save(value: T): void;
  reset(): void;
}

export interface RemoteSync<T> {
  pull(): Promise<T | null>;
  push(value: T): Promise<void>;
}

interface Envelope<T> {
  v: number;
  data: T;
}

export function createStore<T>(key: string, version: number, defaults: () => T, validate: (x: unknown) => x is T, recover?: (x: unknown) => T): VersionedStore<T> {
  let lastGood: T | undefined;
  let unsaved = false;
  const copy = (value: T): T => JSON.parse(JSON.stringify(value)) as T;
  return {
    load() {
      if (unsaved && lastGood !== undefined) return copy(lastGood);
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return defaults();
        const env = JSON.parse(raw) as Envelope<unknown>;
        if (!env || env.v !== version) return defaults();
        const value = recover ? recover(env.data) : validate(env.data) ? env.data : defaults();
        lastGood = copy(value);
        return value;
      } catch {
        return lastGood === undefined ? defaults() : copy(lastGood);
      }
    },
    save(value) {
      try {
        lastGood = copy(value);
        unsaved = true;
        localStorage.setItem(key, JSON.stringify({ v: version, data: value } satisfies Envelope<T>));
        unsaved = false;
      } catch {
        /* sem armazenamento (aba privada etc.): o jogo segue sem salvar */
      }
    },
    reset() {
      lastGood = defaults();
      unsaved = true;
      try {
        localStorage.removeItem(key);
        unsaved = false;
      } catch {
        /* ignora */
      }
    },
  };
}
