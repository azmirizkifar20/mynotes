export const taskTags = (board, task) => (board.tags || []).filter((tag) => (task.tagIds || []).includes(tag.id));

export function tagsHTML(board, task, esc, limit = 2) {
  const tags = taskTags(board, task);
  return tags.length ? `<ul class="tb-tags" aria-label="Tag task">${tags.slice(0, limit).map((tag) => `<li title="${esc(tag.name)}">${esc(tag.name)}</li>`).join("")}${tags.length > limit ? `<li class="tb-tag-more" title="${esc(tags.slice(limit).map((tag) => tag.name).join(", "))}"><span aria-hidden="true">+${tags.length - limit}</span><span class="sr-only">Tag lainnya: ${esc(tags.slice(limit).map((tag) => tag.name).join(", "))}</span></li>` : ""}</ul>` : "";
}

export function tagChoices(tags, selected, esc) {
  return tags.length ? tags.map((tag) => `<label class="tb-tag-choice"><input type="checkbox" value="${esc(tag.id)}" ${(selected || []).includes(tag.id) ? "checked" : ""}><span>${esc(tag.name)}</span></label>`).join("") : '<p class="tb-hint">Belum ada tag. Buat melalui Kelola tag di halaman papan.</p>';
}

export function tagRows(tags, tasks, { escape: esc, icon }) {
  return tags.map((tag, index) => `<div class="tb-tag-row" data-board-tag-id="${esc(tag.id)}"><input class="text-input" aria-label="Nama tag ${index + 1}" value="${esc(tag.name)}" maxlength="32" required placeholder="Nama tag"><span class="tb-hint">${tasks.filter((task) => (task.tagIds || []).includes(tag.id)).length} task</span><button type="button" class="icon-button" data-action="confirmBoardTagDelete" data-arg="${esc(tag.id)}" aria-label="Hapus tag ${esc(tag.name || "tanpa nama")}">${icon("trash")}</button></div>`).join("") || '<p class="tb-hint">Belum ada tag. Tambahkan tag untuk mengelompokkan task.</p>';
}
