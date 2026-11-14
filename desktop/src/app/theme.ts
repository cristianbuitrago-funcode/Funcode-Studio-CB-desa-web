import { useEffect } from "react";

import { useAppSettings } from "@/features/system/hooks";

const STORAGE_KEY = "fwa-theme";
export type Theme = "dark" | "light";

function stored(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset["theme"] = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme); // Preferencia visual, no es un dato sensible.
  } catch {
    // Almacenamiento no disponible: el tema se aplica igualmente.
  }
}

export function initTheme(): void {
  applyTheme(stored());
}

/** Mantiene el tema sincronizado con la configuración guardada en el backend. */
export function useThemeSync(): void {
  const theme = useAppSettings().data?.theme;
  useEffect(() => {
    if (theme) applyTheme(theme);
  }, [theme]);
}
