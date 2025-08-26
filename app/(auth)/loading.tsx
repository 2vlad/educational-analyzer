export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-4 border-gray-200"></div>
          <div className="absolute top-0 h-12 w-12 animate-spin rounded-full border-4 border-black border-t-transparent"></div>
        </div>
        <p className="text-sm text-black">Загрузка...</p>
      </div>
    </div>
  )
}