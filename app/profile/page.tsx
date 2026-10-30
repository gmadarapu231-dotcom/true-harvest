import { requireUser } from '@/lib/auth';
import { saveAddress } from '@/lib/actions/auth';
import LogoutButton from '@/components/LogoutButton';
import { Flash, PageHead } from '@/components/ui';
import { BRAND } from '@/lib/config';

export const metadata = { title: 'Profile' };

export default async function Profile({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const u = await requireUser();
  const sp = await searchParams;
  return (
    <main className="wrap" style={{ maxWidth: 640 }}>
      <PageHead title="Profile" sub={`+91 ${u.phone}`} />
      <Flash sp={sp} />
      <form action={saveAddress} className="card form">
        <label>Name<input name="name" defaultValue={u.name} /></label>
        <label>Delivery address<textarea name="address" defaultValue={u.address} /></label>
        <label>PIN code<input name="pin" defaultValue={u.pin} inputMode="numeric" /></label>
        <button className="btn">Save</button>
      </form>
      <div className="card small muted">
        Help: call {BRAND.supportPhone}. {BRAND.grievanceOfficer}. To ask for a copy or deletion of your data, contact support.
      </div>
      <LogoutButton />
    </main>
  );
}
