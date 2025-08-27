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

export function buildMarkdown(query: string, events: Array<{ event: string; data?: any }>) {
  const parts: string[] = []
  parts.push(`# Research Report\n`)
  parts.push(`**Topic:** ${query}\n`)
  for (const e of events) {
    parts.push(`\n## ${e.event}\n`)
    if (e.data) {
      parts.push('```json')
      parts.push(JSON.stringify(e.data, null, 2))
      parts.push('```')
    }
  }
  return parts.join('\n')
}

export function downloadMarkdown(query: string, events: Array<{ event: string; data?: any }>) {
  const md = buildMarkdown(query, events)
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'research_report.md'
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadPdf(
  query: string,
  events: Array<{ event: string; data?: any }>,
  getAccessTokenSilently: any,
) {
  const sections = events.map((e) => ({ heading: e.event, body: e.data ? JSON.stringify(e.data, null, 2) : '' }))
  const token = await getAccessTokenSilently({ authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE } })
  const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/export/pdf`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ title: `Research Report: ${query}`, sections }),
  })
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'research_report.pdf'
  a.click()
  URL.revokeObjectURL(url)
}

