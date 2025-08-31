import { Link, Route, Routes, Navigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { addRun, downloadPdf, getRuns, updateRun, type RunRecord } from './lib/runs'

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-100 to-slate-50 text-gray-900 transition-colors">
      <header className="border-b border-indigo-200 bg-indigo-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-semibold text-indigo-800 hover:text-indigo-700">
            AI Research Assistant
          </Link>
          <nav className="flex items-center gap-4 text-sm text-gray-800">
            <Link to="/" className="hover:text-indigo-600">
              Home
            </Link>
            <Link to="/dashboard" className="hover:text-indigo-600">
              Dashboard
            </Link>
            <Link to="/projects/1" className="hover:text-indigo-600">
              Projects
            </Link>
            <AuthButtons />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:id"
            element={
              <ProtectedRoute>
                <ProjectDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <History />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  )
}

function Home() {
  return (
    <div className="prose">
      <h1>Welcome</h1>
      <p className="mt-2">Start exploring research projects.</p>
    </div>
  )
}

function Dashboard() {
  const { getAccessTokenSilently } = useAuth0()
  const [runs, setRuns] = useState<Array<{ id: number; status: string; created_at?: string; completed_at?: string }>>([])

  useEffect(() => {
    (async () => {
      try {
        const token = await getAccessTokenSilently({ authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE } })
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/runs`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json()
        setRuns(json.runs || [])
      } catch {}
    })()
  }, [getAccessTokenSilently])

  return (
    <div>
      <h2 className="text-2xl font-semibold">Dashboard</h2>
      <div className="mt-4 space-y-2">
        {runs.length === 0 && <p className="text-sm text-gray-600">No runs yet.</p>}
        {runs.map((r) => (
          <div key={r.id} className="rounded border bg-white p-3 text-sm flex items-center justify-between">
            <div>
              <div className="font-medium">Run #{r.id}</div>
              <div className="text-xs text-gray-500">
                {r.status} • {r.created_at ? new Date(r.created_at).toLocaleString() : ''}
              </div>
            </div>
            <RunActions runId={r.id} />
          </div>
        ))}
      </div>
    </div>
  )
}

function ProjectDetail() {
  const { getAccessTokenSilently } = useAuth0()
  const [query, setQuery] = useState('Large Language Models safety best practices')
  const [runId, setRunId] = useState<string | null>(null)
  const [events, setEvents] = useState<Array<{ event: string; data?: any }>>([])
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const wsRef = useRef<WebSocket | null>(null)

  function makeWsUrl(path: string) {
    const http = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
    const wsBase = http.startsWith('https') ? http.replace('https', 'wss') : http.replace('http', 'ws')
    return `${wsBase}${path}`
  }

  async function start() {
    try {
      setStatus('running')
      setEvents([])
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      })
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ query }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(JSON.stringify(json))
      const id = json.run_id as string
      setRunId(id)
      addRun({ id, query, status: 'running', startedAt: new Date().toISOString(), events: 0 })

      const url = makeWsUrl(`/ws/research/${encodeURIComponent(id)}?q=${encodeURIComponent(query)}&user_id=0`)
      const ws = new WebSocket(url)
      wsRef.current = ws
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data)
          if (msg.event === 'done') {
            setStatus('done')
            updateRun(id, { status: 'done', finishedAt: new Date().toISOString() })
          } else {
            setEvents((prev) => {
              const next = [...prev, msg]
              updateRun(id, { events: next.length })
              return next
            })
          }
        } catch (e) {
          // ignore non-JSON frames
        }
      }
      ws.onerror = () => setStatus('error')
      ws.onclose = () => {
        if (status === 'running') setStatus('done')
      }
    } catch (e) {
      setStatus('error')
    }
  }

  function stop() {
    wsRef.current?.close()
    wsRef.current = null
  }

  useEffect(() => {
    return () => {
      wsRef.current?.close()
    }
  }, [])

  // derive stage status from events
  const has = (name: string) => events.some((e) => e.event === name)
  const stage = (name: string) =>
    has(name) ? 'Completed' : status === 'running' && !has('done') ? (name === nextStage(events) ? 'InProgress' : 'Not Started') : 'Not Started'

  function nextStage(evts: Array<{event: string}>) {
    const order = ['search', 'summary', 'validated', 'recommendations']
    for (const s of order) if (!evts.some((e) => e.event === s)) return s
    return 'recommendations'
  }

  const sources = (events.find((e) => e.event === 'search')?.data?.hits as Array<any>) || []
  const summary = (events.find((e) => e.event === 'summary')?.data?.text as string) || ''

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <div>
          <label className="text-sm text-gray-600">Query</label>
          <div className="mt-2 flex items-center gap-2">
            <div className="relative w-full max-w-2xl">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded border border-indigo-200 px-3 py-2 pr-9 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="Enter your research topic"
              />
              <button
                onClick={start}
                disabled={status === 'running'}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded bg-indigo-600 px-2 py-1 text-white hover:bg-indigo-700 disabled:opacity-50"
                title="Run"
              >
                <SearchIcon />
              </button>
            </div>
            {status === 'running' && (
              <button onClick={stop} className="rounded border border-indigo-300 px-3 py-2 text-indigo-700 hover:bg-indigo-50">Stop</button>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-700">Live Event Timeline</h3>
          <div className="mt-3 space-y-4">
            <StageRow label="Search" state={stage('search')} />
            <StageRow label="Summarize" state={stage('summary')} />
            <StageRow label="Validate" state={stage('validated')} />
            <StageRow label="Recommend" state={stage('recommendations')} />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-700">Sources</h3>
          <div className="mt-3 space-y-3">
            {sources.map((s, i) => (
              <SourceCard key={i} title={s.title} url={s.url} />
            ))}
            {sources.length === 0 && (
              <div className="text-sm text-gray-500">No sources yet. Run a query to see results.</div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Report Preview</h3>
        <div className="rounded border border-indigo-100 bg-white p-4 text-sm leading-6 text-gray-800">
          {summary || 'The report preview will appear here after the summarization stage completes.'}
        </div>
        <button
          className="inline-flex items-center gap-2 rounded border border-indigo-300 px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-50"
          onClick={() => downloadPdf(query, events, getAccessTokenSilently)}
        >
          <DocIcon /> Export PDF
        </button>
        {runId && <div className="text-xs text-gray-500">Run ID: {runId}</div>}
      </div>
    </div>
  )
}

export default App

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth0()
  if (isLoading) return <p>Loading...</p>
  if (!isAuthenticated) return <Navigate to="/" replace />
  return <>{children}</>
}

function AuthButtons() {
  const { loginWithRedirect, logout, isAuthenticated, user } = useAuth0()
  return (
    <span className="inline-flex items-center gap-3">
      {!isAuthenticated ? (
        <>
          <button
            className="rounded bg-gray-900 px-3 py-1 text-white hover:bg-gray-800"
            onClick={() => loginWithRedirect()}
          >
            Log in
          </button>
          <button
            className="rounded border px-3 py-1 hover:bg-gray-100"
            onClick={() => loginWithRedirect({ authorizationParams: { screen_hint: 'signup' } })}
          >
            Sign up
          </button>
        </>
      ) : (
        <>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
            <UserIcon />
          </span>
          <button
            className="rounded border px-3 py-1 hover:bg-gray-100"
            onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
          >
            Log out
          </button>
        </>
      )}
    </span>
  )
}

function History() {
  const { getAccessTokenSilently } = useAuth0()
  const [runs, setRuns] = useState<Array<{ id: number; status: string; created_at?: string; completed_at?: string }>>([])
  useEffect(() => {
    (async () => {
      try {
        const token = await getAccessTokenSilently({ authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE } })
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/runs`, { headers: { Authorization: `Bearer ${token}` } })
        const json = await res.json()
        setRuns(json.runs || [])
      } catch {}
    })()
  }, [getAccessTokenSilently])
  return (
    <div>
      <h2 className="text-2xl font-semibold">History</h2>
      <div className="mt-4 space-y-2">
        {runs.length === 0 && <p className="text-sm text-gray-600">No runs yet.</p>}
        {runs.map((r) => (
          <div key={r.id} className="rounded border bg-white p-3 text-sm flex items-center justify-between">
            <div>
              <div className="font-medium">Run #{r.id}</div>
              <div className="text-xs text-gray-500">{r.status} • started {r.created_at ? new Date(r.created_at).toLocaleString() : ''}</div>
              {r.completed_at && (
                <div className="text-xs text-gray-500">finished {new Date(r.completed_at).toLocaleString()}</div>
              )}
            </div>
            <RunActions runId={r.id} />
          </div>
        ))}
      </div>
    </div>
  )
}

// UI components
function StageRow({ label, state }: { label: string; state: 'Completed' | 'InProgress' | 'Not Started' }) {
  const color = state === 'Completed' ? 'bg-green-500' : state === 'InProgress' ? 'bg-indigo-500' : 'bg-slate-300'
  const sub = state === 'Completed' ? 'Completed' : state === 'InProgress' ? 'In Progress' : 'Not Started'
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className={`mt-1 inline-block h-3 w-3 rounded-full ${color}`}></span>
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-xs text-gray-500">{sub}</div>
      </div>
    </div>
  )
}

function SourceCard({ title, url }: { title: string; url: string }) {
  try {
    const hostname = new URL(url).hostname
    return (
      <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-4 rounded border border-indigo-100 bg-white p-3 hover:border-indigo-200 hover:bg-indigo-50/40">
        <div className="flex h-14 w-20 items-center justify-center rounded bg-indigo-50 text-indigo-300">
          <ImageIcon />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-gray-900">{title || hostname}</div>
          <div className="truncate text-xs text-indigo-700">{hostname}</div>
        </div>
      </a>
    )
  } catch {
    return null
  }
}

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path fillRule="evenodd" d="M10 2a8 8 0 105.293 14.293l3.707 3.707a1 1 0 001.414-1.414l-3.707-3.707A8 8 0 0010 2zm-6 8a6 6 0 1110.392 4.242A6 6 0 014 10z" clipRule="evenodd" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M12 12a5 5 0 100-10 5 5 0 000 10zm-7 9a7 7 0 1114 0H5z" />
    </svg>
  )
}

function DocIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M6 2a2 2 0 00-2 2v16a2 2 0 002 2h9a2 2 0 002-2V9l-5-5H6z" />
    </svg>
  )
}

function ImageIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M4 5a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V7a2 2 0 00-2-2H4zm3 3a2 2 0 110 4 2 2 0 010-4zm-3 9l3.5-4.5 2.5 3 3.5-4.5L20 17H4z" />
    </svg>
  )
}

function RunActions({ runId }: { runId: number }) {
  const { getAccessTokenSilently } = useAuth0()
  const [loading, setLoading] = useState(false)

  async function fetchEvents(): Promise<Array<{ event: string; data?: any }>> {
    const token = await getAccessTokenSilently({ authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE } })
    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/runs/${runId}/events`, { headers: { Authorization: `Bearer ${token}` } })
    const json = await res.json()
    return json.events || []
  }

  async function handleExportPdf() {
    setLoading(true)
    try {
      const events = await fetchEvents()
      const topic = (events.find((e) => e.event === 'start')?.data?.query as string) || `Run #${runId}`
      await downloadPdf(topic, events, getAccessTokenSilently)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button className="rounded border px-2 py-1 text-xs" onClick={handleExportPdf} disabled={loading}>{loading ? 'Preparing…' : 'Export PDF'}</button>
    </div>
  )
}
