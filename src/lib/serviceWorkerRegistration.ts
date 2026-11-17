export function registerServiceWorker(): () => void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator))
    return () => {};
  let active = true;
  const register = () => {
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((registration) => {
        const ready = () => {
          if (active && registration.waiting)
            window.dispatchEvent(new Event("sca-update-ready"));
        };
        ready();
        registration.addEventListener("updatefound", () =>
          registration.installing?.addEventListener("statechange", ready),
        );
      })
      .catch(() => window.dispatchEvent(new Event("sca-worker-error")));
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
  return () => {
    active = false;
    window.removeEventListener("load", register);
  };
}
export async function activateAvailableUpdate() {
  const registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration?.waiting) return;
  await new Promise<void>((resolve) => {
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => {
        resolve();
        window.location.reload();
      },
      { once: true },
    );
    registration.waiting!.postMessage({ type: "ACTIVATE_UPDATE" });
  });
}
