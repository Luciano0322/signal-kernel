import { createRoot } from "react-dom/client";
import { createApp } from "vue";
import { mountEventLog } from "../eventLog";
import { AccountCartIsland } from "../react-island/AccountCartIsland";
import { createCommerceGraph } from "../shared-graph/commerceGraph";
import { createCheckoutSummaryIsland } from "../vue-island/CheckoutSummaryIsland";

export function mountShell() {
  const reactRoot = document.getElementById("react-island");
  const vueRoot = document.getElementById("vue-island");
  const eventLogRoot = document.getElementById("event-log");
  const shellMeta = document.getElementById("shell-meta");

  if (!reactRoot || !vueRoot || !eventLogRoot) {
    throw new Error("Micro frontend example roots are missing from index.html");
  }

  const graph = createCommerceGraph();

  if (shellMeta) {
    shellMeta.textContent = `${graph.identity.graphId} / ${graph.identity.contractVersion}`;
  }

  createRoot(reactRoot).render(<AccountCartIsland graph={graph} />);
  createApp(createCheckoutSummaryIsland(graph)).mount(vueRoot);
  mountEventLog(eventLogRoot, graph.selectors.eventLog);
}
