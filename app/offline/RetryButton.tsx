'use client';

export function RetryButton() {
  return (
    <button className="submit-button" onClick={() => window.location.reload()}>
      TRY AGAIN
    </button>
  );
}
