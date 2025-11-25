import { Routes, Route } from 'react-router-dom'
import { RedirectToSignIn, SignIn, SignUp, SignedIn, SignedOut, UserButton } from '@clerk/clerk-react'
import DetailedView from './pages/DetailedView'
import UploadPage from './pages/UploadPage'
import CreativesPage from './pages/CreativesPage'
import ActionsPage from './pages/ActionsPage'
import SettingsPage from './pages/SettingsPage'

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
            path="/upload"
            element={
              <>
                <SignedIn>
                  <UploadPage />
                </SignedIn>
                <SignedOut>
                  <RedirectToSignIn />
                </SignedOut>
              </>
            }
          />
          <Route
            path="/"
            element={
              <>
                <SignedIn>
                  <DetailedView />
                </SignedIn>
                <SignedOut>
                  <RedirectToSignIn />
                </SignedOut>
              </>
            }
          />
          <Route
            path="/detailed"
            element={
              <>
                <SignedIn>
                  <DetailedView />
                </SignedIn>
                <SignedOut>
                  <RedirectToSignIn />
                </SignedOut>
              </>
            }
          />
          <Route
            path="/creatives"
            element={
              <>
                <SignedIn>
                  <CreativesPage />
                </SignedIn>
                <SignedOut>
                  <RedirectToSignIn />
                </SignedOut>
              </>
            }
          />
          <Route
            path="/actions"
            element={
              <>
                <SignedIn>
                  <ActionsPage />
                </SignedIn>
                <SignedOut>
                  <RedirectToSignIn />
                </SignedOut>
              </>
            }
          />
          <Route
            path="/settings"
            element={
              <>
                <SignedIn>
                  <SettingsPage />
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
