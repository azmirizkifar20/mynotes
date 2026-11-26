import type { PoolClient } from 'pg'
import type { TodoItem } from '../../../shared/contracts/today'
const { transaction, fail } = require('../../database/connection')
const { audit } = require('../../database/audit')
const { uuid, validText } = require('./validation')

export async function snapshot(client: PoolClient): Promise<TodoItem[]> {
  const { rows } = await client.query<TodoItem>(`SELECT id,text,done,revision,created_at::text AS "createdAt"
    FROM mdpreview.todos WHERE deleted_at IS NULL ORDER BY created_at,id`)
  return rows
}

function input(body: unknown, keys: string[]): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(key => !keys.includes(key))) throw fail(400, 'Data to-do tidak valid.')
  return body as Record<string, unknown>
}

export async function create(body: unknown, ip?: string) {
  const value = input(body, ['id', 'text'])
  if (!uuid(value.id) || !validText(value.text, 200)) throw fail(400, 'Tulis to-do antara 1 dan 200 karakter.')
  const id = (value.id as string).toLowerCase(), text = (value.text as string).trim()
  return transaction(async (client: PoolClient) => {
    const existing = (await client.query('SELECT text,deleted_at FROM mdpreview.todos WHERE id=$1', [id])).rows[0]
    if (existing) {
      if (existing.text !== text || existing.deleted_at) throw fail(409, 'To-do sudah berubah atau dihapus. Muat ulang daftar.')
    } else {
      await client.query('INSERT INTO mdpreview.todos(id,text) VALUES($1,$2)', [id, text])
      await audit('TODO_CREATE', id, ip, client)
    }
    return { todos: await snapshot(client) }
  })
}

async function mutate(body: unknown, operation: 'complete' | 'delete' | 'restore', ip?: string) {
  const value = input(body, operation === 'complete' ? ['id', 'revision', 'done'] : ['id', 'revision'])
  if (!uuid(value.id) || !Number.isSafeInteger(value.revision) || (value.revision as number) < 1 ||
      (operation === 'complete' && typeof value.done !== 'boolean')) throw fail(400, 'Data to-do tidak valid.')
  return transaction(async (client: PoolClient) => {
    const id = (value.id as string).toLowerCase()
    const current = (await client.query('SELECT revision,deleted_at FROM mdpreview.todos WHERE id=$1', [id])).rows[0]
    if (!current) throw fail(404, 'To-do tidak ditemukan.')
    if (current.revision !== value.revision || Boolean(current.deleted_at) !== (operation === 'restore'))
      throw fail(409, 'To-do berubah di perangkat lain. Muat ulang daftar sebelum mencoba lagi.')
    const values: unknown[] = [id, value.revision]
    const update = operation === 'complete' ? 'done=$3' : operation === 'delete' ? 'deleted_at=now()' : 'deleted_at=NULL'
    if (operation === 'complete') values.push(value.done)
    const item = (await client.query(`UPDATE mdpreview.todos SET ${update},revision=revision+1,modified=now()
      WHERE id=$1 AND revision=$2 RETURNING id,revision`, values)).rows[0]
    if (!item) throw fail(409, 'To-do berubah. Muat ulang daftar sebelum mencoba lagi.')
    await audit('TODO_' + operation.toUpperCase(), id, ip, client)
    return { todos: await snapshot(client), item }
  })
}

export const complete = (body: unknown, ip?: string) => mutate(body, 'complete', ip)
export const remove = (body: unknown, ip?: string) => mutate(body, 'delete', ip)
export const restore = (body: unknown, ip?: string) => mutate(body, 'restore', ip)
