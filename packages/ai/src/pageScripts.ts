export function jsLiteral(value: string): string {
  return JSON.stringify(value);
}

export function wrapUntrusted(text: string, tag: string): string {
  return `<${tag}>\n${text.split(tag).join("")}\n</${tag}>`;
}

export function readPageContentScript(maxLength: number, selector?: string): string {
  if (selector) {
    return [
      "(function() {",
      `  const el = document.querySelector(${jsLiteral(selector)});`,
      "  if (!el) return { error: 'Element not found' };",
      "  return {",
      "    title: document.title,",
      "    url: window.location.href,",
      `    content: el.innerText.substring(0, ${maxLength})`,
      "  };",
      "})();",
    ].join("\n");
  }
  return [
    "(function() {",
    "  const clone = document.body.cloneNode(true);",
    "  clone.querySelectorAll('script, style, noscript').forEach(el => el.remove());",
    "  let text = clone.innerText || clone.textContent || '';",
    "  text = text.replace(/\\s+/g, ' ').trim();",
    `  if (text.length > ${maxLength}) text = text.substring(0, ${maxLength}) + '...';`,
    "  return { title: document.title, url: window.location.href, content: text };",
    "})();",
  ].join("\n");
}

export function clickElementScript(selector?: string, text?: string): string {
  if (selector) {
    return [
      "(function() {",
      `  const sel = ${jsLiteral(selector)};`,
      "  const el = document.querySelector(sel);",
      "  if (!el) return 'Element not found: ' + sel;",
      "  el.scrollIntoView({block: 'center'});",
      "  el.click();",
      "  return 'Clicked element: ' + (el.textContent || '').substring(0, 100).trim();",
      "})();",
    ].join("\n");
  }
  return [
    "(function() {",
    `  const query = ${jsLiteral(text ?? "")}.toLowerCase();`,
    "  const candidates = document.querySelectorAll('a, button, input[type=\"submit\"], input[type=\"button\"], [role=\"button\"], [onclick], [tabindex]');",
    "  let best = null;",
    "  let bestScore = Infinity;",
    "  for (const el of candidates) {",
    "    if (el.offsetParent === null && el.style.display !== 'contents') continue;",
    "    const label = (el.textContent || el.value || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();",
    "    const lower = label.toLowerCase();",
    "    if (lower === query) { best = el; bestScore = 0; break; }",
    "    if (lower.includes(query) && label.length < bestScore) { best = el; bestScore = label.length; }",
    "  }",
    "  if (!best) return 'No clickable element found matching: ' + query;",
    "  best.scrollIntoView({block: 'center'});",
    "  best.click();",
    "  return 'Clicked: ' + (best.textContent || best.value || '').substring(0, 100).trim();",
    "})();",
  ].join("\n");
}

export function getInteractiveElementsScript(filter: string, limit: number): string {
  return [
    "(function() {",
    `  const filter = ${jsLiteral(filter)}.toLowerCase();`,
    `  const limit = ${limit};`,
    "  const selectors = 'a[href], button, input, select, textarea, [role=\"button\"], [role=\"link\"], [role=\"menuitem\"], [onclick], [tabindex]';",
    "  const elements = document.querySelectorAll(selectors);",
    "  const results = [];",
    "  for (const el of elements) {",
    "    if (results.length >= limit) break;",
    "    if (el.offsetParent === null && el.style.display !== 'contents' && !el.closest('label')) continue;",
    "    const tag = el.tagName.toLowerCase();",
    "    const type = el.getAttribute('type') || '';",
    "    const text = (el.textContent || '').trim().substring(0, 80);",
    "    const value = el.value || '';",
    "    const ariaLabel = el.getAttribute('aria-label') || '';",
    "    const placeholder = el.getAttribute('placeholder') || '';",
    "    const href = el.getAttribute('href') || '';",
    "    const role = el.getAttribute('role') || '';",
    "    const name = el.getAttribute('name') || '';",
    "    const id = el.id || '';",
    "    const classes = el.className && typeof el.className === 'string' ? el.className.split(' ').slice(0, 3).join('.') : '';",
    "    const label = text || ariaLabel || placeholder || value;",
    "    if (filter && !label.toLowerCase().includes(filter) && !ariaLabel.toLowerCase().includes(filter) && !placeholder.toLowerCase().includes(filter)) continue;",
    "    if (!label && tag === 'input' && type === 'hidden') continue;",
    "    let selector = '';",
    "    if (id) selector = '#' + CSS.escape(id);",
    "    else if (name) selector = tag + '[name=\"' + name + '\"]';",
    "    else if (ariaLabel) selector = tag + '[aria-label=\"' + ariaLabel.replace(/\"/g, '\\\\\"') + '\"]';",
    "    else if (classes) selector = tag + '.' + classes.split('.').map(c => CSS.escape(c.trim())).filter(c => c).join('.');",
    "    const entry = { tag, text: text.substring(0, 60) };",
    "    if (type) entry.type = type;",
    "    if (href) entry.href = href.substring(0, 100);",
    "    if (ariaLabel) entry.ariaLabel = ariaLabel;",
    "    if (placeholder) entry.placeholder = placeholder;",
    "    if (selector) entry.selector = selector;",
    "    if (role) entry.role = role;",
    "    results.push(entry);",
    "  }",
    "  return JSON.stringify(results);",
    "})();",
  ].join("\n");
}

export function extractStructuredDataScript(kind: string, selectors: string[] = []): string {
  switch (kind) {
    case "schema_org":
      return [
        "(function() {",
        "  const scripts = document.querySelectorAll('script[type=\"application/ld+json\"]');",
        "  const data = [];",
        "  scripts.forEach(s => { try { data.push(JSON.parse(s.textContent)); } catch(e) {} });",
        "  return JSON.stringify(data, null, 2);",
        "})();",
      ].join("\n");
    case "open_graph":
      return [
        "(function() {",
        "  const og = {};",
        "  document.querySelectorAll('meta[property^=\"og:\"]').forEach(m => {",
        "    og[m.getAttribute('property')] = m.getAttribute('content');",
        "  });",
        "  return JSON.stringify(og, null, 2);",
        "})();",
      ].join("\n");
    case "meta":
      return [
        "(function() {",
        "  const meta = {};",
        "  document.querySelectorAll('meta[name], meta[property]').forEach(m => {",
        "    const key = m.getAttribute('name') || m.getAttribute('property');",
        "    meta[key] = m.getAttribute('content');",
        "  });",
        "  return JSON.stringify(meta, null, 2);",
        "})();",
      ].join("\n");
    case "custom":
      return [
        "(function() {",
        `  const selectors = ${JSON.stringify(selectors)};`,
        "  const results = {};",
        "  selectors.forEach(s => {",
        "    const els = document.querySelectorAll(s);",
        "    results[s] = Array.from(els).map(e => e.innerText.trim()).filter(t => t);",
        "  });",
        "  return JSON.stringify(results, null, 2);",
        "})();",
      ].join("\n");
    default:
      return "";
  }
}

export function summarizePageScript(): string {
  return [
    "(function() {",
    "  const clone = document.body.cloneNode(true);",
    "  clone.querySelectorAll('script, style, noscript, nav, footer, header').forEach(el => el.remove());",
    "  let text = clone.innerText || clone.textContent || '';",
    "  text = text.replace(/\\s+/g, ' ').trim();",
    "  if (text.length > 16000) text = text.substring(0, 16000) + '...';",
    "  return { title: document.title, url: window.location.href, content: text, length: text.length };",
    "})();",
  ].join("\n");
}

export function searchInPageScript(): string {
  return [
    "const text = document.body.innerText;",
    "const needle = query.toLowerCase();",
    "const hay = text.toLowerCase();",
    "const matches = [];",
    "let idx = needle ? hay.indexOf(needle) : -1;",
    "while (idx !== -1 && matches.length < 10) {",
    "  const start = Math.max(0, idx - 50);",
    "  const end = Math.min(text.length, idx + needle.length + 50);",
    "  matches.push({ index: idx, context: text.substring(start, end) });",
    "  idx = hay.indexOf(needle, idx + needle.length);",
    "}",
    "return JSON.stringify({ count: matches.length, matches: matches });",
  ].join("\n");
}

export function extractPageContextScript(): string {
  return [
    "(function() {",
    "  const title = document.title;",
    "  const url = window.location.href;",
    "  const selection = String(window.getSelection() || '').trim().substring(0, 2000);",
    "  const clone = document.body.cloneNode(true);",
    "  const scripts = clone.querySelectorAll('script, style, noscript');",
    "  scripts.forEach(el => el.remove());",
    "  let text = clone.innerText || clone.textContent || '';",
    "  text = text.replace(/\\s+/g, ' ').trim();",
    "  const truncated = text.length > 8000;",
    "  if (truncated) text = text.substring(0, 8000) + '...';",
    "  return { title: title, url: url, content: text, selection: selection, truncated: truncated };",
    "})();",
  ].join("\n");
}

export function formatPageContext(page: { title: string; url: string; content: string; selection: string; truncated: boolean }, tag: string, canSearch: boolean): string {
  const selectionPart = page.selection
    ? `\n<selected_text>\n${page.selection}\n</selected_text>`
    : "";
  const note =
    page.truncated && canSearch
      ? "\n\nThe page text above is only the start of the page. Use searchInPage to look for anything further down."
      : "";
  return (
    wrapUntrusted(
      `<title>${page.title}</title>\n<url>${page.url}</url>\n<content>\n${page.content}\n</content>${selectionPart}`,
      tag,
    ) +
    note +
    "\n\nUser Question: "
  );
}

export function webUrl(value: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  const scheme = parsed.protocol.replace(":", "").toLowerCase();
  if (scheme !== "http" && scheme !== "https") return null;
  return parsed;
}
