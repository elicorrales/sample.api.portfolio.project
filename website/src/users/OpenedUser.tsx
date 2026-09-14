import { useEffect, useId, useState, type ReactNode } from "react";
import { ApiError, call, isTokenRefused, messageOf } from "../api/call.ts";
import { api } from "../api/client.ts";
import type { components } from "../api/schema.ts";
import { bearer } from "../api/token.ts";
import {
  ADDRESS_TYPES, draftOf, emptyDraft, fieldNamesOf, inputOf, MAX_ROWS, PHONE_TYPES, readablePhone, sameDraft,
  US_STATES, withRowAdded, withRowRemoved, type AddressDraft, type PhoneDraft, type UserDraft,
} from "./draft.ts";

type UserBasic = components["schemas"]["UserBasic"];
type UserDetailed = components["schemas"]["UserDetailed"];

type Loaded = { status: "loading" } | { status: "failed"; message: string } | { status: "loaded"; user: UserDetailed };
// What the last save, delete, or restore came back with.
type Outcome = { message: string | null; fieldErrors: Record<string, string>; offerReload: boolean };
type Action = "save" | "delete" | "restore";

type Props = {
  token: string;
  onTokenRefused: (token: string) => void;
  summary: UserBasic | null; // null: a new user
  blocked: boolean; // someone tried to open something else while this had unsaved changes
  onDirtyChange: (dirty: boolean) => void;
  onSaved: (user: UserDetailed | null, created: boolean) => void;
  onClose: () => void;
};

// The right page: a new user's empty form, a user's form, or a deleted user shown read-only with Restore.
// The app gives each user (and New user) its own copy of this component, so nothing carries over between them.
export function OpenedUser({ token, onTokenRefused, summary, blocked, onDirtyChange, onSaved, onClose }: Props) {
  const userId = summary?.id ?? null;
  // Unused for a new user (no userId).
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  const [reloads, setReloads] = useState(0);
  const [initial, setInitial] = useState<UserDraft>(emptyDraft);
  const [draft, setDraft] = useState<UserDraft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const dirty = !sameDraft(draft, initial);
  const user = userId && loaded.status === "loaded" ? loaded.user : null;

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  useEffect(() => {
    if (!userId) return;
    // Closing this page, or reloading again, before the answer arrives marks it as replaced.
    let replaced = false;
    loadDetails(token, userId).then(
      (details) => {
        if (replaced) return;
        show(details);
      },
      (error) => {
        if (replaced) return;
        if (isTokenRefused(error)) onTokenRefused(token);
        setLoaded({ status: "failed", message: messageOf(error) });
      },
    );
    return () => {
      replaced = true;
    };
  }, [token, onTokenRefused, userId, reloads]);

  function show(details: UserDetailed) {
    setLoaded({ status: "loaded", user: details });
    setInitial(draftOf(details));
    setDraft(draftOf(details));
    setOutcome(null);
  }

  function reload() {
    setLoaded({ status: "loading" });
    setOutcome(null);
    setReloads((count) => count + 1);
  }

  function failed(error: unknown, action: Action) {
    if (isTokenRefused(error)) onTokenRefused(token);
    setOutcome(outcomeOf(error, action));
  }

  async function save() {
    setBusy(true);
    setOutcome(null);
    setNotice(null);
    try {
      const body = inputOf(draft);
      if (!user) {
        const created = await call(() => api.POST("/v1/users", { body, headers: bearer(token) }));
        onSaved(created, true);
      } else {
        const saved = await call(() =>
          api.PUT("/v1/users/{userId}", {
            params: { path: { userId: user.id }, header: { "If-Match": `"${user.version}"` } },
            body,
            headers: bearer(token),
          }),
        );
        show(saved);
        onSaved(saved, false);
      }
    } catch (error) {
      failed(error, "save");
    } finally {
      setBusy(false);
    }
  }

  async function remove(target: UserDetailed) {
    setConfirmingDelete(false);
    setBusy(true);
    try {
      await call(() =>
        api.DELETE("/v1/users/{userId}", {
          params: { path: { userId: target.id }, header: { "If-Match": `"${target.version}"` } },
          headers: bearer(token),
        }),
      );
      onSaved(null, false);
      reload(); // shows the user as deleted, with Restore
    } catch (error) {
      failed(error, "delete");
    } finally {
      setBusy(false);
    }
  }

  async function restore(target: UserDetailed) {
    setBusy(true);
    setNotice(null);
    try {
      const restored = await call(() =>
        api.POST("/v1/users/{userId}/restore", { params: { path: { userId: target.id } }, headers: bearer(token) }),
      );
      show(restored);
      onSaved(restored, false);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setNotice("Someone restored this user first.");
        onSaved(null, false);
        reload();
      } else {
        failed(error, "restore");
      }
    } finally {
      setBusy(false);
    }
  }

  const heading = user ? `${user.firstName} ${user.lastName}` : summary ? `${summary.firstName} ${summary.lastName}` : "New user";
  const errors = outcome?.fieldErrors ?? {};
  const unplaced = Object.entries(errors).filter(([name]) => !fieldNamesOf(draft).has(name));
  const alert = outcome?.message ? (
    <div role="alert" className="problem">
      <p>{outcome.message}</p>
      {unplaced.length ? (
        <ul>
          {unplaced.map(([name, message]) => (
            <li key={name}>{`${name}: ${message}`}</li>
          ))}
        </ul>
      ) : null}
      {outcome.offerReload ? (
        <button type="button" className="btn" onClick={reload}>
          Load their version
        </button>
      ) : null}
    </div>
  ) : null;

  // While loading, or when loading failed: what the list already knows.
  if (userId && loaded.status !== "loaded") {
    return (
      <article className="opened">
        <h2>{heading}</h2>
        {notice ? <p role="status" className="notice">{notice}</p> : null}
        <dl className="fill">
          <dt>Email</dt>
          <dd>{summary?.email}</dd>
        </dl>
        {loaded.status === "loading" ? (
          <p className="waiting">Loading details…</p>
        ) : (
          <p role="alert" className="problem">{loaded.message}</p>
        )}
      </article>
    );
  }

  // A deleted user: read-only, with Restore.
  if (user?.deletedAt) {
    return (
      <article className="opened">
        <h2>{heading}</h2>
        <p className="sub">{`Deleted ${shortTime(user.deletedAt)}, version ${user.version}`}</p>
        <dl className="fill">
          <dt>Email</dt>
          <dd>{user.email}</dd>
          <dt>Date of birth</dt>
          <dd>{user.dateOfBirth}</dd>
          {user.phones.map((phone) => (
            <Line key={phone.type} label={labelOf("Phone", phone)} value={readablePhone(phone.number)} />
          ))}
          {user.addresses.map((address) => (
            <Line
              key={address.type}
              label={labelOf("Address", address)}
              value={[address.street, address.street2, address.city, `${address.state} ${address.zip}`].filter(Boolean).join(", ")}
            />
          ))}
        </dl>
        {alert}
        <div className="actions">
          <button type="button" className="btn solid" disabled={busy} onClick={() => void restore(user)}>
            Restore
          </button>
        </div>
      </article>
    );
  }

  const set = (change: Partial<UserDraft>) => setDraft((current) => ({ ...current, ...change }));
  const setPhone = (index: number, change: Partial<PhoneDraft>) =>
    set({ phones: draft.phones.map((phone, i) => (i === index ? { ...phone, ...change } : change.primary ? { ...phone, primary: false } : phone)) });
  const setAddress = (index: number, change: Partial<AddressDraft>) =>
    set({ addresses: draft.addresses.map((address, i) => (i === index ? { ...address, ...change } : change.primary ? { ...address, primary: false } : address)) });

  return (
    <article className="opened">
      <h2>{heading}</h2>
      {user ? <p className="sub">{`version ${user.version}, updated ${shortTime(user.updatedAt)}`}</p> : <p className="sub">not saved yet</p>}
      {notice ? <p role="status" className="notice">{notice}</p> : null}

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className="fill">
          <TextField label="First name" value={draft.firstName} error={errors.firstName} onChange={(firstName) => set({ firstName })} />
          <TextField label="Last name" value={draft.lastName} error={errors.lastName} onChange={(lastName) => set({ lastName })} />
          <TextField label="Email" type="email" value={draft.email} error={errors.email} onChange={(email) => set({ email })} />
          <TextField label="Date of birth" type="date" value={draft.dateOfBirth} error={errors.dateOfBirth} onChange={(dateOfBirth) => set({ dateOfBirth })} />
        </div>

        <h3>
          Phones{" "}
          <button type="button" className="link" aria-label="Add phone" disabled={draft.phones.length >= MAX_ROWS}
            onClick={() => set({ phones: withRowAdded(draft.phones, PHONE_TYPES, { number: "" }) })}>
            + add phone
          </button>
        </h3>
        {draft.phones.map((phone, i) => {
          const name = `Phone ${i + 1}`;
          return (
            <Row key={i} title={name} onRemove={draft.phones.length > 1 ? () => set({ phones: withRowRemoved(draft.phones, i) }) : null} removeLabel={`Remove phone ${i + 1}`}>
              <Input label={`${name} number`} value={phone.number} error={errors[`phones.${i}.number`]} onChange={(number) => setPhone(i, { number })} placeholder="(305) 555-0123" />
              <Choice label={`${name} type`} value={phone.type} options={PHONE_TYPES} error={errors[`phones.${i}.type`]} onChange={(type) => setPhone(i, { type: type as PhoneDraft["type"] })} />
              {draft.phones.length > 1 ? <Primary label={`${name} is primary`} group="phone" checked={phone.primary} onChange={() => setPhone(i, { primary: true })} /> : null}
            </Row>
          );
        })}

        <h3>
          Addresses{" "}
          <button type="button" className="link" aria-label="Add address" disabled={draft.addresses.length >= MAX_ROWS}
            onClick={() => set({ addresses: withRowAdded(draft.addresses, ADDRESS_TYPES, { street: "", street2: "", city: "", state: "", zip: "" }) })}>
            + add address
          </button>
        </h3>
        {draft.addresses.map((address, i) => {
          const name = `Address ${i + 1}`;
          const at = (part: string) => errors[`addresses.${i}.${part}`];
          return (
            <Row key={i} title={name} onRemove={draft.addresses.length > 1 ? () => set({ addresses: withRowRemoved(draft.addresses, i) }) : null} removeLabel={`Remove address ${i + 1}`}>
              <Input label={`${name} street`} value={address.street} error={at("street")} onChange={(street) => setAddress(i, { street })} placeholder="street" wide />
              <Input label={`${name} street 2`} value={address.street2} error={at("street2")} onChange={(street2) => setAddress(i, { street2 })} placeholder="apt, suite (optional)" wide />
              <Input label={`${name} city`} value={address.city} error={at("city")} onChange={(city) => setAddress(i, { city })} placeholder="city" />
              <Choice label={`${name} state`} value={address.state} options={["", ...US_STATES]} error={at("state")} onChange={(state) => setAddress(i, { state: state as AddressDraft["state"] })} />
              <Input label={`${name} ZIP`} value={address.zip} error={at("zip")} onChange={(zip) => setAddress(i, { zip })} placeholder="ZIP" narrow />
              <Choice label={`${name} type`} value={address.type} options={ADDRESS_TYPES} error={at("type")} onChange={(type) => setAddress(i, { type: type as AddressDraft["type"] })} />
              {draft.addresses.length > 1 ? <Primary label={`${name} is primary`} group="address" checked={address.primary} onChange={() => setAddress(i, { primary: true })} /> : null}
            </Row>
          );
        })}

        {blocked ? <p role="status" className="notice">You have unsaved changes: Save or Cancel first.</p> : null}
        {alert}

        {confirmingDelete && user ? (
          <div className="confirm">
            <p>{`Delete ${user.firstName} ${user.lastName}?`}</p>
            <button type="button" className="btn red" onClick={() => void remove(user)}>Yes, delete</button>{" "}
            <button type="button" className="btn" onClick={() => setConfirmingDelete(false)}>Keep</button>
          </div>
        ) : (
          <div className="actions">
            <button type="submit" className="btn solid" disabled={!dirty || busy}>Save</button>
            <button type="button" className="btn" disabled={user ? !dirty || busy : busy}
              onClick={() => {
                if (!user) return onClose();
                setDraft(initial);
                setOutcome(null);
              }}>
              Cancel
            </button>
            <span className="sp" />
            {user ? (
              <button type="button" className="btn red" disabled={busy} onClick={() => setConfirmingDelete(true)}>Delete user</button>
            ) : null}
          </div>
        )}
      </form>
    </article>
  );
}

function outcomeOf(error: unknown, action: Action): Outcome {
  const problem = error instanceof ApiError ? error.problem : null;
  const status = error instanceof ApiError ? error.status : null;
  if (status === 412 && action !== "restore") {
    const message = action === "save" ? "Someone saved this user first. Nothing of yours was saved." : "Someone changed this user first. Nothing was deleted.";
    return { message, fieldErrors: {}, offerReload: true };
  }
  if (status === 409 && problem?.type === "/problems/conflict" && action === "save") {
    return { message: null, fieldErrors: { email: problem.detail ?? problem.title }, offerReload: false };
  }
  const fieldErrors = Object.fromEntries((problem?.errors ?? []).map(({ field, message }) => [field, message]));
  return { message: messageOf(error), fieldErrors, offerReload: false };
}

async function loadDetails(token: string, userId: string): Promise<UserDetailed> {
  const user = await call(() =>
    api.GET("/v1/users/{userId}", {
      // includeDeleted: a user someone deleted meanwhile shows as deleted, with Restore, instead of as missing.
      params: { path: { userId }, query: { view: "detailed", includeDeleted: true } },
      headers: bearer(token),
    }),
  );
  // The spec allows either view in the answer; we asked for detailed.
  if (!("version" in user)) throw new Error("the API sent the basic view instead of the detailed one");
  return user;
}

function TextField({ label, value, error, onChange, type = "text" }: { label: string; value: string; error?: string; onChange: (value: string) => void; type?: string }) {
  const id = useId();
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <div>
        <input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} />
        {error ? <p id={`${id}-error`} className="field-error">{error}</p> : null}
      </div>
    </>
  );
}

function Input({ label, value, error, onChange, placeholder, wide, narrow }: { label: string; value: string; error?: string; onChange: (value: string) => void; placeholder?: string; wide?: boolean; narrow?: boolean }) {
  const id = useId();
  return (
    <span className={wide ? "cell wide" : narrow ? "cell narrow" : "cell"}>
      <input id={id} aria-label={label} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} />
      {error ? <span id={`${id}-error`} className="field-error">{error}</span> : null}
    </span>
  );
}

function Choice({ label, value, options, error, onChange }: { label: string; value: string; options: readonly string[]; error?: string; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <span className="cell">
      <select id={id} aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined}>
        {options.map((option) => (
          <option key={option} value={option}>{option || "state"}</option>
        ))}
      </select>
      {error ? <span id={`${id}-error`} className="field-error">{error}</span> : null}
    </span>
  );
}

function Primary({ label, group, checked, onChange }: { label: string; group: string; checked: boolean; onChange: () => void }) {
  const name = useId();
  return (
    <label className="cell primary">
      <input type="radio" name={`${group}-${name}`} aria-label={label} checked={checked} onChange={onChange} /> primary
    </label>
  );
}

function Row({ title, children, onRemove, removeLabel }: { title: string; children: ReactNode; onRemove: (() => void) | null; removeLabel: string }) {
  return (
    <div className="row">
      <span className="row-title">{title}</span>
      <div className="row-cells">
        {children}
        {onRemove ? (
          <button type="button" className="link" aria-label={removeLabel} onClick={onRemove}>remove</button>
        ) : null}
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

// ("Phone", { type: "mobile", primary: true }) → "Phone: mobile, primary"
function labelOf(kind: string, { type, primary }: { type: string; primary: boolean }) {
  return `${kind}: ${type}${primary ? ", primary" : ""}`;
}

// 2026-09-13T10:42:00Z → 2026-09-13 10:42 UTC
function shortTime(timestamp: string) {
  return `${timestamp.slice(0, 16).replace("T", " ")} UTC`;
}
