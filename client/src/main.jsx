import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'
import App from './App.jsx'
import { DataProvider } from './context/DataContext.jsx'

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!clerkPublishableKey) {
  console.warn('Missing VITE_CLERK_PUBLISHABLE_KEY for Clerk. Rendering without auth.')
}

const appTree = clerkPublishableKey ? (
  <ClerkProvider publishableKey={clerkPublishableKey}>
    <BrowserRouter>
      <DataProvider>
        <App />
      </DataProvider>
    </BrowserRouter>
  </ClerkProvider>
) : (
  <BrowserRouter>
    <DataProvider>
      <App />
    </DataProvider>
  </BrowserRouter>
)

createRoot(document.getElementById('root')).render(<StrictMode>{appTree}</StrictMode>)
