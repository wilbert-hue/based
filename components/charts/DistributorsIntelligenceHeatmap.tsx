'use client'

import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { 
  loadDistributorsIntelligenceData,
  type DistributorsIntelligenceData
} from '@/lib/distributors-intelligence-data'

interface DistributorsIntelligenceHeatmapProps {
  title?: string
  height?: number
}

interface PropositionDetailModalProps {
  isOpen: boolean
  onClose: () => void
  propositions: any[]
  region?: string
  segment?: string
}

function PropositionDetailModal({ isOpen, onClose, propositions, region, segment }: PropositionDetailModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-black">Value Propositions</h2>
            <p className="text-sm text-black mt-1">
              {region && segment ? `${region} - ${segment}` : 'All Propositions'} ({propositions.length} propositions)
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-black hover:text-black transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {propositions.map((prop, idx) => (
              <div
                key={idx}
                className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-black text-sm mb-2">{prop.column}</h3>
                    <p className="text-sm text-gray-700">{prop.value}</p>
                    {prop.sheet && (
                      <p className="text-xs text-gray-500 mt-2">Sheet: {prop.sheet}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#168AAD] text-white rounded-md hover:bg-[#1A759F] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export function DistributorsIntelligenceHeatmap({ title, height = 600 }: DistributorsIntelligenceHeatmapProps) {
  const [distributorsData, setDistributorsData] = useState<DistributorsIntelligenceData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hoveredCell, setHoveredCell] = useState<{ 
    region: string
    segment: string
    count: number
    x: number
    y: number
  } | null>(null)
  const [selectedCell, setSelectedCell] = useState<{
    region: string
    segment: string
    propositions: any[]
  } | null>(null)
  const [isTooltipHovered, setIsTooltipHovered] = useState(false)
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load data on mount
  useEffect(() => {
    const abortController = new AbortController()
    let isMounted = true
    
    async function loadData() {
      try {
        if (!isMounted || abortController.signal.aborted) return
        
        setIsLoading(true)
        const data = await loadDistributorsIntelligenceData()
        
        // Only update state if component is still mounted and not aborted
        if (isMounted && !abortController.signal.aborted) {
          setDistributorsData(data)
          setIsLoading(false)
        }
      } catch (error) {
        // Only log/handle error if component is still mounted
        if (isMounted && !abortController.signal.aborted) {
          console.error('Error loading distributors intelligence data:', error)
          setIsLoading(false)
        }
      }
    }
    
    loadData()
    
    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false
      abortController.abort()
    }
  }, [])

  // Extract propositions and group by region/segment
  const { regions, segments, heatmapData, allPropositions } = useMemo(() => {
    if (!distributorsData) {
      return { regions: [], segments: [], heatmapData: {}, allPropositions: [] }
    }

    // Get propositions from the data
    const props = (distributorsData as any).data?.propositions || []
    const allPropositions = props

    // Extract unique regions and segments from propositions or distributor data
    const regionSet = new Set<string>()
    const segmentSet = new Set<string>()
    const heatmap: Record<string, Record<string, any[]>> = {}

    // Try to extract from distributor rows
    const distributors = distributorsData.data['Module 1 - Standard'] || []
    
    distributors.forEach((dist: any) => {
      const region = dist.headquarters_emirate || dist.cities_regions_covered || 'Unknown'
      const segment = dist.business_type || dist.company_name || 'Unknown'
      
      regionSet.add(region)
      segmentSet.add(segment)
      
      if (!heatmap[region]) {
        heatmap[region] = {}
      }
      if (!heatmap[region][segment]) {
        heatmap[region][segment] = []
      }
      
      // Add propositions if available
      if (props.length > 0) {
        heatmap[region][segment].push(...props.filter((p: any) => 
          p.fullRow && (p.fullRow['Company Name'] === dist.company_name || 
                       p.fullRow['Company'] === dist.company_name)
        ))
      }
    })

    // If we have propositions but no heatmap data, create from propositions
    if (props.length > 0 && Object.keys(heatmap).length === 0) {
      props.forEach((prop: any) => {
        const row = prop.fullRow || {}
        const region = row['Region'] || row['Headquarters'] || row['Location'] || 'Unknown'
        const segment = row['Segment'] || row['Business Type'] || row['Category'] || 'Unknown'
        
        regionSet.add(region)
        segmentSet.add(segment)
        
        if (!heatmap[region]) {
          heatmap[region] = {}
        }
        if (!heatmap[region][segment]) {
          heatmap[region][segment] = []
        }
        
        heatmap[region][segment].push(prop)
      })
    }

    // Default regions and segments if no data
    const defaultRegions = ['North America', 'Europe', 'Asia Pacific', 'Latin America', 'Middle East', 'Africa']
    const defaultSegments = ['Direct Sales through OEM', 'Distributors and Wholesalers', 'Retailers', 'Solar Installers and Contractors']

    return {
      regions: Array.from(regionSet).length > 0 ? Array.from(regionSet) : defaultRegions,
      segments: Array.from(segmentSet).length > 0 ? Array.from(segmentSet) : defaultSegments,
      heatmapData: heatmap,
      allPropositions: allPropositions
    }
  }, [distributorsData])

  // Calculate color intensity based on proposition count
  const getColor = useCallback((count: number, maxCount: number) => {
    if (count === 0) return 'bg-gray-50'
    if (maxCount === 0) return 'bg-[#52B69A]'
    
    const intensity = (count / maxCount) * 100
    
    if (intensity < 20) return 'bg-[#D9ED92]'  // Yellow Green
    if (intensity < 40) return 'bg-[#B5E48C]'  // Light Lime
    if (intensity < 60) return 'bg-[#52B69A]'  // Teal
    if (intensity < 80) return 'bg-[#168AAD]'  // Deep Teal
    return 'bg-[#1A759F]'  // Blue Teal
  }, [])

  // Get max count for color scaling
  const maxCount = useMemo(() => {
    let max = 0
    segments.forEach(segment => {
      regions.forEach(region => {
        const count = heatmapData[region]?.[segment]?.length || 0
        max = Math.max(max, count)
      })
    })
    return max
  }, [regions, segments, heatmapData])

  // Handle cell click
  const handleCellClick = useCallback((region: string, segment: string) => {
    const propositions = heatmapData[region]?.[segment] || []
    setSelectedCell({ region, segment, propositions })
  }, [heatmapData])

  // Clear timeout when component unmounts
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [])

  // Handle mouse leave from cell with delay
  const handleCellMouseLeave = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
    }
    
    closeTimeoutRef.current = setTimeout(() => {
      if (!isTooltipHovered) {
        setHoveredCell(null)
      }
    }, 200)
  }, [isTooltipHovered])

  // Handle mouse enter on tooltip
  const handleTooltipMouseEnter = useCallback(() => {
    setIsTooltipHovered(true)
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
    }
  }, [])

  // Handle mouse leave from tooltip
  const handleTooltipMouseLeave = useCallback(() => {
    setIsTooltipHovered(false)
    closeTimeoutRef.current = setTimeout(() => {
      setHoveredCell(null)
    }, 150)
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#168AAD] mx-auto"></div>
          <p className="mt-4 text-black">Loading distributors intelligence data...</p>
        </div>
      </div>
    )
  }

  if (!distributorsData || regions.length === 0 || segments.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
        <div className="text-center">
          <p className="text-black">No data to display</p>
          <p className="text-sm text-black mt-1">
            Distributors intelligence data is being loaded...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-black">
          {title || 'Distributors Intelligence - Value Propositions Heatmap'}
        </h3>
        <p className="text-xs text-black mt-0.5">
          Value propositions by Region and Segment ({allPropositions.length} total propositions)
        </p>
      </div>

      <div className="overflow-auto" style={{ maxHeight: height }}>
        <div className="inline-block min-w-full">
          {/* Header row with Regions */}
          <div className="flex">
            <div className="w-32 p-2 bg-gray-100 border border-gray-300 font-medium text-xs">
              Segment \ Region
            </div>
            {regions.map(region => (
              <div
                key={region}
                className="w-28 p-2 bg-gray-100 border border-gray-300 text-xs font-medium text-center truncate"
                title={region}
              >
                {region}
              </div>
            ))}
          </div>

          {/* Data rows - Segments */}
          {segments.map((segment) => (
            <div key={segment} className="flex">
              <div className="w-32 p-2 bg-gray-100 border border-gray-300 font-medium text-xs truncate" title={segment}>
                {segment}
              </div>
              {regions.map((region) => {
                const propositions = heatmapData[region]?.[segment] || []
                const count = propositions.length
                
                return (
                  <div
                    key={`${region}-${segment}`}
                    className={`w-28 p-2 border border-gray-300 text-center cursor-pointer transition-all hover:opacity-80 hover:shadow-md ${getColor(count, maxCount)}`}
                    onClick={() => handleCellClick(region, segment)}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      setHoveredCell({
                        region,
                        segment,
                        count,
                        x: rect.left + rect.width / 2,
                        y: rect.top - 10
                      })
                    }}
                    onMouseLeave={handleCellMouseLeave}
                  >
                    <span className="text-xs font-semibold text-black">
                      {count}
                    </span>
                    <div className="text-[10px] mt-0.5 opacity-75">
                      props
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Custom Tooltip */}
      {hoveredCell && (() => {
        const propositions = heatmapData[hoveredCell.region]?.[hoveredCell.segment] || []
        const displayProps = propositions.slice(0, 3)
        const hasMore = propositions.length > 3

        return (
          <div
            className="fixed bg-white p-4 border border-gray-200 rounded-lg shadow-xl z-50 pointer-events-auto min-w-[320px] max-w-[400px]"
            style={{
              left: `${hoveredCell.x}px`,
              top: `${hoveredCell.y}px`,
              transform: 'translate(-50%, -100%)',
              marginTop: '-10px'
            }}
            onMouseEnter={handleTooltipMouseEnter}
            onMouseLeave={handleTooltipMouseLeave}
          >
            <p className="font-semibold text-black mb-3 pb-2 border-b border-gray-200">
              Value Propositions
            </p>
            <div className="space-y-2 mb-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-black">Region:</span>
                <span className="text-sm font-medium text-black">{hoveredCell.region}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-black">Segment:</span>
                <span className="text-sm font-medium text-black">{hoveredCell.segment}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-black">Total Propositions:</span>
                <span className="text-sm font-semibold text-[#168AAD]">
                  {hoveredCell.count}
                </span>
              </div>
            </div>

            {/* Proposition List (max 3) */}
            {displayProps.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs font-medium text-black mb-2">Sample Propositions:</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {displayProps.map((prop, idx) => (
                    <div key={idx} className="text-xs text-black py-1">
                      • {prop.column}: {prop.value.substring(0, 50)}{prop.value.length > 50 ? '...' : ''}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Explore All Link */}
            {hasMore && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <button
                  onClick={() => {
                    setSelectedCell({
                      region: hoveredCell.region,
                      segment: hoveredCell.segment,
                      propositions
                    })
                    setHoveredCell(null)
                    setIsTooltipHovered(false)
                  }}
                  className="w-full px-3 py-2 bg-[#168AAD] hover:bg-[#1A759F] text-white text-xs font-semibold rounded-md transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span>Explore All {hoveredCell.count} Propositions</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )
      })()}

      {/* Proposition Detail Modal */}
      {selectedCell && (
        <PropositionDetailModal
          isOpen={!!selectedCell}
          onClose={() => setSelectedCell(null)}
          propositions={selectedCell.propositions}
          region={selectedCell.region}
          segment={selectedCell.segment}
        />
      )}

      {/* Legend */}
      <div className="mt-3 flex items-center justify-center space-x-3">
        <span className="text-xs text-black">Low</span>
        <div className="flex space-x-0.5">
          <div className="w-5 h-5 bg-[#D9ED92] rounded"></div>
          <div className="w-5 h-5 bg-[#B5E48C] rounded"></div>
          <div className="w-5 h-5 bg-[#52B69A] rounded"></div>
          <div className="w-5 h-5 bg-[#168AAD] rounded"></div>
          <div className="w-5 h-5 bg-[#1A759F] rounded"></div>
        </div>
        <span className="text-xs text-black">High</span>
      </div>

      <div className="mt-2 text-center text-xs text-black">
        Comparing {segments.length} segments &times; {regions.length} regions
      </div>
    </div>
  )
}

export default DistributorsIntelligenceHeatmap

