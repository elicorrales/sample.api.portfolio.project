import { API_URL } from "./api/client.ts";
import { UsersList } from "./users/UsersList.tsx";

export function App() {
  return (
    <div className="spread">
      <section className="page page-left">
        <header className="head">
          <h1>Users</h1>
          <div className="who">{new URL(API_URL).host}</div>
        </header>
        <p className="note">Demo only: all data is fake and resets every night at 08:00 UTC.</p>
        <UsersList />
      </section>
      <section className="page page-right">
        <p className="blank-page">The user you open from the list will appear on this page.</p>
      </section>
    </div>
  );
}
