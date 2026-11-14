// Licensed under GPL-3.0. See LICENSE.
// Ported from Nook (GPL-3.0); see packages/tweaks/README.md.
const universePlaying = v => !v.paused && !v.ended && v.readyState >= 2;
    const universeRefusesAutomatic = v => !universePlaying(v) || v.muted || v.volume === 0 || v.loop
        || v.videoHeight > v.videoWidth;
    function universePickVideo() {
        const playing = universePlaying;
        const area = v => { const r = v.getBoundingClientRect(); return r.width * r.height; };
        const found = [...document.querySelectorAll('video')];
        if (!found.some(playing)) {
            const roots = [document];
            while (roots.length) {
                for (const el of roots.pop().querySelectorAll('*')) {
                    if (!el.shadowRoot) continue;
                    roots.push(el.shadowRoot);
                    found.push(...el.shadowRoot.querySelectorAll('video'));
                }
            }
        }
        const score = v => (v.webkitPresentationMode === 'picture-in-picture' ? 8 : 0)
            + (playing(v) ? 4 : 0) + (!v.muted && v.volume > 0 ? 2 : 0);
        return found.filter(v => area(v) > 1 || v.webkitPresentationMode === 'picture-in-picture')
            .sort((a, b) => score(b) - score(a) || area(b) - area(a))[0] || null;
    }
