'use client'

import React from 'react'

interface ScoreSpeedometerProps {
  score: number
  maxScore: number
}

export default function ScoreSpeedometer({ score, maxScore }: ScoreSpeedometerProps) {
  // Calculate percentage (0-100)
  // For display like "1/30", score is from 0 to maxScore
  const percentage = Math.max(0, Math.min(100, (score / maxScore) * 100))

  // Calculate angle for the speedometer needle (-90 to 90 degrees)
  const angle = (percentage / 100) * 180 - 90

  // Determine color based on percentage - more granular for better visual feedback
  const getColor = () => {
    if (percentage < 20) {
      return '#FF6B6B' // Red for very low scores (0-20%)
    } else if (percentage < 40) {
      return '#FFB3BA' // Light pink for low scores (20-40%)
    } else if (percentage < 60) {
      return '#FFE5B4' // Light yellow/peach for middle scores (40-60%)
    } else if (percentage < 80) {
      return '#B4E5B4' // Light green for good scores (60-80%)
    } else {
      return '#4CAF50' // Strong green for excellent scores (80-100%)
    }
  }

  const color = getColor()

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center">
      {/* SVG Speedometer */}
      <svg width="240" height="140" viewBox="0 0 240 140" className="mb-2">
        {/* Background arc */}
        <path
          d="M 30 120 A 90 90 0 0 1 210 120"
          fill="none"
          stroke="#E5E5E5"
          strokeWidth="16"
          strokeLinecap="round"
        />

        {/* Colored arc based on score */}
        <path
          d="M 30 120 A 90 90 0 0 1 210 120"
          fill="none"
          stroke={color}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${percentage * 2.827} 282.7`}
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />

        {/* Needle */}
        <g transform={`translate(120, 120) rotate(${angle})`}>
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="-70"
            stroke="#1a1a1a"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <circle cx="0" cy="0" r="8" fill="#1a1a1a" />
        </g>

        {/* Center decorative circle */}
        <circle cx="120" cy="120" r="5" fill={color} />
      </svg>

      {/* Score display */}
      <div className="text-center">
        <div style={{ fontSize: '50px', fontWeight: 400 }} className="text-black leading-none">
          {score}/{maxScore}
        </div>
      </div>
    </div>
  )
}
