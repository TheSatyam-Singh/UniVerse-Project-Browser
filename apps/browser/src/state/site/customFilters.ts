const DOMAIN = /^(\*\.)?([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;
const FILTER = /^(?:@@)?\|\|[^|\s]+\^?(?:\$[^\s]+)?$/i;
const URL_PATTERN = /^(?:\*|https?):\/\/[^\s]+$/i;

export function normalizeCustomRule(input: string): string | null {
  const rule = input.trim();
  if (!rule || /\s/.test(rule)) return null;
  if (DOMAIN.test(rule)) return `||${rule.replace(/^\*\./, "").toLowerCase()}^`;
  if (FILTER.test(rule) || URL_PATTERN.test(rule)) return rule;
  return null;
}

export const customFiltersText = (rules: string[]): string => rules.join("\n");
