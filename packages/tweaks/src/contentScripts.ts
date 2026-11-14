import { TWEAK_SCRIPTS } from "./scriptSources.ts";
import { sha256Hex } from "./sha256.ts";
import { isYouTubeDomain, SponsorBlockClient } from "./sponsorBlock.ts";
import { boostCssFor, matchingBoosts } from "./boost.ts";
import { downloadSiteMatches, enabledDownloadDomains, facebookTweaksScript, isFacebookHost, socialDownloadScript, socialVideoSourceScript } from "./facebookTweaks.ts";
import { isRedditHost, redditTweaksScript } from "./redditTweaks.ts";
import { isYouTubeTweaksHost, youTubeTweaksScript } from "./youtubeTweaks.ts";
import type { TweaksSettings } from "./settings.ts";

export type ContentScriptWorld = "page" | "isolated";
export type ContentScriptRunAt = "documentStart" | "documentEnd";

export type ContentScript = {
  id: string;
  source: string;
  sourceHash: string;
  runAt: ContentScriptRunAt;
  world: ContentScriptWorld;
  mainFrameOnly: boolean;
};

function script(id: string, source: string, runAt: ContentScriptRunAt, world: ContentScriptWorld): ContentScript {
  return { id, source, sourceHash: sha256Hex(source).slice(0, 12), runAt, world, mainFrameOnly: true };
}

export const SPONSORBLOCK_SCRIPT_ID = "universe-sponsorblock";
export const YOUTUBE_TWEAKS_SCRIPT_ID = "universe-youtube-tweaks";
export const FACEBOOK_TWEAKS_SCRIPT_ID = "universe-facebook-tweaks";
export const REDDIT_TWEAKS_SCRIPT_ID = "universe-reddit-tweaks";
export const SOCIAL_DOWNLOAD_SCRIPT_ID = "universe-social-download";
export const SOCIAL_VIDEO_SOURCE_SCRIPT_ID = "universe-social-video-source";
export const BOOST_STYLE_SCRIPT_ID = "universe-boost-style";
export const BOOST_STYLE_ELEMENT_ID = "universe-boost-style";

export function tweakScriptsFor(url: string, settings: TweaksSettings): ContentScript[] {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return [];
  }
  const out: ContentScript[] = [];
  if (settings.sponsorBlockEnabled && isYouTubeDomain(host)) {
    out.push(script(SPONSORBLOCK_SCRIPT_ID, TWEAK_SCRIPTS.youtubeSponsorblock, "documentStart", "isolated"));
  }
  if (isYouTubeTweaksHost(host)) {
    const source = youTubeTweaksScript(settings.youTube);
    if (source) out.push(script(YOUTUBE_TWEAKS_SCRIPT_ID, source, "documentStart", "isolated"));
  }
  if (isFacebookHost(host)) {
    const source = facebookTweaksScript(settings.facebook);
    if (source) out.push(script(FACEBOOK_TWEAKS_SCRIPT_ID, source, "documentStart", "page"));
  }
  if (isRedditHost(host) && settings.reddit.sortHot) {
    out.push(script(REDDIT_TWEAKS_SCRIPT_ID, redditTweaksScript, "documentStart", "page"));
  }
  const domains = enabledDownloadDomains(settings);
  if (downloadSiteMatches(host, domains)) {
    const source = socialDownloadScript(domains);
    if (source) out.push(script(SOCIAL_DOWNLOAD_SCRIPT_ID, source, "documentStart", "isolated"));
    out.push(script(SOCIAL_VIDEO_SOURCE_SCRIPT_ID, socialVideoSourceScript, "documentStart", "page"));
  }
  return out;
}

export function boostStyleScriptFor(url: string, settings: TweaksSettings): ContentScript | null {
  const css = boostCssFor(url, settings.boosts);
  return script(BOOST_STYLE_SCRIPT_ID, boostStyleScript(css), "documentStart", "isolated");
}

export function boostStyleScript(css: string): string {
  return `(function(css){var s=document.getElementById('${BOOST_STYLE_ELEMENT_ID}');if(!css){if(s)s.remove();return;}if(s&&s.textContent===css)return;if(!s){s=document.createElement('style');s.id='${BOOST_STYLE_ELEMENT_ID}';}s.textContent=css;var p=document.head||document.documentElement;if(p)p.appendChild(s);else document.addEventListener('DOMContentLoaded',function(){if(!document.getElementById('${BOOST_STYLE_ELEMENT_ID}'))(document.head||document.documentElement).appendChild(s);},{once:true});})(${JSON.stringify(css)});`;
}

export function boostRunScripts(url: string, settings: TweaksSettings): { boostId: string; script: string }[] {
  return matchingBoosts(url, settings.boosts)
    .filter((b) => b.scriptEnabled && b.script.length > 0)
    .map((b) => ({ boostId: b.id, script: `try {\n${b.script}\n} catch (e) { console.error('UniVerse Boost script:', e); }` }));
}

export function sponsorBlockDeliverScript(
  segments: Parameters<typeof SponsorBlockClient.deliverScript>[0],
  options: Parameters<typeof SponsorBlockClient.deliverScript>[1],
): string {
  return SponsorBlockClient.deliverScript(segments, options);
}

export const zapPickerScript: string = `return new Promise(function(resolve){
  var box=document.createElement('div');
  box.style.cssText='position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #ff4d4f;background:rgba(255,77,79,.18);border-radius:4px;display:none';
  document.documentElement.appendChild(box);
  var cur=null, prevCursor=document.documentElement.style.cursor;
  document.documentElement.style.cursor='crosshair';
  function ok(el){return el&&el!==document.documentElement&&el!==document.body&&el!==box;}
  function sel(el){
    var parts=[];
    while(el&&el.nodeType===1&&el!==document.documentElement){
      if(el.id&&/^[A-Za-z][\\w-]*$/.test(el.id)&&document.querySelectorAll('#'+el.id).length===1){parts.unshift('#'+el.id);break;}
      var p=el.tagName.toLowerCase(),par=el.parentElement;
      if(par){var same=[].filter.call(par.children,function(c){return c.tagName===el.tagName;});if(same.length>1)p+=':nth-of-type('+(same.indexOf(el)+1)+')';}
      parts.unshift(p);el=par;
      if(document.querySelectorAll(parts.join('>')).length===1)break;
    }
    return parts.join('>');
  }
  function done(v){
    ['mousemove','click','keydown'].forEach(function(t){document.removeEventListener(t,h[t],true);});
    box.remove();document.documentElement.style.cursor=prevCursor;window.__universeZapCancel=null;resolve(v);
  }
  var h={
    mousemove:function(e){cur=e.target;if(!ok(cur)){box.style.display='none';return;}
      var r=cur.getBoundingClientRect();box.style.display='block';
      box.style.left=r.left+'px';box.style.top=r.top+'px';box.style.width=r.width+'px';box.style.height=r.height+'px';},
    click:function(e){e.preventDefault();e.stopPropagation();done(ok(e.target)?sel(e.target):'');},
    keydown:function(e){if(e.key==='Escape'){e.preventDefault();done('');}}
  };
  for(var t in h)document.addEventListener(t,h[t],true);
  window.__universeZapCancel=function(){done('');};
});`;

export const cancelZapPickerScript = "window.__universeZapCancel&&window.__universeZapCancel()";
