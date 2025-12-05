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

const getPerformanceBucket = (ad) => {
  const raw =
    ad.performanceBucket || ad.performanceLabel || ad.performance || ad.filePerformanceBucket || ''
  const value = String(raw).toLowerCase().trim()
  if (value.includes('winner')) return 'Winner'
  if (value.includes('average')) return 'Average'
  if (value.includes('poor')) return 'Poor'
  return null
}

const getPerformanceRank = (ad) => {
  const bucket = getPerformanceBucket(ad)
  if (bucket === 'Winner') return 3
  if (bucket === 'Average') return 2
  if (bucket === 'Poor') return 1
  return 0
}

const deriveRating = (ad) => getPerformanceBucket(ad) || 'Unknown'

const percentDiff = (value, baseline) => {
  if (!baseline || baseline === 0 || value == null) return null
  const diff = ((value - baseline) / baseline) * 100
  return Number.isFinite(diff) ? diff : null
}

const getAdId = (ad) => ad.id || ad.ad_id || `${ad.adName || 'ad'}-${ad.adSetName || ad.adSet || 'set'}`

const DetailedView = () => {
  const navigate = useNavigate()
  const { currentAds } = useData()
  const ads = currentAds || []

  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'desc' })
  const [performanceFilter, setPerformanceFilter] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [expandedGroups, setExpandedGroups] = useState({
    winners: false,
    steady: false,
    needsCare: false,
  })

  const parseMetricNumber = (value) => {
    if (value == null) return 0
    if (typeof value === 'number') return value
    const cleaned = String(value)
      .replace(/\s/g, '')
      .replace(/kr/gi, '')
      .replace(/%/g, '')
      .replace(',', '.')
    const num = Number(cleaned)
    return Number.isFinite(num) ? num : 0
  }

  const averageMetrics = useMemo(() => {
    if (!ads.length) {
      return {
        avgRoas: null,
        avgCpa: null,
        avgCtr: null,
        totalSpend: 0,
        totalPurchases: 0,
        strongestAd: null,
      }
    }

    let roasSum = 0
    let roasCount = 0
    let cpaSum = 0
    let cpaCount = 0
    let ctrSum = 0
    let ctrCount = 0
    let totalSpend = 0
    let totalPurchases = 0

    ads.forEach((ad) => {
      const roasVal = parseMetricNumber(ad.roas)
      if (Number.isFinite(roasVal) && roasVal > 0) {
        roasSum += roasVal
        roasCount += 1
      }
      const cpaVal = parseMetricNumber(ad.cpa ?? ad.cpr)
      if (Number.isFinite(cpaVal) && cpaVal > 0) {
        cpaSum += cpaVal
        cpaCount += 1
      }
      const ctrVal = parseMetricNumber(ad.ctr)
      if (Number.isFinite(ctrVal) && ctrVal >= 0) {
        ctrSum += ctrVal
        ctrCount += 1
      }
      totalSpend += parseMetricNumber(ad.amountSpent)
      totalPurchases += parseMetricNumber(ad.purchases ?? ad.results)
    })

    const avgRoas = roasCount ? roasSum / roasCount : null
    const avgCpa = cpaCount ? cpaSum / cpaCount : null
    const avgCtr = ctrCount ? ctrSum / ctrCount : null

    const validRoasAds = ads.filter((ad) => Number.isFinite(parseMetricNumber(ad.roas)))
    const strongestAd = validRoasAds.length
      ? validRoasAds.reduce((best, ad) =>
          parseMetricNumber(ad.roas) > parseMetricNumber(best.roas) ? ad : best,
        )
      : null

    return { avgRoas, avgCpa, avgCtr, totalSpend, totalPurchases, strongestAd }
  }, [ads])

  const visibleAds = useMemo(() => {
    if (!ads.length) return []
    const filtered = ads.filter((ad) => {
      if (performanceFilter === 'all') return true
      const bucket = getPerformanceBucket(ad)
      if (performanceFilter === 'winner') return bucket === 'Winner'
      if (performanceFilter === 'average') return bucket === 'Average'
      if (performanceFilter === 'poor') return bucket === 'Poor'
      return true
    })

    const { key, direction } = sortConfig
    if (!key) return filtered

    const sorted = [...filtered].sort((a, b) => {
      const getValue = (ad) => {
        switch (key) {
          case 'results':
            return parseMetricNumber(ad.purchases ?? ad.results)
          case 'cpr':
            return parseMetricNumber(ad.cpr ?? ad.cpa)
          case 'roas':
            return parseMetricNumber(ad.roas)
          case 'ctr':
            return parseMetricNumber(ad.ctr)
          case 'performance':
            return getPerformanceRank(ad)
          case 'name':
            return String(ad.name || ad.adName || '')
          default:
            return 0
        }
      }
      const aVal = getValue(a)
      const bVal = getValue(b)
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return direction === 'desc' ? bVal - aVal : aVal - bVal
      }
      const cmp = String(aVal).localeCompare(String(bVal), 'nb', { sensitivity: 'base' })
      return direction === 'desc' ? -cmp : cmp
    })

    return sorted
  }, [ads, performanceFilter, sortConfig])

  useEffect(() => {
    if (visibleAds.length > 0 && !selectedId) {
      setSelectedId(getAdId(visibleAds[0]))
    }
    if (visibleAds.length === 0 && selectedId) {
      setSelectedId(null)
    }
  }, [visibleAds, selectedId])

  const selectedAd = useMemo(() => {
    if (!visibleAds.length) return null
    return visibleAds.find((ad) => getAdId(ad) === selectedId) || visibleAds[0]
  }, [visibleAds, selectedId])

  const selectedStats = useMemo(() => {
    if (!selectedAd) return null
    const roas = parseMetricNumber(selectedAd.roas)
    const cpa = parseMetricNumber(selectedAd.cpa ?? selectedAd.cpr)
    const ctr = parseMetricNumber(selectedAd.ctr)

    const roasDiff = percentDiff(roas, averageMetrics.avgRoas)
    const cpaDiff = percentDiff(cpa, averageMetrics.avgCpa)
    const ctrDiff = percentDiff(ctr, averageMetrics.avgCtr)

    const bucket = deriveRating(selectedAd)

    return { roas, cpa, ctr, roasDiff, cpaDiff, ctrDiff, bucket }
  }, [selectedAd, averageMetrics])

  const insightBullets = useMemo(() => {
    if (!selectedStats) return []
    const bullets = []
    if (selectedStats.bucket === 'Winner') {
      bullets.push('This ad is classified as a winner among the campaign ads.')
    }
    if (selectedStats.roasDiff != null) {
      if (selectedStats.roasDiff > 15) {
        bullets.push('ROAS is higher than the campaign average.')
      } else if (selectedStats.roasDiff < -15) {
        bullets.push('ROAS is below average; results trail the strongest ads.')
      }
    }
    if (selectedStats.ctrDiff != null) {
      if (selectedStats.ctrDiff > 10) {
        bullets.push('CTR is higher than average; the ad grabs attention well.')
      } else if (selectedStats.ctrDiff < -10) {
        bullets.push('CTR is lower than average; it gets less attention than other ads.')
      }
    }
    if (selectedStats.ctrDiff != null && selectedStats.roasDiff != null) {
      if (selectedStats.ctrDiff > 5 && selectedStats.roasDiff < -5) {
        bullets.push('CTR is above average but ROAS is lower; the challenge may be post-click.')
      }
    }
    if (!bullets.length) {
      bullets.push('Performance is close to the campaign average on key metrics.')
    }
    return bullets.slice(0, 4)
  }, [selectedStats])

  const actionBullets = useMemo(() => {
    if (!selectedStats) return []
    const bullets = []
    if (selectedStats.roasDiff != null && selectedStats.roasDiff < -10) {
      bullets.push('Review audience or offer if ROAS sits below average.')
    } else if (selectedStats.roasDiff != null && selectedStats.roasDiff > 10) {
      bullets.push('Analyze what separates this ad from others with lower ROAS to learn and replicate.')
    }
    if (selectedStats.ctrDiff != null && selectedStats.ctrDiff < -10) {
      bullets.push('With low CTR, test variations in hooks, messaging, or creative expression.')
    }
    if (
      selectedStats.ctrDiff != null &&
      selectedStats.ctrDiff > 5 &&
      selectedStats.roasDiff != null &&
      selectedStats.roasDiff < 0
    ) {
      bullets.push('If CTR is high but ROAS is weak, the issue may be on the landing page or purchase flow.')
    }
    if (selectedStats.bucket === 'Winner') {
      bullets.push('For winner ads, extract learnings to fuel new variants.')
    }
    if (!bullets.length) {
      bullets.push('Performance is near average. Monitor trends and consider small adjustments as needed.')
    }
    return bullets.slice(0, 4)
  }, [selectedStats])

  const groupedAds = useMemo(() => {
    const winners = []
    const steady = []
    const needsCare = []
    const avgRoas = averageMetrics.avgRoas
    ads.forEach((ad) => {
      const bucket = getPerformanceBucket(ad)
      const roasVal = parseMetricNumber(ad.roas)
      const isWinner = bucket === 'Winner' || (avgRoas ? roasVal > avgRoas * 1.1 : false)
      const isPoor = bucket === 'Poor' || (avgRoas ? roasVal < avgRoas * 0.9 : false)
      if (isWinner) {
        winners.push(ad)
        return
      }
      if (isPoor) {
        needsCare.push(ad)
        return
      }
      steady.push(ad)
    })
    return { winners, steady, needsCare }
  }, [ads, averageMetrics.avgRoas])

  const handleSelectAdFromGroup = (ad) => {
    const id = getAdId(ad)
    setSelectedId(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggleGroup = (key) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        const nextDirection = prev.direction === 'desc' ? 'asc' : 'desc'
        return { key, direction: nextDirection }
      }
      return { key, direction: 'desc' }
    })
  }

  if (!ads.length) {
    return (
      <AppShell activeTab="detailed" showTabs={false}>
        <div className="empty-state-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <h3>No ads loaded yet.</h3>
          <p style={{ margin: '0.25rem 0 1rem' }}>
            Upload a CSV file or use the demo file on the homepage.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
            <button type="button" className="primary-button" onClick={() => navigate('/upload')}>
              Go to upload
            </button>
            <button
              type="button"
              className="secondary-button demo-button"
              onClick={() => navigate('/upload')}
            >
              Use demo file on the homepage
            </button>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell activeTab="detailed" showTabs={false}>
      <PageHeader />

      <div className="top-grid">
        <div className="top-left">
          <div className="card selected-ad-card">
            <p className="eyebrow">Overview</p>
            <div className="kpi-row">
              <div className="kpi-chip">
                <div className="kpi-value">{averageMetrics.totalSpend.toLocaleString('nb-NO')} kr</div>
                <div className="kpi-label">Total spend</div>
              </div>
              <div className="kpi-chip">
                <div className="kpi-value">{averageMetrics.totalPurchases.toLocaleString('nb-NO')}</div>
                <div className="kpi-label">Total purchases</div>
              </div>
              <div className="kpi-chip">
                <div className="kpi-value">{averageMetrics.avgRoas == null ? '—' : averageMetrics.avgRoas.toFixed(2)}</div>
                <div className="kpi-label">Avg ROAS</div>
              </div>
              <div className="kpi-chip">
                <div className="kpi-value">{averageMetrics.avgCpa == null ? '—' : `${averageMetrics.avgCpa.toLocaleString('nb-NO')} kr`}</div>
                <div className="kpi-label">Avg CPA</div>
              </div>
              <div className="kpi-chip">
                <div className="kpi-value">{averageMetrics.avgCtr == null ? '—' : `${averageMetrics.avgCtr.toFixed(2)} %`}</div>
                <div className="kpi-label">Avg CTR</div>
              </div>
            </div>
            {ads.length > 0 && (
              <p className="kpi-footnote">Based on {ads.length} ads in the campaign.</p>
            )}
          </div>

          <div className="card grouped-card">
            <p className="eyebrow">Winners</p>
            <p className="muted group-sub">Ads that clearly outperform the average.</p>
            <div className="group-list">
              {groupedAds.winners.slice(0, expandedGroups.winners ? 5 : 2).map((ad, idx) => {
                const name = ad.adName || 'Unknown ad'
                const roas = ad.roas === null || ad.roas === undefined ? '—' : ad.roas.toFixed(2)
                return (
                  <div
                    key={`win-${getAdId(ad)}-${idx}`}
                    className="group-row"
                    onClick={() => handleSelectAdFromGroup(ad)}
                  >
                    <div className="group-row-main">
                      <span className="group-ad-name ad-truncate" title={name}>
                        {name}
                      </span>
                      <span className="group-metric">ROAS {roas}</span>
                    </div>
                    <button
                      type="button"
                      className="secondary-button thin small"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSelectAdFromGroup(ad)
                      }}
                    >
                      View ad
                    </button>
                  </div>
                )
              })}
              {groupedAds.winners.length > (expandedGroups.winners ? 5 : 2) && (
                <div className="group-row more-row">
                  … and {groupedAds.winners.length - (expandedGroups.winners ? 5 : 2)} more ads
                </div>
              )}
              {!groupedAds.winners.length && (
                <div className="group-row muted">No ads in this group yet.</div>
              )}
            </div>
            {groupedAds.winners.length > 2 && (
              <button
                type="button"
                className="secondary-button thin small toggle-btn"
                onClick={() => toggleGroup('winners')}
              >
                {expandedGroups.winners ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>

          <div className="card grouped-card">
            <p className="eyebrow">Steady ads</p>
            <p className="muted group-sub">Perform around the campaign average.</p>
            <div className="group-list">
              {groupedAds.steady.slice(0, expandedGroups.steady ? 5 : 2).map((ad, idx) => {
                const name = ad.adName || 'Unknown ad'
                const roas = ad.roas === null || ad.roas === undefined ? '—' : ad.roas.toFixed(2)
                return (
                  <div
                    key={`std-${getAdId(ad)}-${idx}`}
                    className="group-row"
                    onClick={() => handleSelectAdFromGroup(ad)}
                  >
                    <div className="group-row-main">
                      <span className="group-ad-name ad-truncate" title={name}>
                        {name}
                      </span>
                      <span className="group-metric">ROAS {roas}</span>
                    </div>
                    <button
                      type="button"
                      className="secondary-button thin small"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSelectAdFromGroup(ad)
                      }}
                    >
                      View ad
                    </button>
                  </div>
                )
              })}
              {groupedAds.steady.length > (expandedGroups.steady ? 5 : 2) && (
                <div className="group-row more-row">
                  … and {groupedAds.steady.length - (expandedGroups.steady ? 5 : 2)} more ads
                </div>
              )}
              {!groupedAds.steady.length && (
                <div className="group-row muted">No ads in this group yet.</div>
              )}
            </div>
            {groupedAds.steady.length > 2 && (
              <button
                type="button"
                className="secondary-button thin small toggle-btn"
                onClick={() => toggleGroup('steady')}
              >
                {expandedGroups.steady ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>

          <div className="card grouped-card">
            <p className="eyebrow">Ads to review</p>
            <p className="muted group-sub">Clearly below average on ROAS/CPA.</p>
            <div className="group-list">
              {groupedAds.needsCare.slice(0, expandedGroups.needsCare ? 5 : 2).map((ad, idx) => {
                const name = ad.adName || 'Unknown ad'
                const roas = ad.roas === null || ad.roas === undefined ? '—' : ad.roas.toFixed(2)
                return (
                  <div
                    key={`care-${getAdId(ad)}-${idx}`}
                    className="group-row"
                    onClick={() => handleSelectAdFromGroup(ad)}
                  >
                    <div className="group-row-main">
                      <span className="group-ad-name ad-truncate" title={name}>
                        {name}
                      </span>
                      <span className="group-metric">ROAS {roas}</span>
                    </div>
                    <button
                      type="button"
                      className="secondary-button thin small"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSelectAdFromGroup(ad)
                      }}
                    >
                      View ad
                    </button>
                  </div>
                )
              })}
              {groupedAds.needsCare.length > (expandedGroups.needsCare ? 5 : 2) && (
                <div className="group-row more-row">
                  … and {groupedAds.needsCare.length - (expandedGroups.needsCare ? 5 : 2)} more ads
                </div>
              )}
              {!groupedAds.needsCare.length && (
                <div className="group-row muted">No ads in this group yet.</div>
              )}
            </div>
            {groupedAds.needsCare.length > 2 && (
              <button
                type="button"
                className="secondary-button thin small toggle-btn"
                onClick={() => toggleGroup('needsCare')}
              >
                {expandedGroups.needsCare ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        </div>

        <div className="top-right">
          {selectedAd && (
            <div className="card creative-card detail-card">
              <div className="creative-card-header">
                <p className="eyebrow">Creative Preview</p>
                <h3>{selectedAd.adName || 'Unknown ad'}</h3>
              </div>
              <div className="creative-preview">Creative Preview</div>
            </div>
          )}

          {selectedAd && (
            <div className="card selected-ad-card detail-card">
              <p className="eyebrow">Ad details</p>
              <div className="flex between" style={{ gap: '0.5rem', alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <h3 className="ad-truncate" title={selectedAd.adName || 'Unknown ad'}>
                    {selectedAd.adName || 'Unknown ad'}
                  </h3>
                  <p
                    className="muted ad-truncate"
                    title={selectedAd.adSetName || selectedAd.adSet || 'Unknown ad set'}
                  >
                    {selectedAd.adSetName || selectedAd.adSet || 'Unknown ad set'}
                  </p>
                </div>
                <span className={`badge ${ratingColor[getPerformanceBucket(selectedAd)] || ''}`}>
                  {getPerformanceBucket(selectedAd) || '—'}
                </span>
              </div>
              <div className="detail-grid detail-grid-large metrics-grid">
                <div>
                  <p className="label">Spend</p>
                  <p className="value">{(selectedAd.amountSpent || 0).toLocaleString('nb-NO')} kr</p>
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
                  <p className="label">CTR</p>
                  <p className="value">
                    {selectedAd.ctr === null || selectedAd.ctr === undefined
                      ? '—'
                      : `${(selectedAd.ctr || 0).toFixed(1)} %`}
                  </p>
                </div>
              </div>
              {selectedStats && (
                <p className="muted limited-text" style={{ marginTop: '1rem' }}>
                  {selectedStats.roasDiff != null && selectedStats.roasDiff > 5
                    ? 'ROAS is higher than the campaign average.'
                    : selectedStats.roasDiff != null && selectedStats.roasDiff < -5
                    ? 'ROAS is lower than the campaign average.'
                    : 'ROAS is roughly on par with the average.'}{' '}
                  {selectedStats.cpaDiff != null && selectedStats.cpaDiff > 5
                    ? 'CPA is higher than the average.'
                    : selectedStats.cpaDiff != null && selectedStats.cpaDiff < -5
                    ? 'CPA is lower than the average.'
                    : 'CPA is near the average.'}{' '}
                  {selectedStats.ctrDiff != null && selectedStats.ctrDiff > 5
                    ? 'CTR is higher than the average.'
                    : selectedStats.ctrDiff != null && selectedStats.ctrDiff < -5
                    ? 'CTR is lower than the average.'
                    : 'CTR is near the average.'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bottom-section">
        <div className="chip-group table-filter">
          {['all', 'winner', 'average', 'poor'].map((key) => (
            <button
              key={key}
              type="button"
              className={`chip ${performanceFilter === key ? 'active' : ''}`}
              onClick={() => setPerformanceFilter(key)}
            >
              {key === 'all'
                ? 'All'
                : key === 'winner'
                ? 'Winner'
                : key === 'average'
                ? 'Average'
                : 'Poor'}
            </button>
          ))}
        </div>

        <div className="table-card">
          <div className="table-header">
            <button type="button" onClick={() => handleSort('name')}>
              Annonse
            </button>
            <button type="button" onClick={() => handleSort('performance')}>
              Performance
            </button>
            <span>Tiltak</span>
            <button type="button" className="right" onClick={() => handleSort('results')}>
              Results
            </button>
            <button type="button" className="right" onClick={() => handleSort('cpr')}>
              CPR
            </button>
            <button type="button" className="right" onClick={() => handleSort('roas')}>
              ROAS
            </button>
            <button type="button" className="right" onClick={() => handleSort('ctr')}>
              CTR
            </button>
          </div>

          <div className="table-body">
            {visibleAds.map((ad, index) => {
              const baseId = getAdId(ad)
              const rowKey = `${baseId}-${index}`
              const bucket = getPerformanceBucket(ad)
              const rating = bucket || '—'
              const purchases = ad.purchases ?? ad.results ?? '—'
              const cpa =
                ad.cpa === null || ad.cpa === undefined
                  ? '—'
                  : `${ad.cpa.toLocaleString('nb-NO')} kr`
              const roas = ad.roas === null || ad.roas === undefined ? '—' : ad.roas.toFixed(2)
              const ctr =
                ad.ctr === null || ad.ctr === undefined ? '—' : `${(ad.ctr || 0).toFixed(1)} %`

              return (
                <div
                  key={rowKey}
                  className={`table-row ${selectedId === baseId ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedId(baseId)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                >
                  <div className="table-cell name-cell">
                    <div className="ad-thumb small" />
                    <div className="name-meta" title={ad.adName || 'Unknown ad'}>
                      <span className="ad-name ad-truncate">{ad.adName || 'Unknown ad'}</span>
                    </div>
                  </div>
                  <div className="table-cell center">
                    <span className={`badge ${ratingColor[rating] || ''}`}>{rating}</span>
                  </div>
                  <div className="table-cell center">
                    <button type="button" className="secondary-button thin">
                      View actions
                    </button>
                  </div>
                  <div className="table-cell right">{purchases}</div>
                  <div className="table-cell right">{cpa}</div>
                  <div className="table-cell right">{roas}</div>
                  <div className="table-cell right">{ctr}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

export default DetailedView
