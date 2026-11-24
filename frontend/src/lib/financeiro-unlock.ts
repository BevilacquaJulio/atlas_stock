const KEY = 'g5_financeiro_token';
const EVENT = 'g5:financeiro-unlock';

const notify = () => window.dispatchEvent(new Event(EVENT));

export const financeiroUnlockStore = {
  get(): string | null {
    return sessionStorage.getItem(KEY);
  },
  set(token: string) {
    sessionStorage.setItem(KEY, token);
    notify();
  },
  clear() {
    sessionStorage.removeItem(KEY);
    notify();
  },
  /** Para `useSyncExternalStore`: a tela volta a bloquear quando o token some. */
  subscribe(callback: () => void) {
    window.addEventListener(EVENT, callback);
    return () => window.removeEventListener(EVENT, callback);
  },
};
