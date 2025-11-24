import { Routes, Route } from 'react-router-dom'
import { RedirectToSignIn, SignIn, SignUp, SignedIn, SignedOut, UserButton } from '@clerk/clerk-react'
import Home from './pages/Home'
import Dashboard from './Dashboard'

function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="top-logo">
          <img
            src="/Logo-White.png"
            alt="InsightAdsAI logo"
            className="top-logo-img"
          />
        </div>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </header>
      <div className="app-container">
        <Routes>
          <Route path="/sign-in/*" element={<SignIn routing="path" path="/sign-in" />} />
          <Route path="/sign-up/*" element={<SignUp routing="path" path="/sign-up" />} />
          <Route
            path="/*"
            element={
              <>
                <SignedIn>
                  <Dashboard />
                </SignedIn>
                <SignedOut>
                  <RedirectToSignIn />
                </SignedOut>
              </>
            }
          />
        </Routes>
      </div>
    </div>
  )
}

export default App
