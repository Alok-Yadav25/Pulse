import { useState } from "react";
import { ArrowRight, FlaskConical } from "lucide-react";
import { Modal } from "./ui";
import { useWorkspace } from "../lib/workspace";

export default function AuthModal({
  open,
  onOpenChange,
  notify,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notify: (message: string) => void;
}) {
  const workspace = useWorkspace(),
    [register, setRegister] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(demo = false) {
    setBusy(true);
    setError("");
    try {
      if (demo) await workspace.startDemo();
      else await workspace.signIn(email, password, register);
      onOpenChange(false);
      setPassword("");
      notify(demo ? "Live chaos demo connected." : "Live workspace connected.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        register ? "Your first live heartbeat." : "Connect your workspace."
      }
      description="Sign in to save monitors to Postgres and receive real probe results."
    >
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="segmented">
          <button
            type="button"
            className={!register ? "selected" : ""}
            onClick={() => setRegister(false)}
          >
            Sign in
          </button>
          <button
            type="button"
            className={register ? "selected" : ""}
            onClick={() => setRegister(true)}
          >
            Create account
          </button>
        </div>
        <label>
          Email
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={254}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete={register ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={10}
            maxLength={128}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="button button-primary" disabled={busy}>
          {busy ? "Connecting…" : register ? "Create account" : "Sign in"}
          <ArrowRight size={15} />
        </button>
        <button
          type="button"
          className="button button-secondary"
          disabled={busy}
          onClick={() => void submit(true)}
        >
          <FlaskConical size={15} />
          Try the live chaos demo
        </button>
        <p className="section-note">
          The sample workspace remains available without an account. Your API
          must be running for live mode.
        </p>
      </form>
    </Modal>
  );
}
