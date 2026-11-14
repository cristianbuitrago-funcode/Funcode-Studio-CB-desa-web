import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { getProvider } from "@/lib/api/connection";
import { startConnectionManager, type ConnectionManager } from "@/lib/connection-manager";

interface ConnectionControls {
  /** Verdadero si la aplicación puede reiniciar el backend (solo escritorio). */
  canRestart: boolean;
  restartBackend: () => Promise<void>;
  pickDirectory: (initial?: string) => Promise<string | null>;
  canPickDirectory: boolean;
}

const Context = createContext<ConnectionControls | null>(null);

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [manager, setManager] = useState<ConnectionManager | null>(null);

  useEffect(() => {
    const started = startConnectionManager(queryClient);
    setManager(started);
    return () => started.stop();
  }, [queryClient]);

  const provider = getProvider();
  const controls: ConnectionControls = {
    canRestart: provider.managesProcess,
    canPickDirectory: provider.managesProcess,
    restartBackend: async () => {
      await manager?.restartBackend();
    },
    pickDirectory: (initial) => provider.pickDirectory(initial),
  };
  return <Context.Provider value={controls}>{children}</Context.Provider>;
}

export function useConnectionControls(): ConnectionControls {
  const value = useContext(Context);
  if (!value) throw new Error("ConnectionProvider no está montado.");
  return value;
}
