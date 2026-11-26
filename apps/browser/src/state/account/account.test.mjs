import assert from "node:assert/strict";
import { test } from "node:test";

globalThis.acTestNativeModules = {};

const { buildAuthUrl, isTokenExpired, parseAuthRedirect, profileFromUserinfo } = await import("./googleSignIn.ts");

test("profileFromUserinfo maps a Google userinfo response", () => {
  assert.deepEqual(profileFromUserinfo({ sub: "123", name: "Satyam Singh", email: "satyam@example.com", picture: "https://example.com/p.jpg" }), {
    id: "123",
    name: "Satyam Singh",
    email: "satyam@example.com",
    picture: "https://example.com/p.jpg",
  });
  assert.deepEqual(profileFromUserinfo({ sub: "123", email: "satyam@example.com" }), {
    id: "123",
    name: "satyam@example.com",
    email: "satyam@example.com",
    picture: null,
  });
});

test("profileFromUserinfo rejects responses without an id or email", () => {
  assert.equal(profileFromUserinfo({ name: "No Id", email: "a@example.com" }), null);
  assert.equal(profileFromUserinfo({ sub: "123", name: "No Email" }), null);
  assert.equal(profileFromUserinfo(null), null);
  assert.equal(profileFromUserinfo("not an object"), null);
});

test("isTokenExpired treats tokens inside the leeway as expired", () => {
  const now = 1_000_000;
  assert.equal(isTokenExpired(now - 1, now), true);
  assert.equal(isTokenExpired(now + 30_000, now), true);
  assert.equal(isTokenExpired(now + 120_000, now), false);
});

test("buildAuthUrl asks Google for an offline PKCE code", () => {
  const url = buildAuthUrl("client.apps.googleusercontent.com", "verifier", "state-1");
  assert.match(url, /accounts\.google\.com\/o\/oauth2\/v2\/auth/);
  assert.match(url, /client_id=client\.apps\.googleusercontent\.com/);
  assert.match(url, /redirect_uri=http%3A%2F%2F127\.0\.0\.1%3A53682%2Funiverse-oauth/);
  assert.match(url, /response_type=code/);
  assert.match(url, /scope=openid%20profile%20email/);
  assert.match(url, /code_challenge_method=S256/);
  assert.match(url, /code_challenge=[A-Za-z0-9_-]+/);
  assert.match(url, /state=state-1/);
  assert.match(url, /access_type=offline/);
  assert.match(url, /prompt=consent/);
});

test("parseAuthRedirect returns the code only for a matching state", () => {
  assert.deepEqual(parseAuthRedirect("http://127.0.0.1:53682/universe-oauth?code=abc&state=s1", "s1"), { code: "abc" });
  assert.deepEqual(parseAuthRedirect("http://127.0.0.1:53682/universe-oauth?code=abc&state=other", "s1"), {
    error: "Sign-in didn't match this request",
  });
  assert.deepEqual(parseAuthRedirect("http://127.0.0.1:53682/universe-oauth?error=access_denied&state=s1", "s1"), { error: "access_denied" });
  assert.deepEqual(parseAuthRedirect("http://127.0.0.1:53682/universe-oauth?state=s1", "s1"), { error: "Google didn't grant access" });
});
