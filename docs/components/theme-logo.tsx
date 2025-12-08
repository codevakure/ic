'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export function ThemeLogo() {
  const { theme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    // Return a simple fallback during hydration
    return (
      <span style={{ fontSize: '18px', fontWeight: 'bold' }}>Ranger</span>
    )
  }

  // Determine if we should show dark theme logo
  const isDark = resolvedTheme === 'dark' || (theme === 'dark' && !resolvedTheme)

  return (
    <div className="theme-logo-container">
      {/* Light theme logo */}
      <img 
        src="/docs/logo-lite.svg"
        alt="Ranger Logo Light"
        width="162" 
        height="50" 
        className="ranger-logo light-logo"
        style={{ display: isDark ? 'none' : 'block' }}
      />
      {/* Dark theme logo */}
      <img 
        src="/docs/logo-dark.svg"
        alt="Ranger Logo Dark"
        width="162" 
        height="50" 
        className="ranger-logo dark-logo"
        style={{ display: isDark ? 'block' : 'none' }}
      />
    </div>
  )
}