import 'vite/modulepreload-polyfill'
import './styles/main.css'
import './public/css/main.css'
import { startWorkspace } from './public/js/main.js'
import { createBoardRenderer } from './features/task-board/renderer'
import { createTodayRenderer } from './features/today/renderer'

startWorkspace({ ...createBoardRenderer(), ...createTodayRenderer() })
