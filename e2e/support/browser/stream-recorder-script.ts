/**
 * Runs in the page. After every change of the page it notes, for each agent message (an element
 * marked `data-markdown`): its blocks (identity and tag), its shown text, and the thinking boxes
 * (height and scroll). It also keeps the blocks that were removed from a message, whether a
 * permission card was on the page, the commits seen and the long tasks the browser reported.
 * It remembers the first block of the first message, to say later whether it is still the same element.
 */
export const STREAM_RECORDER_SCRIPT = `(() => {
  if (window.__stream) return;
  const ids = new WeakMap();
  let next = 1;
  const idOf = (node) => {
    if (!ids.has(node)) ids.set(node, next++);
    return ids.get(node);
  };
  const state = { samples: [], removedBlocks: [], longTasks: [], commits: 0 };
  const first = { node: null };
  const messages = () => [...document.querySelectorAll("[data-markdown]")];
  const hasButton = (name) =>
    [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === name);
  function sample() {
    first.node ??= messages()[0]?.children[0] ?? null;
    const permission = hasButton("Allow");
    const thoughts = [...document.querySelectorAll('[data-testid="thought"]')].map((t) => {
      const box = t.firstElementChild;
      return { height: box.clientHeight, scrollTop: box.scrollTop, scrollHeight: box.scrollHeight };
    });
    messages().forEach((root, index) => {
      const blocks = [...root.children].map((el) => ({ id: idOf(el), tag: el.tagName.toLowerCase() }));
      const text = root.textContent;
      const tables = root.querySelectorAll("table").length;
      const columns = root.querySelectorAll("th").length;
      const bolds = root.querySelectorAll("b").length;
      state.samples.push({ message: index, blocks, text, tables, columns, bolds, permission, thoughts });
    });
    if (messages().length === 0) {
      const empty = { message: -1, blocks: [], text: "", tables: 0, columns: 0, bolds: 0 };
      state.samples.push({ ...empty, permission, thoughts });
    }
  }
  const observer = new MutationObserver((records) => {
    state.commits += 1;
    for (const record of records) {
      const root = record.target instanceof Element ? record.target.closest("[data-markdown]") : null;
      const isRoot = record.target instanceof Element && record.target.hasAttribute("data-markdown");
      if (!root || !isRoot) continue;
      for (const node of record.removedNodes) state.removedBlocks.push(node.nodeName.toLowerCase());
    }
    sample();
  });
  observer.observe(document, { subtree: true, childList: true, characterData: true });
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) state.longTasks.push(entry.duration);
    }).observe({ entryTypes: ["longtask"] });
  } catch (error) {
    // Long tasks are not reported by this browser: the list stays empty.
  }
  window.__stream = {
    state,
    firstBlockIsStillShown: () =>
      first.node !== null && first.node.isConnected && messages()[0]?.children[0] === first.node,
  };
  sample();
})();`;
