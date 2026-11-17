// Camada única de persistência (ADR-003). Trocar por chamadas HTTP aqui
// é o caminho para um backend real sem mexer nas telas.
const PREFIX = 'etd.v1.';

export const storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) {
      console.warn('storage.get falhou', key, e);
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      throw new Error('Não foi possível salvar (armazenamento cheio ou bloqueado).');
    }
  },
  remove(key) {
    localStorage.removeItem(PREFIX + key);
  },
};
