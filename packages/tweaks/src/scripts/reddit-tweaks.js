// Licensed under GPL-3.0. See LICENSE.
// Ported from Nook (GPL-3.0); see packages/tweaks/README.md.
    (() => {
      if (!/^(www\.)?reddit\.com$/.test(location.hostname)) return;
      const feed = /^\/(r\/[^/]+\/|user\/[^/]+\/m\/[^/]+\/)$/;
      document.addEventListener('click', (e) => {
        const a = e.composedPath().find((n) => n instanceof HTMLAnchorElement && n.href);
        if (!a) return;
        const u = new URL(a.href);
        const path = u.pathname.endsWith('/') ? u.pathname : u.pathname + '/';
        if (u.host !== location.host || !feed.test(path)) return;
        u.pathname = path + 'hot/';
        a.href = u.href;
      }, true);

      const HOME = 'shreddit-feed[reload-url*="home-feed"][reload-url*="feed=following"]';
      const KEY = 'universe.redditHomeSort';
      const wantsHot = () => { try { return localStorage.getItem(KEY) !== 'reddit'; } catch { return true; } };
      const remember = (mode) => { try { localStorage.setItem(KEY, mode); } catch {} };

      const style = document.createElement('style');
      style.textContent = `${HOME}:not([data-universe-hot]) > :is(article, hr, shreddit-ad-post) { visibility: hidden }`;
      style.disabled = !wantsHot();
      (document.head || document.documentElement).append(style);

      const card = (id) => fetch(`/svc/shreddit/partial-feed-post/${id}?render-mode=partial&postViewContext=AggregateFeed&feedViewType=cardView`)
        .then((r) => (r.ok ? r.text() : '')).catch(() => '');
      const hot = (after) => fetch(`/hot.json?limit=10&raw_json=1${after ? `&after=${after}` : ''}`)
        .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((j) => j.data);

      let early = location.pathname === '/' && wantsHot() ? hot(null) : null;
      early?.catch(() => {});
      setTimeout(() => { early = null; }, 30000);

      const page = async (state) => {
        if (!state.sentinel.isConnected) state.done = true;
        if (state.loading || state.done) return;
        state.loading = true;
        try {
          const first = !state.after;
          const data = await (first && early ? early : hot(state.after));
          if (first) early = null;
          const ids = data.children.map((c) => c.data.name).filter((id) => !state.seen.has(id));
          ids.forEach((id) => state.seen.add(id));
          const cards = ids.map(card);
          const range = document.createRange();
          range.selectNodeContents(state.feed);
          let cleared = !first;
          for (const c of cards) {
            const html = await c;
            if (!state.sentinel.isConnected) break;
            if (!html) continue;
            if (!cleared) {
              for (const el of [...state.feed.children]) {
                if (/^(ARTICLE|HR|SHREDDIT-AD-POST|FACEPLATE-LOADER)$/.test(el.tagName) || el.slot === 'load-after') el.remove();
              }
              cleared = true;
            }
            state.feed.insertBefore(range.createContextualFragment(html), state.sentinel);
            state.feed.dataset.universeHot = '';
          }
          state.after = data.after;
          state.done = !data.after;
        } catch {
          state.done = true;
        } finally {
          state.loading = false;
          state.feed.dataset.universeHot = '';
        }
        if (!state.done && state.sentinel.getBoundingClientRect().top < innerHeight + 1500) setTimeout(() => page(state));
      };

      const take = (feed) => {
        delete feed.dataset.universeHot;
        const sentinel = document.createElement('div');
        feed.append(sentinel);
        const state = { feed, sentinel, after: null, seen: new Set(), loading: false, done: false };
        new IntersectionObserver((entries) => {
          if (entries.some((e) => e.isIntersecting)) page(state);
        }, { rootMargin: '1500px' }).observe(sentinel);
        page(state);
      };

      const dropdown = () => document.querySelector('shreddit-sort-dropdown[sort-event="feed-sort-change"]');
      const addHotItem = (d) => {
        const best = d.querySelector('data[value="BEST"]');
        if (!best || d.querySelector('data[value="HOT"]')) return;
        const hot = best.cloneNode(true);
        hot.setAttribute('value', 'HOT');
        hot.querySelector('.text-body-2').textContent = 'Hot';
        best.after(hot);
      };
      const selectHot = (d) => {
        d.silentlySelectItemByValue?.('HOT');
        for (const item of d.querySelectorAll('data')) {
          const on = item.getAttribute('value') === 'HOT';
          item.querySelector('li')?.toggleAttribute('rpl-selected', on);
          const row = item.querySelector('[aria-selected]');
          row?.setAttribute('aria-selected', String(on));
          row?.classList.toggle('bg-neutral-background-selected', on);
        }
      };

      document.addEventListener('click', (e) => {
        const item = e.target.closest?.('shreddit-sort-dropdown[sort-event="feed-sort-change"] data');
        const feed = document.querySelector(HOME);
        if (!item || !feed) return;
        if (item.getAttribute('value') !== 'HOT') { remember('reddit'); style.disabled = true; return; }
        e.stopImmediatePropagation();
        e.preventDefault();
        remember('hot');
        style.disabled = false;
        document.body.click();
        selectHot(item.closest('shreddit-sort-dropdown'));
        take(feed);
      }, true);

      const find = () => {
        const d = dropdown();
        if (d) addHotItem(d);
        const feed = document.querySelector(`${HOME}:not([data-universe-hot-taken])`);
        if (!feed) return;
        feed.dataset.universeHotTaken = '';
        if (!wantsHot()) return;
        take(feed);
        if (d) selectHot(d);
      };
      let queued = false;
      new MutationObserver(() => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; find(); });
      }).observe(document.documentElement, { childList: true, subtree: true });
      find();
    })();
    