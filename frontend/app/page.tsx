import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { supplyChainSnapshot } from "@/lib/mock-supply-chain"

export default function Page() {
  return <DashboardShell data={supplyChainSnapshot} />
}
