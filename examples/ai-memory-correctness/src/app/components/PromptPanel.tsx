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
        This prompt is a computed value derived from the current recalled facts.
        Candidate facts do not enter it until retention commits.
      </p>
    </section>
  );
}
