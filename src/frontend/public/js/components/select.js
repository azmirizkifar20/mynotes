export function createFeature({ actions, selector }) {
  const { escape: esc, icon } = actions;
  const controls = new Map();
  let opened = null, sequence = 0;
  const chevron = '<svg class="tb-select-chevron" aria-hidden="true" viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"/></svg>';
  function content(option) {
    return `${option.dataset.tone ? `<i class="tb-dot" data-tone="${esc(option.dataset.tone)}" aria-hidden="true"></i>` : ""}<span>${esc(option.textContent)}</span>`;
  }
  function close(restore = false) {
    if (!opened) return;
    const current = opened; opened = null;
    current.panel.hidePopover(); current.trigger.setAttribute("aria-expanded", "false"); current.trigger.removeAttribute("aria-activedescendant");
    if (restore && current.trigger.isConnected) current.trigger.focus();
  }
  function sync(control) {
    const { select, trigger } = control, option = select.selectedOptions[0];
    const html = option ? content(option) : "<span>Pilih opsi</span>";
    if (control.value.innerHTML !== html) control.value.innerHTML = html;
    trigger.disabled = select.disabled || !select.options.length;
    trigger.setAttribute("aria-label", `${control.label}: ${option?.textContent || "Pilih opsi"}`);
    if (opened === control && (trigger.disabled || !trigger.getClientRects().length)) close();
  }
  function active(control, index) {
    [...control.panel.children].forEach((item, i) => { item.dataset.active = String(i === index); });
    control.index = index;
    const option = control.panel.children[index];
    if (option) { control.trigger.setAttribute("aria-activedescendant", option.id); option.scrollIntoView({ block: "nearest" }); }
  }
  function open(control, last = false) {
    close(); sync(control); if (control.trigger.disabled) return;
    const { select, trigger, panel } = control; trigger.focus({ preventScroll: true });
    panel.innerHTML = [...select.options].map((option, i) => `<div class="tb-select-option" role="option" id="${panel.id}-${i}" data-index="${i}" aria-selected="${i === select.selectedIndex}" aria-disabled="${option.disabled}"><span class="tb-select-value">${content(option)}</span><span class="tb-select-check">${icon("check")}</span></div>`).join("");
    const rect = trigger.getBoundingClientRect(), below = innerHeight - rect.bottom - 10, above = rect.top - 10, up = below < 180 && above > below;
    panel.style.width = Math.min(innerWidth - 16, Math.max(180, rect.width)) + "px";
    panel.style.maxHeight = Math.min(280, Math.max(40, up ? above : below)) + "px";
    panel.showPopover(); panel.style.left = Math.max(8, Math.min(rect.left, innerWidth - panel.offsetWidth - 8)) + "px";
    panel.style.top = (up ? Math.max(8, rect.top - panel.offsetHeight - 5) : rect.bottom + 5) + "px";
    opened = control; trigger.setAttribute("aria-expanded", "true");
    const enabled = [...select.options].map((o, i) => o.disabled ? -1 : i).filter((i) => i >= 0);
    active(control, enabled.includes(select.selectedIndex) ? select.selectedIndex : last ? enabled.at(-1) : enabled[0]);
  }
  function choose(control, index) {
    if (!control.select.options[index] || control.select.options[index].disabled || control.select.disabled) return;
    control.select.selectedIndex = index; close(true); sync(control);
    control.select.dispatchEvent(new Event("input", { bubbles: true }));
    control.select.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function enhance(select) {
    if (controls.has(select) || select.multiple) return;
    const wrapper = document.createElement("span"); wrapper.className = "tb-custom-select";
    const trigger = document.createElement("button"); trigger.type = "button"; trigger.className = "tb-select-trigger";
    const panel = document.createElement("div"); panel.id = "tb-select-popup-" + (++sequence); panel.className = "tb-select-popup"; panel.popover = "manual"; panel.setAttribute("role", "listbox");
    const fieldLabel = select.labels?.[0]?.cloneNode(true);
    fieldLabel?.querySelectorAll("select").forEach((element) => element.remove());
    const label = select.getAttribute("aria-label") || fieldLabel?.textContent.trim() || "Pilihan";
    panel.setAttribute("aria-label", label); trigger.setAttribute("role", "combobox"); trigger.setAttribute("aria-haspopup", "listbox"); trigger.setAttribute("aria-expanded", "false"); trigger.setAttribute("aria-controls", panel.id);
    trigger.innerHTML = '<span class="tb-select-value"></span>' + chevron;
    select.before(wrapper); wrapper.append(select, trigger, panel); select.hidden = true;
    const control = { select, trigger, panel, label, value: trigger.firstElementChild, index: 0, typed: "", typedAt: 0 };
    controls.set(select, control); sync(control);
    trigger.addEventListener("click", () => opened === control ? close() : open(control));
    panel.addEventListener("pointerdown", (event) => event.preventDefault());
    panel.addEventListener("pointermove", (event) => { const option = event.target.closest("[data-index]"); if (option?.getAttribute("aria-disabled") === "false") active(control, Number(option.dataset.index)); });
    panel.addEventListener("click", (event) => { event.preventDefault(); const option = event.target.closest("[data-index]"); if (option) choose(control, Number(option.dataset.index)); });
    trigger.addEventListener("keydown", (event) => {
      const key = event.key, expanded = opened === control;
      if (key === "Tab") { close(); return; }
      if (key === "Escape") { if (expanded) { event.preventDefault(); event.stopPropagation(); close(true); } return; }
      if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(key)) {
        event.preventDefault(); event.stopPropagation();
        if (!expanded) { open(control, key === "ArrowUp"); return; }
        if (key === "Enter" || key === " ") { choose(control, control.index); return; }
        const available = [...select.options].map((o, i) => o.disabled ? -1 : i).filter((i) => i >= 0), at = available.indexOf(control.index);
        const next = key === "Home" ? 0 : key === "End" ? available.length - 1 : Math.max(0, Math.min(available.length - 1, at + (key === "ArrowDown" ? 1 : -1)));
        active(control, available[next]); return;
      }
      if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault(); if (!expanded) open(control);
        const now = Date.now(); control.typed = now - control.typedAt > 600 ? key : control.typed + key; control.typedAt = now;
        const index = [...select.options].findIndex((o) => !o.disabled && o.textContent.toLocaleLowerCase().startsWith(control.typed.toLocaleLowerCase()));
        if (index >= 0) active(control, index);
      }
    });
    select.addEventListener("invalid", (event) => { event.preventDefault(); open(control); });
    select.addEventListener("change", () => sync(control)); select.addEventListener("input", () => sync(control));
  }
  function refresh() {
    for (const [select, control] of controls) {
      if (!select.isConnected) { if (opened === control) close(); controls.delete(select); }
      else sync(control);
    }
    document.querySelectorAll(selector).forEach(enhance);
  }
  function bind() {
    new MutationObserver((records) => { if (records.some((record) => !record.target.closest(".tb-select-trigger,.tb-select-popup"))) refresh(); }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["disabled", "hidden"] });
    document.addEventListener("pointerdown", (event) => { if (opened && !opened.trigger.contains(event.target) && !opened.panel.contains(event.target)) close(); }, true);
    document.addEventListener("scroll", (event) => { if (opened && !opened.panel.contains(event.target)) close(); }, true);
    document.addEventListener("close", () => close(), true); window.addEventListener("resize", () => close()); refresh();
  }
  return { bind, refresh, close };
}
