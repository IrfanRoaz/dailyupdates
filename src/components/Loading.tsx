export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="postbox">
      <div className="loading-row">
        <span className="spinner" aria-hidden="true" />
        <span>{label}</span>
      </div>
    </div>
  );
}
