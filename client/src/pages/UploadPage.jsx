import HealthCheck from '../components/HealthCheck'
import CsvUpload from '../components/CsvUpload'
import AppShell from '../components/layout/AppShell'

const UploadPage = () => {
  return (
    <AppShell activeTab="upload">
      <section className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 className="section-title">Systemstatus</h2>
        <HealthCheck />
      </section>

      <section className="card">
        <h2 className="section-title">Last opp Meta Ads-CSV</h2>
        <CsvUpload hideAnalysis />
      </section>
    </AppShell>
  )
}

export default UploadPage
