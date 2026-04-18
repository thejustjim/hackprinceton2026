import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { sampleSupplyScenario } from "@/lib/supply-chain-scenario"

export default function Page() {
  return <DashboardShell scenario={sampleSupplyScenario} />
}
