import { descriptionText } from "./mention-text.js";

export const emptyFilters = () => ({ query: "", statusId: "", tagId: "", priority: "", dateFrom: "", dateTo: "", dateMode: "" });
export function todayDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function filterBoard(board, filters) {
  const today = todayDate(), query = filters.query.trim().toLocaleLowerCase();
  return { ...board, tasks: board.tasks.filter((task) => {
    const complete = board.statuses.find((status) => status.id === task.statusId)?.completed;
    const text = `${task.title} ${descriptionText(task.description, board.documents)} ${descriptionText(task.result || "", board.documents)} ${(task.tagIds || []).map((id) => board.tags.find((tag) => tag.id === id)?.name || "").join(" ")}`;
    return (!query || text.toLocaleLowerCase().includes(query)) &&
      (!filters.statusId || task.statusId === filters.statusId) &&
      (!filters.tagId || task.tagIds?.includes(filters.tagId)) &&
      (!filters.priority || task.priority === filters.priority) &&
      (!filters.dateFrom || Boolean(task.due && task.due >= filters.dateFrom)) &&
      (!filters.dateTo || Boolean(task.due && task.due <= filters.dateTo)) &&
      (filters.dateMode !== "today" || task.due === today) &&
      (filters.dateMode !== "overdue" || Boolean(task.due && task.due < today && !complete));
  }) };
}
