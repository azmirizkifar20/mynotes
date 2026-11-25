import { afterEach, describe, expect, it } from 'vitest'
import express from 'express'
import type { Server } from 'node:http'
import { createRequire } from 'node:module'
import { readFrontendAssets } from '../../src/backend/rendering/frontend-assets'
import register from '../../src/backend/modules/task-board/http'

let server: Server | undefined
afterEach(async () => { if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve())); server = undefined })

describe('typed backend boundaries', () => {
  it('renders login, private, public and workspace fixtures with assets on both mounts', async () => {
    const require = createRequire(import.meta.url)
    const fixture = await require('../helpers/local-workspace.cjs').start()
    server = fixture.server
    const assets = readFrontendAssets(process.cwd())
    for (const prefix of ['', '/mynotes']) {
      for (const route of ['/', '/fixture/login', '/fixture/private', '/fixture/public']) {
        const response = await fetch(fixture.url + prefix + route)
        expect(response.status).toBe(200)
        expect(await response.text()).toContain(prefix + '/static/app/' + assets.entry)
      }
      expect((await fetch(fixture.url + prefix + '/static/app/' + assets.entry)).status).toBe(200)
      expect((await fetch(fixture.url + prefix + '/static/app/' + assets.styles[0])).status).toBe(200)
    }
  })

  it('reads mount-relative hashed Vite assets and fails clearly without a build', () => {
    const assets = readFrontendAssets(process.cwd())
    expect(assets.entry).toMatch(/^assets\/main-.*\.js$/)
    expect(assets.styles).not.toHaveLength(0)
    expect(() => readFrontendAssets('/missing-build-fixture')).toThrow(/npm run build/)
  })

  it('keeps registered task routes behind their parent authentication middleware', async () => {
    const app = express()
    app.use(express.json())
    const router = express.Router()
    router.use((req, res, next) => req.headers['x-fixture-auth'] === 'yes' ? next() : res.sendStatus(401))
    let received: unknown
    const mutate = async (body: unknown) => { received = body; return { board: { revision: 2 } } }
    register(router, {
      board: { list: async () => ({ revision: 1, tasks: [], statuses: [], documents: [], tags: [] }), mentionedDocument: async () => '/folder/my notes.md', suggestDocuments: async () => [], relatedTasks: async () => [], saveTask: mutate, removeTask: mutate, archiveTask: mutate, restoreTask: mutate, saveStatuses: mutate, saveTags: mutate },
      preferences: { preferences: async () => ({}), saveViews: mutate, saveDraft: mutate, discardDraft: mutate },
      today: { list: async () => ({}), save: mutate },
    })
    app.use('/mynotes/api', router)
    app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(500).json({ message: error.message }))
    server = app.listen(0, '127.0.0.1')
    await new Promise<void>(resolve => server!.once('listening', resolve))
    const address = server.address() as import('node:net').AddressInfo
    const origin = `http://127.0.0.1:${address.port}/mynotes/api`
    expect((await fetch(origin + '/task-board')).status).toBe(401)
    const headers = { 'x-fixture-auth': 'yes', 'Content-Type': 'application/json' }
    expect((await (await fetch(origin + '/task-board', { headers })).json()).board.revision).toBe(1)
    const body = { title: 'Fixture', revision: 1 }
    expect((await fetch(origin + '/task-board/tasks/save', { method: 'POST', headers, body: JSON.stringify(body) })).status).toBe(200)
    expect(received).toEqual(body)
    const redirect = await fetch(origin + '/task-board/documents/document/open', { headers, redirect: 'manual' })
    expect(redirect.headers.get('location')).toBe('/mynotes/folder/my%20notes.md')
  })
})
