export const MEASURE_POPUP_SCRIPT = `
const measure = () => {
  const d = document.documentElement, b = document.body;
  return { w: Math.ceil(Math.max(d.scrollWidth, b ? b.scrollWidth : 0)), h: Math.ceil(Math.max(d.scrollHeight, b ? b.scrollHeight : 0)) };
};
const last = window.__universeSize;
const now = measure();
if (!last || last.w !== now.w || last.h !== now.h) {
  window.__universeSize = now;
  post("result", JSON.stringify(now));
} else {
  const ro = new ResizeObserver(() => {
    const m = measure();
    if (m.w === window.__universeSize.w && m.h === window.__universeSize.h) return;
    ro.disconnect();
    window.__universeSize = m;
    post("result", JSON.stringify(m));
  });
  ro.observe(document.documentElement);
  if (document.body) ro.observe(document.body);
}`;
