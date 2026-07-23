import { useCallback, useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
};

export function usePwaInstall(showToast: (message: string) => void) {
  const [installPrompt, setInstallPrompt] =
    useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => setInstallPrompt(null);

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const triggerInstall = useCallback(async () => {
    if (!installPrompt) {
      showToast("У меню браузера оберіть «Встановити застосунок»");
      return;
    }
    try {
      await installPrompt.prompt();
      setInstallPrompt(null);
    } catch {
      showToast("Не вдалося відкрити встановлення застосунку");
    }
  }, [installPrompt, showToast]);

  return { triggerInstall, canInstall: Boolean(installPrompt) };
}
