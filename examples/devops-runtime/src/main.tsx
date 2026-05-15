import { createRoot } from "react-dom/client";
import { createApp } from "vue";
import { commitFixtures, commitOrder } from "./graph/commits";
import { devopsGraph } from "./graph/devopsGraph";
import type { CommitId } from "./graph/types";
import { mountEventLog } from "./eventLog";
import { ReactPanel } from "./react/ReactPanel";
import { VuePanel } from "./vue/VuePanel";

const commitSelect = document.getElementById("commit-select") as HTMLSelectElement;
const deployButton = document.getElementById("deploy-button") as HTMLButtonElement;
const approveButton = document.getElementById("approve-button") as HTMLButtonElement;
const cancelButton = document.getElementById("cancel-button") as HTMLButtonElement;
const reactRoot = document.getElementById("react-root");
const vueRoot = document.getElementById("vue-root");
const eventLogRoot = document.getElementById("event-log");

if (!reactRoot || !vueRoot || !eventLogRoot) {
  throw new Error("Example roots are missing from index.html");
}

for (const commitId of commitOrder) {
  const option = document.createElement("option");
  const fixture = commitFixtures[commitId];
  option.value = commitId;
  option.textContent = `${fixture.label}: ${fixture.message}`;
  commitSelect.append(option);
}

commitSelect.value = devopsGraph.signals.selectedCommit.peek();

commitSelect.addEventListener("change", () => {
  devopsGraph.actions.selectCommit(commitSelect.value as CommitId);
});

deployButton.addEventListener("click", () => {
  devopsGraph.actions.startDeployment();
});

approveButton.addEventListener("click", () => {
  devopsGraph.actions.approvePromotion();
});

cancelButton.addEventListener("click", () => {
  devopsGraph.actions.cancelDeployment();
});

mountEventLog(eventLogRoot, devopsGraph.signals.eventLog);
createRoot(reactRoot).render(<ReactPanel />);
createApp(VuePanel).mount(vueRoot);
