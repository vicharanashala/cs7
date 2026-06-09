// "Exclusive open" coordination: app-wide state ensuring at most one keyed thing
// (dropdown, popover, expanded card, …) is open at once. Opening one closes the rest.
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface ExclusiveOpenCtx {
  openKey: string | null;
  requestOpen: (key: string) => void;
  requestClose: (key: string) => void;
}

const Ctx = createContext<ExclusiveOpenCtx>({
  openKey: null,
  requestOpen: () => {},
  requestClose: () => {},
});

export function ExclusiveOpenProvider({ children }: { children: ReactNode }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const requestOpen = useCallback((key: string) => setOpenKey(key), []);
  const requestClose = useCallback(
    (key: string) => setOpenKey((k) => (k === key ? null : k)),
    [],
  );
  return <Ctx.Provider value={{ openKey, requestOpen, requestClose }}>{children}</Ctx.Provider>;
}

/**
 * Exclusive-open hook. Only one key can be "open" across the whole app at a time.
 * Calling `open()` or `toggle()` on any instance automatically closes every other.
 */
export function useExclusiveOpen(key: string) {
  const { openKey, requestOpen, requestClose } = useContext(Ctx);
  const isOpen = openKey === key;

  const open = useCallback(() => requestOpen(key), [key, requestOpen]);
  const close = useCallback(() => requestClose(key), [key, requestClose]);
  const toggle = useCallback(() => {
    if (openKey === key) requestClose(key);
    else requestOpen(key);
  }, [openKey, key, requestOpen, requestClose]);

  return { isOpen, open, close, toggle };
}
