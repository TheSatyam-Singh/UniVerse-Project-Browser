// Licensed under GPL-3.0. See LICENSE.
// Ported from Nook (GPL-3.0); see packages/tweaks/README.md.
(function () {
    if (!/(^|\.)(instagram\.com|facebook\.com)$/.test(location.hostname)) return;

    const MP4 = /^https:\/\/[^/?#]*(cdninstagram\.com|fbcdn\.net)\/[^?#]*\.mp4/;
    const MAX_LEVELS = 40, MAX_DEPTH = 6, MAX_NODES = 20000;

    function collect(value, key, parent, depth, seen, out) {
        if (typeof value === 'string') {
            if (MP4.test(value)) out.push({ url: value, key, parent });
            return;
        }
        if (!value || typeof value !== 'object' || depth === 0 || seen.has(value) || seen.size > MAX_NODES) return;
        if (value.$$typeof || value instanceof Node) return;
        seen.add(value);
        let keys;
        try { keys = Object.keys(value); } catch { return; }
        for (const k of keys) {
            if (k.startsWith('_')) continue;   // Relay store internals hold every video on the page
            let v;
            try { v = value[k]; } catch { continue; }
            collect(v, k, value, depth - 1, seen, out);
        }
    }

    function score({ key, parent }) {
        const area = (+parent?.width || 0) * (+parent?.height || 0) || 1;
        const name = `${key} ${parent?.metadata?.quality ?? ''}`.toLowerCase();
        return area * (name.includes('hd') ? 4 : name.includes('sd') ? 1 : 2);
    }

    const MAX_FIBERS = 50000;
    function fiberOf(element) {
        let container = null;
        for (let node = element; node; node = node.parentElement) {
            const keys = Object.keys(node);
            const fiberKey = keys.find(k => k.startsWith('__reactFiber$'));
            if (fiberKey) return node[fiberKey];
            const containerKey = !container && keys.find(k => k.startsWith('__reactContainer$'));
            if (containerKey) container = node[containerKey];
        }
        const stack = container?.stateNode?.current ? [container.stateNode.current] : [];
        let found = null, foundNode = null, visited = 0;
        while (stack.length && visited++ < MAX_FIBERS) {
            const fiber = stack.pop();
            const node = fiber.tag === 4 ? fiber.stateNode?.containerInfo : fiber.stateNode;   // 4: portal
            if (node instanceof Element) {
                if (!node.contains(element)) continue;
                if (fiber.tag !== 4 && (!foundNode || foundNode.contains(node))) { found = fiber; foundNode = node; }
            }
            for (let child = fiber.child; child; child = child.sibling) stack.push(child);
        }
        return found;
    }

    function collectFiber(fiber, seen, out) {
        collect(fiber.memoizedProps, '', null, MAX_DEPTH, seen, out);
        if (fiber.tag === 1) return collect(fiber.memoizedState, '', null, MAX_DEPTH, seen, out);   // 1: class
        for (let hook = fiber.memoizedState, i = 0; hook && typeof hook === 'object' && i < 50; hook = hook.next, i++) {
            collect(hook.memoizedState, '', null, MAX_DEPTH, seen, out);
        }
    }

    document.addEventListener('nook-social-video-url', event => {
        const video = event.target;
        const seen = new Set();
        let fiber = fiberOf(video), best = null, level = 0;
        for (; fiber && level < MAX_LEVELS && !best; level++, fiber = fiber.return) {
            const found = [];
            collectFiber(fiber, seen, found);
            for (const candidate of found) if (!best || score(candidate) > score(best)) best = candidate;
        }
        if (!best) return;
        const size = best.parent?.width ? ` ${best.parent.width}x${best.parent.height}` : '';
        video.setAttribute('data-nook-video-url', JSON.stringify({ url: best.url, note: `${best.key}${size} level ${level - 1}` }));
    }, true);
})();
