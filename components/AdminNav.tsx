// The admin menu now lives in the sidebar rendered by app/admin/layout.tsx. Pages still call this so their
// markup stays unchanged; it renders nothing.
export default function AdminNav(_: { current: string }) {
  return null;
}
