import type { ScenarioId, ScenarioSummary } from "../../model/types";

type ScenarioControlsProps = {
  activeScenarioId: ScenarioId;
  onSelect(id: ScenarioId): void;
  scenarios: ScenarioSummary[];
};

export function ScenarioControls({
  activeScenarioId,
  onSelect,
  scenarios,
}: ScenarioControlsProps) {
  const activeScenario = scenarios.find(
    (scenario) => scenario.id === activeScenarioId,
  );

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
            onClick={() => onSelect(scenario.id)}
            type="button"
          >
            <span>{scenario.label}</span>
            <small>{scenario.claim}</small>
          </button>
        ))}
      </div>
      {activeScenario ? (
        <p className="panel-note">
          Selected path: {activeScenario.claim}
        </p>
      ) : null}
    </section>
  );
}
