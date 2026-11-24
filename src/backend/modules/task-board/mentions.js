const { createHash } = require("node:crypto");

const mentionedIds = (text) => [...text.matchAll(/@\[[^\]\r\n]+\]\(doc:([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})\)/gi)].map((match) => match[1].toLowerCase());

async function deletionImpact(client, key) {
  const { rows: documents } = await client.query("SELECT id FROM mdpreview.entries WHERE kind IN ('doc','pdf') AND deleted_at IS NULL AND (path=$1 OR starts_with(path,$1 || '/')) ORDER BY id", [key]);
  if (!documents.length) return null;
  const ids = new Set(documents.map((doc) => doc.id)), mentioned = new Set();
  const { rows } = await client.query("SELECT id,title,description,result FROM mdpreview.tasks ORDER BY id");
  const tasks = rows.filter((task) => {
    const matches = mentionedIds(task.description + "\n" + task.result).filter((id) => ids.has(id));
    matches.forEach((id) => mentioned.add(id));
    return matches.length > 0;
  });
  if (!tasks.length) return null;
  return {
    token: createHash("sha256").update(JSON.stringify([key, documents, tasks])).digest("hex"),
    taskCount: tasks.length, documentCount: mentioned.size,
    taskTitles: tasks.slice(0, 5).map((task) => task.title),
  };
}
module.exports = { mentionedIds, deletionImpact };
