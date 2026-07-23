import { useCallback, useEffect, useRef, useState } from "react";

export function useToast(durationMs = 2_600) {
  const [toast, setToast] = useState("");
  const timeoutRef = useRef<number | null>(null);

  const showToast = useCallback(
    (message: string) => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
      setToast(message);
      timeoutRef.current = window.setTimeout(() => {
        setToast("");
        timeoutRef.current = null;
      }, durationMs);
    },
    [durationMs],
  );

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    },
    [],
  );

  return { toast, showToast };
}
