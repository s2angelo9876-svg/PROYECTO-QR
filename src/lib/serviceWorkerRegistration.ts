export function registerServiceWorker(): () => void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return () => {};

  // Hydration can finish after load. Registration must work in both cases.
  const register = () => {
    void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch(() => window.dispatchEvent(new Event('sca-worker-error')));
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
  // Updates wait for all old clients to close. Never reload during a capture.
  return () => window.removeEventListener('load', register);
}
