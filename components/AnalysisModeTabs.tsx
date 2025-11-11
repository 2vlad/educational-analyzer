'use client'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface AnalysisModeTabsProps {
  value: 'single' | 'batch'
  onChange: (value: 'single' | 'batch') => void
  className?: string
}

export function AnalysisModeTabs({ value, onChange, className }: AnalysisModeTabsProps) {
  return (
    <div className={className}>
      <label
        className="block text-[15px] font-normal text-gray-500 dark:text-gray-400 mb-3 transition-colors"
        style={{ fontFamily: 'Inter, sans-serif' }}
      >
        Режим анализа
      </label>
      <Tabs value={value} onValueChange={(v) => onChange(v as 'single' | 'batch')}>
        <TabsList className="grid w-full grid-cols-2 !h-14 bg-[#F2F2F2] dark:bg-gray-800 rounded-[50px] p-[3px] transition-colors">
          <TabsTrigger
            value="single"
            className="text-[20px] font-light h-full rounded-[46px] text-gray-400 dark:text-gray-500 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-black dark:data-[state=active]:text-white border-0 shadow-none transition-colors cursor-pointer"
          >
            Один урок
          </TabsTrigger>
          <TabsTrigger
            value="batch"
            className="text-[20px] font-light h-full rounded-[46px] text-gray-400 dark:text-gray-500 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-black dark:data-[state=active]:text-white border-0 shadow-none transition-colors cursor-pointer"
          >
            Много уроков
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
}
