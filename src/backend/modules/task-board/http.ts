import type { NextFunction, Request, Response, Router } from 'express'
import type { TaskBoard } from '../../../shared/contracts/task-board'

type Mutation = (input: unknown, ip?: string) => Promise<Record<string, unknown>>
interface Services {
  board: {
    list(): Promise<TaskBoard>
    mentionedDocument(id: unknown): Promise<string>
    suggestDocuments(query: unknown): Promise<unknown[]>
    relatedTasks(id: unknown): Promise<unknown[]>
    saveTask: Mutation; removeTask: Mutation; archiveTask: Mutation
    restoreTask: Mutation; saveStatuses: Mutation; saveTags: Mutation
  }
  preferences: { preferences(): Promise<Record<string, unknown>>; saveViews: Mutation; saveDraft: Mutation; discardDraft: Mutation }
  today: { list(): Promise<unknown>; save: Mutation }
}
const asyncRoute = (work: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => { Promise.resolve(work(req, res)).catch(next) }

export default function register(api: Router, services: Services = {
  board: require('./service'), preferences: require('./preferences'), today: require('./today'),
}) {
  const { board, preferences, today } = services
  api.get('/today', asyncRoute(async (_req, res) => res.json({ success: true, today: await today.list() })))
  api.post('/today', asyncRoute(async (req, res) => res.json({ success: true, today: await today.save(req.body, req.ip) })))
  api.get('/task-board/documents/:id/open', asyncRoute(async (req, res) => {
    const path = await board.mentionedDocument(req.params.id)
    res.redirect(302, req.baseUrl.replace(/\/api$/, '') + path.split('/').map(encodeURIComponent).join('/'))
  }))
  api.get('/task-board/documents', asyncRoute(async (req, res) => res.json({ success: true, items: await board.suggestDocuments(req.query.q) })))
  api.get('/task-board', asyncRoute(async (_req, res) => res.json({ success: true, board: await board.list() })))
  api.get('/task-board/preferences', asyncRoute(async (_req, res) => res.json({ success: true, ...await preferences.preferences() })))
  api.get('/task-board/related', asyncRoute(async (req, res) => res.json({ success: true, items: await board.relatedTasks(req.query.document) })))
  const mutations: Array<[string, Mutation]> = [
    ['tasks/save', board.saveTask], ['tasks/delete', board.removeTask],
    ['tasks/archive', board.archiveTask], ['tasks/restore', board.restoreTask],
    ['statuses/save', board.saveStatuses], ['tags/save', board.saveTags],
    ['views/save', preferences.saveViews], ['drafts/save', preferences.saveDraft],
    ['drafts/discard', preferences.discardDraft],
  ]
  for (const [path, mutation] of mutations) api.post('/task-board/' + path, asyncRoute(async (req, res) =>
    res.json({ success: true, ...await mutation(req.body, req.ip) }),
  ))
}
