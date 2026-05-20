import type { ScenarioId, ScenarioSummary } from "../../model/types";

type ScenarioControlsProps = {
  activeScenarioId: ScenarioId;
  scenarios: ScenarioSummary[];
};

export function ScenarioControls({
  activeScenarioId,
  scenarios,
}: ScenarioControlsProps) {
  return (
    <section className="panel scenario-panel" aria-label="Demo scenarios">
      <div className="panel-heading">
        <p className="eyebrow">Scenarios</p>
        <h2>Correctness paths</h2>
      </div>
      <div className="scenario-list">
        {scenarios.map((scenario) => (
          <button
            className={
              scenario.id === activeScenarioId
                ? "scenario-button active"
                : "scenario-button"
            }
            key={scenario.id}
            type="button"
          >
            <span>{scenario.label}</span>
            <small>{scenario.claim}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
