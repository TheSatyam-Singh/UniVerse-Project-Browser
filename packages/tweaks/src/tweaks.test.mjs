import assert from "node:assert/strict";
import { test } from "node:test";
import { isYouTubeTweaksHost, youTubeTweaksCss, youTubeTweaksScript, DEFAULT_YOUTUBE_TWEAKS } from "./youtubeTweaks.ts";
import { facebookTweaksScript, isFacebookHost } from "./facebookTweaks.ts";
import { isRedditHost, redditHotUrl, redditTweaksScript, DEFAULT_REDDIT_TWEAKS } from "./redditTweaks.ts";
import { isLikelyOAuthPopupUrl, isLikelyOAuthUrl } from "./oauth.ts";

test("youtube tweaks only run on www.youtube.com and youtube.com", () => {
  assert.equal(isYouTubeTweaksHost("www.youtube.com"), true);
  assert.equal(isYouTubeTweaksHost("youtube.com"), true);
  assert.equal(isYouTubeTweaksHost("music.youtube.com"), false);
});

test("youtube CSS hides Shorts, home sections, hover previews and sets the grid width", () => {
  const css = youTubeTweaksCss({
    ...DEFAULT_YOUTUBE_TWEAKS,
    hideShorts: true,
    hiddenHomeSections: ["posts", "filterChips"],
    videosPerRow: 5,
    noHoverPreview: true,
    frameThumbnails: true,
  });
  assert.match(css, /ytd-reel-shelf-renderer \{ display: none !important; \}/);
  assert.match(css, /ytd-rich-section-renderer:has\(ytd-post-renderer, ytd-backstage-post-thread-renderer\)/);
  assert.match(css, /--ytd-rich-grid-items-per-row: 5 !important/);
  assert.match(css, /ytd-video-preview \{ display: none !important; \}/);
  assert.match(css, /img\[data-universe-frame\]/);
  assert.match(css, /frosted-glass\.with-chipbar/);
  assert.equal(youTubeTweaksCss({ ...DEFAULT_YOUTUBE_TWEAKS, videosPerRow: 9 }), "");
  assert.equal(youTubeTweaksCss({ ...DEFAULT_YOUTUBE_TWEAKS, videosPerRow: 2 }), "");
});

test("youtube tweaks script is null when nothing is on, and parses with its config when built", () => {
  assert.equal(youTubeTweaksScript(DEFAULT_YOUTUBE_TWEAKS), null);
  const built = youTubeTweaksScript({ ...DEFAULT_YOUTUBE_TWEAKS, hideShorts: true });
  assert.match(built, /"css":"/);
  new Function(built);
});

test("facebook tweaks set the reels and suggested flags before the prune script", () => {
  assert.equal(isFacebookHost("facebook.com"), true);
  assert.equal(isFacebookHost("www.facebook.com"), true);
  assert.equal(isFacebookHost("notfacebook.com"), false);
  assert.equal(facebookTweaksScript({ hideReels: false, hideSuggested: false }), null);
  const built = facebookTweaksScript({ hideReels: true, hideSuggested: false });
  assert.match(built, /__universeFBFilter/);
  assert.match(built, /f\.reels = true; f\.suggested = false/);
  assert.match(built, /__universeFBPrune/);
  new Function(built);
});

test("reddit hot urls rewrite subreddit and custom feeds, and nothing else", () => {
  const on = { ...DEFAULT_REDDIT_TWEAKS, sortHot: true };
  assert.equal(redditHotUrl("https://www.reddit.com/r/askscience/", on), "https://www.reddit.com/r/askscience/hot/");
  assert.equal(redditHotUrl("https://reddit.com/user/me/m/feed/", on), "https://reddit.com/user/me/m/feed/hot/");
  assert.equal(redditHotUrl("https://www.reddit.com/r/askscience/comments/abc/x/", on), null);
  assert.equal(redditHotUrl("https://www.reddit.com/", on), null);
  assert.equal(redditHotUrl("https://old.reddit.com/r/askscience/", on), null);
  assert.equal(redditHotUrl("https://www.reddit.com/r/askscience/", DEFAULT_REDDIT_TWEAKS), null);
  assert.equal(isRedditHost("www.reddit.com"), true);
  assert.equal(isRedditHost("old.reddit.com"), false);
  new Function(redditTweaksScript);
});

test("oauth detection catches provider hosts, auth paths and auth query params", () => {
  assert.equal(isLikelyOAuthUrl("https://accounts.google.com/o/oauth2/auth?client_id=x"), true);
  assert.equal(isLikelyOAuthUrl("https://example.com/oauth2/authorize?client_id=x"), true);
  assert.equal(isLikelyOAuthUrl("https://example.com/callback?code=x"), false);
  assert.equal(isLikelyOAuthUrl("https://example.com/api?response_type=code"), true);
  assert.equal(isLikelyOAuthUrl("https://github.com/login"), false);
  assert.equal(isLikelyOAuthUrl("https://mygithub.com/oauth/authorize"), true);
  assert.equal(isLikelyOAuthPopupUrl("https://login.example.com/signin"), true);
  assert.equal(isLikelyOAuthPopupUrl("https://example.com/about"), false);
});
