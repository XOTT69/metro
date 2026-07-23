import { useEffect, useState } from "react";

export function useNow(fixedNow?: Date) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (fixedNow) return;

    const clock = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(clock);
  }, [fixedNow]);

  return fixedNow ?? now;
}
