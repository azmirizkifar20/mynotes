const db = require("../../database");
const { validPath } = require("./paths");

const validDate = (value) => value === "" || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= "0001-01-01" && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);

module.exports = async function search(filters) {
  const { q = "", folder = "", type = "", visibility = "", updatedFrom = "", updatedTo = "" } = filters;
  if (typeof q !== "string" || typeof folder !== "string" || (folder && !validPath(folder)) ||
      !["", "doc", "pdf"].includes(type) || !["", "public", "private"].includes(visibility) ||
      !validDate(updatedFrom) || !validDate(updatedTo) || (updatedFrom && updatedTo && updatedFrom > updatedTo))
    throw db.fail(400, "Filter pencarian tidak valid.");
  const text = q.trim().slice(0, 200);
  if (text.includes("\0")) throw db.fail(400, "Pencarian tidak valid.");
  if (!text && !folder && !type && !visibility && !updatedFrom && !updatedTo) return [];
  return (await db.query(
    `SELECT id,path,kind,visibility,modified,
       CASE WHEN kind='doc' AND $1<>'' THEN ts_headline('simple',convert_from(content,'UTF8'),websearch_to_tsquery('simple',$1),'StartSel="",StopSel="",MaxWords=35,MinWords=15,MaxFragments=1') ELSE '' END AS snippet,
       ts_rank(search_vector,websearch_to_tsquery('simple',$1)) AS rank
     FROM mdpreview.entries
     WHERE deleted_at IS NULL AND kind IN ('doc','folder','pdf') AND path <> '/'
       AND path !~* '^/(steering|superpowers)(/|$)' AND path !~ '/\\.'
       AND ($1='' OR search_vector @@ websearch_to_tsquery('simple',$1) OR strpos(lower(path),lower($1))>0)
       AND ($2='' OR $2='/' OR starts_with(lower(path),lower($2) || '/'))
       AND ($3='' OR kind=$3) AND ($4='' OR visibility=$4)
       AND ($5::date IS NULL OR modified >= $5::date)
       AND ($6::date IS NULL OR modified < $6::date + interval '1 day')
     ORDER BY rank DESC,path LIMIT 50`,
    [text, folder, type, visibility, updatedFrom || null, updatedTo || null],
  )).rows;
};
