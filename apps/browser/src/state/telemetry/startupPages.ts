let opened = 0;

export function noteStartupPagesOpened(pages: number) {
  opened += pages;
}

export function takeStartupPagesCounts() {
  const counts = { startup_pages_opened: opened };
  opened = 0;
  return counts;
}
