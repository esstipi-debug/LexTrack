import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const REDIRECT_AFTER_LOGIN_KEY = "lextrack:redirect_after_login";

function getOAuthUrl() {
  const kimiAuthUrl = import.meta.env.VITE_KIMI_AUTH_URL;
  const appID = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${kimiAuthUrl}/api/oauth/authorize`);
  url.searchParams.set("client_id", appID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "profile");
  url.searchParams.set("state", state);

  return url.toString();
}

export default function Login() {
  const handleSignIn = () => {
    // Persist post-login redirect destination so LandingRoute can pick it up
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect");
    if (redirect && redirect.startsWith("/")) {
      sessionStorage.setItem(REDIRECT_AFTER_LOGIN_KEY, redirect);
    } else {
      sessionStorage.removeItem(REDIRECT_AFTER_LOGIN_KEY);
    }
    window.location.href = getOAuthUrl();
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Welcome</CardTitle>
        </CardHeader>
        <CardContent>
          <Button className="w-full" size="lg" onClick={handleSignIn}>
            Sign in with Kimi
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export { REDIRECT_AFTER_LOGIN_KEY };
