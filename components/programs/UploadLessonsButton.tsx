'use client'

import { useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { FileUploadDropzone } from '@/components/ui/file-upload-dropzone'
import { toast } from 'sonner'
import { ApiService } from '@/src/services/api'

interface UploadedFile {
  file: globalThis.File
  id: string
  content?: string
  error?: string
}

interface UploadLessonsButtonProps {
  programId: string
  programName: string
  onSuccess: () => void
  onUploadComplete?: (programId: string, lessonsCount: number) => void
}

export default function UploadLessonsButton({
  programId,
  programName,
  onSuccess,
  onUploadComplete,
}: UploadLessonsButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [uploading, setUploading] = useState(false)

  const handleUpload = async () => {
    const filesToUpload = uploadedFiles.filter((f) => !f.error && f.content)

    if (filesToUpload.length === 0) {
      toast.error('Нет файлов для загрузки')
      return
    }

    setUploading(true)

    try {
      const api = new ApiService()
      const result = await api.uploadLessons(
        programId,
        filesToUpload.map((f) => ({
          fileName: f.file.name,
          content: f.content!,
          fileSize: f.file.size,
        })),
      )

      console.log('[UploadLessonsButton] Upload successful:', {
        programId,
        lessonsCreated: result.lessonsCreated,
        hasOnUploadComplete: !!onUploadComplete,
      })

      toast.success(`Успешно загружено ${result.lessonsCreated} уроков`)
      
      // Notify parent about upload completion to trigger analysis
      if (onUploadComplete) {
        console.log('[UploadLessonsButton] Calling onUploadComplete...')
        await onUploadComplete(programId, result.lessonsCreated)
        console.log('[UploadLessonsButton] onUploadComplete finished')
      } else {
        console.warn('[UploadLessonsButton] No onUploadComplete callback provided!')
      }
      
      setIsOpen(false)
      setUploadedFiles([])
      
      console.log('[UploadLessonsButton] Calling onSuccess...')
      onSuccess()
      console.log('[UploadLessonsButton] Upload flow complete')
    } catch (error) {
      console.error('Upload error:', error)
      toast.error(error instanceof Error ? error.message : 'Ошибка загрузки файлов')
    } finally {
      setUploading(false)
    }
  }

  const handleClose = () => {
    if (!uploading) {
      setIsOpen(false)
      setUploadedFiles([])
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="w-full text-xs gap-1"
      >
        <Upload className="w-3 h-3" />
        Загрузить файлы
      </Button>

      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Загрузить уроки в "{programName}"</DialogTitle>
            <DialogDescription>
              Выберите текстовые файлы для загрузки. Каждый файл станет отдельным уроком.
              После загрузки автоматически запустится анализ всех уроков.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <FileUploadDropzone
              onFilesSelected={setUploadedFiles}
              maxFiles={100}
              maxSizeMB={10}
              acceptedFileTypes={['.txt', '.md', '.html', '.pdf']}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose} disabled={uploading}>
              Отмена
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploadedFiles.filter((f) => !f.error).length === 0 || uploading}
              className="bg-black text-white hover:bg-gray-800"
            >
              {uploading
                ? 'Загрузка...'
                : `Загрузить (${uploadedFiles.filter((f) => !f.error).length})`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
