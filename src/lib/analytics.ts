import posthog from 'posthog-js';

export function initAnalytics() {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  const host = import.meta.env.VITE_POSTHOG_HOST ?? 'https://app.posthog.com';
  if (!key) return; // disabled when key not set
  posthog.init(key, { api_host: host, autocapture: false, capture_pageview: false });
}

export function identifyUser(userId: number, traits?: Record<string, unknown>) {
  if (!posthog.__loaded) return;
  posthog.identify(String(userId), traits);
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (!posthog.__loaded) return;
  posthog.capture(event, properties);
}

export function trackPageview(path: string) {
  if (!posthog.__loaded) return;
  posthog.capture('$pageview', { $current_url: path });
}

export function resetAnalytics() {
  if (!posthog.__loaded) return;
  posthog.reset();
}
