import { Link, Route, Routes, Navigate } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'

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
  return (
    <div>
      <h2 className="text-2xl font-semibold">Dashboard</h2>
      <p className="mt-2 text-sm text-gray-600">Your recent research runs will appear here.</p>
    </div>
  )
}

function ProjectDetail() {
  return (
    <div>
      <h2 className="text-2xl font-semibold">Project Detail</h2>
      <p className="mt-2 text-sm text-gray-600">Live updates will stream here later.</p>
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
