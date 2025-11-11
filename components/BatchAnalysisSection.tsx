'use client'

import { useState } from 'react'
import { FileUploadDropzone } from '@/components/ui/file-upload-dropzone'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Play } from 'lucide-react'
import { toast } from 'sonner'
import { ApiService } from '@/src/services/api'

interface UploadedFile {
  file: globalThis.File
  id: string
  content?: string
  error?: string
}

interface BatchAnalysisSectionProps {
  metricMode: 'lx' | 'custom'
  onSwitchMode: () => void
}

export default function BatchAnalysisSection({
  metricMode,
  onSwitchMode,
}: BatchAnalysisSectionProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [results, setResults] = useState<any[]>([])

  const handleAnalyze = async () => {
    const filesToAnalyze = uploadedFiles.filter((f) => !f.error && f.content)

    if (filesToAnalyze.length === 0) {
      toast.error('Нет файлов для анализа')
      return
    }

    setAnalyzing(true)
    setResults([])

    try {
      const api = new ApiService()
      const analysisPromises = filesToAnalyze.map(async (file) => {
        try {
          const response = await api.analyze({
            content: file.content!,
            metricMode,
          })
          return {
            fileName: file.file.name,
            analysisId: response.analysisId,
            status: 'started',
          }
        } catch (error) {
          return {
            fileName: file.file.name,
            error: error instanceof Error ? error.message : 'Ошибка анализа',
            status: 'error',
          }
        }
      })

      const analysisResults = await Promise.all(analysisPromises)
      setResults(analysisResults)

      const successCount = analysisResults.filter((r: any) => r.status === 'started').length
      const errorCount = analysisResults.filter((r: any) => r.status === 'error').length

      if (successCount > 0) {
        toast.success(`Запущен анализ ${successCount} файлов`)
      }
      if (errorCount > 0) {
        toast.error(`Ошибки при анализе ${errorCount} файлов`)
      }
    } catch (error) {
      console.error('Batch analysis error:', error)
      toast.error('Ошибка при запуске анализа')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleClear = () => {
    setUploadedFiles([])
    setResults([])
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Пакетный анализ файлов</CardTitle>
              <CardDescription>
                Загрузите несколько файлов для одновременного анализа
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={onSwitchMode}>
              Переключить на одиночный анализ
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileUploadDropzone
            onFilesSelected={setUploadedFiles}
            maxFiles={50}
            maxSizeMB={10}
            acceptedFileTypes={['.txt', '.md', '.html', '.pdf']}
          />

          {uploadedFiles.filter((f) => !f.error).length > 0 && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClear} disabled={analyzing}>
                Очистить
              </Button>
              <Button
                onClick={handleAnalyze}
                disabled={analyzing || uploadedFiles.filter((f) => !f.error).length === 0}
                className="bg-black text-white hover:bg-gray-800 gap-2"
              >
                {analyzing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Анализ...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Анализировать ({uploadedFiles.filter((f) => !f.error).length})
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Section */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Результаты анализа</CardTitle>
            <CardDescription>
              {results.filter((r) => r.status === 'started').length} анализов запущено
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    result.status === 'error'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-green-50 border-green-200'
                  }`}
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">{result.fileName}</p>
                    {result.status === 'error' && (
                      <p className="text-xs text-red-600 mt-1">{result.error}</p>
                    )}
                    {result.status === 'started' && (
                      <p className="text-xs text-green-600 mt-1">
                        Анализ запущен. Проверьте историю для результатов.
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {result.status === 'started' && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                        ✓ Запущен
                      </span>
                    )}
                    {result.status === 'error' && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                        ✗ Ошибка
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
