import { useState } from 'react'
import HealthCheck from '../components/HealthCheck'
import CsvUpload from '../components/CsvUpload'
import ScrollToTopButton from '../components/ScrollToTopButton'

const Home = () => {
  const [hasCurrentData, setHasCurrentData] = useState(false)

  return (
    <main>
      <section style={{ marginBottom: '2rem' }}>
        <p style={{ color: '#f3f4f6', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>
          Meta Ads AI
        </p>
        <div className="hero-top-row">
          <h1 style={{ fontSize: '2.5rem', margin: '0.5rem 0 0', color: '#fdfaf5' }}>
            MVP-dashboard for smarter kampanjeinnsikt <span className="beta-badge">Beta</span>
          </h1>
          <a className="feedback-link" href="mailto:feedback@example.com">
            Gi tilbakemelding →
          </a>
        </div>
        <p style={{ color: '#d1d5db', maxWidth: '640px', marginTop: '0.75rem' }}>
          Analyser Meta Ads-data med AI, få KPI-oversikt og raskt se hva som fungerer. Laste opp CSV og få
          anbefalinger på minutter.
        </p>
      </section>

      <section className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 className="section-title">Systemstatus</h2>
        <HealthCheck />
      </section>

      {!hasCurrentData && (
        <section className="card onboarding-card">
          <h2 className="section-title">Slik bruker du verktøyet</h2>
          <ol className="onboarding-steps">
            <li>Last opp Meta Ads-CSV fra kontoen din.</li>
            <li>Juster filtre og scenario for å simulere målene dine.</li>
            <li>Les AI-innsikten og bruk tiltak-knappene for å prioritere handlinger.</li>
          </ol>
        </section>
      )}

      <section className="card">
        <h2 className="section-title">Last opp Meta Ads-CSV</h2>
        <CsvUpload onDataStatusChange={setHasCurrentData} />
      </section>

      {hasCurrentData && <ScrollToTopButton />}
    </main>
  )
}

export default Home
