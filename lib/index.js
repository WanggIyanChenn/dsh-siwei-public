import { createReadStream, existsSync, realpathSync, statSync } from 'node:fs'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LINES, lineAvailability, readSiweiRuns } from './lines.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const BASE = '/dsh-siwei'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
}

export const name = 'dsh-siwei'
export const inject = ['webServer', 'tools']

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

/** Refuse `..`, dotfiles, and symlinks that escape the served directory. */
function safeFile(dir, rel) {
  if (!dir || rel.split('/').some((part) => part.startsWith('.'))) return null
  let base
  try { base = realpathSync(dir) } catch { return null }
  const file = normalize(join(base, rel))
  if (!file.startsWith(base + sep) || !existsSync(file)) return null
  const real = realpathSync(file)
  return real.startsWith(base + sep) && statSync(real).isFile() ? real : null
}

function serveFile(req, res, file) {
  res.writeHead(200, {
    'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
    'content-length': statSync(file).size,
    'cache-control': 'no-cache',
  })
  if (req.method === 'HEAD') return res.end()
  createReadStream(file).pipe(res)
}

/** Build the panel payload from the configured workspace. */
function overview(workspace) {
  const runs = readSiweiRuns(workspace)
  return {
    workspace,
    lines: LINES.map((line) => {
      const available = existsSync(join(workspace, line.root))
      const runsForLine = line.id === 'siwei' ? runs : []
      const active = runsForLine.find((run) => run.current !== '')
      return {
        id: line.id,
        title: line.title,
        subtitle: line.subtitle,
        skill: line.skill,
        starter: line.starter,
        available,
        stages: line.stages,
        stageLabels: line.stageLabels,
        runCount: runsForLine.length,
        active: active ? { name: active.name, topic: active.topic, current: active.current, done: active.done } : null,
      }
    }),
    runs,
    availability: lineAvailability(workspace),
    at: new Date().toISOString(),
  }
}

export function apply(ctx, config) {
  const workspace = config?.workspace || process.cwd()

  // One read-only tool: the panel is the visual half, this is what the model calls.
  ctx.tools.register({
    name: 'siwei_status',
    description: 'Read the stage status of the production lines in the current workspace: the daily DEMO pipeline (A scan / B topic / C facts / D argument / E draft), plus which runs are unfinished.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        line: { type: 'string', enum: ['siwei', 'research', 'lesson'], description: 'which line to report; omit for all' },
      },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, required: ['text'], properties: { text: { type: 'string' } } },
      render: (_args, value) => [{ type: 'text', text: value.text }],
    },
    async execute(args) {
      const data = overview(workspace)
      const wanted = args?.line
      const rows = data.lines.filter((line) => !wanted || line.id === wanted)
      const lines = rows.map((line) => {
        if (!line.available) return `${line.title}：目录不存在（${join(workspace, LINES.find((l) => l.id === line.id).root)}）`
        if (line.id !== 'siwei') return `${line.title}：已接入目录，阶段台账暂未定义`
        if (line.runCount === 0) return `${line.title}：还没有跑过`
        const active = line.active
        return `${line.title}：${line.runCount} 天有记录${active ? `，最近一条 ${active.name} 停在 ${active.current}` : '，都已完成'}`
      })
      const runs = wanted && wanted !== 'siwei' ? [] : data.runs.slice(0, 5).map((run) => {
        const marks = Object.entries(run.stages).map(([stage, status]) => `${stage}=${status}`).join(' ')
        return `${run.date} ${run.topic || run.name} · ${marks}${run.halted ? ` · 中止：${run.halted}` : ''}`
      })
      return { text: ['工作区：' + workspace, ...lines, ...(runs.length ? ['', '最近几天：', ...runs] : [])].join('\n') }
    },
  })

  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'prefix',
      path: BASE,
      handler(req, res) {
        const url = new URL(req.url || '/', 'http://x')
        const rest = decodeURIComponent(url.pathname.slice(BASE.length)) || '/'
        if (rest === '/api/overview') return sendJson(res, 200, overview(workspace))
        if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { ok: false, error: 'GET only' })
        const file = safeFile(join(ROOT, 'gallery'), rest === '/' ? 'index.html' : rest.slice(1))
        if (!file) {
          res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
          return res.end('not found')
        }
        return serveFile(req, res, file)
      },
    }),
  )
}
