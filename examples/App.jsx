// A notes app: kept in localStorage, safe when the stored value is damaged, and tells the user
// when the tab is running an old deploy.
import { useDeployVersion, usePersisted } from "react-persist-safe";

export function App() {
  const [notes, setNotes, saved] = usePersisted("notes", [], { validate: Array.isArray, refuseEmpty: true });
  const deploy = useDeployVersion({ current: __APP_VERSION__ });

  return (
    <main>
      {deploy.status === "stale" && (
        <p role="status">
          A new version is available. <button onClick={() => window.location.reload()}>Reload</button>
        </p>
      )}
      {saved.status === "unreadable" && (
        <p role="alert">
          Your saved notes could not be read. They are kept under &quot;{saved.backupKey}&quot; and nothing
          has been overwritten.
        </p>
      )}
      {saved.error && <p role="alert">{saved.error}</p>}

      <button onClick={() => setNotes((n) => [...n, `Note ${n.length + 1}`])}>Add a note</button>
      <button onClick={() => window.confirm("Delete every note?") && saved.clear()}>Delete all</button>
      <ul>{notes.map((n) => <li key={n}>{n}</li>)}</ul>
    </main>
  );
}
