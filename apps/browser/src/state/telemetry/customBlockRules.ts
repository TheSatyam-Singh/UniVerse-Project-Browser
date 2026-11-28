let added = 0;

export function noteCustomBlockRuleAdded() {
  added++;
}

export function takeCustomBlockRuleCounts() {
  const counts = { custom_block_rules_added: added };
  added = 0;
  return counts;
}
