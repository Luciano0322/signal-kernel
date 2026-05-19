import { createReactiveProxyGraph } from "./graph/reactiveProxyGraph";

const graph = createReactiveProxyGraph();

const decision = graph.resolveProxyDecision({
  method: "GET",
  path: "/api/users",
  headers: {},
});

console.log("Reactive proxy graph is ready.");
console.log(JSON.stringify(decision, null, 2));
