import { SignedIn, UserProfile, useUser } from '@clerk/clerk-react'
import AppShell from '../components/layout/AppShell'

const SettingsPage = () => {
  const { user } = useUser()

  return (
    <AppShell activeTab="detailed">
      <section className="card">
        <h2 className="section-title">Konto og innstillinger</h2>
        <SignedIn>
          <div style={{ marginTop: '1rem' }}>
            {user ? (
              <>
                <p>
                  Innlogget som <strong>{user.fullName || user.username || 'Bruker'}</strong>
                </p>
                {user.primaryEmailAddress?.emailAddress && (
                  <p>{user.primaryEmailAddress.emailAddress}</p>
                )}
                <div style={{ marginTop: '1rem' }}>
                  <UserProfile routing="hash" />
                </div>
              </>
            ) : (
              <p>Innlogget bruker</p>
            )}
          </div>
        </SignedIn>
        {!user && (
          <p style={{ marginTop: '1rem' }}>Her kommer kontoinnstillinger senere.</p>
        )}
      </section>
    </AppShell>
  )
}

export default SettingsPage
