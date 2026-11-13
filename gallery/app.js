const $ = (id) => document.getElementById(id)

function toast(message) {
  const el = $('toast')
  el.textContent = message
  el.hidden = false
  clearTimeout(toast.timer)
  toast.timer = setTimeout(() => { el.hidden = true }, 2600)
}

function start(prompt) {
  parent.postMessage({ type: 'dsh-siwei:start', prompt }, location.origin)
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

function renderLines(lines) {
  const box = $('lines')
  box.textContent = ''
  for (const line of lines) {
    const card = document.createElement('div')
    card.className = 'card' + (line.available ? '' : ' off')

    const title = document.createElement('h3')
    title.textContent = line.title
    card.append(title)

    const meta = document.createElement('div')
    meta.className = 'meta'
    meta.textContent = line.subtitle
    card.append(meta)

    const status = document.createElement('div')
    status.className = 'status'
    if (!line.available) status.textContent = '目录还没建'
    else if (line.id !== 'siwei') status.textContent = '已接目录 · 阶段台账待定义'
    else if (line.runCount === 0) status.textContent = '还没跑过'
    else if (line.active) status.textContent = `进行中：${line.active.topic || line.active.name}（${line.active.current}）`
    else status.textContent = `已完成 ${line.runCount} 天`
    card.append(status)

    if (line.stages.length) {
      const dots = document.createElement('div')
      dots.className = 'dots'
      for (const stage of line.stages) {
        const dot = document.createElement('i')
        dot.className = 'dot'
        const state = line.active ? line.active.done.includes(stage) ? 'done' : stage === line.active.current ? 'current' : '' : ''
        if (state) dot.classList.add(state)
        dot.title = `${stage} ${line.stageLabels[stage] || ''}`
        dots.append(dot)
      }
      card.append(dots)
    }

    const action = document.createElement('button')
    action.textContent = line.id === 'siwei' ? '跑一条' : '开一条'
    action.style.marginTop = '12px'
    action.addEventListener('click', () => start(line.starter))
    card.append(action)

    box.append(card)
  }
}

function renderRuns(runs) {
  const box = $('runs')
  box.textContent = ''
  $('runs-hint').textContent = runs.length ? `${runs.length} 天有记录` : ''
  if (!runs.length) {
    const empty = document.createElement('div')
    empty.className = 'empty'
    empty.textContent = '还没有跑过。点右上角「跑今天的生产线」开始第一条。'
    box.append(empty)
    return
  }
  const stages = ['A', 'B', 'C', 'D', 'E']
  for (const run of runs) {
    const row = document.createElement('div')
    row.className = 'run'

    const date = document.createElement('div')
    date.className = 'date'
    date.textContent = run.date
    row.append(date)

    const topic = document.createElement('div')
    topic.className = 'topic'
    topic.textContent = run.topic || run.name
    if (run.halted) {
      const tag = document.createElement('span')
      tag.className = 'tag'
      tag.textContent = `中止 · ${run.halted}`
      topic.append(tag)
    }
    row.append(topic)

    const steps = document.createElement('div')
    steps.className = 'steps'
    for (const stage of stages) {
      const bar = document.createElement('span')
      const state = run.stages[stage]
      if (state === 'done') bar.classList.add('done')
      else if (stage === run.current) bar.classList.add('current')
      bar.title = `${stage} ${state}`
      steps.append(bar)
    }
    row.append(steps)

    box.append(row)
  }
}

async function load() {
  try {
    const res = await fetch('/dsh-siwei/api/overview', { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    $('workspace').textContent = data.workspace
    renderLines(data.lines || [])
    renderRuns(data.runs || [])
  } catch (err) {
    $('workspace').textContent = '读取失败：' + String(err.message || err)
  }
}

$('run-today').addEventListener('click', () => start('/siwei-pipeline 跑今天的生产线'))
addEventListener('message', (event) => {
  const data = event.data
  if (data && data.type === 'dsh-siwei:start-failed') toast('开新对话失败：' + data.message)
})
load()
