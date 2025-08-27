import { Link, Route, Routes, Navigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { addRun, getRuns, updateRun, type RunRecord } from './lib/runs'

function App() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-semibold">
            AI Research Assistant
          </Link>
          <nav className="space-x-4 text-sm">
            <Link to="/dashboard" className="hover:underline">
              Dashboard
            </Link>
            <Link to="/projects/1" className="hover:underline">
              Project
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
  const [runs, setRuns] = useState<RunRecord[]>(getRuns())
  useEffect(() => {
    setRuns(getRuns())
  }, [])
  return (
    <div>
      <h2 className="text-2xl font-semibold">Dashboard</h2>
      <div className="mt-4 space-y-2">
        {runs.length === 0 && <p className="text-sm text-gray-600">No runs yet.</p>}
        {runs.map((r) => (
          <div key={r.id} className="rounded border bg-white p-3 text-sm flex items-center justify-between">
            <div>
              <div className="font-medium">{r.query}</div>
              <div className="text-xs text-gray-500">
                {r.status} • {new Date(r.startedAt).toLocaleString()}
              </div>
            </div>
            <div className="text-xs text-gray-500">{r.events ?? 0} events</div>
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full max-w-xl rounded border px-3 py-2"
          placeholder="Enter your research topic"
        />
        <button
          onClick={start}
          disabled={status === 'running'}
          className="rounded bg-green-600 px-3 py-2 text-white disabled:opacity-50"
        >
          {status === 'running' ? 'Running…' : 'Start research'}
        </button>
        {status === 'running' && (
          <button onClick={stop} className="rounded border px-3 py-2">
            Stop
          </button>
        )}
      </div>
      {runId && <div className="text-xs text-gray-500">Run ID: {runId}</div>}
      <div className="space-y-2">
        {events.map((e, i) => (
          <div key={i} className="rounded border bg-white p-3">
            <div className="text-xs uppercase tracking-wide text-gray-500">{e.event}</div>
            {e.data && <pre className="mt-2 whitespace-pre-wrap break-words text-xs">{JSON.stringify(e.data, null, 2)}</pre>}
          </div>
        ))}
        {status === 'done' && events.length === 0 && (
          <div className="text-sm text-gray-600">No events received.</div>
        )}
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
          <span className="text-xs text-gray-600">{user?.email}</span>
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
  const [runs, setRuns] = useState<RunRecord[]>(getRuns())
  useEffect(() => {
    setRuns(getRuns())
  }, [])
  return (
    <div>
      <h2 className="text-2xl font-semibold">History</h2>
      <div className="mt-4 space-y-2">
        {runs.length === 0 && <p className="text-sm text-gray-600">No runs yet.</p>}
        {runs.map((r) => (
          <div key={r.id} className="rounded border bg-white p-3 text-sm">
            <div className="font-medium">{r.query}</div>
            <div className="text-xs text-gray-500">{r.status} • started {new Date(r.startedAt).toLocaleString()}</div>
            {r.finishedAt && (
              <div className="text-xs text-gray-500">finished {new Date(r.finishedAt).toLocaleString()}</div>
            )}
            <div className="text-xs text-gray-500">{r.events ?? 0} events</div>
          </div>
        ))}
      </div>
    </div>
  )
}
