import { readFileSync } from 'node:fs'
import { join } from 'node:path'

interface ManifestEntry { file: string; css?: string[]; isEntry?: boolean }
export function readFrontendAssets(root: string): { entry: string; styles: string[] } {
  try {
    const manifest: Record<string, ManifestEntry> = JSON.parse(readFileSync(join(root, 'dist/frontend/.vite/manifest.json'), 'utf8'))
    const entry = manifest['src/frontend/main.ts']
    if (!entry?.isEntry) throw new Error('Missing frontend entry')
    return { entry: entry.file, styles: entry.css || [] }
  } catch (error) {
    throw new Error('Frontend build unavailable. Run npm run build before starting Ruangku.', { cause: error })
  }
}
