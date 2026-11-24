export function decorateUnderline(element) {
  // shortcut: live underline uses CSS Highlights; add a DOM fallback if older browsers are supported.
  if (!globalThis.CSS?.highlights || typeof Highlight === "undefined") return;
  const ranges = [], stack = [];
  element.querySelectorAll("[data-underline-marker]").forEach((node) => node.removeAttribute("data-underline-marker"));
  for (const marker of element.querySelectorAll('[data-type="html-inline"] > code')) {
    if (marker.textContent.toLowerCase() === "<u>") stack.push(marker.parentElement);
    else if (marker.textContent.toLowerCase() === "</u>" && stack.length) {
      const open = stack.pop(), close = marker.parentElement, range = document.createRange();
      range.setStartAfter(open); range.setEndBefore(close);
      ranges.push(range);
      open.setAttribute("data-underline-marker", ""); close.setAttribute("data-underline-marker", "");
    }
  }
  CSS.highlights.set("markdown-underline", new Highlight(...ranges));
}

export function underlineSelection(instance, range) {
  if (range.collapsed) return;
  const fragment = range.cloneContents();
  if (fragment.querySelector("img, video, audio, table, pre")) return;
  const ancestor = range.commonAncestorContainer;
  const selector = "p, h1, h2, h3, h4, h5, h6, li";
  const blocks = ancestor.nodeType === Node.ELEMENT_NODE
    ? [...(ancestor.matches(selector) ? [ancestor] : []), ...ancestor.querySelectorAll(selector)] : [];
  const ranges = blocks.filter((block) => range.intersectsNode(block) && !block.querySelector(":scope > p")).map((block) => {
    const part = document.createRange();
    part.selectNodeContents(block);
    const headingMarker = block.querySelector(':scope > [data-type="heading-marker"]');
    if (headingMarker) part.setStartAfter(headingMarker);
    const nested = block.querySelector("ol, ul");
    if (nested) part.setEndBefore(nested);
    if (range.compareBoundaryPoints(Range.START_TO_START, part) > 0) part.setStart(range.startContainer, range.startOffset);
    if (range.compareBoundaryPoints(Range.END_TO_END, part) < 0) part.setEnd(range.endContainer, range.endOffset);
    return part;
  });
  // Replace inline content per block; inserting a whole list into an existing item creates empty items.
  for (const part of ranges.length ? ranges : [range]) {
    if (part.collapsed) continue;
    const content = document.createElement("div");
    content.append(part.cloneContents());
    for (const [position, tag] of [["afterbegin", "&lt;u&gt;"], ["beforeend", "&lt;/u&gt;"]]) {
      content.insertAdjacentHTML(position, `<span data-type="html-inline" class="vditor-ir__node"><code class="vditor-ir__marker">${tag}</code></span>`);
    }
    const markdown = instance.vditor.lute.VditorIRDOM2Md(content.innerHTML).trim();
    if (markdown) {
      const selection = document.getSelection();
      selection.removeAllRanges();
      selection.addRange(part);
      instance.insertMD(markdown);
    }
  }
}
