let taken = 0;
let fullPageTaken = 0;

export function noteScreenshotTaken(fullPage: boolean) {
  taken++;
  if (fullPage) fullPageTaken++;
}

export function takeScreenshotCounts() {
  const counts = { screenshots_taken: taken, full_page_screenshots_taken: fullPageTaken };
  taken = 0;
  fullPageTaken = 0;
  return counts;
}
