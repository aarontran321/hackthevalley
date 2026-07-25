"use client";

import { useCallback, useEffect, useState } from "react";

export function useStoredValue<T>(getter: () => T) {
  const [value, setValue] = useState<T | null>(null);
  const refresh = useCallback(() => setValue(getter()), [getter]);
  useEffect(() => {
    refresh();
    window.addEventListener("bumpsafe-storage", refresh);
    return () => window.removeEventListener("bumpsafe-storage", refresh);
  }, [refresh]);
  return [value, refresh] as const;
}
