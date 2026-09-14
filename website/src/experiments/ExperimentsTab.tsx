import { useEffect, useState } from "react";
import { api, API_URL } from "../api/client.ts";
import { EXPERIMENTS, REPO, type Experiment } from "./experiments.ts";

const FLOOD_SIZE = 150; // all sent at once, so the flood fits inside one minute of the API's counting
const EXPECTED_ANSWERS = 100; // the API's limit per minute
const REPLAY_STEP_MS = 150;

type Counts = { answered: number; refused: number };
type Flood =
  | { status: "idle" }
  | { status: "confirming" }
  | ({ status: "running" } & Counts)
  | ({ status: "failed"; message: string } & Counts)
  | ({ status: "done"; retryAfter: number | null } & Counts);

// Left page: the experiments, the live flood first. Right page: the chosen one.
export function ExperimentsTab({ hidden }: { hidden: boolean }) {
  const [chosenId, setChosenId] = useState(EXPERIMENTS[0].id);
  const [flood, setFlood] = useState<Flood>({ status: "idle" });
  const chosen = EXPERIMENTS.find((experiment) => experiment.id === chosenId) ?? EXPERIMENTS[0];

  async function runFlood() {
    const counts: Counts = { answered: 0, refused: 0 };
    let unanswered = 0;
    let retryAfter: number | null = null;
    setFlood({ status: "running", ...counts });
    await Promise.all(
      Array.from({ length: FLOOD_SIZE }, async () => {
        try {
          // No token on purpose: the limit is counted before the token is checked.
          const { response } = await api.GET("/v1/users", { params: { query: { pageSize: 1 } } });
          if (response.status === 429) {
            counts.refused++;
            retryAfter = Math.max(retryAfter ?? 0, Number(response.headers.get("Retry-After")) || 0) || null;
          } else {
            counts.answered++;
          }
        } catch {
          unanswered++;
        }
        setFlood({ status: "running", ...counts });
      }),
    );
    setFlood(
      unanswered
        ? { status: "failed", ...counts, message: `Can't reach the API: ${unanswered} of ${FLOOD_SIZE} requests got no answer. Check your connection, or try again in a minute.` }
        : { status: "done", ...counts, retryAfter },
    );
  }

  return (
    <>
      <section className="page page-left" aria-label="Experiments list" hidden={hidden}>
        <header className="head">
          <h1>Experiments</h1>
          {/* No token status here: the flood doesn't use one. */}
          <div className="who">{`live requests go to ${new URL(API_URL).host}`}</div>
        </header>
        <p className="note">
          Each claim is proven by automated tests on every change. The flood runs live from your browser; the others replay what their test sends.
        </p>
        <ol className="index">
          {EXPERIMENTS.map((experiment, i) => (
            <li key={experiment.id} className={experiment.id === chosen.id ? "sel" : experiment.live ? "live" : undefined}>
              <button type="button" className="index-open" aria-current={experiment.id === chosen.id ? "true" : undefined} onClick={() => setChosenId(experiment.id)}>
                <span className="n">{i + 1}</span>
                <span>
                  <b>{experiment.title}</b>
                  <small className={experiment.careful ? "caution" : undefined}>{experiment.short}</small>
                </span>
              </button>
              <span className="st">
                {experiment.live ? (
                  flood.status === "done" ? <Stamp mini {...floodStamp(flood)} /> : <span className="badge">runs live</span>
                ) : (
                  <Stamp mini code={experiment.proven} caption="proven by tests" />
                )}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="page page-right" aria-label="Experiment" hidden={hidden}>
        <ExperimentPage key={chosen.id} experiment={chosen} number={EXPERIMENTS.indexOf(chosen) + 1} flood={flood} setFlood={setFlood} runFlood={runFlood} />
      </section>
    </>
  );
}

type PageProps = { experiment: Experiment; number: number; flood: Flood; setFlood: (flood: Flood) => void; runFlood: () => Promise<void> };

function ExperimentPage({ experiment, number, flood, setFlood, runFlood }: PageProps) {
  const [shownSteps, setShownSteps] = useState<number | null>(null); // null: replay not started

  // Reveal the replay one step at a time, like requests coming back.
  useEffect(() => {
    if (shownSteps === null || shownSteps >= experiment.replay.length) return;
    const timer = setTimeout(() => setShownSteps(shownSteps + 1), REPLAY_STEP_MS);
    return () => clearTimeout(timer);
  }, [shownSteps, experiment.replay.length]);

  const stamp = experiment.live ? (flood.status === "done" ? floodStamp(flood) : null) : { code: experiment.proven, caption: "proven by tests" };
  const replayDone = shownSteps !== null && shownSteps >= experiment.replay.length;

  return (
    <article className="exp">
      <div className="running">
        <span>{`experiment ${number} of ${EXPERIMENTS.length}${experiment.live ? ", runs live" : ""}`}</span>
        <span>{experiment.tests[0]}</span>
      </div>
      <div className="exp-head">
        <h2>{experiment.title}</h2>
        {stamp ? <Stamp {...stamp} /> : null}
      </div>
      <dl>
        <dt>Claim</dt>
        <dd>{experiment.claim}</dd>
        <dt>Method</dt>
        <dd>{experiment.method}</dd>
        <dt>Predict</dt>
        <dd>{experiment.predict}</dd>
        {experiment.careful ? (
          <>
            <dt>Careful</dt>
            <dd className="caution">{experiment.careful}</dd>
          </>
        ) : null}
        {experiment.found ? (
          <>
            <dt>Found</dt>
            <dd>{experiment.found}</dd>
          </>
        ) : null}
        <dt>Tests</dt>
        <dd>
          {experiment.tests.map((path) => (
            <a key={path} className="test-link" href={REPO + path} target="_blank" rel="noreferrer">
              {path}
            </a>
          ))}
        </dd>
      </dl>

      {experiment.live ? (
        <FloodResult flood={flood} setFlood={setFlood} runFlood={runFlood} />
      ) : (
        <>
          <h3>What came back</h3>
          {shownSteps === null ? (
            <div className="actions">
              <button type="button" className="btn solid" onClick={() => setShownSteps(0)}>
                Replay the test
              </button>
            </div>
          ) : (
            <>
              <p className="replay-note">A replay of what the automated test sends and gets back. Nothing was sent from your browser.</p>
              <table className="log" aria-label={`Replay of ${experiment.tests[0]}`}>
                <tbody>
                  {experiment.replay.slice(0, shownSteps).map((step, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{step.request}</td>
                      <td className={step.ok ? "ok" : "no"}>{step.answer}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {replayDone && experiment.lastBody ? <pre className="body">{experiment.lastBody}</pre> : null}
              {replayDone ? (
                <div className="actions">
                  <button type="button" className="btn" onClick={() => setShownSteps(0)}>
                    Replay again
                  </button>
                </div>
              ) : null}
            </>
          )}
        </>
      )}
    </article>
  );
}

function FloodResult({ flood, setFlood, runFlood }: { flood: Flood; setFlood: (flood: Flood) => void; runFlood: () => Promise<void> }) {
  const counts = flood.status === "running" || flood.status === "failed" || flood.status === "done" ? flood : null;
  const bars = (count: number) => "|".repeat(count).replace(/(\|{5})/g, "$1 ");
  return (
    <>
      <h3>What came back</h3>
      {flood.status === "idle" ? <p className="waiting">Not run yet</p> : null}
      {counts ? (
        <div className="tally" aria-hidden="true">
          {bars(counts.answered)}
          {counts.refused ? <s>{bars(counts.refused)}</s> : null}
        </div>
      ) : null}
      {flood.status === "running" ? <p className="waiting">{`${flood.answered + flood.refused} of ${FLOOD_SIZE} answers back…`}</p> : null}
      {flood.status === "done" ? (
        <>
          <p>{flood.refused ? `${flood.answered} answered, ${flood.refused} refused with 429.` : `${flood.answered} answered, and no 429.`}</p>
          {flood.refused && flood.answered < EXPECTED_ANSWERS ? (
            <p className="waiting">Part of this minute was already used, by this page or by someone sharing your address.</p>
          ) : null}
          {flood.refused && flood.answered > EXPECTED_ANSWERS ? (
            <p className="waiting">A new minute started during the flood, so the API's count started over.</p>
          ) : null}
          {!flood.refused ? (
            <p className="waiting">Not as predicted: the limit didn't stop it. The flood may have been split across two minutes, or reached the API from more than one address.</p>
          ) : null}
        </>
      ) : null}
      {flood.status === "failed" ? <p role="alert" className="problem">{flood.message}</p> : null}

      {flood.status === "confirming" ? (
        <div className="confirm">
          <p>Run it now? Your address will be blocked for up to a minute.</p>
          <button type="button" className="btn red" onClick={() => void runFlood()}>Yes, flood it</button>{" "}
          <button type="button" className="btn" onClick={() => setFlood({ status: "idle" })}>Don't run</button>
        </div>
      ) : (
        <div className="actions">
          <button type="button" className="btn solid" disabled={flood.status === "running"} onClick={() => setFlood({ status: "confirming" })}>
            Run experiment
          </button>
        </div>
      )}
    </>
  );
}

function floodStamp(flood: Extract<Flood, { status: "done" }>) {
  const retry = flood.retryAfter ? `retry in ${flood.retryAfter} s` : "retry later";
  if (!flood.refused) return { code: "—", caption: "not as predicted" };
  if (flood.answered === EXPECTED_ANSWERS) return { code: "429", caption: `as predicted, ${retry}` };
  return { code: "429", caption: `after ${flood.answered} answers, ${retry}` };
}

function Stamp({ code, caption, mini }: { code: string; caption: string; mini?: boolean }) {
  // One label for screen readers and tests, e.g. "429 as predicted, retry in 38 s" or "412, proven by tests".
  const label = caption.startsWith("proven") || caption.startsWith("not") ? `${code}, ${caption}` : `${code} ${caption}`;
  return (
    <div role="img" aria-label={label} className={mini ? "mini" : "stamp"}>
      <b>{code}</b>
      <span>{caption}</span>
    </div>
  );
}
