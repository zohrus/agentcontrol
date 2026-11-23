/** The recovery page's request box holds exactly this text. */
export async function expectRequestBoxToHold(
  page: { requestBoxText(): Promise<string> },
  text: string,
): Promise<void> {
  const shown = await page.requestBoxText();
  if (shown !== text) {
    throw new Error(`expected the request box to hold "${text}", but it holds "${shown}"`);
  }
}

/** The page's own script raised no errors. */
export function expectNoErrorsInThePage(errors: string[]): void {
  if (errors.length > 0) {
    throw new Error(`expected no errors in the page's script, but it raised: ${errors.join("; ")}`);
  }
}
