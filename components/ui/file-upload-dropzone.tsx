'use client'

import { useCallback, useState } from 'react'
import { Upload, X, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface UploadedFile {
  file: globalThis.File
  id: string
  content?: string
  error?: string
}

interface FileUploadDropzoneProps {
  onFilesSelected: (files: UploadedFile[]) => void
  maxFiles?: number
  maxSizeMB?: number
  acceptedFileTypes?: string[]
  className?: string
}

export function FileUploadDropzone({
  onFilesSelected,
  maxFiles = 50,
  maxSizeMB = 10,
  acceptedFileTypes = ['.txt', '.md', '.html', '.pdf', '.docx'],
  className,
}: FileUploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const readFileContent = async (file: globalThis.File): Promise<string> => {
    // Handle PDF files differently
    if (file.name.toLowerCase().endsWith('.pdf')) {
      return await parsePdfFile(file)
    }

    // Handle text files
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        resolve(content)
      }
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`))
      reader.readAsText(file)
    })
  }

  const parsePdfFile = async (file: globalThis.File): Promise<string> => {
    try {
      const formData = new globalThis.FormData()
      formData.append('file', file)

      const response = await fetch('/api/parse-pdf', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to parse PDF')
      }

      const result = await response.json()

      // If truncated, we could show a warning but still return the text
      if (result.truncated) {
        console.warn(
          `PDF ${file.name} was truncated. Pages: ${result.pages}, Original: ${result.originalLength}, Returned: ${result.text.length}`,
        )
      }

      return result.text
    } catch (error) {
      console.error('PDF parsing error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to parse PDF file')
    }
  }

  const processFiles = async (files: globalThis.FileList | globalThis.File[]) => {
    setError(null)
    setIsProcessing(true)

    const fileArray = Array.from(files)

    // Validate file count
    if (uploadedFiles.length + fileArray.length > maxFiles) {
      setError(`Максимум ${maxFiles} файлов. Удалите лишние или уменьшите количество.`)
      setIsProcessing(false)
      return
    }

    const maxSizeBytes = maxSizeMB * 1024 * 1024
    const newFiles: UploadedFile[] = []

    for (const file of fileArray) {
      // Validate file size
      if (file.size > maxSizeBytes) {
        newFiles.push({
          file,
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          error: `Файл слишком большой (>${maxSizeMB}MB)`,
        })
        continue
      }

      // Validate file type
      const extension = '.' + file.name.split('.').pop()?.toLowerCase()
      if (!acceptedFileTypes.includes(extension || '')) {
        newFiles.push({
          file,
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          error: `Неподдерживаемый формат (${extension})`,
        })
        continue
      }

      try {
        const content = await readFileContent(file)
        newFiles.push({
          file,
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          content,
        })
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Ошибка чтения файла'
        newFiles.push({
          file,
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          error: errorMessage,
        })
      }
    }

    const updatedFiles = [...uploadedFiles, ...newFiles]
    setUploadedFiles(updatedFiles)
    onFilesSelected(updatedFiles.filter((f) => !f.error))
    setIsProcessing(false)
  }

  const handleDrop = useCallback(
    (e: globalThis.React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const files = e.dataTransfer.files
      if (files.length > 0) {
        processFiles(files)
      }
    },
    [uploadedFiles, processFiles],
  )

  const handleDragOver = useCallback((e: globalThis.React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: globalThis.React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileSelect = (e: globalThis.React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      processFiles(files)
    }
  }

  const removeFile = (id: string) => {
    const filtered = uploadedFiles.filter((f) => f.id !== id)
    setUploadedFiles(filtered)
    onFilesSelected(filtered.filter((f) => !f.error))
  }

  const clearAll = () => {
    setUploadedFiles([])
    onFilesSelected([])
    setError(null)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleDropzoneClick = () => {
    if (!isProcessing) {
      document.getElementById('file-upload')?.click()
    }
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Dropzone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleDropzoneClick}
        className={cn(
          'relative h-[180px] px-6 py-6 rounded-[25px] text-center transition-colors cursor-pointer',
          isDragging ? 'bg-gray-100' : 'bg-[#F2F2F2] hover:bg-gray-100',
          isProcessing && 'opacity-50 pointer-events-none',
        )}
      >
        <input
          type="file"
          multiple
          accept={acceptedFileTypes.join(',')}
          onChange={handleFileSelect}
          className="hidden"
          id="file-upload"
          disabled={isProcessing}
        />

        <div className="flex flex-col items-center justify-center gap-3 h-full">
          <Upload className={cn('w-10 h-10', isDragging ? 'text-gray-600' : 'text-gray-400')} />

          <div>
            <p
              className="text-[20px] font-light text-black"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              {isDragging ? 'Отпустите файлы сюда' : 'Перетащите файлы сюда'}
            </p>
            <p
              className="text-[15px] text-gray-500 mt-1"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              или <span className="text-black hover:text-gray-700 font-normal">выберите файлы</span>
            </p>
          </div>

          <div className="text-[12px] text-gray-400" style={{ fontFamily: 'Inter, sans-serif' }}>
            <p>Поддерживаемые форматы: {acceptedFileTypes.join(', ')}</p>
            <p>
              Максимум {maxFiles} файлов, до {maxSizeMB}MB каждый
            </p>
          </div>
        </div>

        {isProcessing && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black" />
              <span className="text-sm text-gray-600">Обработка файлов...</span>
            </div>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 rounded-[20px] border border-red-200">
          <p className="text-[14px] text-red-700" style={{ fontFamily: 'Inter, sans-serif' }}>
            {error}
          </p>
        </div>
      )}

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">
              Загружено файлов: {uploadedFiles.filter((f) => !f.error).length}
              {uploadedFiles.some((f) => f.error) && (
                <span className="text-red-600 ml-2">
                  ({uploadedFiles.filter((f) => f.error).length} с ошибками)
                </span>
              )}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="text-gray-600 hover:text-gray-900"
            >
              Очистить всё
            </Button>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-2">
            {uploadedFiles.map((uploadedFile) => (
              <div
                key={uploadedFile.id}
                className={cn(
                  'flex items-center gap-3 p-2 rounded border',
                  uploadedFile.error ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200',
                )}
              >
                <FileText
                  className={cn(
                    'w-4 h-4 flex-shrink-0',
                    uploadedFile.error ? 'text-red-500' : 'text-gray-800',
                  )}
                />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {uploadedFile.file.name}
                  </p>
                  {uploadedFile.error ? (
                    <p className="text-xs text-red-600">{uploadedFile.error}</p>
                  ) : (
                    <p className="text-xs text-gray-500">
                      {formatFileSize(uploadedFile.file.size)}
                      {uploadedFile.content &&
                        ` • ${uploadedFile.content.length.toLocaleString()} символов`}
                    </p>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(uploadedFile.id)}
                  className="flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
