import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext'
import AppShell from '../components/layout/AppShell'
import PageHeader from '../components/layout/PageHeader'

const ratingColor = {
  Winner: 'badge-success',
  Average: 'badge-warning',
  Poor: 'badge-danger',
}

const deriveRating = (ad) => {
  if (ad.filePerformanceBucket) return ad.filePerformanceBucket
  const roasVal = Number(ad.roas) || 0
  if (roasVal >= 2.5) return 'Winner'
  if (roasVal >= 1.2) return 'Average'
  return 'Poor'
}

const DetailedView = () => {
  const navigate = useNavigate()
  const { currentAds, loading, error } = useData()
  const ads = currentAds || []
  console.log('DetailedView: currentAds from context:', ads)

  const [selectedId, setSelectedId] = useState(null)
  const [performanceFilter, setPerformanceFilter] = useState('all')

  const filteredAds = useMemo(() => {
    if (!ads.length) return []
    if (performanceFilter === 'all') return ads
    return ads.filter((ad) => deriveRating(ad).toLowerCase() === performanceFilter)
  }, [ads, performanceFilter])

  useEffect(() => {
    if (filteredAds.length > 0 && !selectedId) {
      const first = filteredAds[0]
      const firstId = first.id || `${first.adName}-${first.adSetName || first.adSet}`
      setSelectedId(firstId)
    }
    if (filteredAds.length === 0 && selectedId) {
      setSelectedId(null)
    }
  }, [filteredAds, selectedId])

  const selectedAd = useMemo(() => {
    if (!filteredAds.length) return null
    return (
      filteredAds.find((ad) => ad.id === selectedId) ||
      filteredAds.find((ad) => `${ad.adName}-${ad.adSetName || ad.adSet}` === selectedId) ||
      filteredAds[0]
    )
  }, [filteredAds, selectedId])

  if (!ads.length) {
    return (
      <AppShell activeTab="detailed" showTabs={false}>
        <div className="empty-state-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <h3>Ingen annonser lastet enda.</h3>
          <p style={{ margin: '0.25rem 0 1rem' }}>
            Last opp en CSV-fil eller bruk demo-fil på hovedsiden.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
            <button type="button" className="primary-button" onClick={() => navigate('/upload')}>
              Gå til opplasting
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => navigate('/upload')}
            >
              Bruk demo-fil på forsiden
            </button>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell activeTab="detailed" showTabs={false}>
      <PageHeader performanceFilter={performanceFilter} setPerformanceFilter={setPerformanceFilter} />

      <div className="detail-columns">
        <div className="detail-left">
          <div className="card ai-summary-card">
            <p className="eyebrow">AI Summary</p>
            <h3>Oppnå raskere lønnsomhet</h3>
            <ul>
              <li>Flytt 20% av budsjettet fra svake annonser til vinnerne.</li>
              <li>Øk budsjett på sterkeste annonse med 15% de neste 3 dagene.</li>
              <li>Test en ny video-variant med tydelig CTA for retargeting.</li>
            </ul>
          </div>

          <div className="card ads-list-card">
            <div className="ads-list-header">
              <p className="eyebrow" style={{ marginBottom: '0.15rem' }}>
                ADS
              </p>
              <h3>Annonser</h3>
            </div>
            <div className="ads-list-scroll">
              {filteredAds.map((ad) => {
                const id = ad.id || `${ad.adName}-${ad.adSetName || ad.adSet}`
                const rating = deriveRating(ad)
                return (
                  <button
                    key={id}
                    type="button"
                    className={`ad-card ${selectedId === id ? 'selected' : ''}`}
                    onClick={() => setSelectedId(id)}
                  >
                    <div className="ad-thumb" />
                    <div className="ad-meta">
                      <div className="ad-name-row">
                        <span className="ad-name ad-truncate">{ad.adName || 'Ukjent annonse'}</span>
                        <span className={`badge ${ratingColor[rating] || ''}`}>{rating}</span>
                      </div>
                      <div className="ad-stats">
                        <span>Spend {(ad.amountSpent || 0).toLocaleString('nb-NO')} kr</span>
                        <span>ROAS {(ad.roas || 0).toFixed(2)}</span>
                        <span>
                          CPA{' '}
                          {ad.cpa === null || ad.cpa === undefined
                            ? '—'
                            : `${ad.cpa.toLocaleString('nb-NO')} kr`}
                        </span>
                        {ad.ctr !== undefined && <span>CTR {(ad.ctr || 0).toFixed(1)}%</span>}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="detail-right">
          {selectedAd && (
            <div className="card creative-card">
              <div className="creative-card-header">
                <p className="eyebrow">Creative Preview</p>
                <h3>{selectedAd.adName || 'Ukjent annonse'}</h3>
              </div>
              <div className="creative-preview">Creative Preview</div>
            </div>
          )}

          {selectedAd && (
            <div className="card selected-ad-card">
              <p className="eyebrow">Selected Ad</p>
              <h3>{selectedAd.adName || 'Ukjent annonse'}</h3>
              <p className="muted">{selectedAd.adSetName || selectedAd.adSet || 'Ukjent ad set'}</p>
              <div className="detail-grid detail-grid-large">
                <div>
                  <p className="label">Spend</p>
                  <p className="value">
                    {(selectedAd.amountSpent || 0).toLocaleString('nb-NO')} kr
                  </p>
                </div>
                <div>
                  <p className="label">ROAS</p>
                  <p className="value">{(selectedAd.roas || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="label">CPA</p>
                  <p className="value">
                    {selectedAd.cpa === null || selectedAd.cpa === undefined
                      ? '—'
                      : `${selectedAd.cpa.toLocaleString('nb-NO')} kr`}
                  </p>
                </div>
                <div>
                  <p className="label">Purchases</p>
                  <p className="value">{selectedAd.purchases ?? '—'}</p>
                </div>
                <div>
                  <p className="label">Status</p>
                  <p className="value">{selectedAd.status || '—'}</p>
                </div>
              </div>
            </div>
          )}

          {selectedAd && (
            <div className="right-bottom-grid">
              <div className="card performance-card">
                <p className="eyebrow">Performance</p>
                <h3>
                  Score {selectedAd.performanceScore ?? '—'} / 100 ({deriveRating(selectedAd)})
                </h3>
                <p className="muted limited-text">
                  {deriveRating(selectedAd) === 'Winner'
                    ? 'Leverer sterke resultater, skaler forsiktig.'
                    : deriveRating(selectedAd) === 'Average'
                    ? 'Stabil, men har mer potensial med forbedret målretting.'
                    : 'Underpresterer, reduser budsjett eller test ny variant.'}
                </p>
              </div>

              <div className="card insights-card">
                <p className="eyebrow">AI Insights</p>
                <ul className="limited-text">
                  <li>ROAS opp hvis vi flytter budsjett fra svake annonser.</li>
                  <li>Retargeting CTR kan bedres med kortere hook.</li>
                  <li>CPA synker når vinner-annonsen får mer budsjett.</li>
                </ul>
              </div>

              <div className="card actions-card span-2">
                <p className="eyebrow">Recommended Actions</p>
                <div className="action-item">
                  <span className="action-icon">⚡</span>
                  Øk budsjett på vinner-annonsen med 15% (kort sikt)
                </div>
                <div className="action-item">
                  <span className="action-icon">🧪</span>
                  A/B-test ny video med kortere hook (medium)
                </div>
                <div className="action-item">
                  <span className="action-icon">🔥</span>
                  Paus svak annonse og flytt spend (kort sikt)
                </div>
                <div className="action-item">
                  <span className="action-icon">🎯</span>
                  Lag lookalike på kjøpere siste 60 dager (lang sikt)
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}

export default DetailedView
