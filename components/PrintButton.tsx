'use client';
export default function PrintButton() {
  return <button type="button" className="btn btn-ghost btn-sm" onClick={() => window.print()}>Receipt (PDF)</button>;
}
