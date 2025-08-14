import { useEffect, useState, useRef } from 'react'

/**
 * Hook for smooth progress animation with interpolation
 * Prevents jumpy progress bars by smoothly transitioning between values
 */
export function useSmoothProgress(targetProgress: number, duration: number = 500) {
  const [displayProgress, setDisplayProgress] = useState(0)
  const animationRef = useRef<number>()
  const startProgressRef = useRef(0)
  const startTimeRef = useRef<number>()

  useEffect(() => {
    // Cancel any ongoing animation
    if (animationRef.current) {
      window.cancelAnimationFrame(animationRef.current)
    }

    startProgressRef.current = displayProgress
    startTimeRef.current = undefined

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp
      }

      const elapsed = timestamp - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)

      // Use easeInOutCubic for smooth acceleration and deceleration
      const easeInOutCubic = (t: number) => {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
      }

      const easedProgress = easeInOutCubic(progress)
      const currentValue =
        startProgressRef.current + (targetProgress - startProgressRef.current) * easedProgress

      setDisplayProgress(currentValue)

      if (progress < 1) {
        animationRef.current = window.requestAnimationFrame(animate)
      }
    }

    animationRef.current = window.requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        window.cancelAnimationFrame(animationRef.current)
      }
    }
  }, [targetProgress, duration])

  return displayProgress
}
