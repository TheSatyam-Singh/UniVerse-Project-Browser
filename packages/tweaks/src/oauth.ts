export const OAUTH_PROVIDER_HOSTS: ReadonlySet<string> = new Set([
  "accounts.google.com",
  "identitytoolkit.googleapis.com",
  "securetoken.googleapis.com",
  "login.microsoftonline.com",
  "login.live.com",
  "login.windows.net",
  "b2clogin.com",
  "appleid.apple.com",
  "idmsa.apple.com",
  "auth0.com",
  "okta.com",
  "oktapreview.com",
  "onelogin.com",
  "pingidentity.com",
  "ping.one",
  "pingone.com",
  "pingone.eu",
  "pingone.asia",
  "pingone.ca",
  "cloudflareaccess.com",
  "signin.aws.amazon.com",
  "auth.aws.amazon.com",
  "amazoncognito.com",
  "api.twitter.com",
  "id.twitch.tv",
  "accounts.spotify.com",
  "login.yahoo.com",
  "public-api.wordpress.com",
  "login.salesforce.com",
  "test.salesforce.com",
  "account.box.com",
  "id.atlassian.com",
  "auth.atlassian.com",
  "ims-na1.adobelogin.com",
  "connect.stripe.com",
  "accounts.shopify.com",
  "login.twilio.com",
]);

const STRONG_OAUTH_PATHS = [
  "/oauth2/authorize",
  "/oauth/authorize",
  "/oauth2/token",
  "/oauth/token",
  "/oauth2/",
  "/oauth/",
  "/openid-connect/",
  "/protocol/openid-connect/",
  "/realms/",
  "/connect/authorize",
  "/connect/token",
  "/saml/",
  "/saml2/",
  "/.well-known/openid-configuration",
];

const OAUTH_QUERY_PARAMS = ["client_id=", "redirect_uri=", "response_type=", "grant_type=", "id_token=", "access_token="];

const OAUTH_SUBDOMAIN_PREFIXES = ["login.", "auth.", "sso.", "oauth.", "signin.", "identity.", "id.", "account.", "accounts."];
const LOOSE_OAUTH_PATHS = ["/signin", "/login", "/callback", "/sso", "/logout"];

function matchesProvider(host: string): boolean {
  for (const known of OAUTH_PROVIDER_HOSTS) {
    if (host === known || host.endsWith(`.${known}`)) return true;
  }
  return false;
}

export function isLikelyOAuthUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();
  const query = parsed.search.toLowerCase();
  if (matchesProvider(host)) return true;
  if (STRONG_OAUTH_PATHS.some((p) => path.includes(p))) return true;
  return OAUTH_QUERY_PARAMS.some((p) => query.includes(p));
}

export function isLikelyOAuthPopupUrl(url: string): boolean {
  if (isLikelyOAuthUrl(url)) return true;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();
  const query = parsed.search.toLowerCase();
  if (OAUTH_SUBDOMAIN_PREFIXES.some((p) => host.startsWith(p))) return true;
  if (LOOSE_OAUTH_PATHS.some((p) => path.includes(p))) return true;
  return query.includes("scope=");
}
