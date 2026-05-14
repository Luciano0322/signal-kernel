import { createRoot } from "react-dom/client";
import { createApp } from "vue";
import { ReactPanel } from "./react/ReactPanel";
import { VuePanel } from "./vue/VuePanel";
import { mountNaivePanel } from "./naive/naivePanel";
import { mountEventLog } from "./eventLog";
import { searchRaceGraph } from "./graph/searchGraph";

const input = document.getElementById("search-input") as HTMLInputElement;
const raceButton = document.getElementById("race-button") as HTMLButtonElement;
const clearButton = document.getElementById("clear-button") as HTMLButtonElement;
const naiveRoot = document.getElementById("naive-root");
const reactRoot = document.getElementById("react-root");
const vueRoot = document.getElementById("vue-root");
const eventLogRoot = document.getElementById("event-log");

if (!naiveRoot || !reactRoot || !vueRoot || !eventLogRoot) {
  throw new Error("Example roots are missing from index.html");
}

const naivePanel = mountNaivePanel(naiveRoot, searchRaceGraph.recordEvent);
mountEventLog(eventLogRoot, searchRaceGraph.eventLog);

createRoot(reactRoot).render(<ReactPanel />);
createApp(VuePanel).mount(vueRoot);

function applyQuery(nextQuery: string) {
  input.value = nextQuery;
  searchRaceGraph.query.set(nextQuery);
  naivePanel.search(nextQuery);
}

function clearDemo() {
  input.value = "";
  naivePanel.reset();
  searchRaceGraph.clearEvents();
  searchRaceGraph.query.set("");
}

function runRaceSequence() {
  clearDemo();

  window.setTimeout(() => applyQuery("a"), 0);
  window.setTimeout(() => applyQuery("ab"), 40);
  window.setTimeout(() => applyQuery("abc"), 80);
}

input.addEventListener("input", () => {
  applyQuery(input.value);
});

raceButton.addEventListener("click", runRaceSequence);
clearButton.addEventListener("click", clearDemo);
