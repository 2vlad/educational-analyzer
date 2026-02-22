'use client'

import { useState } from 'react'
import { Download, FileText, FileSpreadsheet, ChevronDown } from 'lucide-react'
import jsPDF from 'jspdf'
import Papa from 'papaparse'
import { format } from 'date-fns'

interface ExportButtonProps {
  onExport: (analysisIds: string[], format: 'pdf' | 'csv') => void
  selectedCount: number
  totalCount: number
}

export default function ExportButton({ onExport, selectedCount, totalCount }: ExportButtonProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [exporting, setExporting] = useState(false)

  const handleExport = async (format: 'pdf' | 'csv', exportSelected: boolean) => {
    setExporting(true)
    setShowMenu(false)

    try {
      // Fetch the data to export
      const response = await fetch('/api/history?pageSize=1000') // Get all for export
      const data = await response.json()

      const analysesToExport =
        exportSelected && selectedCount > 0
          ? data.analyses.filter((a: any) => selectedAnalysisIds.includes(a.id))
          : data.analyses

      if (format === 'pdf') {
        exportAsPDF(analysesToExport)
      } else {
        exportAsCSV(analysesToExport)
      }
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setExporting(false)
    }
  }

  const exportAsPDF = (analyses: any[]) => {
    const pdf = new jsPDF()
    const pageHeight = pdf.internal.pageSize.height
    let currentY = 20

    pdf.setFontSize(20)
    pdf.text('Analysis History Report', 20, currentY)
    currentY += 15

    pdf.setFontSize(10)
    pdf.text(`Generated on: ${format(new Date(), 'PPP')}`, 20, currentY)
    currentY += 10
    pdf.text(`Total Analyses: ${analyses.length}`, 20, currentY)
    currentY += 20

    analyses.forEach((analysis, index) => {
      // Check if we need a new page
      if (currentY > pageHeight - 60) {
        pdf.addPage()
        currentY = 20
      }

      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'bold')
      pdf.text(`Analysis #${index + 1}`, 20, currentY)
      currentY += 7

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.text(`Date: ${format(new Date(analysis.created_at), 'PPP')}`, 20, currentY)
      currentY += 5
      pdf.text(`Model: ${analysis.model_used || 'Unknown'}`, 20, currentY)
      currentY += 5

      // Add content preview
      const contentLines = pdf.splitTextToSize(
        `Content: ${analysis.content.substring(0, 200)}...`,
        170,
      )
      contentLines.forEach((line: string) => {
        if (currentY > pageHeight - 20) {
          pdf.addPage()
          currentY = 20
        }
        pdf.text(line, 20, currentY)
        currentY += 5
      })

      // Add results
      const results =
        typeof analysis.results === 'string' ? JSON.parse(analysis.results) : analysis.results

      if (results?.metrics) {
        pdf.text('Metrics:', 20, currentY)
        currentY += 5

        Object.entries(results.metrics).forEach(([key, value]: [string, any]) => {
          if (currentY > pageHeight - 20) {
            pdf.addPage()
            currentY = 20
          }
          const scoreText = value.score > 0 ? '+1' : value.score < 0 ? '-1' : '0'
          pdf.text(`  - ${key}: ${scoreText}`, 25, currentY)
          currentY += 5
        })
      }

      currentY += 15
    })

    pdf.save(`analysis-history-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
  }

  const exportAsCSV = (analyses: any[]) => {
    const csvData = analyses.map((analysis) => {
      const results =
        typeof analysis.results === 'string' ? JSON.parse(analysis.results) : analysis.results

      const metrics = results?.metrics || {}
      const metricScores = Object.entries(metrics).reduce((acc, [key, value]: [string, any]) => {
        acc[`metric_${key}`] = value.score
        return acc
      }, {} as any)

      return {
        id: analysis.id,
        date: format(new Date(analysis.created_at), 'yyyy-MM-dd HH:mm:ss'),
        model: analysis.model_used || 'Unknown',
        content_preview: analysis.content.substring(0, 100).replace(/\n/g, ' '),
        ...metricScores,
        overall_score: calculateOverallScore(metrics),
      }
    })

    const csv = Papa.unparse(csvData)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute('download', `analysis-history-${format(new Date(), 'yyyy-MM-dd')}.csv`)
    link.style.visibility = 'hidden'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const calculateOverallScore = (metrics: any) => {
    const scores = Object.values(metrics).map((m: any) => m.score || 0)
    if (scores.length === 0) return 0
    const sum = scores.reduce((acc: number, score: number) => acc + score, 0)
    return ((sum + scores.length) / (scores.length * 2)) * 10
  }

  // Note: In a real implementation, this would be passed from parent
  const selectedAnalysisIds: string[] = []

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={exporting || totalCount === 0}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Download className="w-4 h-4" />
        Export
        {selectedCount > 0 && (
          <span className="px-2 py-0.5 bg-gray-200 text-blue-700 text-xs rounded-full">
            {selectedCount}
          </span>
        )}
        <ChevronDown className="w-4 h-4" />
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
            <div className="p-2">
              {selectedCount > 0 && (
                <>
                  <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">
                    Export Selected ({selectedCount})
                  </div>
                  <button
                    onClick={() => handleExport('pdf', true)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                  >
                    <FileText className="w-4 h-4" />
                    Export as PDF
                  </button>
                  <button
                    onClick={() => handleExport('csv', true)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Export as CSV
                  </button>
                  <div className="my-2 border-t border-gray-200" />
                </>
              )}

              <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">
                Экспорт всех ({totalCount})
              </div>
              <button
                onClick={() => handleExport('pdf', false)}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
              >
                <FileText className="w-4 h-4" />
                Экспорт все в PDF
              </button>
              <button
                onClick={() => handleExport('csv', false)}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Экспорт все в CSV
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
