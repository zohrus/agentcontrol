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
