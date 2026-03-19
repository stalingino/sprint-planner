import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_KEY = "sprint-planner-state";

// ─── Jira API helpers ───
async function jiraFetch(baseUrl, email, token, path, method = "GET", body = null) {
  const url = `https://corsproxy.io/?${encodeURIComponent(`${baseUrl}/rest/api/3${path}`)}`;
  const headers = {
    Authorization: "Basic " + btoa(`${email}:${token}`),
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira ${method} ${path}: ${res.status} — ${text}`);
  }
  if (method === "PUT" || res.status === 204) return null;
  return res.json();
}

async function fetchIssue(cfg, issueKey) {
  return jiraFetch(cfg.baseUrl, cfg.email, cfg.token, `/issue/${issueKey}`);
}

async function updateIssueFields(cfg, issueKey, fieldsPayload) {
  return jiraFetch(cfg.baseUrl, cfg.email, cfg.token, `/issue/${issueKey}`, "PUT", { fields: fieldsPayload });
}

async function fetchCustomFields(cfg) {
  return jiraFetch(cfg.baseUrl, cfg.email, cfg.token, "/field");
}

// ─── Date helpers ───
function parseDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d) ? null : d;
}
function formatDate(d) {
  if (!d) return "";
  return d.toISOString().split("T")[0];
}
function formatDisplay(d) {
  if (!d) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
}
function isWeekend(d) {
  const day = d.getDay();
  return day === 0 || day === 6;
}
function isHoliday(d, holidays) {
  const ds = formatDate(d);
  return holidays.some((h) => h.date === ds);
}
function isWorkingDay(d, holidays) {
  return !isWeekend(d) && !isHoliday(d, holidays);
}
function addWorkingDays(start, days, holidays) {
  let d = new Date(start);
  let count = 0;
  while (count < days) {
    if (isWorkingDay(d, holidays)) count++;
    if (count < days) d.setDate(d.getDate() + 1);
  }
  return d;
}
function daysBetween(a, b) {
  return Math.round((b - a) / 86400000);
}
function eachDay(start, end) {
  const days = [];
  let d = new Date(start);
  while (d <= end) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

// ─── Default state ───
const defaultState = {
  jira: { baseUrl: "https://dvarasolutions.atlassian.net", email: "", token: "", connected: false },
  fieldMap: {},
  sprints: [
    { id: "s1", name: "Sprint 1", start: "2026-03-23", end: "2026-04-03", status: "Active" },
    { id: "s2", name: "Sprint 2", start: "2026-04-06", end: "2026-04-17", status: "Planned" },
  ],
  developers: ["Dev 1", "Dev 2", "Dev 3", "Dev 4", "Dev 5"],
  holidays: [
    { date: "2026-03-30", name: "Ram Navami" },
    { date: "2026-04-14", name: "Ambedkar Jayanti" },
    { date: "2026-04-18", name: "Good Friday" },
    { date: "2026-05-01", name: "May Day" },
  ],
  tasks: [],
};

// ─── Tiny ID generator ───
let _id = 0;
const uid = () => `t${Date.now()}_${++_id}`;

// ─── Persistence ───
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultState, ...JSON.parse(raw) };
  } catch {}
  return defaultState;
}

// ─── Styles ───
const C = {
  bg: "#0d1117", surface: "#161b22", surface2: "#1c2333", border: "#30363d",
  text: "#e6edf3", muted: "#7d8590", blue: "#4a9eff", green: "#3fb950",
  orange: "#d29922", red: "#f85149", purple: "#bc8cff", teal: "#39d2c0",
  pink: "#f778ba", input: "#0d1117",
};
const devColors = [C.blue, C.green, C.orange, C.purple, C.teal, C.pink, C.red, "#ffa657", "#79c0ff", "#7ee787"];

function StatusBadge({ status }) {
  const colors = {
    "To Do": C.muted, "In Progress": C.blue, "In Review": C.orange,
    Done: C.green, Blocked: C.red, "Carried Over": C.purple,
  };
  const color = colors[status] || C.muted;
  return (
    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: color + "22", color, fontWeight: 600, whiteSpace: "nowrap" }}>
      {status || "—"}
    </span>
  );
}

function PriorityDot({ priority }) {
  const colors = { Critical: C.red, High: C.orange, Medium: C.blue, Low: C.muted };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: colors[priority] || C.muted }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: colors[priority] || C.muted }} />
      {priority || "—"}
    </span>
  );
}

// ─── MAIN APP ───
export default function SprintPlanner() {
  const [state, setState] = useState(loadState);
  const [tab, setTab] = useState("tasks");
  const [syncing, setSyncing] = useState({});
  const [toast, setToast] = useState(null);
  const [fieldDefs, setFieldDefs] = useState(null);
  const [showConfig, setShowConfig] = useState(!state.jira.token);
  const [addingIssue, setAddingIssue] = useState("");
  const [fetchingIssue, setFetchingIssue] = useState(false);

  const save = useCallback((s) => {
    setState(s);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
  }, []);

  const notify = (msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ─── Jira field discovery ───
  async function discoverFields() {
    try {
      const fields = await fetchCustomFields(state.jira);
      setFieldDefs(fields);
      const map = {};
      const targets = [
        { label: "Development ETA", type: "date" },
        { label: "Dev Effort L0", type: "number" },
        { label: "Dev Effort L0", type: "string" },
        { label: "Dev Effort L1", type: "number" },
        { label: "Dev Effort L1", type: "string" },
      ];
      for (const t of targets) {
        const match = fields.find((f) => {
          const nameMatch = f.name && f.name.toLowerCase().includes(t.label.toLowerCase());
          if (!nameMatch) return false;
          if (t.type === "date") return f.schema?.type === "date" || f.schema?.type === "datetime";
          if (t.type === "number") return f.schema?.type === "number";
          if (t.type === "string") return f.schema?.type === "string" || f.schema?.type === "option";
          return true;
        });
        if (match) {
          const key = `${t.label}__${t.type}`;
          map[key] = match.id;
        }
      }
      save({ ...state, fieldMap: map, jira: { ...state.jira, connected: true } });
      notify(`Connected! Found ${Object.keys(map).length}/5 custom fields`, "success");
      return map;
    } catch (e) {
      notify(`Field discovery failed: ${e.message}`, "error");
      return null;
    }
  }

  // ─── Fetch issue from Jira ───
  async function pullIssue(issueKey) {
    setFetchingIssue(true);
    try {
      const issue = await fetchIssue(state.jira, issueKey);
      const fm = Object.keys(state.fieldMap).length ? state.fieldMap : await discoverFields();
      if (!fm) { setFetchingIssue(false); return; }

      const f = issue.fields;
      const getField = (label, type) => {
        const key = `${label}__${type}`;
        const fid = fm[key];
        if (!fid) return null;
        const val = f[fid];
        if (val === null || val === undefined) return null;
        if (type === "number") return typeof val === "number" ? val : parseFloat(val);
        if (type === "date") return val;
        if (typeof val === "object" && val.value) return val.value;
        return String(val);
      };

      const task = {
        id: uid(),
        jiraKey: issueKey.toUpperCase(),
        summary: f.summary || issueKey,
        type: f.issuetype?.name || "Task",
        priority: f.priority?.name || "Medium",
        status: f.status?.name || "To Do",
        assignee: f.assignee?.displayName || "",
        sprint: state.sprints[0]?.name || "",
        developer: "",
        devEta: getField("Development ETA", "date") || "",
        effortL0Num: getField("Dev Effort L0", "number"),
        effortL0Txt: getField("Dev Effort L0", "string") || "",
        effortL1Num: getField("Dev Effort L1", "number"),
        effortL1Txt: getField("Dev Effort L1", "string") || "",
        effortDays: getField("Dev Effort L0", "number") || 1,
        notes: "",
        startDate: null,
        endDate: null,
        lastSynced: new Date().toISOString(),
      };

      const exists = state.tasks.find((t) => t.jiraKey === task.jiraKey);
      let newTasks;
      if (exists) {
        newTasks = state.tasks.map((t) => (t.jiraKey === task.jiraKey ? { ...t, ...task, developer: t.developer, sprint: t.sprint, startDate: t.startDate } : t));
        notify(`${issueKey} refreshed from Jira`, "success");
      } else {
        newTasks = [...state.tasks, task];
        notify(`${issueKey} — "${task.summary}" added`, "success");
      }
      save({ ...state, tasks: newTasks, fieldMap: fm, jira: { ...state.jira, connected: true } });
    } catch (e) {
      notify(`Failed to fetch ${issueKey}: ${e.message}`, "error");
    }
    setFetchingIssue(false);
  }

  // ─── Push changes to Jira ───
  async function pushTask(task) {
    if (!task.jiraKey) return;
    setSyncing((s) => ({ ...s, [task.id]: true }));
    try {
      const fm = state.fieldMap;
      const payload = {};
      const setField = (label, type, value) => {
        const key = `${label}__${type}`;
        const fid = fm[key];
        if (fid && value !== null && value !== undefined && value !== "") {
          if (type === "number") payload[fid] = parseFloat(value);
          else if (type === "date") payload[fid] = value;
          else payload[fid] = String(value);
        }
      };
      setField("Development ETA", "date", task.devEta);
      setField("Dev Effort L0", "number", task.effortL0Num);
      setField("Dev Effort L0", "string", task.effortL0Txt);
      setField("Dev Effort L1", "number", task.effortL1Num);
      setField("Dev Effort L1", "string", task.effortL1Txt);

      if (Object.keys(payload).length) {
        await updateIssueFields(state.jira, task.jiraKey, payload);
        const newTasks = state.tasks.map((t) => (t.id === task.id ? { ...t, lastSynced: new Date().toISOString() } : t));
        save({ ...state, tasks: newTasks });
        notify(`${task.jiraKey} synced to Jira ✓`, "success");
      }
    } catch (e) {
      notify(`Sync failed for ${task.jiraKey}: ${e.message}`, "error");
    }
    setSyncing((s) => ({ ...s, [task.id]: false }));
  }

  // ─── Recalculate dates ───
  function recalcDates(tasks, sprints, holidays) {
    const sorted = [...tasks];
    const devEndDates = {};
    return sorted.map((t) => {
      if (!t.developer || !t.effortDays || !t.sprint) return t;
      const sprint = sprints.find((s) => s.name === t.sprint);
      if (!sprint) return t;
      const sprintStart = parseDate(sprint.start);
      const prevEnd = devEndDates[t.developer];
      let start = sprintStart;
      if (prevEnd && prevEnd >= sprintStart) {
        start = new Date(prevEnd);
        start.setDate(start.getDate() + 1);
        while (!isWorkingDay(start, holidays)) start.setDate(start.getDate() + 1);
      } else {
        while (!isWorkingDay(start, holidays)) start.setDate(start.getDate() + 1);
      }
      const end = addWorkingDays(start, t.effortDays, holidays);
      devEndDates[t.developer] = end;
      return { ...t, startDate: formatDate(start), endDate: formatDate(end) };
    });
  }

  const tasksWithDates = recalcDates(state.tasks, state.sprints, state.holidays);

  function updateTask(id, patch) {
    const newTasks = state.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t));
    save({ ...state, tasks: newTasks });
  }

  function removeTask(id) {
    save({ ...state, tasks: state.tasks.filter((t) => t.id !== id) });
  }

  function moveTask(id, dir) {
    const idx = state.tasks.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const ni = idx + dir;
    if (ni < 0 || ni >= state.tasks.length) return;
    const arr = [...state.tasks];
    [arr[idx], arr[ni]] = [arr[ni], arr[idx]];
    save({ ...state, tasks: arr });
  }

  // ─── Timeline computation ───
  const timelineStart = state.sprints.length
    ? new Date(Math.min(...state.sprints.map((s) => parseDate(s.start)?.getTime() || Infinity)))
    : new Date();
  const timelineEnd = state.sprints.length
    ? new Date(Math.max(...state.sprints.map((s) => parseDate(s.end)?.getTime() || 0)) + 14 * 86400000)
    : new Date(Date.now() + 30 * 86400000);
  const timelineDays = eachDay(timelineStart, timelineEnd);
  const today = new Date(); today.setHours(0, 0, 0, 0);

  // ─── RENDER ───
  const inputStyle = {
    background: C.input, border: `1px solid ${C.border}`, borderRadius: 5,
    color: C.text, padding: "6px 10px", fontSize: 13, outline: "none", width: "100%",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  };
  const btnStyle = (color = C.blue) => ({
    background: color + "22", border: `1px solid ${color}44`, borderRadius: 6,
    color, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: 600,
    fontFamily: "'JetBrains Mono', monospace", transition: "all .15s",
  });
  const tabStyle = (active) => ({
    padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", borderRadius: "8px 8px 0 0",
    background: active ? C.surface : "transparent", color: active ? C.text : C.muted,
    border: active ? `1px solid ${C.border}` : "1px solid transparent", borderBottom: "none",
    fontFamily: "'JetBrains Mono', monospace",
  });

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: "100vh", fontFamily: "'Inter', 'Segoe UI', sans-serif", fontSize: 13 }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 16, right: 16, zIndex: 999, padding: "10px 20px", borderRadius: 8,
          background: toast.type === "error" ? C.red + "22" : toast.type === "success" ? C.green + "22" : C.blue + "22",
          border: `1px solid ${toast.type === "error" ? C.red : toast.type === "success" ? C.green : C.blue}44`,
          color: toast.type === "error" ? C.red : toast.type === "success" ? C.green : C.blue,
          fontSize: 12, fontWeight: 600, maxWidth: 400, fontFamily: "'JetBrains Mono', monospace",
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: -1, fontFamily: "'JetBrains Mono', monospace", color: C.purple }}>
            ▸ Sprint Planner
          </span>
          <span style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Jira-synced</span>
          {state.jira.connected && (
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: C.green + "22", color: C.green, fontWeight: 700 }}>
              ● CONNECTED
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btnStyle(C.muted)} onClick={() => setShowConfig(!showConfig)}>
            {showConfig ? "✕ Close Config" : "⚙ Config"}
          </button>
          <button style={btnStyle(C.red)} onClick={() => { if (confirm("Reset all data?")) { save(defaultState); notify("Reset done"); } }}>
            Reset
          </button>
        </div>
      </div>

      {/* Config Panel */}
      {showConfig && (
        <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, maxWidth: 1200 }}>
            {/* Jira Connection */}
            <div>
              <h3 style={{ color: C.blue, fontSize: 13, marginBottom: 10, fontFamily: "'JetBrains Mono', monospace" }}>Jira Connection</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input style={inputStyle} placeholder="Base URL (e.g. https://yoursite.atlassian.net)" value={state.jira.baseUrl}
                  onChange={(e) => save({ ...state, jira: { ...state.jira, baseUrl: e.target.value } })} />
                <input style={inputStyle} placeholder="Email" value={state.jira.email}
                  onChange={(e) => save({ ...state, jira: { ...state.jira, email: e.target.value } })} />
                <input style={{ ...inputStyle }} type="password" placeholder="API Token" value={state.jira.token}
                  onChange={(e) => save({ ...state, jira: { ...state.jira, token: e.target.value } })} />
                <button style={btnStyle(C.green)} onClick={discoverFields}>
                  Connect & Discover Fields
                </button>
                {Object.keys(state.fieldMap).length > 0 && (
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                    Mapped fields: {Object.entries(state.fieldMap).map(([k, v]) => (
                      <span key={k} style={{ display: "inline-block", margin: "2px 4px", padding: "1px 6px", borderRadius: 3, background: C.purple + "18", color: C.purple, fontSize: 10 }}>
                        {k.replace("__", " → ")} = {v}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sprints */}
            <div>
              <h3 style={{ color: C.green, fontSize: 13, marginBottom: 10, fontFamily: "'JetBrains Mono', monospace" }}>Sprints</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 220, overflowY: "auto" }}>
                {state.sprints.map((sp, i) => (
                  <div key={sp.id} style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px 70px 24px", gap: 4, alignItems: "center" }}>
                    <input style={{ ...inputStyle, fontSize: 11, padding: "4px 6px" }} value={sp.name}
                      onChange={(e) => { const s = [...state.sprints]; s[i] = { ...sp, name: e.target.value }; save({ ...state, sprints: s }); }} />
                    <input style={{ ...inputStyle, fontSize: 11, padding: "4px 6px" }} type="date" value={sp.start}
                      onChange={(e) => { const s = [...state.sprints]; s[i] = { ...sp, start: e.target.value }; save({ ...state, sprints: s }); }} />
                    <input style={{ ...inputStyle, fontSize: 11, padding: "4px 6px" }} type="date" value={sp.end}
                      onChange={(e) => { const s = [...state.sprints]; s[i] = { ...sp, end: e.target.value }; save({ ...state, sprints: s }); }} />
                    <select style={{ ...inputStyle, fontSize: 10, padding: "3px 4px" }} value={sp.status}
                      onChange={(e) => { const s = [...state.sprints]; s[i] = { ...sp, status: e.target.value }; save({ ...state, sprints: s }); }}>
                      <option>Active</option><option>Planned</option><option>Completed</option>
                    </select>
                    <button style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 14 }}
                      onClick={() => save({ ...state, sprints: state.sprints.filter((_, j) => j !== i) })}>×</button>
                  </div>
                ))}
                <button style={{ ...btnStyle(C.green), padding: "4px 10px", fontSize: 11 }}
                  onClick={() => save({ ...state, sprints: [...state.sprints, { id: `s${Date.now()}`, name: `Sprint ${state.sprints.length + 1}`, start: "", end: "", status: "Planned" }] })}>
                  + Add Sprint
                </button>
              </div>
            </div>

            {/* Devs + Holidays */}
            <div>
              <h3 style={{ color: C.teal, fontSize: 13, marginBottom: 10, fontFamily: "'JetBrains Mono', monospace" }}>Developers</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
                {state.developers.map((d, i) => (
                  <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 4, background: devColors[i % devColors.length] + "22", color: devColors[i % devColors.length], fontSize: 11, fontWeight: 600 }}>
                    {d}
                    <span style={{ cursor: "pointer", opacity: 0.6 }} onClick={() => save({ ...state, developers: state.developers.filter((_, j) => j !== i) })}>×</span>
                  </span>
                ))}
                <input style={{ ...inputStyle, width: 100, fontSize: 11, padding: "3px 6px" }} placeholder="+ Add dev"
                  onKeyDown={(e) => { if (e.key === "Enter" && e.target.value.trim()) { save({ ...state, developers: [...state.developers, e.target.value.trim()] }); e.target.value = ""; } }} />
              </div>

              <h3 style={{ color: C.orange, fontSize: 13, marginBottom: 8, fontFamily: "'JetBrains Mono', monospace" }}>Holidays</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 120, overflowY: "auto" }}>
                {state.holidays.map((h, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "110px 1fr 20px", gap: 4, alignItems: "center" }}>
                    <input style={{ ...inputStyle, fontSize: 10, padding: "3px 5px" }} type="date" value={h.date}
                      onChange={(e) => { const hs = [...state.holidays]; hs[i] = { ...h, date: e.target.value }; save({ ...state, holidays: hs }); }} />
                    <input style={{ ...inputStyle, fontSize: 10, padding: "3px 5px" }} value={h.name}
                      onChange={(e) => { const hs = [...state.holidays]; hs[i] = { ...h, name: e.target.value }; save({ ...state, holidays: hs }); }} />
                    <button style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 12 }}
                      onClick={() => save({ ...state, holidays: state.holidays.filter((_, j) => j !== i) })}>×</button>
                  </div>
                ))}
                <button style={{ ...btnStyle(C.orange), padding: "3px 8px", fontSize: 10 }}
                  onClick={() => save({ ...state, holidays: [...state.holidays, { date: "", name: "" }] })}>
                  + Add Holiday
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Issue Adder Bar */}
      <div style={{ padding: "12px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12, background: C.surface2 }}>
        <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>Add Jira Issue:</span>
        <input
          style={{ ...inputStyle, width: 160, fontSize: 13, fontWeight: 700 }}
          placeholder="e.g. PKIS-123"
          value={addingIssue}
          onChange={(e) => setAddingIssue(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter" && addingIssue.trim()) {
              pullIssue(addingIssue.trim());
              setAddingIssue("");
            }
          }}
        />
        <button style={btnStyle(C.green)} disabled={fetchingIssue || !addingIssue.trim()}
          onClick={() => { pullIssue(addingIssue.trim()); setAddingIssue(""); }}>
          {fetchingIssue ? "Fetching…" : "↓ Pull from Jira"}
        </button>
        <span style={{ fontSize: 10, color: C.muted }}>or</span>
        <button style={btnStyle(C.muted)} onClick={() => {
          save({ ...state, tasks: [...state.tasks, {
            id: uid(), jiraKey: "", summary: "New Task", type: "Task", priority: "Medium", status: "To Do",
            assignee: "", sprint: state.sprints[0]?.name || "", developer: "", devEta: "",
            effortL0Num: null, effortL0Txt: "", effortL1Num: null, effortL1Txt: "",
            effortDays: 1, notes: "", startDate: null, endDate: null, lastSynced: null,
          }] });
        }}>
          + Manual Task
        </button>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <button style={btnStyle(C.blue)} onClick={async () => {
            const jiraTasks = state.tasks.filter(t => t.jiraKey);
            for (const t of jiraTasks) await pullIssue(t.jiraKey);
            notify(`Refreshed ${jiraTasks.length} issues from Jira`, "success");
          }}>
            ↓ Pull All
          </button>
          <button style={btnStyle(C.orange)} onClick={async () => {
            const jiraTasks = tasksWithDates.filter(t => t.jiraKey);
            for (const t of jiraTasks) await pushTask(t);
            notify(`Pushed ${jiraTasks.length} issues to Jira`, "success");
          }}>
            ↑ Push All
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, padding: "0 24px", paddingTop: 12 }}>
        {[["tasks", "📋 Tasks"], ["timeline", "📊 Timeline"], ["workload", "👥 Workload"]].map(([key, label]) => (
          <button key={key} style={tabStyle(tab === key)} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0 8px 8px 8px", margin: "0 24px 24px", padding: 0, minHeight: 400 }}>
        {tab === "tasks" && <TasksTable tasks={tasksWithDates} state={state} updateTask={updateTask} removeTask={removeTask} moveTask={moveTask} pushTask={pushTask} syncing={syncing} devColors={devColors} pullIssue={pullIssue} />}
        {tab === "timeline" && <TimelineView tasks={tasksWithDates} sprints={state.sprints} holidays={state.holidays} timelineDays={timelineDays} today={today} devColors={devColors} developers={state.developers} />}
        {tab === "workload" && <WorkloadView tasks={tasksWithDates} sprints={state.sprints} developers={state.developers} holidays={state.holidays} devColors={devColors} />}
      </div>
    </div>
  );
}

// ─── TASKS TABLE ───
function TasksTable({ tasks, state, updateTask, removeTask, moveTask, pushTask, syncing, devColors, pullIssue }) {
  const [expanded, setExpanded] = useState({});
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: C.surface2 }}>
            {["", "Key", "Task", "Type", "Priority", "Sprint", "Developer", "Effort", "Status", "Start", "End", "Spill?", "Jira Sync", ""].map((h, i) => (
              <th key={i} style={{ padding: "10px 8px", color: C.muted, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, textAlign: "left", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.map((t, idx) => {
            const sprintObj = state.sprints.find((s) => s.name === t.sprint);
            const spill = t.endDate && sprintObj && t.endDate > sprintObj.end;
            const isExpanded = expanded[t.id];
            return [
              <tr key={t.id} style={{ background: idx % 2 ? C.surface2 : C.surface, borderBottom: `1px solid ${C.border}22` }}>
                {/* Reorder */}
                <td style={{ padding: "6px 4px", textAlign: "center", width: 40 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    <button style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 10, lineHeight: 1 }} onClick={() => moveTask(t.id, -1)}>▲</button>
                    <button style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 10, lineHeight: 1 }} onClick={() => moveTask(t.id, 1)}>▼</button>
                  </div>
                </td>
                {/* Key */}
                <td style={{ padding: "6px 8px", fontWeight: 700, color: C.blue, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, whiteSpace: "nowrap" }}>
                  {t.jiraKey || <span style={{ color: C.muted, fontStyle: "italic" }}>local</span>}
                </td>
                {/* Summary */}
                <td style={{ padding: "6px 8px", maxWidth: 240 }}>
                  <input style={{ background: "transparent", border: "none", color: C.text, fontSize: 12, width: "100%", outline: "none", fontWeight: 500 }}
                    value={t.summary} onChange={(e) => updateTask(t.id, { summary: e.target.value })} />
                </td>
                {/* Type */}
                <td style={{ padding: "6px 8px", fontSize: 11, color: C.muted }}>{t.type}</td>
                {/* Priority */}
                <td style={{ padding: "6px 6px" }}><PriorityDot priority={t.priority} /></td>
                {/* Sprint */}
                <td style={{ padding: "6px 6px" }}>
                  <select style={{ background: C.input, border: `1px solid ${C.border}`, color: C.purple, fontSize: 11, borderRadius: 4, padding: "3px 4px", fontWeight: 600 }}
                    value={t.sprint} onChange={(e) => updateTask(t.id, { sprint: e.target.value })}>
                    <option value="">—</option>
                    {state.sprints.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </td>
                {/* Developer */}
                <td style={{ padding: "6px 6px" }}>
                  <select style={{ background: C.input, border: `1px solid ${C.border}`, color: C.teal, fontSize: 11, borderRadius: 4, padding: "3px 4px", fontWeight: 600 }}
                    value={t.developer} onChange={(e) => updateTask(t.id, { developer: e.target.value })}>
                    <option value="">—</option>
                    {state.developers.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </td>
                {/* Effort */}
                <td style={{ padding: "6px 6px", textAlign: "center" }}>
                  <input type="number" min="0.5" step="0.5" style={{ background: C.input, border: `1px solid ${C.border}`, color: C.orange, fontSize: 12, width: 48, textAlign: "center", borderRadius: 4, padding: "3px 4px", fontWeight: 700 }}
                    value={t.effortDays || ""} onChange={(e) => updateTask(t.id, { effortDays: parseFloat(e.target.value) || 0 })} />
                </td>
                {/* Status */}
                <td style={{ padding: "6px 6px" }}><StatusBadge status={t.status} /></td>
                {/* Start */}
                <td style={{ padding: "6px 6px", fontSize: 11, color: C.green, fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap" }}>
                  {formatDisplay(parseDate(t.startDate))}
                </td>
                {/* End */}
                <td style={{ padding: "6px 6px", fontSize: 11, color: C.orange, fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap" }}>
                  {formatDisplay(parseDate(t.endDate))}
                </td>
                {/* Spill */}
                <td style={{ padding: "6px 6px", textAlign: "center" }}>
                  {spill ? <span style={{ color: C.red, fontWeight: 700, fontSize: 11 }}>⚠</span> : t.endDate ? <span style={{ color: C.green, fontSize: 11 }}>✓</span> : ""}
                </td>
                {/* Sync */}
                <td style={{ padding: "6px 6px" }}>
                  {t.jiraKey && (
                    <div style={{ display: "flex", gap: 3 }}>
                      <button title="Pull from Jira" style={{ ...btnPill(C.blue), opacity: syncing[t.id] ? 0.5 : 1 }} onClick={() => pullIssue(t.jiraKey)}>↓</button>
                      <button title="Push to Jira" style={{ ...btnPill(C.orange), opacity: syncing[t.id] ? 0.5 : 1 }} onClick={() => pushTask(t)}>↑</button>
                    </div>
                  )}
                </td>
                {/* Expand / Delete */}
                <td style={{ padding: "6px 6px", display: "flex", gap: 3 }}>
                  <button style={btnPill(C.purple)} onClick={() => setExpanded({ ...expanded, [t.id]: !isExpanded })}>
                    {isExpanded ? "▾" : "▸"}
                  </button>
                  <button style={btnPill(C.red)} onClick={() => removeTask(t.id)}>×</button>
                </td>
              </tr>,
              isExpanded && (
                <tr key={t.id + "_exp"} style={{ background: C.surface2 }}>
                  <td colSpan={14} style={{ padding: "12px 20px 16px 60px", borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, maxWidth: 700 }}>
                      <Field label="Dev ETA (Date)" value={t.devEta} type="date" onChange={(v) => updateTask(t.id, { devEta: v })} />
                      <Field label="Dev Effort L0 (Number)" value={t.effortL0Num} type="number" onChange={(v) => updateTask(t.id, { effortL0Num: v ? parseFloat(v) : null })} />
                      <Field label="Dev Effort L0 (Text)" value={t.effortL0Txt} onChange={(v) => updateTask(t.id, { effortL0Txt: v })} />
                      <Field label="Dev Effort L1 (Number)" value={t.effortL1Num} type="number" onChange={(v) => updateTask(t.id, { effortL1Num: v ? parseFloat(v) : null })} />
                      <Field label="Dev Effort L1 (Text)" value={t.effortL1Txt} onChange={(v) => updateTask(t.id, { effortL1Txt: v })} />
                      <Field label="Assignee (Jira)" value={t.assignee || "—"} readOnly />
                      <div style={{ gridColumn: "1 / -1" }}>
                        <Field label="Notes" value={t.notes} onChange={(v) => updateTask(t.id, { notes: v })} />
                      </div>
                    </div>
                    {t.lastSynced && (
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 8 }}>
                        Last synced: {new Date(t.lastSynced).toLocaleString()}
                      </div>
                    )}
                  </td>
                </tr>
              ),
            ];
          })}
          {tasks.length === 0 && (
            <tr>
              <td colSpan={14} style={{ padding: 40, textAlign: "center", color: C.muted }}>
                No tasks yet. Enter a Jira issue key above or add a manual task.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function btnPill(color) {
  return {
    background: color + "22", border: `1px solid ${color}33`, borderRadius: 4,
    color, width: 24, height: 22, cursor: "pointer", fontSize: 11, fontWeight: 700,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
  };
}

function Field({ label, value, onChange, type = "text", readOnly = false }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: C.muted, marginBottom: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <input
        type={type}
        readOnly={readOnly}
        style={{
          background: readOnly ? C.surface2 : C.input, border: `1px solid ${C.border}`, borderRadius: 4,
          color: C.text, padding: "5px 8px", fontSize: 12, width: "100%", outline: "none",
          fontFamily: "'JetBrains Mono', monospace", opacity: readOnly ? 0.6 : 1,
        }}
        value={value ?? ""}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      />
    </div>
  );
}

// ─── TIMELINE VIEW ───
function TimelineView({ tasks, sprints, holidays, timelineDays, today, devColors, developers }) {
  const scrollRef = useRef(null);
  const cellW = 28;
  const rowH = 28;
  const labelW = 320;
  const activeTasks = tasks.filter((t) => t.startDate && t.endDate && t.developer);

  useEffect(() => {
    if (scrollRef.current) {
      const todayIdx = timelineDays.findIndex((d) => formatDate(d) === formatDate(today));
      if (todayIdx > 5) scrollRef.current.scrollLeft = (todayIdx - 5) * cellW;
    }
  }, []);

  // Group sprints by date range for the band
  const sprintBand = timelineDays.map((d) => {
    const ds = formatDate(d);
    return sprints.find((s) => ds >= s.start && ds <= s.end)?.name || "";
  });

  return (
    <div style={{ display: "flex", overflow: "hidden" }}>
      {/* Fixed left: task labels */}
      <div style={{ minWidth: labelW, maxWidth: labelW, borderRight: `1px solid ${C.border}`, background: C.surface }}>
        <div style={{ height: rowH * 2, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "flex-end", padding: "0 12px 6px", fontWeight: 700, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>
          <span style={{ flex: 1 }}>Task</span>
          <span style={{ width: 80, textAlign: "center" }}>Developer</span>
          <span style={{ width: 40, textAlign: "center" }}>Days</span>
        </div>
        {activeTasks.map((t, i) => {
          const devIdx = developers.indexOf(t.developer);
          const color = devColors[devIdx >= 0 ? devIdx % devColors.length : 0];
          return (
            <div key={t.id} style={{
              height: rowH, display: "flex", alignItems: "center", padding: "0 12px", borderBottom: `1px solid ${C.border}11`,
              background: i % 2 ? C.surface2 : C.surface, gap: 6,
            }}>
              {t.jiraKey && <span style={{ fontSize: 9, color: C.blue, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, minWidth: 60 }}>{t.jiraKey}</span>}
              <span style={{ flex: 1, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.summary}</span>
              <span style={{ width: 80, fontSize: 10, color, fontWeight: 600, textAlign: "center" }}>{t.developer}</span>
              <span style={{ width: 40, fontSize: 10, color: C.orange, textAlign: "center", fontWeight: 700 }}>{t.effortDays}</span>
            </div>
          );
        })}
      </div>

      {/* Scrollable right: Gantt grid */}
      <div ref={scrollRef} style={{ flex: 1, overflowX: "auto", overflowY: "hidden" }}>
        <div style={{ minWidth: timelineDays.length * cellW }}>
          {/* Sprint band + date headers */}
          <div style={{ display: "flex", height: rowH, borderBottom: `1px solid ${C.border}33` }}>
            {timelineDays.map((d, di) => {
              const sName = sprintBand[di];
              const prevName = di > 0 ? sprintBand[di - 1] : "";
              const showLabel = sName && sName !== prevName;
              return (
                <div key={di} style={{ width: cellW, minWidth: cellW, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: sName ? C.purple : C.muted, background: sName ? C.purple + "0a" : "transparent", borderLeft: showLabel ? `2px solid ${C.purple}55` : "none", position: "relative" }}>
                  {showLabel && <span style={{ position: "absolute", left: 4, fontSize: 9, whiteSpace: "nowrap", color: C.purple, fontFamily: "'JetBrains Mono', monospace" }}>{sName}</span>}
                </div>
              );
            })}
          </div>
          {/* Day numbers */}
          <div style={{ display: "flex", height: rowH, borderBottom: `1px solid ${C.border}` }}>
            {timelineDays.map((d, di) => {
              const wknd = isWeekend(d);
              const hol = isHoliday(d, holidays);
              const isToday = formatDate(d) === formatDate(today);
              const isFirst = d.getDate() === 1;
              return (
                <div key={di} style={{
                  width: cellW, minWidth: cellW, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  background: isToday ? C.green + "22" : hol ? C.red + "0c" : wknd ? C.surface2 : "transparent",
                  borderLeft: isFirst ? `1px solid ${C.blue}44` : "none",
                  position: "relative",
                }}>
                  {isFirst && <span style={{ fontSize: 7, color: C.blue, fontWeight: 700, position: "absolute", top: 1 }}>{d.toLocaleDateString("en", { month: "short" })}</span>}
                  <span style={{ fontSize: 10, fontWeight: isToday ? 800 : 600, color: isToday ? C.green : wknd ? C.red + "99" : hol ? C.red : C.muted, fontFamily: "'JetBrains Mono', monospace", marginTop: isFirst ? 6 : 0 }}>
                    {d.getDate()}
                  </span>
                  <span style={{ fontSize: 7, color: C.muted + "88" }}>{["Su","Mo","Tu","We","Th","Fr","Sa"][d.getDay()]}</span>
                </div>
              );
            })}
          </div>
          {/* Gantt bars */}
          {activeTasks.map((t, i) => {
            const devIdx = developers.indexOf(t.developer);
            const color = devColors[devIdx >= 0 ? devIdx % devColors.length : 0];
            const start = parseDate(t.startDate);
            const end = parseDate(t.endDate);
            return (
              <div key={t.id} style={{ display: "flex", height: rowH, borderBottom: `1px solid ${C.border}08`, background: i % 2 ? C.surface2 + "88" : "transparent" }}>
                {timelineDays.map((d, di) => {
                  const ds = formatDate(d);
                  const inRange = start && end && d >= start && d <= end;
                  const wknd = isWeekend(d);
                  const hol = isHoliday(d, holidays);
                  const isToday = ds === formatDate(today);
                  const isWork = inRange && !wknd && !hol;
                  const isNonWork = inRange && (wknd || hol);
                  return (
                    <div key={di} style={{
                      width: cellW, minWidth: cellW, display: "flex", alignItems: "center", justifyContent: "center",
                      background: isWork ? color + "33" : isNonWork ? C.surface2 : isToday ? C.green + "08" : wknd || hol ? "#0a0a12" : "transparent",
                      borderLeft: isWork && ds === t.startDate ? `2px solid ${color}` : "none",
                      borderRight: isWork && ds === t.endDate ? `2px solid ${color}` : "none",
                    }}>
                      {isWork && <div style={{ width: "100%", height: 14, background: color + "66", borderRadius: ds === t.startDate ? "3px 0 0 3px" : ds === t.endDate ? "0 3px 3px 0" : 0 }} />}
                      {isNonWork && <span style={{ fontSize: 8, color: C.muted + "66" }}>·</span>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── WORKLOAD VIEW ───
function WorkloadView({ tasks, sprints, developers, holidays, devColors }) {
  const [selSprint, setSelSprint] = useState(sprints[0]?.name || "");
  const sprint = sprints.find((s) => s.name === selSprint);
  const sprintTasks = tasks.filter((t) => t.sprint === selSprint);

  const workingDays = sprint ? (() => {
    const start = parseDate(sprint.start);
    const end = parseDate(sprint.end);
    if (!start || !end) return 0;
    let count = 0;
    const d = new Date(start);
    while (d <= end) {
      if (isWorkingDay(d, holidays)) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  })() : 0;

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>Sprint:</span>
        <select style={{ background: C.input, border: `1px solid ${C.border}`, color: C.purple, fontSize: 13, borderRadius: 6, padding: "6px 12px", fontWeight: 700 }}
          value={selSprint} onChange={(e) => setSelSprint(e.target.value)}>
          {sprints.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
        {sprint && (
          <span style={{ fontSize: 11, color: C.muted }}>
            {formatDisplay(parseDate(sprint.start))} → {formatDisplay(parseDate(sprint.end))} · <span style={{ color: C.green, fontWeight: 700 }}>{workingDays} working days</span>
          </span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        {developers.map((dev, di) => {
          const devTasks = sprintTasks.filter((t) => t.developer === dev);
          const totalEffort = devTasks.reduce((s, t) => s + (t.effortDays || 0), 0);
          const done = devTasks.filter((t) => t.status === "Done").length;
          const util = workingDays > 0 ? totalEffort / workingDays : 0;
          const color = devColors[di % devColors.length];
          const overloaded = util > 1;

          return (
            <div key={dev} style={{
              background: C.surface2, borderRadius: 8, padding: 16, border: `1px solid ${overloaded ? C.red + "44" : C.border}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color }}>{dev}</span>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                  background: overloaded ? C.red + "22" : util > 0.8 ? C.orange + "22" : C.green + "22",
                  color: overloaded ? C.red : util > 0.8 ? C.orange : C.green,
                }}>
                  {Math.round(util * 100)}%
                </span>
              </div>
              {/* Utilization bar */}
              <div style={{ height: 6, borderRadius: 3, background: C.border, marginBottom: 10, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 3, width: `${Math.min(100, util * 100)}%`, background: overloaded ? C.red : util > 0.8 ? C.orange : color, transition: "width .3s" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 11 }}>
                <div style={{ color: C.muted }}>Tasks: <span style={{ color: C.text, fontWeight: 600 }}>{devTasks.length}</span></div>
                <div style={{ color: C.muted }}>Effort: <span style={{ color: C.orange, fontWeight: 600 }}>{totalEffort}d</span></div>
                <div style={{ color: C.muted }}>Done: <span style={{ color: C.green, fontWeight: 600 }}>{done}</span></div>
                <div style={{ color: C.muted }}>Left: <span style={{ color: C.teal, fontWeight: 600 }}>{Math.max(0, workingDays - totalEffort)}d</span></div>
              </div>
              {devTasks.length > 0 && (
                <div style={{ marginTop: 10, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                  {devTasks.map((t) => (
                    <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0", fontSize: 10 }}>
                      <StatusBadge status={t.status} />
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.summary}</span>
                      <span style={{ color: C.orange, fontWeight: 700 }}>{t.effortDays}d</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
