import { Link, Route, Routes } from 'react-router-dom'

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
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
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
