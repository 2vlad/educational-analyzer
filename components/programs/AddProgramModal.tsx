'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CreateProgramRequest } from '@/src/services/api'

interface AddProgramModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (data: CreateProgramRequest) => void | Promise<void>
}

export default function AddProgramModal({ isOpen, onClose, onAdd }: AddProgramModalProps) {
  const [name, setName] = useState('')
  const [sourceType, setSourceType] = useState<'yonote' | 'generic_list' | 'manual'>('manual')
  const [rootUrl, setRootUrl] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // For manual type, rootUrl is not required
    const isValidManual = sourceType === 'manual' && name.trim()
    const isValidUrl = sourceType !== 'manual' && name.trim() && rootUrl.trim()

    if (isValidManual || isValidUrl) {
      setLoading(true)
      try {
        await onAdd({
          name: name.trim(),
          sourceType,
          rootUrl: sourceType === 'manual' ? undefined : rootUrl.trim(),
        })
        handleClose()
      } catch (error) {
        console.error('Failed to create program:', error)
      } finally {
        setLoading(false)
      }
    }
  }

  const handleClose = () => {
    setName('')
    setRootUrl('')
    setSourceType('manual')
    onClose()
  }

  const isValid = sourceType === 'manual' ? name.trim() : name.trim() && rootUrl.trim()

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Добавить новую программу</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Название программы</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: React для начинающих"
                autoFocus
                disabled={loading}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="sourceType">Тип источника</Label>
              <Select
                value={sourceType}
                onValueChange={(value) =>
                  setSourceType(value as 'yonote' | 'generic_list' | 'manual')
                }
                disabled={loading}
              >
                <SelectTrigger id="sourceType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Ручная загрузка файлов</SelectItem>
                  <SelectItem value="yonote">Yonote/Practicum</SelectItem>
                  <SelectItem value="generic_list">Список URL</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                {sourceType === 'manual'
                  ? 'Загрузите файлы уроков после создания программы'
                  : sourceType === 'yonote'
                    ? 'Ссылка на курс в Yonote или Practicum'
                    : 'Ссылка на .txt, .json или .csv файл со списком уроков'}
              </p>
            </div>

            {sourceType !== 'manual' && (
              <div className="grid gap-2">
                <Label htmlFor="rootUrl">URL источника</Label>
                <Input
                  id="rootUrl"
                  value={rootUrl}
                  onChange={(e) => setRootUrl(e.target.value)}
                  placeholder={
                    sourceType === 'yonote'
                      ? 'https://practicum.yandex.ru/trainer/...'
                      : 'https://example.com/lessons.txt'
                  }
                  disabled={loading}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={!isValid || loading}
              className="bg-black text-white hover:bg-gray-800"
            >
              {loading ? 'Создание...' : 'Создать'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
