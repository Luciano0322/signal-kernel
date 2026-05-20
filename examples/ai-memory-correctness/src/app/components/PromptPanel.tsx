type PromptPanelProps = {
  prompt: string;
};

export function PromptPanel({ prompt }: PromptPanelProps) {
  return (
    <section className="panel prompt-panel" aria-label="Rendered memory prompt">
      <div className="panel-heading">
        <p className="eyebrow">Prompt</p>
        <h2>Derived memory prompt</h2>
      </div>
      <pre>{prompt}</pre>
      <p className="panel-note">
        In the graph phase this prompt will be a computed value, derived from
        recalled facts and rendering policy.
      </p>
    </section>
  );
}
