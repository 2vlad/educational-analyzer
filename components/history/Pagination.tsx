'use client'

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
  onPageChange: (page: number) => void
}

export default function Pagination({
  currentPage,
  totalPages,
  hasNextPage,
  hasPreviousPage,
  onPageChange,
}: PaginationProps) {
  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const showPages = 5 // Number of page buttons to show
    const halfShow = Math.floor(showPages / 2)

    let start = Math.max(1, currentPage - halfShow)
    let end = Math.min(totalPages, currentPage + halfShow)

    // Adjust if we're near the beginning or end
    if (currentPage <= halfShow) {
      end = Math.min(totalPages, showPages)
    }
    if (currentPage > totalPages - halfShow) {
      start = Math.max(1, totalPages - showPages + 1)
    }

    // Add first page and ellipsis if needed
    if (start > 1) {
      pages.push(1)
      if (start > 2) pages.push('...')
    }

    // Add page numbers
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }

    // Add ellipsis and last page if needed
    if (end < totalPages) {
      if (end < totalPages - 1) pages.push('...')
      pages.push(totalPages)
    }

    return pages
  }

  const pageNumbers = getPageNumbers()

  return (
    <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-gray-200 p-4 mt-6">
      {/* Page Info */}
      <div className="text-sm text-gray-700">
        Page <span className="font-medium">{currentPage}</span> of{' '}
        <span className="font-medium">{totalPages}</span>
      </div>

      {/* Page Navigation */}
      <div className="flex items-center gap-1">
        {/* First Page */}
        <button
          onClick={() => onPageChange(1)}
          disabled={!hasPreviousPage}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="First page"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        {/* Previous Page */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!hasPreviousPage}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Page Numbers */}
        <div className="flex items-center gap-1 mx-2">
          {pageNumbers.map((page, index) => {
            if (page === '...') {
              return (
                <span key={`ellipsis-${index}`} className="px-3 py-2 text-gray-500">
                  ...
                </span>
              )
            }

            const pageNum = page as number
            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`px-3 py-2 rounded-lg transition-colors ${
                  pageNum === currentPage
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {pageNum}
              </button>
            )
          })}
        </div>

        {/* Next Page */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!hasNextPage}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Last Page */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={!hasNextPage}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Last page"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>

      {/* Go to Page */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-700">Go to:</span>
        <input
          type="number"
          min="1"
          max={totalPages}
          value={currentPage}
          onChange={(e) => {
            const page = parseInt(e.target.value)
            if (page >= 1 && page <= totalPages) {
              onPageChange(page)
            }
          }}
          className="w-16 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
    </div>
  )
}
