import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** Stage labels for the daily pipeline, A through E. */
const SIWEI_STAGES = ['A', 'B', 'C', 'D', 'E']
const SIWEI_LABELS = { A: '扫描', B: '选题', C: '核证', D: '论证', E: '成稿' }

/**
 * The three production lines this panel knows about.
 *
 * `root` is relative to the configured workspace; a line whose directory does
 * not exist yet still renders, so a fresh workspace shows the shape of the
 * pipeline instead of an empty page.
 */
export const LINES = [
  {
    id: 'siwei',
    title: '思维工艺',
    subtitle: '每日 DEMO 生产线',
    skill: 'siwei-pipeline',
    root: join('思维工艺', '每日DEMO'),
    stages: SIWEI_STAGES,
    stageLabels: SIWEI_LABELS,
    starter: '/siwei-pipeline 跑今天的生产线',
  },
  {
    id: 'research',
    title: '科研',
    subtitle: '申报 / 论文',
    skill: 'research-pipeline',
    root: '科研',
    stages: [],
    stageLabels: {},
    starter: '/research-pipeline ',
  },
  {
    id: 'lesson',
    title: '备课',
    subtitle: '讲稿 → 提问 → 课件',
    skill: 'lesson-pipeline',
    root: '备课',
    stages: [],
    stageLabels: {},
    starter: '/lesson-pipeline ',
  },
]

/** Read one pipeline_state.json, returning null when it is absent or malformed. */
function readState(file) {
  try {
    const state = JSON.parse(readFileSync(file, 'utf8'))
    return state && typeof state === 'object' ? state : null
  } catch {
    return null
  }
}

/** Count the artifacts that actually exist next to the state file. */
function countArtifacts(dir, state) {
  const found = []
  for (const entry of Object.values(state?.stages ?? {})) {
    const artifact = typeof entry?.artifact === 'string' ? entry.artifact : ''
    if (artifact && existsSync(join(dir, artifact))) found.push(artifact)
  }
  return found
}

/** Summarize one daily run directory. */
function summarizeRun(dir, name, state) {
  const stages = state?.stages ?? {}
  const done = SIWEI_STAGES.filter((stage) => stages[stage]?.status === 'done')
  const current = SIWEI_STAGES.find((stage) => stages[stage]?.status !== 'done') ?? ''
  const artifacts = countArtifacts(dir, state)
  let updatedAt = ''
  for (const entry of Object.values(stages)) {
    if (typeof entry?.updated_at === 'string' && entry.updated_at > updatedAt) updatedAt = entry.updated_at
  }
  return {
    name,
    dir,
    date: name.slice(0, 10),
    topic: name.slice(11) || '',
    stages: Object.fromEntries(SIWEI_STAGES.map((stage) => [stage, stages[stage]?.status ?? 'pending'])),
    done,
    current,
    halted: state?.halted ?? null,
    artifacts,
    updatedAt,
  }
}

/** List the most recent daily runs for the 思维工艺 line. */
export function readSiweiRuns(workspace, limit = 8) {
  const root = join(workspace, join('思维工艺', '每日DEMO'))
  if (!existsSync(root)) return []
  let entries = []
  try {
    entries = readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  } catch {
    return []
  }
  const runs = []
  for (const name of entries) {
    const dir = join(root, name)
    const state = readState(join(dir, 'pipeline_state.json'))
    runs.push(summarizeRun(dir, name, state ?? {}))
  }
  return runs
    .sort((a, b) => (b.date + b.name).localeCompare(a.date + a.name))
    .slice(0, limit)
}

/** Whether each line's directory exists, so the panel can say 未开始 instead of 空. */
export function lineAvailability(workspace) {
  return Object.fromEntries(LINES.map((line) => [line.id, existsSync(join(workspace, line.root))]))
}

/** Latest modification time under a directory, used for the "最近改动" column. */
export function latestTouch(dir) {
  try {
    const stats = statSync(dir)
    return stats.mtime.toISOString()
  } catch {
    return ''
  }
}
