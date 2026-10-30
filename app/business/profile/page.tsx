import { requireUser } from '@/lib/auth';
import { one } from '@/lib/db';
import { saveBusiness } from '@/lib/actions/business';
import LogoutButton from '@/components/LogoutButton';
import { Chip, Flash, PageHead } from '@/components/ui';

export const metadata = { title: 'Business profile' };

export default async function BusinessProfile({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const u = await requireUser('business');
  const sp = await searchParams;
  const bp = (await one('SELECT * FROM business_profiles WHERE user_id=$1', [u.id])) ?? {};
  return (
    <main className="wrap" style={{ maxWidth: 720 }}>
      <PageHead title="Business profile" sub={`${u.name} · +91 ${u.phone}`} action={<Chip s={bp.status ?? 'pending'} />} />
      <Flash sp={sp} />
      <form action={saveBusiness} className="card form">
        <div className="grid2">
          <label>Business name<input name="legal_name" defaultValue={bp.legal_name} required /></label>
          <label>GSTIN<input name="gstin" defaultValue={bp.gstin} /></label>
          <label>FSSAI number<input name="fssai_no" defaultValue={bp.fssai_no} /></label>
          <label>Receiving hours<input name="receiving_hours" defaultValue={bp.receiving_hours} /></label>
        </div>
        <label>Delivery address<textarea name="address" defaultValue={u.address} /></label>
        <label>PIN code<input name="pin" defaultValue={u.pin} /></label>
        <button className="btn">Save</button>
      </form>
      <LogoutButton />
    </main>
  );
}
