// Licensed under GPL-3.0. See LICENSE.
// Ported from Nook (GPL-3.0); see packages/tweaks/README.md.
(function () {
  'use strict';
  var flags = window.__universeFBFilter || {};
  if (window.__universeFBPrune) return;
  window.__universeFBPrune = true;

  var ORPHAN_BASE = 1000000;

  var CONNECTIONS = [
    { root: ['viewer', 'news_feed'] },
    { root: ['marketplace_home_feed'] },
  ];

  function isAd(node) {
    if (node.__typename === 'MarketplaceFeedAdStory') return true;
    for (var k in node) {
      var v = node[k];
      if (v && typeof v === 'object' && v.__typename === 'SponsoredData') return true;
    }
    return false;
  }

  var SUGGESTION_UNIT = /PeopleYouMayKnow|YouShouldJoin|Suggest|Recommend/;
  var SUGGESTION_KEYS = { recommendation_context: true, if_viewer_can_join_group: true };

  function hasSuggestionKey(o, depth) {
    if (!o || typeof o !== 'object' || depth > 14) return false;
    for (var k in o) {
      var v = o[k];
      if (SUGGESTION_KEYS[k] && v !== null && v !== undefined) return true;
      if (v && typeof v === 'object' && hasSuggestionKey(v, depth + 1)) return true;
    }
    return false;
  }

  function isSuggested(node) {
    var t = node.__typename;
    if (t !== 'Story') return SUGGESTION_UNIT.test(t || '');
    return hasSuggestionKey(node.comet_sections, 0);
  }

  function shouldRemove(node) {
    if (!node || typeof node !== 'object') return false;
    return (flags.ads && isAd(node)) ||
      (flags.reels && node.__typename === 'ShowcaseFeedUnit') ||
      (flags.suggested && isSuggested(node));
  }

  function at(o, keys) {
    for (var i = 0; i < keys.length && o; i++) o = o[keys[i]];
    return o;
  }

  function connectionFor(p) {
    if (!Array.isArray(p)) return null;
    for (var c = 0; c < CONNECTIONS.length; c++) {
      var root = CONNECTIONS[c].root, i = 0;
      while (i < root.length && p[i] === root[i]) i++;
      if (i === root.length && p[i] === 'edges' && typeof p[i + 1] === 'number') return CONNECTIONS[c];
    }
    return null;
  }

  function reset(c) { c.removed = 0; c.newIndex = {}; c.orphaned = {}; c.lastItem = null; c.streaming = true; }

  function handleFirst(c, conn) {
    reset(c);
    var edges = conn.edges, kept = [];
    for (var i = 0; i < edges.length; i++) {
      if (shouldRemove(edges[i] && edges[i].node)) { c.orphaned[i] = true; c.removed++; }
      else { c.newIndex[i] = kept.length; kept.push(edges[i]); }
    }
    if (c.removed) conn.edges = kept;
  }

  function handleStream(c, payload) {
    var d = payload.data, p = payload.path, idx = c.root.length + 1, n = p[idx];
    if (!c.streaming) return payload;

    if (p.length > idx + 1) {
      if (c.orphaned[n]) p[idx] = ORPHAN_BASE + n;
      else if (c.newIndex[n] !== undefined) p[idx] = c.newIndex[n];
      return payload;
    }

    if (shouldRemove(d && d.node)) {
      c.orphaned[n] = true;
      if (!c.lastItem) {
        d.node = null;
        c.newIndex[n] = n - c.removed;
        p[idx] = n - c.removed;
        c.lastItem = { path: p.slice(), data: d };
        return payload;
      }
      c.removed++;
      var repeat = {};
      for (var k in payload) repeat[k] = payload[k];
      repeat.path = c.lastItem.path.slice();
      repeat.data = c.lastItem.data;
      return repeat;
    }

    c.newIndex[n] = n - c.removed;
    p[idx] = n - c.removed;
    c.lastItem = { path: p.slice(), data: d };
    return payload;
  }

  function handle(o) {
    var d = o.data;
    if (!d || typeof d !== 'object') return null;
    if (o.path !== undefined) {
      var c = connectionFor(o.path);
      return c ? handleStream(c, o) : null;
    }
    var found = false;
    for (var i = 0; i < CONNECTIONS.length; i++) {
      var conn = at(d, CONNECTIONS[i].root);
      if (conn && Array.isArray(conn.edges)) { handleFirst(CONNECTIONS[i], conn); found = true; }
    }
    return found ? o : null;
  }

  function visit(o, depth) {
    if (!o || typeof o !== 'object' || depth > 40) return o;
    var handled = handle(o);
    if (handled) return handled;
    if (Array.isArray(o)) {
      for (var i = o.length - 1; i >= 0; i--) {
        if (flags.ads && o[i] && o[i].__typename === 'AdsSideFeedUnit') { o.splice(i, 1); continue; }
        o[i] = visit(o[i], depth + 1);
      }
    } else {
      for (var k in o) o[k] = visit(o[k], depth + 1);
    }
    return o;
  }

  var WANT = /"(news_feed|marketplace_home_feed|AdsSideFeedUnit)"/;
  window.__universeFBFilter = flags;
  var origParse = JSON.parse;
  JSON.parse = function (text) {
    var out = origParse.apply(this, arguments);
    if (out && typeof out === 'object' && typeof text === 'string' && WANT.test(text)) {
      try { out = visit(out, 0); } catch (e) {}
    }
    return out;
  };
})();
