import { descriptionText } from "./mention-text.js";

export const emptyFilters = () => ({ query: "", statusId: "", tagId: "", priority: "", dateFrom: "", dateTo: "", dateMode: "" });
export function todayDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function filterBoard(board, filters) {
  const today = todayDate(), query = filters.query.trim().toLocaleLowerCase();
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) return { ...board, tasks: [] };
  return { ...board, tasks: board.tasks.filter((task) => {
    const complete = board.statuses.find((status) => status.id === task.statusId)?.completed;
    const start = task.startDate || task.due, end = task.due || task.startDate;
    const text = `${task.title} ${descriptionText(task.description, board.documents)} ${descriptionText(task.result || "", board.documents)} ${(task.tagIds || []).map((id) => board.tags.find((tag) => tag.id === id)?.name || "").join(" ")}`;
    return (!query || text.toLocaleLowerCase().includes(query)) &&
      (!filters.statusId || task.statusId === filters.statusId) &&
      (!filters.tagId || task.tagIds?.includes(filters.tagId)) &&
      (!filters.priority || task.priority === filters.priority) &&
      (!filters.dateFrom || Boolean(end && end >= filters.dateFrom)) &&
      (!filters.dateTo || Boolean(start && start <= filters.dateTo)) &&
      (filters.dateMode !== "today" || Boolean(start && end && start <= today && end >= today)) &&
      (filters.dateMode !== "overdue" || Boolean(task.due && task.due < today && !complete));
  }) };
}
