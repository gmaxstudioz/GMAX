"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"

const themes = ["light", "dark" ] as const
type Theme = (typeof themes)[number]

const themeConfig: Record<Theme, { label: string; icon: React.ReactNode }> = {
  light: {
    label: "Light",
    icon: <Sun className="h-[1.2rem] w-[1.2rem]" />,
  },
  dark: {
    label: "Dark",
    icon: <Moon className="h-[1.2rem] w-[1.2rem]" />,
  },
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [hovered, setHovered] = React.useState(false)

  const currentTheme = (theme as Theme) ?? "system"
  const currentIndex = themes.indexOf(currentTheme)
  const nextTheme = themes[(currentIndex + 1) % themes.length]

  const handleToggle = () => {
    setTheme(nextTheme)
  }

  return (
    <div className="relative inline-flex items-center">
      <Button
        variant="outline"
        size="icon"
        onClick={handleToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label={`Current theme: ${currentTheme}. Click to switch to ${nextTheme}`}
      >
        <span className="transition-all duration-300">
          {themeConfig[currentTheme]?.icon}
        </span>
      </Button>

      {/* Hover label */}
      <div
        className={`
          absolute -bottom-8 left-1/2 -translate-x-1/2
          px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap
          bg-popover text-popover-foreground border shadow-md
          transition-all duration-200 pointer-events-none
          ${hovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"}
        `}
      >
        → {themeConfig[nextTheme].label}
      </div>
    </div>
  )
}