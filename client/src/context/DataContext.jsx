import { createContext, useContext, useMemo, useState } from 'react'

// Shared data context for parsed ads/metrics and related info.
const DataContext = createContext(null)

export const DataProvider = ({ children }) => {
  const [currentAds, setCurrentAds] = useState([])
  const [previousAds, setPreviousAds] = useState([])
  const [currentFileInfo, setCurrentFileInfo] = useState(null)
  const [previousFileInfo, setPreviousFileInfo] = useState(null)
  const [aiInsights, setAiInsights] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const value = useMemo(
    () => ({
      currentAds,
      setCurrentAds,
      previousAds,
      setPreviousAds,
      currentFileInfo,
      setCurrentFileInfo,
      previousFileInfo,
      setPreviousFileInfo,
      aiInsights,
      setAiInsights,
      loading,
      setLoading,
      error,
      setError,
    }),
    [currentAds, previousAds, currentFileInfo, previousFileInfo, aiInsights, loading, error],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export const useData = () => {
  const ctx = useContext(DataContext)
  if (!ctx) {
    throw new Error('useData must be used within a DataProvider')
  }
  return ctx
}
