# DevOps Runtime Example

This example is a skeleton for modeling DevOps operational state as a deterministic `signal-kernel` graph.

It is not a CI/CD platform, dashboard framework, OpenTelemetry replacement, Kubernetes replacement, or workflow engine. It is a pressure-test for how TypeScript can model operational state before future snapshot and possible ops-runtime package work.

## What This Proves

The graph owns:

* selected commit
* CI status
* artifact readiness
* staging deployment status
* health stream events
* manual approval
* derived decisions such as `canDeploy`, `canPromote`, `blockedReason`, and `riskLevel`

React and Vue only render the graph through thin adapters. Both use
`useKernelValue()` for synchronous readable graph values, while resources and
streams remain on their dedicated adapter hooks.

## Runtime Graph

The example is organized around `createDevopsGraph()`. The graph separates source signals, async resources, stream resources, derived decisions, and actions.

```mermaid
flowchart TD
  Actions["Graph actions<br/>selectCommit / startDeployment / approvePromotion / cancelDeployment"]

  subgraph Signals["Source signals"]
    selectedCommit["selectedCommit"]
    targetEnvironment["targetEnvironment"]
    manualApproval["manualApproval"]
    rolloutIntent["rolloutIntent"]
    eventLog["eventLog"]
  end

  subgraph Resources["Async runtime resources"]
    ciStatus["ciStatus<br/>createResource({ input: selectedCommit })"]
    artifactStatus["artifactStatus<br/>createResource({ input: selectedCommit })"]
    deploymentStatus["deploymentStatus<br/>createResource({ input: deploymentRequest })"]
    healthEvents["healthEvents<br/>createStreamResource({ input: selectedCommit })"]
  end

  subgraph Computed["Derived decisions"]
    canDeploy["canDeploy"]
    deploymentRequest["deploymentRequest"]
    healthSummary["healthSummary"]
    decisions["decisions<br/>phase / canPromote / blockedReason / riskLevel"]
  end

  Actions --> selectedCommit
  Actions --> rolloutIntent
  Actions --> manualApproval
  Actions --> eventLog

  selectedCommit --> ciStatus
  selectedCommit --> artifactStatus
  selectedCommit --> healthEvents

  ciStatus --> canDeploy
  artifactStatus --> canDeploy

  selectedCommit --> deploymentRequest
  targetEnvironment --> deploymentRequest
  rolloutIntent --> deploymentRequest
  canDeploy --> deploymentRequest

  deploymentRequest --> deploymentStatus
  healthEvents --> healthSummary

  ciStatus --> decisions
  artifactStatus --> decisions
  deploymentStatus --> decisions
  healthSummary --> decisions
  manualApproval --> decisions
  rolloutIntent --> decisions

  ciStatus --> eventLog
  artifactStatus --> eventLog
  deploymentStatus --> eventLog
  healthEvents --> eventLog
```

The important boundary is that the graph is headless. React and Vue are only consumers of the final graph state.

## Promotion Gate

The `decisions` computed value turns operational inputs into promotion eligibility.

```mermaid
flowchart TD
  CI["CI success?"] --> Artifact["Artifact ready?"]
  Artifact --> CanDeploy["canDeploy = true"]
  CanDeploy --> Deploy["Staging rollout requested"]
  Deploy --> Rollout["Deployment success?"]
  Rollout --> Health["Health healthy?"]
  Health --> Approval["Manual approval granted?"]
  Approval --> Promote["canPromote = true"]

  CI -. failed .-> Blocked["blockedReason"]
  Artifact -. missing .-> Blocked
  Rollout -. failed .-> Blocked
  Health -. degraded .-> Blocked
  Approval -. missing .-> Blocked
```

This is why the example is closer to a control-plane graph than a dashboard. The UI displays the decision; it does not own the decision.

## CLI Direction

A realistic DevOps tool would likely consume the same graph from a CLI or headless runtime.

```mermaid
flowchart TD
  CLI["CLI<br/>check / deploy / promote / watch"]
  Args["Parse args<br/>commit / env / format"]
  Graph["createDevopsGraph()"]
  Providers["Provider layer<br/>CI / registry / deploy / telemetry"]
  Decisions["decisions.get()"]
  Events["eventLog.get()"]
  Output["stdout / JSON / exit code"]

  CLI --> Args
  Args --> Graph
  Providers --> Graph

  Graph --> Decisions
  Graph --> Events

  Decisions --> Output
  Events --> Output

  Graph -. same graph .-> React["React viewer"]
  Graph -. same graph .-> Vue["Vue viewer"]
```

The current React and Vue panels are viewers. A future CLI could create the same graph, feed it provider data, read `decisions.get()`, and return stdout, JSON, or an exit code.

## Scenario

```txt
select commit
-> CI checks run
-> artifact becomes available
-> staging rollout starts
-> health events stream in
-> graph computes promotion eligibility
-> manual approval is granted
-> production promotion becomes allowed or blocked
```

The fake fixtures include:

```txt
commit-a: slow but healthy rollout
commit-b: fast checks, degraded health
commit-c: medium checks with healthy rollout
```

Switching commits while work is running should not allow stale CI, artifact, deployment, or health results to become authoritative.

## Run

```sh
pnpm -F @signal-kernel/example-devops-runtime dev
```

## Build

```sh
pnpm -F @signal-kernel/example-devops-runtime build
```

## Test

```sh
pnpm -F @signal-kernel/example-devops-runtime test
```

The tests focus on graph semantics, not UI internals:

* stale CI results are ignored after commit switching
* promotion requires CI, artifact, rollout, health, and approval
* degraded health blocks promotion

## Structure

```txt
src/
  graph/
    commits.ts
    fakeArtifactApi.ts
    fakeCiApi.ts
    fakeDeploymentApi.ts
    fakeHealthStream.ts
    devopsGraph.ts
    devopsGraph.test.ts
    types.ts
  react/
    ReactPanel.tsx
  vue/
    VuePanel.ts
```

The graph is intentionally framework-neutral. The UI exists to make the operational state visible.
