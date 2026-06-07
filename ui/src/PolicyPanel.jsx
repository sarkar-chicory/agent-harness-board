import { useState } from "react";

const BOARD = import.meta.env.VITE_BOARD_URL || "http://localhost:8765";

const MODES = ["read", "write", "exec", "call"];

function ModeTag({ mode }) {
  const colors = { read: "#34d399", write: "#f87171", exec: "#fbbf24", call: "#c084fc" };
  const c = colors[mode] || "#8899aa";
  return (
    <span style={{
      background: c + "22", color: c,
      padding: "1px 6px", borderRadius: 4, fontSize: 11, fontWeight: 600,
      fontFamily: "var(--mono)", marginRight: 4,
    }}>{mode}</span>
  );
}

export default function PolicyPanel({ policies, onPolicyAdded }) {
  const [pattern, setPattern]       = useState("");
  const [maxReaders, setMaxReaders] = useState(10);
  const [maxWriters, setMaxWriters] = useState(1);
  const [allowModes, setAllowModes] = useState(["read", "write", "exec", "call"]);
  const [ttlLimit, setTtlLimit]     = useState(300);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState(null);
  const [success, setSuccess]       = useState(false);

  const toggleMode = m => setAllowModes(prev =>
    prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
  );

  const submit = async e => {
    e.preventDefault();
    setSaving(true); setError(null); setSuccess(false);
    try {
      const r = await fetch(`${BOARD}/policy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource_pattern: pattern,
          max_readers: Number(maxReaders),
          max_writers: Number(maxWriters),
          allow_modes: allowModes,
          ttl_limit: Number(ttlLimit),
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      setSuccess(true);
      setPattern("");
      onPolicyAdded?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const entries = Object.entries(policies || {});

  const inputStyle = {
    background: "#0a0e14", border: "1px solid var(--border)", borderRadius: 4,
    color: "var(--text)", fontFamily: "var(--mono)", fontSize: 12, padding: "5px 8px",
    outline: "none", width: "100%",
  };
  const labelStyle = {
    fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, display: "block",
  };

  return (
    <div style={{ display: "grid", gap: 20 }}>

      {/* Policy table */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
          Active Policies
          <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8, fontWeight: 400 }}>
            board_policy.yaml + runtime overrides
          </span>
        </div>

        {entries.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 12 }}>No policies loaded.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Pattern", "Allow Modes", "Max Readers", "Max Writers", "TTL Limit"].map(h => (
                  <th key={h} style={{
                    fontSize: 11, color: "var(--muted)", padding: "4px 8px", textAlign: "left",
                    textTransform: "uppercase", letterSpacing: 1,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map(([pat, pol]) => (
                <tr key={pat}>
                  <td style={{ fontSize: 12, padding: "8px 8px", fontFamily: "var(--mono)", color: "var(--accent)", borderTop: "1px solid var(--border)" }}>{pat}</td>
                  <td style={{ fontSize: 12, padding: "8px 8px", borderTop: "1px solid var(--border)" }}>
                    {(pol.allow_modes || []).map(m => <ModeTag key={m} mode={m} />)}
                  </td>
                  <td style={{ fontSize: 12, padding: "8px 8px", fontFamily: "var(--mono)", color: "var(--green)", borderTop: "1px solid var(--border)" }}>
                    {pol.max_readers ?? "—"}
                  </td>
                  <td style={{ fontSize: 12, padding: "8px 8px", fontFamily: "var(--mono)", color: "var(--red)", borderTop: "1px solid var(--border)" }}>
                    {pol.max_writers ?? "—"}
                  </td>
                  <td style={{ fontSize: 12, padding: "8px 8px", fontFamily: "var(--mono)", color: "var(--yellow)", borderTop: "1px solid var(--border)" }}>
                    {pol.ttl_limit != null ? `${pol.ttl_limit}s` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Runtime override form */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
          Add Runtime Override
          <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8, fontWeight: 400 }}>
            POST /policy — takes effect immediately, until daemon restart
          </span>
        </div>

        <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
          <div>
            <label style={labelStyle}>Resource Pattern (fnmatch)</label>
            <input
              value={pattern}
              onChange={e => setPattern(e.target.value)}
              placeholder="e.g. *.csv or api.openai.com"
              required
              style={inputStyle}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <div>
              <label style={labelStyle}>Max Readers</label>
              <input type="number" min={0} value={maxReaders} onChange={e => setMaxReaders(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Max Writers</label>
              <input type="number" min={0} value={maxWriters} onChange={e => setMaxWriters(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>TTL Limit (s)</label>
              <input type="number" min={1} value={ttlLimit} onChange={e => setTtlLimit(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Allow Modes</label>
            <div style={{ display: "flex", gap: 8 }}>
              {MODES.map(m => {
                const colors = { read: "#34d399", write: "#f87171", exec: "#fbbf24", call: "#c084fc" };
                const on = allowModes.includes(m);
                return (
                  <button type="button" key={m} onClick={() => toggleMode(m)} style={{
                    padding: "4px 12px", borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    fontFamily: "var(--mono)",
                    background: on ? colors[m] + "22" : "transparent",
                    border: `1px solid ${on ? colors[m] : "var(--border)"}`,
                    color: on ? colors[m] : "var(--muted)",
                  }}>{m}</button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button type="submit" disabled={saving || !pattern} style={{
              background: "var(--accent)", color: "#0a0e14", border: "none", borderRadius: 4,
              padding: "7px 18px", fontSize: 13, fontWeight: 700, cursor: saving || !pattern ? "not-allowed" : "pointer",
              opacity: saving || !pattern ? 0.6 : 1,
            }}>
              {saving ? "Saving…" : "Apply Override"}
            </button>
            {success && <span style={{ color: "var(--green)", fontSize: 12 }}>Override applied.</span>}
            {error && <span style={{ color: "var(--red)", fontSize: 12 }}>{error}</span>}
          </div>
        </form>
      </div>

      {/* YAML note */}
      <div style={{ fontSize: 12, color: "var(--muted)", padding: "0 4px" }}>
        Persistent policies live in <code style={{ fontFamily: "var(--mono)", color: "var(--accent)" }}>board_policy.yaml</code>.
        The engine hot-reloads within 30 s of a file change. Runtime overrides added here are lost on daemon restart.
      </div>

    </div>
  );
}
