export type RunStatus = 'running' | 'done' | 'error'

export interface RunRecord {
  id: string
  query: string
  status: RunStatus
  startedAt: string
  finishedAt?: string
  events?: number
}

const KEY = 'ai_research_runs'

function read(): RunRecord[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const data = JSON.parse(raw) as RunRecord[]
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function write(runs: RunRecord[]) {
  localStorage.setItem(KEY, JSON.stringify(runs))
}

export function getRuns(): RunRecord[] {
  return read().sort((a, b) => (b.startedAt.localeCompare(a.startedAt)))
}

export function addRun(run: RunRecord) {
  const runs = read()
  runs.unshift(run)
  write(runs)
}

export function updateRun(id: string, patch: Partial<RunRecord>) {
  const runs = read()
  const idx = runs.findIndex(r => r.id === id)
  if (idx >= 0) {
    runs[idx] = { ...runs[idx], ...patch }
    write(runs)
  }
}

