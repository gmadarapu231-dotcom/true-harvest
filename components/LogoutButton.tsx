import { logout } from '@/lib/actions/auth';

export default function LogoutButton() {
  return <form action={logout} style={{ marginTop: 16 }}><button className="btn btn-ghost btn-block">Log out · లాగ్ అవుట్</button></form>;
}
