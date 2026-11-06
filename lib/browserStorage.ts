/** Browser preferences must never prevent the CRM from opening. Reads are
 * non-destructive: invalid legacy values stay on disk for support/recovery. */
export function storageAdapter(kind: 'localStorage' | 'sessionStorage') {
  return {
    getItem(key: string): string | null {
      try { return window[kind].getItem(key); } catch { return null; }
    },
    setItem(key: string, value: string): boolean {
      try { window[kind].setItem(key, value); return true; } catch { return false; }
    },
    removeItem(key: string): void {
      try { window[kind].removeItem(key); } catch { /* Storage can be disabled. */ }
    },
  };
}
export const localStore = storageAdapter('localStorage');
export const sessionStore = storageAdapter('sessionStorage');

export function readStoredArray<T>(storage: Pick<Storage, 'getItem'>, key: string, valid: (value: any) => boolean): T[] {
  try {
    const value: unknown = JSON.parse(storage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter(valid) as T[] : [];
  } catch { return []; }
}
export function readStoredRecord(storage: Pick<Storage, 'getItem'>, key: string): Record<string, any> {
  try {
    const value = JSON.parse(storage.getItem(key) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}
