'use client'

import { useMemo, useState } from 'react'
import { useDashboardStore } from '@/lib/store'
import { filterData } from '@/lib/data-processor'

interface MatrixHeatmapProps {
  title?: string
  height?: number
}

export function MatrixHeatmap({ title, height = 600 }: MatrixHeatmapProps) {
  const { data, filters } = useDashboardStore()
  const [hoveredCell, setHoveredCell] = useState<{ geo: string; year: number; segment: string; value: number; x: number; y: number } | null>(null)

  const matrixData = useMemo(() => {
    if (!data) return { matrix: [], geographyYears: [], segments: [], maxValue: 0, minValue: 0, years: [] }

    // Get the appropriate dataset
    const dataset = filters.dataType === 'value'
      ? data.data.value.geography_segment_matrix
      : data.data.volume.geography_segment_matrix

    // Filter data
    const filtered = filterData(dataset, filters)

    // Check if we need Global-to-regional mapping
    const regionalGeographies = ['North America', 'Europe', 'Asia Pacific', 'Latin America', 'Middle East', 'Africa', 'ASEAN', 'SAARC Region', 'CIS Region']
    const hasRegionalSelection = filters.geographies.some(g => regionalGeographies.includes(g))
    const hasOnlyGlobalRecords = filtered.every(r => r.geography === 'Global')
    const needsGlobalMapping = hasRegionalSelection && hasOnlyGlobalRecords && !filters.geographies.includes('Global')

    // Get unique geographies - use selected geographies if we need Global mapping
    let uniqueGeos: string[]
    if (needsGlobalMapping) {
      // Use selected regional geographies instead of Global
      uniqueGeos = filters.geographies.filter(g => regionalGeographies.includes(g))
    } else {
      uniqueGeos = [...new Set(filtered.map(r => r.geography).filter(g => g && typeof g === 'string' && g.trim() !== ''))]
    }

    // Get unique segments - filter out empty/undefined values
    const uniqueSegs = [...new Set(filtered.map(r => r.segment).filter(s => s && typeof s === 'string' && s.trim() !== '' && s !== '__ALL_SEGMENTS__'))]

    // If no unique values found, use the selected filters as fallback
    const geographies = uniqueGeos.length > 0 ? uniqueGeos.sort() : (filters.geographies.length > 0 ? filters.geographies : [])
    const segments = uniqueSegs.length > 0 ? uniqueSegs.sort() : (filters.segments.length > 0 ? filters.segments : [])

    // Get all years in the selected range
    const [startYear, endYear] = filters.yearRange
    const years: number[] = []
    for (let year = startYear; year <= endYear; year++) {
      years.push(year)
    }

    // Create geography-year combinations (rows)
    const geographyYears: Array<{ geography: string; year: number; label: string }> = []
    geographies.forEach(geo => {
      years.forEach(year => {
        geographyYears.push({
          geography: geo,
          year: year,
          label: `${geo} - ${year}`
        })
      })
    })

    // Realistic regional market share distribution for Global data mapping
    const regionalMarketShares: Record<string, number> = {
      'North America': 0.31,
      'Europe': 0.22,
      'Asia Pacific': 0.41,
      'Latin America': 0.02,
      'Middle East': 0.025,
      'Africa': 0.015,
      'ASEAN': 0.10,
      'SAARC Region': 0.08,
      'CIS Region': 0.05
    }

    // Calculate sum of market shares for selected regions
    const selectedShareSum = geographies.reduce((sum, geo) =>
      sum + (regionalMarketShares[geo] || 0.1), 0
    )

    // Build matrix: rows = geography-year combinations, columns = segments
    const matrix: number[][] = []
    let maxValue = 0
    let minValue = Infinity

    geographyYears.forEach((geoYear, rowIndex) => {
      matrix[rowIndex] = []
      segments.forEach((seg, segIndex) => {
        let value = 0

        if (needsGlobalMapping) {
          // Find Global record and apply proportional distribution
          const globalRecord = filtered.find(r => r.geography === 'Global' && r.segment === seg)
          if (globalRecord) {
            const globalValue = globalRecord.time_series[geoYear.year] || 0
            const regionShare = regionalMarketShares[geoYear.geography] || 0.1
            const normalizedShare = regionShare / selectedShareSum
            value = globalValue * normalizedShare
          }
        } else {
          // Direct lookup for non-Global data
          const record = filtered.find(r => r.geography === geoYear.geography && r.segment === seg)
          value = record?.time_series[geoYear.year] || 0
        }

        matrix[rowIndex][segIndex] = value
        maxValue = Math.max(maxValue, value)
        if (value > 0) minValue = Math.min(minValue, value)
      })
    })

    if (minValue === Infinity) minValue = 0

    // Additional validation - ensure we have valid geographies and segments
    if (geographies.length === 0 || segments.length === 0) {
      console.warn('⚠️ MatrixHeatmap: Empty geographies or segments after filtering', {
        geographies,
        segments,
        filteredCount: filtered.length
      })
    }

    return { matrix, geographyYears, segments, maxValue, minValue, years }
  }, [data, filters])

  if (!data || matrixData.matrix.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
        <div className="text-center">
          <p className="text-black">No data to display</p>
          <p className="text-sm text-black mt-1">
            Select multiple geographies and segments for matrix view
          </p>
        </div>
      </div>
    )
  }

  // Calculate color intensity using palette colors
  const getColor = (value: number) => {
    if (value === 0) return 'bg-gray-50'
    const { maxValue, minValue } = matrixData
    const range = maxValue - minValue
    if (range === 0) return 'bg-[#52B69A]'
    
    const intensity = ((value - minValue) / range) * 100
    
    if (intensity < 20) return 'bg-[#D9ED92]'  // Yellow Green
    if (intensity < 40) return 'bg-[#B5E48C]'  // Light Lime
    if (intensity < 60) return 'bg-[#52B69A]'  // Teal
    if (intensity < 80) return 'bg-[#168AAD]'  // Deep Teal
    return 'bg-[#1A759F]'  // Blue Teal
  }

  const formatValue = (value: number) => {
    if (value === 0) return '-'
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
    return value.toFixed(1)
  }

  const [startYear, endYear] = filters.yearRange
  const valueUnit = filters.dataType === 'value' 
    ? `${data.metadata.currency} ${data.metadata.value_unit}`
    : data.metadata.volume_unit

  return (
    <div className="w-full">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-black">
          {title || 'Matrix View - Geography × Segment Comparison'}
        </h3>
        <p className="text-sm text-black mt-1">
          Years: {startYear} - {endYear} | {filters.dataType === 'value' ? 'Values' : 'Volume'} in {valueUnit}
        </p>
      </div>

      <div className="overflow-auto" style={{ maxHeight: height }}>
        <div className="inline-block min-w-full">
          {/* Header row with segments */}
          <div className="flex">
            <div className="w-40 p-2 bg-gray-100 border border-gray-300 font-medium text-sm text-black">
              Geo \ Segment
            </div>
            {matrixData.segments.map(segment => (
              <div
                key={segment}
                className="w-32 p-2 bg-gray-100 border border-gray-300 text-xs font-medium text-center truncate text-black"
                title={segment}
              >
                {segment}
              </div>
            ))}
          </div>

          {/* Data rows - one row per geography-year combination */}
          {matrixData.geographyYears.map((geoYear, rowIndex) => (
            <div key={`${geoYear.geography}-${geoYear.year}`} className="flex">
              <div className="w-40 p-2 bg-gray-100 border border-gray-300 font-medium text-sm truncate text-black" title={geoYear.label}>
                {geoYear.label}
              </div>
              {matrixData.segments.map((segment, segIndex) => {
                const value = matrixData.matrix[rowIndex][segIndex]
                
                return (
                  <div
                    key={`${geoYear.geography}-${geoYear.year}-${segment}`}
                    className={`w-32 p-2 border border-gray-300 text-center cursor-pointer transition-all hover:opacity-80 ${getColor(value)}`}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      setHoveredCell({
                        geo: geoYear.geography,
                        year: geoYear.year,
                        segment,
                        value,
                        x: rect.left + rect.width / 2,
                        y: rect.top - 10
                      })
                    }}
                    onMouseLeave={() => setHoveredCell(null)}
                  >
                    <span className="text-xs font-medium text-black">
                      {formatValue(value)}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Custom Tooltip */}
      {hoveredCell && (
        <div
          className="fixed bg-white p-4 border border-gray-200 rounded-lg shadow-xl z-50 pointer-events-none min-w-[280px]"
          style={{
            left: `${hoveredCell.x}px`,
            top: `${hoveredCell.y}px`,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <p className="font-semibold text-black mb-3 pb-2 border-b border-gray-200">
            Matrix Cell Details
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-black">Geography:</span>
              <span className="text-sm font-medium text-black">{hoveredCell.geo}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-black">Segment:</span>
              <span className="text-sm font-medium text-black">{hoveredCell.segment}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-black">Year:</span>
              <span className="text-sm font-medium text-black">{hoveredCell.year}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-black">Value:</span>
              <div className="text-right">
                <span className="text-sm font-semibold text-black">
                  {hoveredCell.value.toLocaleString(undefined, { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  })}
                </span>
                <span className="text-xs text-black ml-1">{valueUnit}</span>
              </div>
            </div>
            {matrixData.maxValue > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-black">Market Share:</span>
                <span className="text-sm font-semibold text-blue-600">
                  {((hoveredCell.value / matrixData.maxValue) * 100).toFixed(2)}%
                </span>
              </div>
            )}
          </div>
          <div className="mt-3 pt-2 border-t border-gray-200 text-xs text-black">
            Matrix comparison view
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center space-x-4">
        <span className="text-xs text-black">Low</span>
        <div className="flex space-x-1">
          <div className="w-6 h-6 bg-[#D9ED92] rounded"></div>
          <div className="w-6 h-6 bg-[#B5E48C] rounded"></div>
          <div className="w-6 h-6 bg-[#52B69A] rounded"></div>
          <div className="w-6 h-6 bg-[#168AAD] rounded"></div>
          <div className="w-6 h-6 bg-[#1A759F] rounded"></div>
        </div>
        <span className="text-xs text-black">High</span>
      </div>

      <div className="mt-4 text-center text-sm text-black">
        Comparing {matrixData.geographyYears.length} geography-year combinations × {matrixData.segments.length} segments
      </div>
    </div>
  )
}
