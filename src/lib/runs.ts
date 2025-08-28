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
  parts.push(`# Research Report: ${query}\n`)
  const hits = events.find(e => e.event === 'search')?.data?.hits || []
  const summary = events.find(e => e.event === 'summary')?.data?.text || ''
  const recs: string[] = events.find(e => e.event === 'recommendations')?.data?.items || []

  if (summary) {
    parts.push(`\n## Executive Summary\n`)
    parts.push(summary)
  }
  if (hits.length) {
    parts.push(`\n## Sources\n`)
    for (const h of hits) {
      if (h.title && h.url) parts.push(`- [${h.title}](${h.url})`)
    }
  }
  if (recs.length) {
    parts.push(`\n## Recommendations\n`)
    for (const r of recs) parts.push(`- ${r}`)
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
  const hits = events.find(e => e.event === 'search')?.data?.hits || []
  const summary = events.find(e => e.event === 'summary')?.data?.text || ''
  const recs: string[] = events.find(e => e.event === 'recommendations')?.data?.items || []

  const sections: Array<{ heading: string; body: string }> = []
  if (summary) {
    sections.push({ heading: 'Executive Summary', body: summary })
  }
  if (hits.length) {
    const body = hits
      .filter((h: any) => h.title && h.url)
      .map((h: any) => `• ${h.title} — ${h.url}`)
      .join('\n')
    sections.push({ heading: 'Sources', body })
  }
  if (recs.length) {
    sections.push({ heading: 'Recommendations', body: recs.map(r => `• ${r}`).join('\n') })
  }
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

