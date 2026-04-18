import { cookies } from "next/headers"

import { DashboardPage } from "@/components/dashboard/dashboard-page"
import {
  DASHBOARD_ENTRY_COOKIE,
  DASHBOARD_ENTRY_MODE_DEMO,
} from "@/lib/dashboard-entry"

interface DashboardPageProps {
  searchParams: Promise<{
    demo?: string
  }>
}

export default async function Page({ searchParams }: DashboardPageProps) {
  const params = await searchParams
  const cookieStore = await cookies()
  const startsInDemo =
    params.demo === "1" ||
    cookieStore.get(DASHBOARD_ENTRY_COOKIE)?.value ===
      DASHBOARD_ENTRY_MODE_DEMO

  return <DashboardPage startsInDemo={startsInDemo} />
}
