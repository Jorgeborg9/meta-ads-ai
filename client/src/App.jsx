import { Routes, Route } from 'react-router-dom'
import { RedirectToSignIn, SignIn, SignUp, SignedIn, SignedOut, UserButton } from '@clerk/clerk-react'
import DetailedView from './pages/DetailedView'
import UploadPage from './pages/UploadPage'
import CreativesPage from './pages/CreativesPage'
import ActionsPage from './pages/ActionsPage'
import SettingsPage from './pages/SettingsPage'

const hasClerk = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

function App() {
  if (!hasClerk) {
    // Fallback without auth if Clerk key is missing
    return (
      <div className="app-shell">
        <div className="app-container">
          <Routes>
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/detailed" element={<DetailedView />} />
            <Route path="/creatives" element={<CreativesPage />} />
            <Route path="/actions" element={<ActionsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/" element={<DetailedView />} />
          </Routes>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
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
