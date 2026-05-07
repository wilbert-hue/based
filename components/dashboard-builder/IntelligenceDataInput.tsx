'use client'

import { useState } from 'react'
import { Plus, Trash2, Save, Users, Building2, Upload, FileText, Table } from 'lucide-react'

export type IntelligenceType = 'customer' | 'distributor'

export interface CustomerData {
  id: string
  name: string
  region: string
  endUserSegment: string
  proposition1?: string
  proposition2?: string
  proposition3?: string
}

export interface DistributorData {
  id: string
  companyName: string
  region: string
  segment: string
  proposition1?: string
  proposition2?: string
  proposition3?: string
  // Additional distributor fields
  yearEstablished?: string
  headquarters?: string
  email?: string
  phone?: string
}

interface IntelligenceDataInputProps {
  intelligenceType: IntelligenceType
  onTypeChange: (type: IntelligenceType) => void
  onDataSave: (data: CustomerData[] | DistributorData[]) => void
  onAutoSave?: (data: CustomerData[] | DistributorData[], parentHeaders?: { prop1: string; prop2: string; prop3: string }) => void // Optional auto-save callback with parent headers
}

type InputMode = 'manual' | 'bulk'

export function IntelligenceDataInput({ 
  intelligenceType, 
  onTypeChange, 
  onDataSave,
  onAutoSave
}: IntelligenceDataInputProps) {
  const [inputMode, setInputMode] = useState<InputMode>('manual')
  const [customers, setCustomers] = useState<CustomerData[]>([])
  const [distributors, setDistributors] = useState<DistributorData[]>([])
  
  // Bulk paste data for propositions
  const [propositionData, setPropositionData] = useState<{
    prop1: { parentHeader: string; rowContent: string }
    prop2: { parentHeader: string; rowContent: string }
    prop3: { parentHeader: string; rowContent: string }
  }>({
    prop1: { parentHeader: '', rowContent: '' },
    prop2: { parentHeader: '', rowContent: '' },
    prop3: { parentHeader: '', rowContent: '' }
  })
  
  // Parsed table data from row content
  const [parsedTableData, setParsedTableData] = useState<any[]>([])

  const addCustomer = () => {
    const newCustomer: CustomerData = {
      id: `customer-${Date.now()}`,
      name: '',
      region: '',
      endUserSegment: '',
      proposition1: '',
      proposition2: '',
      proposition3: ''
    }
    setCustomers([...customers, newCustomer])
  }

  const addDistributor = () => {
    const newDistributor: DistributorData = {
      id: `distributor-${Date.now()}`,
      companyName: '',
      region: '',
      segment: '',
      proposition1: '',
      proposition2: '',
      proposition3: '',
      yearEstablished: '',
      headquarters: '',
      email: '',
      phone: ''
    }
    setDistributors([...distributors, newDistributor])
  }

  const updateCustomer = (id: string, field: keyof CustomerData, value: string) => {
    setCustomers(customers.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  const updateDistributor = (id: string, field: keyof DistributorData, value: string) => {
    setDistributors(distributors.map(d => d.id === id ? { ...d, [field]: value } : d))
  }

  const removeCustomer = (id: string) => {
    setCustomers(customers.filter(c => c.id !== id))
  }

  const removeDistributor = (id: string) => {
    setDistributors(distributors.filter(d => d.id !== id))
  }

  // Parse tabular data from pasted content
  const parseTableData = (content: string): any[] => {
    if (!content.trim()) return []
    
    const lines = content.split('\n').filter(line => line.trim())
    if (lines.length === 0) return []
    
    // Try to detect delimiter (tab, comma, or pipe)
    // Count occurrences to determine the most likely delimiter
    const firstLine = lines[0]
    const tabCount = (firstLine.match(/\t/g) || []).length
    const commaCount = (firstLine.match(/,/g) || []).length
    const pipeCount = (firstLine.match(/\|/g) || []).length
    
    let delimiter = '\t'
    if (tabCount > commaCount && tabCount > pipeCount) delimiter = '\t'
    else if (commaCount > pipeCount) delimiter = ','
    else if (pipeCount > 0) delimiter = '|'
    
    // Parse header row (first line)
    const headers = firstLine.split(delimiter).map(h => h.trim()).filter(h => h)
    
    if (headers.length === 0) return []
    
    // Parse data rows
    const rows: any[] = []
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      // Handle quoted values that might contain the delimiter
      const values: string[] = []
      let currentValue = ''
      let inQuotes = false
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j]
        if (char === '"') {
          inQuotes = !inQuotes
        } else if ((char === delimiter || char === '\t' || char === ',') && !inQuotes) {
          values.push(currentValue.trim())
          currentValue = ''
        } else {
          currentValue += char
        }
      }
      values.push(currentValue.trim()) // Add last value
      
      const row: any = {}
      headers.forEach((header, index) => {
        // Use header if available, otherwise use column index
        const key = header || `Column ${index + 1}`
        row[key] = values[index] !== undefined ? String(values[index]) : ''
      })
      // Add all rows, including those with "XX" placeholders
      rows.push(row)
    }
    
    return rows
  }

  // Handle bulk paste - convert to individual entries and auto-save
  const handleBulkPasteProcess = (autoSave: boolean = false) => {
    // Try to parse from any proposition that has row content
    let tableData: any[] = []
    let sourceProp = ''
    
    if (propositionData.prop1.rowContent.trim()) {
      tableData = parseTableData(propositionData.prop1.rowContent)
      sourceProp = 'prop1'
    } else if (propositionData.prop2.rowContent.trim()) {
      tableData = parseTableData(propositionData.prop2.rowContent)
      sourceProp = 'prop2'
    } else if (propositionData.prop3.rowContent.trim()) {
      tableData = parseTableData(propositionData.prop3.rowContent)
      sourceProp = 'prop3'
    }
    
    if (tableData.length === 0) {
      if (!autoSave) {
        alert('Please paste table data in at least one Row Content field')
      }
      return
    }
    
    setParsedTableData(tableData)
    
    // Extract parent headers - combine all non-empty parent headers
    const allParentHeaders = [
      propositionData.prop1.parentHeader,
      propositionData.prop2.parentHeader,
      propositionData.prop3.parentHeader
    ].filter(h => h && h.trim()).join('\n')
    
    // Convert table data to customer/distributor entries
    if (intelligenceType === 'customer') {
      const newCustomers: CustomerData[] = tableData.map((row, index) => {
        // Try to extract customer name from various possible column names
        const keys = Object.keys(row)
        const customerName = 
          row['Company Name'] || 
          row['Customer Name'] || 
          row['Name'] || 
          row['Company'] ||
          (keys[0] && row[keys[0]]) ||
          `Customer ${index + 1}`
        
        // Try to extract End User Type (this is the segment)
        const endUserType = 
          row['End User Type (Municipal Utility / Contractor / Industrial / Distributor)'] ||
          row['End User Type'] ||
          row['Type'] ||
          row['Description'] ||
          (keys[1] && row[keys[1]]) ||
          ''
        
        // Try to extract region from various columns
        const region = 
          row['Region'] ||
          row['Geography'] ||
          row['Location'] ||
          row['Service Area / Population Served OR Scale of Operations'] ||
          ''
        
        // Store all additional data in propositions
        const additionalData: string[] = []
        if (row['Headquarter\'s Address']) additionalData.push(`Headquarters: ${row['Headquarter\'s Address']}`)
        if (row['Years of Existence']) additionalData.push(`Years: ${row['Years of Existence']}`)
        if (row['Service Area / Population Served OR Scale of Operations']) additionalData.push(`Service Area: ${row['Service Area / Population Served OR Scale of Operations']}`)
        if (row['Name:']) additionalData.push(`Contact: ${row['Name:']}`)
        if (row['Decision Role (Procurement / Utility Supervisor / Maintenance Head / Engineering Manager)']) additionalData.push(`Role: ${row['Decision Role (Procurement / Utility Supervisor / Maintenance Head / Engineering Manager)']}`)
        if (row['Email ID:']) additionalData.push(`Email: ${row['Email ID:']}`)
        if (row['Website']) additionalData.push(`Website: ${row['Website']}`)
        if (row['Telephone:']) additionalData.push(`Phone: ${row['Telephone:']}`)
        
        return {
          id: `customer-${Date.now()}-${index}`,
          name: String(customerName).trim() || `Customer ${index + 1}`,
          region: String(region).trim() || 'Unknown',
          endUserSegment: String(endUserType).trim() || 'Unknown',
          proposition1: propositionData.prop1.parentHeader || allParentHeaders || '',
          proposition2: propositionData.prop2.parentHeader || (additionalData.length > 0 ? additionalData.join('\n') : ''),
          proposition3: propositionData.prop3.parentHeader || ''
        }
      })
      setCustomers(newCustomers)
      
      // Auto-save if requested
      if (autoSave && onAutoSave) {
        onAutoSave(newCustomers, {
          prop1: propositionData.prop1.parentHeader,
          prop2: propositionData.prop2.parentHeader,
          prop3: propositionData.prop3.parentHeader
        })
      } else if (!autoSave) {
        setInputMode('manual') // Switch to manual mode to review/edit
      }
    } else {
      const newDistributors: DistributorData[] = tableData.map((row, index) => {
        const keys = Object.keys(row)
        
        // Better company name extraction - check first column or "Company Name"
        const companyName = 
          row['Company Name'] || 
          row['COMPANY NAME'] ||
          (keys[0] && keys[0] !== 'S.No.' && row[keys[0]]) ||
          (keys[1] && row[keys[1]]) ||
          `Distributor ${index + 1}`
        
        // Map all the columns from your pasted data
        const yearEstablished = 
          row['Years of Existence'] || 
          row['Year Established'] || 
          row['Years'] || 
          ''
        
        const headquarters = 
          row['Headquarter\'s Address'] || 
          row['Headquarters'] ||
          row['Headquarters / Emirate'] ||
          ''
        
        const region = 
          row['Cities / Regions Covered'] ||
          row['Service Area / Population Served OR Scale of Operations'] ||
          row['Region'] ||
          row['Geography'] ||
          'Unknown'
        
        const email = 
          row['Email ID:'] || 
          row['Email ID'] ||
          row['Email'] ||
          row['Email Address'] ||
          ''
        
        const phone = 
          row['Telephone:'] || 
          row['Telephone'] ||
          row['Phone'] ||
          row['Phone / WhatsApp'] ||
          ''
        
        const contactName = 
          row['Name:'] || 
          row['Name'] ||
          row['Key Contact Person'] ||
          ''
        
        const role = 
          row['Decision Role (Procurement / Utility Supervisor / Maintenance Head / Engineering Manager)'] ||
          row['Decision Role'] ||
          row['Designation / Role'] ||
          row['Role'] ||
          ''
        
        const website = 
          row['Website'] || 
          row['Website URL'] ||
          ''
        
        // Preserve "xx" values - don't convert to empty
        const preserveValue = (val: string) => {
          const str = String(val || '').trim()
          return str === 'xx' || str === 'XX' ? 'xx' : str
        }
        
        return {
          id: `distributor-${Date.now()}-${index}`,
          companyName: preserveValue(companyName) || `Distributor ${index + 1}`,
          region: preserveValue(region) || 'Unknown',
          segment: row['End User Type (Municipal Utility / Contractor / Industrial / Distributor)'] || 
                   row['End User Type'] || 
                   row['Type'] || 
                   'Unknown',
          proposition1: propositionData.prop1.parentHeader || '', // "Basic Details"
          proposition2: propositionData.prop2.parentHeader || '', // "Contact Details"
          proposition3: propositionData.prop3.parentHeader || '',
          yearEstablished: preserveValue(yearEstablished),
          headquarters: preserveValue(headquarters),
          email: preserveValue(email),
          phone: preserveValue(phone),
          // Store additional fields that might be needed
          contactName: preserveValue(contactName),
          role: preserveValue(role),
          website: preserveValue(website)
        }
      })
      setDistributors(newDistributors)
      
      // Auto-save if requested
      if (autoSave && onAutoSave) {
        onAutoSave(newDistributors, {
          prop1: propositionData.prop1.parentHeader,
          prop2: propositionData.prop2.parentHeader,
          prop3: propositionData.prop3.parentHeader
        })
      } else if (!autoSave) {
        setInputMode('manual') // Switch to manual mode to review/edit
      }
    }
  }

  const handleSave = () => {
    if (intelligenceType === 'customer') {
      onDataSave(customers)
    } else {
      onDataSave(distributors)
    }
  }

  const regions = [
    'North America',
    'Europe',
    'Asia Pacific',
    'Latin America',
    'Middle East',
    'Africa'
  ]

  const endUserSegments = [
    'Residential',
    'Commercial and Industrial',
    'Utility-scale'
  ]

  const distributorSegments = [
    'Standard',
    'Advance',
    'Premium'
  ]

  return (
    <div className="space-y-6">
      {/* Type Selection */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <label className="block text-sm font-medium text-black mb-4">
          Intelligence Type
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="intelligenceType"
              value="customer"
              checked={intelligenceType === 'customer'}
              onChange={() => onTypeChange('customer')}
              className="w-4 h-4 text-blue-600"
            />
            <Users className="w-5 h-5 text-gray-600" />
            <span className="text-sm font-medium text-black">Customer Intelligence</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="intelligenceType"
              value="distributor"
              checked={intelligenceType === 'distributor'}
              onChange={() => onTypeChange('distributor')}
              className="w-4 h-4 text-blue-600"
            />
            <Building2 className="w-5 h-5 text-gray-600" />
            <span className="text-sm font-medium text-black">Distributor Intelligence</span>
          </label>
        </div>
      </div>

      {/* Input Mode Selection */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <label className="block text-sm font-medium text-black mb-4">
          Input Mode
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="inputMode"
              value="manual"
              checked={inputMode === 'manual'}
              onChange={() => setInputMode('manual')}
              className="w-4 h-4 text-blue-600"
            />
            <FileText className="w-5 h-5 text-gray-600" />
            <span className="text-sm font-medium text-black">Manual Entry</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="inputMode"
              value="bulk"
              checked={inputMode === 'bulk'}
              onChange={() => setInputMode('bulk')}
              className="w-4 h-4 text-blue-600"
            />
            <Table className="w-5 h-5 text-gray-600" />
            <span className="text-sm font-medium text-black">Bulk Paste</span>
          </label>
        </div>
      </div>

      {/* Bulk Paste Mode */}
      {inputMode === 'bulk' && (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800 mb-2">
              <strong>Bulk Paste Mode:</strong> Paste your structured data below.
            </p>
            <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
              <li><strong>Parent Header:</strong> Paste section headers (e.g., "Basic Details", "Contact Details")</li>
              <li><strong>Row Content:</strong> Paste tabular data directly from Excel (tab-separated or comma-separated)</li>
              <li>First row should be column headers. Data will be parsed automatically.</li>
            </ul>
          </div>

          {/* Parent Headers Summary */}
          {(propositionData.prop1.parentHeader || 
            propositionData.prop2.parentHeader || 
            propositionData.prop3.parentHeader) && (
            <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
              <h4 className="text-sm font-semibold text-black mb-3">Parent Headers Summary</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {propositionData.prop1.parentHeader && (
                  <div className="bg-gray-50 p-3 rounded border border-gray-200">
                    <p className="text-xs font-medium text-gray-600 mb-1">Proposition 1:</p>
                    <p className="text-sm text-black font-mono whitespace-pre-wrap">{propositionData.prop1.parentHeader}</p>
                  </div>
                )}
                {propositionData.prop2.parentHeader && (
                  <div className="bg-gray-50 p-3 rounded border border-gray-200">
                    <p className="text-xs font-medium text-gray-600 mb-1">Proposition 2:</p>
                    <p className="text-sm text-black font-mono whitespace-pre-wrap">{propositionData.prop2.parentHeader}</p>
                  </div>
                )}
                {propositionData.prop3.parentHeader && (
                  <div className="bg-gray-50 p-3 rounded border border-gray-200">
                    <p className="text-xs font-medium text-gray-600 mb-1">Proposition 3:</p>
                    <p className="text-sm text-black font-mono whitespace-pre-wrap">{propositionData.prop3.parentHeader}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Proposition 1 */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <h4 className="text-md font-semibold text-black mb-4">Proposition 1</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-black mb-2">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Parent Header
                </label>
                <textarea
                  value={propositionData.prop1.parentHeader}
                  onChange={(e) => setPropositionData({
                    ...propositionData,
                    prop1: { ...propositionData.prop1, parentHeader: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  placeholder="Paste parent header text here (e.g., Basic Details, Contact Details)"
                  rows={4}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-2">
                  <Table className="w-4 h-4 inline mr-1" />
                  Row Content (Tabular Data)
                </label>
                <textarea
                  value={propositionData.prop1.rowContent}
                  onChange={(e) => setPropositionData({
                    ...propositionData,
                    prop1: { ...propositionData.prop1, rowContent: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  placeholder="Paste table data here (copy from Excel - tab-separated or comma-separated)"
                  rows={10}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Paste tabular data with headers. First row should be column headers.
                </p>
              </div>
            </div>
          </div>

          {/* Proposition 2 */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <h4 className="text-md font-semibold text-black mb-4">Proposition 2</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-black mb-2">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Parent Header
                </label>
                <textarea
                  value={propositionData.prop2.parentHeader}
                  onChange={(e) => setPropositionData({
                    ...propositionData,
                    prop2: { ...propositionData.prop2, parentHeader: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  placeholder="Paste parent header text here"
                  rows={4}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-2">
                  <Table className="w-4 h-4 inline mr-1" />
                  Row Content (Tabular Data)
                </label>
                <textarea
                  value={propositionData.prop2.rowContent}
                  onChange={(e) => setPropositionData({
                    ...propositionData,
                    prop2: { ...propositionData.prop2, rowContent: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  placeholder="Paste table data here"
                  rows={10}
                />
              </div>
            </div>
          </div>

          {/* Proposition 3 */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <h4 className="text-md font-semibold text-black mb-4">Proposition 3</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-black mb-2">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Parent Header
                </label>
                <textarea
                  value={propositionData.prop3.parentHeader}
                  onChange={(e) => setPropositionData({
                    ...propositionData,
                    prop3: { ...propositionData.prop3, parentHeader: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  placeholder="Paste parent header text here"
                  rows={4}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-2">
                  <Table className="w-4 h-4 inline mr-1" />
                  Row Content (Tabular Data)
                </label>
                <textarea
                  value={propositionData.prop3.rowContent}
                  onChange={(e) => setPropositionData({
                    ...propositionData,
                    prop3: { ...propositionData.prop3, rowContent: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  placeholder="Paste table data here"
                  rows={10}
                />
              </div>
            </div>
          </div>

          {/* Preview Parsed Data */}
          {(propositionData.prop1.rowContent.trim() || 
            propositionData.prop2.rowContent.trim() || 
            propositionData.prop3.rowContent.trim()) && (
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <h4 className="text-md font-semibold text-black mb-4">Preview Parsed Data</h4>
              <button
                onClick={() => {
                  const content = propositionData.prop1.rowContent || 
                                 propositionData.prop2.rowContent || 
                                 propositionData.prop3.rowContent
                  if (content.trim()) {
                    const data = parseTableData(content)
                    setParsedTableData(data)
                  }
                }}
                className="mb-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm"
              >
                Refresh Preview
              </button>
              {parsedTableData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-300 text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        {Object.keys(parsedTableData[0] || {}).map((header) => (
                          <th key={header} className="border border-gray-300 px-3 py-2 text-left font-medium text-black">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsedTableData.slice(0, 10).map((row, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          {Object.values(row).map((value: any, colIndex) => (
                            <td key={colIndex} className="border border-gray-300 px-3 py-2 text-black">
                              {String(value || '').trim() || <span className="text-gray-400">(empty)</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedTableData.length > 10 && (
                    <p className="text-xs text-gray-500 mt-2">
                      Showing first 10 rows of {parsedTableData.length} total rows
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Paste data in Row Content field and click "Refresh Preview" to see parsed data</p>
              )}
            </div>
          )}

          {/* Process Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => handleBulkPasteProcess(false)}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors font-medium"
            >
              <FileText className="w-5 h-5" />
              Preview Data
            </button>
            <button
              onClick={() => handleBulkPasteProcess(true)}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium"
            >
              <Save className="w-5 h-5" />
              Save & Load Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Customer Intelligence Form - Manual Mode */}
      {intelligenceType === 'customer' && inputMode === 'manual' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-black">Customer Intelligence Data</h3>
            <button
              onClick={addCustomer}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Customer
            </button>
          </div>

          {customers.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-8 text-center border border-gray-200">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">No customers added yet. Click "Add Customer" to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {customers.map((customer, index) => (
                <div key={customer.id} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-black">Customer #{index + 1}</h4>
                    <button
                      onClick={() => removeCustomer(customer.id)}
                      className="text-red-600 hover:text-red-700 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-black mb-1">
                        Customer Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={customer.name}
                        onChange={(e) => updateCustomer(customer.id, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter customer name"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-black mb-1">
                        Region <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={customer.region}
                        onChange={(e) => updateCustomer(customer.id, 'region', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select region</option>
                        {regions.map(region => (
                          <option key={region} value={region}>{region}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-black mb-1">
                        End User Segment <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={customer.endUserSegment}
                        onChange={(e) => updateCustomer(customer.id, 'endUserSegment', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select segment</option>
                        {endUserSegments.map(segment => (
                          <option key={segment} value={segment}>{segment}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-black mb-1">
                        Proposition 1
                      </label>
                      <input
                        type="text"
                        value={customer.proposition1 || ''}
                        onChange={(e) => updateCustomer(customer.id, 'proposition1', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter proposition 1"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-black mb-1">
                        Proposition 2
                      </label>
                      <input
                        type="text"
                        value={customer.proposition2 || ''}
                        onChange={(e) => updateCustomer(customer.id, 'proposition2', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter proposition 2"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-black mb-1">
                        Proposition 3
                      </label>
                      <input
                        type="text"
                        value={customer.proposition3 || ''}
                        onChange={(e) => updateCustomer(customer.id, 'proposition3', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter proposition 3"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={customers.length === 0}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            <Save className="w-5 h-5" />
            Save Customer Intelligence Data
          </button>
        </div>
      )}

      {/* Distributor Intelligence Form - Manual Mode */}
      {intelligenceType === 'distributor' && inputMode === 'manual' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-black">Distributor Intelligence Data</h3>
            <button
              onClick={addDistributor}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Distributor
            </button>
          </div>

          {distributors.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-8 text-center border border-gray-200">
              <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">No distributors added yet. Click "Add Distributor" to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {distributors.map((distributor, index) => (
                <div key={distributor.id} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-black">Distributor #{index + 1}</h4>
                    <button
                      onClick={() => removeDistributor(distributor.id)}
                      className="text-red-600 hover:text-red-700 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-black mb-1">
                        Company Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={distributor.companyName}
                        onChange={(e) => updateDistributor(distributor.id, 'companyName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter company name"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-black mb-1">
                        Region <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={distributor.region}
                        onChange={(e) => updateDistributor(distributor.id, 'region', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select region</option>
                        {regions.map(region => (
                          <option key={region} value={region}>{region}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-black mb-1">
                        Segment <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={distributor.segment}
                        onChange={(e) => updateDistributor(distributor.id, 'segment', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select segment</option>
                        {distributorSegments.map(segment => (
                          <option key={segment} value={segment}>{segment}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-black mb-1">
                        Year Established
                      </label>
                      <input
                        type="text"
                        value={distributor.yearEstablished || ''}
                        onChange={(e) => updateDistributor(distributor.id, 'yearEstablished', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., 2010"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-black mb-1">
                        Headquarters
                      </label>
                      <input
                        type="text"
                        value={distributor.headquarters || ''}
                        onChange={(e) => updateDistributor(distributor.id, 'headquarters', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter headquarters location"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-black mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={distributor.email || ''}
                        onChange={(e) => updateDistributor(distributor.id, 'email', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="email@example.com"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-black mb-1">
                        Phone
                      </label>
                      <input
                        type="text"
                        value={distributor.phone || ''}
                        onChange={(e) => updateDistributor(distributor.id, 'phone', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="+1 234 567 8900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-black mb-1">
                        Proposition 1
                      </label>
                      <input
                        type="text"
                        value={distributor.proposition1 || ''}
                        onChange={(e) => updateDistributor(distributor.id, 'proposition1', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter proposition 1"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-black mb-1">
                        Proposition 2
                      </label>
                      <input
                        type="text"
                        value={distributor.proposition2 || ''}
                        onChange={(e) => updateDistributor(distributor.id, 'proposition2', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter proposition 2"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-black mb-1">
                        Proposition 3
                      </label>
                      <input
                        type="text"
                        value={distributor.proposition3 || ''}
                        onChange={(e) => updateDistributor(distributor.id, 'proposition3', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter proposition 3"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={distributors.length === 0}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            <Save className="w-5 h-5" />
            Save Distributor Intelligence Data
          </button>
        </div>
      )}
    </div>
  )
}



