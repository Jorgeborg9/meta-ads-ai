import { useState } from 'react'
import HealthCheck from '../components/HealthCheck'
import CsvUpload from '../components/CsvUpload'
import ScrollToTopButton from '../components/ScrollToTopButton'

const Home = () => {
  const [hasCurrentData, setHasCurrentData] = useState(false)

  return (
    <main>
      <section style={{ marginBottom: '2rem' }}>
        <div className="hero-top-row">
          <h1 style={{ fontSize: '2.5rem', margin: '0.5rem 0 0', color: '#fdfaf5' }}>
            MVP dashboard for smarter campaign insights <span className="beta-badge">Beta</span>
          </h1>
          <a className="feedback-link" href="mailto:feedback@example.com">
            Give feedback →
          </a>
        </div>
        <p style={{ color: '#d1d5db', maxWidth: '640px', marginTop: '0.75rem' }}>
          Analyze your Meta Ads data with AI, get a KPI overview, and quickly see what works. Upload a CSV and get recommendations in minutes.
        </p>
      </section>

      <section className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 className="section-title">System status</h2>
        <HealthCheck />
      </section>

      {!hasCurrentData && (
        <section className="card onboarding-card">
          <h2 className="section-title">How to use the tool</h2>
          <ol className="onboarding-steps">
            <li>Upload a Meta Ads CSV from your account.</li>
            <li>Adjust filters and scenario targets to simulate your goals.</li>
            <li>Read the AI insights and use the action buttons to prioritize next steps.</li>
          </ol>
        </section>
      )}

      <section className="card">
        <h2 className="section-title">Upload Meta Ads CSV</h2>
        <CsvUpload onDataStatusChange={setHasCurrentData} />
      </section>

      {hasCurrentData && <ScrollToTopButton />}
    </main>
  )
}

export default Home
