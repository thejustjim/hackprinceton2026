import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"
import { TooltipProvider } from "@/components/ui/tooltip"

const HERO_BG =
  "/landing/Cinematic_top-down_aerial_photograph_of_an_expansi-1776490199103.png"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("font-sans antialiased")}
    >
      <head>
        <link
          rel="preload"
          as="image"
          href={HERO_BG}
          fetchPriority="high"
        />
      </head>
      <body className="bg-background">
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
