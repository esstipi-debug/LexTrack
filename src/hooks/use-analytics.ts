import { trackEvent, identifyUser, trackPageview, resetAnalytics } from '@/lib/analytics';

export function useAnalytics() {
  return { trackEvent, identifyUser, trackPageview, resetAnalytics };
}
