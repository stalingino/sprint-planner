import { db } from '../db';
import { jiraGet, jiraPut } from '../lib/jiraClient';
import { getTasksWithDates } from './tasks';

const FIELD_TARGETS = [
  { label: 'Development ETA', type: 'date' },
  { label: 'Dev Effort L0', type: 'number' },
  { label: 'Dev Effort L0', type: 'string' },
  { label: 'Dev Effort L1', type: 'number' },
  { label: 'Dev Effort L1', type: 'string' },
];

function getFieldMap(): Record<string, string> {
  const rows = db.query('SELECT label_type, field_id FROM field_map').all() as any[];
  return Object.fromEntries(rows.map((r: any) => [r.label_type, r.field_id]));
}

function extractFromIssue(issue: any, fm: Record<string, string>, existingEffortDays?: number): any {
  const f = issue.fields;
  const getField = (label: string, type: string) => {
    const fid = fm[`${label}__${type}`];
    if (!fid) return null;
    const val = f[fid];
    if (val === null || val === undefined) return null;
    if (type === 'number') return typeof val === 'number' ? val : parseFloat(val);
    if (type === 'date') return val;
    if (typeof val === 'object' && val.value) return val.value;
    return String(val);
  };

  const effortL0Num = getField('Dev Effort L0', 'number');
  return {
    summary: f.summary || issue.key,
    type: f.issuetype?.name || 'Task',
    priority: f.priority?.name || 'Medium',
    status: f.status?.name || 'To Do',
    assignee: f.assignee?.displayName || '',
    devEta: getField('Development ETA', 'date') || '',
    effortL0Num,
    effortL0Txt: getField('Dev Effort L0', 'string') || '',
    effortL1Num: getField('Dev Effort L1', 'number'),
    effortL1Txt: getField('Dev Effort L1', 'string') || '',
    effortDays: effortL0Num ?? existingEffortDays ?? 1,
    lastSynced: new Date().toISOString(),
  };
}

function buildPushPayload(task: any, fm: Record<string, string>): Record<string, any> {
  const payload: Record<string, any> = {};
  const setField = (label: string, type: string, value: any) => {
    const fid = fm[`${label}__${type}`];
    if (fid && value !== null && value !== undefined && value !== '') {
      if (type === 'number') payload[fid] = parseFloat(value);
      else if (type === 'date') payload[fid] = value;
      else payload[fid] = String(value);
    }
  };
  setField('Development ETA', 'date', task.dev_eta);
  setField('Dev Effort L0', 'number', task.effort_l0_num);
  setField('Dev Effort L0', 'string', task.effort_l0_txt);
  setField('Dev Effort L1', 'number', task.effort_l1_num);
  setField('Dev Effort L1', 'string', task.effort_l1_txt);
  return payload;
}

export async function handleJira(req: Request, url: URL, action?: string, key?: string): Promise<Response> {
  // GET-only actions
  if (action === 'search-users') {
    if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
    const q = url.searchParams.get('q') ?? '';
    if (!q.trim()) return Response.json([]);
    const results = await jiraGet(`/user/search?query=${encodeURIComponent(q)}&maxResults=10`);
    return Response.json(
      (results as any[]).map((u: any) => ({
        accountId: u.accountId,
        displayName: u.displayName,
        email: u.emailAddress ?? '',
        avatarUrl: u.avatarUrls?.['24x24'] ?? '',
      }))
    );
  }

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  switch (action) {
    case 'discover': {
      const fields = await jiraGet('/field');
      const map: Record<string, string> = {};
      for (const t of FIELD_TARGETS) {
        const match = fields.find((f: any) => {
          const nameMatch = f.name?.toLowerCase().includes(t.label.toLowerCase());
          if (!nameMatch) return false;
          if (t.type === 'date') return f.schema?.type === 'date' || f.schema?.type === 'datetime';
          if (t.type === 'number') return f.schema?.type === 'number';
          if (t.type === 'string') return f.schema?.type === 'string' || f.schema?.type === 'option';
          return true;
        });
        if (match) map[`${t.label}__${t.type}`] = match.id;
      }
      const stmt = db.prepare('INSERT OR REPLACE INTO field_map (label_type, field_id) VALUES (?, ?)');
      for (const [k, v] of Object.entries(map)) stmt.run(k, v);
      db.query("INSERT OR REPLACE INTO app_config (key, value) VALUES ('jira_connected', 'true')").run();
      return Response.json({ fieldMap: map, count: Object.keys(map).length });
    }

    case 'pull': {
      if (!key) return Response.json({ error: 'Missing issue key' }, { status: 400 });
      const issueKey = key.toUpperCase();
      const fm = getFieldMap();
      const issue = await jiraGet(`/issue/${issueKey}`);
      const existing = db.query('SELECT * FROM tasks WHERE jira_key=?').get(issueKey) as any;
      const data = extractFromIssue(issue, fm, existing?.effort_days);

      if (existing) {
        db.query(`
          UPDATE tasks SET summary=?, type=?, priority=?, status=?, assignee=?,
            dev_eta=?, effort_l0_num=?, effort_l0_txt=?, effort_l1_num=?, effort_l1_txt=?,
            effort_days=?, last_synced=?
          WHERE jira_key=?
        `).run(
          data.summary, data.type, data.priority, data.status, data.assignee,
          data.devEta || null, data.effortL0Num, data.effortL0Txt || null,
          data.effortL1Num, data.effortL1Txt || null, data.effortDays, data.lastSynced, issueKey
        );
      } else {
        const newId = `t${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const maxOrder = (db.query('SELECT MAX(sort_order) as m FROM tasks').get() as any)?.m ?? -1;
        const firstSprint = db.query('SELECT id FROM sprints ORDER BY sort_order LIMIT 1').get() as any;
        db.query(`
          INSERT INTO tasks (id, jira_key, summary, type, priority, status, assignee, sprint_id,
            dev_eta, effort_l0_num, effort_l0_txt, effort_l1_num, effort_l1_txt, effort_days, last_synced, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          newId, issueKey, data.summary, data.type, data.priority, data.status, data.assignee,
          firstSprint?.id ?? null, data.devEta || null, data.effortL0Num,
          data.effortL0Txt || null, data.effortL1Num, data.effortL1Txt || null,
          data.effortDays, data.lastSynced, maxOrder + 1
        );
      }
      return Response.json({ tasks: getTasksWithDates() });
    }

    case 'push': {
      const taskId = key;
      if (!taskId) return Response.json({ error: 'Missing task id' }, { status: 400 });
      const task = db.query('SELECT * FROM tasks WHERE id=?').get(taskId) as any;
      if (!task) return Response.json({ error: 'Task not found' }, { status: 404 });
      if (!task.jira_key) return Response.json({ error: 'Task has no Jira key' }, { status: 400 });

      const payload = buildPushPayload(task, getFieldMap());
      if (Object.keys(payload).length > 0) {
        await jiraPut(`/issue/${task.jira_key}`, { fields: payload });
      }
      const lastSynced = new Date().toISOString();
      db.query('UPDATE tasks SET last_synced=? WHERE id=?').run(lastSynced, taskId);
      return Response.json({ ok: true, lastSynced });
    }

    case 'pull-all': {
      const jiraTasks = db.query('SELECT id, jira_key FROM tasks WHERE jira_key IS NOT NULL AND jira_key != ""').all() as any[];
      const fm = getFieldMap();
      let count = 0;
      for (const t of jiraTasks) {
        try {
          const issue = await jiraGet(`/issue/${t.jira_key}`);
          const existing = db.query('SELECT * FROM tasks WHERE id=?').get(t.id) as any;
          const data = extractFromIssue(issue, fm, existing?.effort_days);
          db.query(`
            UPDATE tasks SET summary=?, type=?, priority=?, status=?, assignee=?,
              dev_eta=?, effort_l0_num=?, effort_l0_txt=?, effort_l1_num=?, effort_l1_txt=?,
              effort_days=?, last_synced=?
            WHERE id=?
          `).run(
            data.summary, data.type, data.priority, data.status, data.assignee,
            data.devEta || null, data.effortL0Num, data.effortL0Txt || null,
            data.effortL1Num, data.effortL1Txt || null, data.effortDays, data.lastSynced, t.id
          );
          count++;
        } catch { /* skip failed pulls */ }
      }
      return Response.json({ count, tasks: getTasksWithDates() });
    }

    case 'push-all': {
      const jiraTasks = db.query('SELECT * FROM tasks WHERE jira_key IS NOT NULL AND jira_key != ""').all() as any[];
      const fm = getFieldMap();
      let count = 0;
      for (const task of jiraTasks) {
        try {
          const payload = buildPushPayload(task, fm);
          if (Object.keys(payload).length > 0) {
            await jiraPut(`/issue/${task.jira_key}`, { fields: payload });
          }
          db.query('UPDATE tasks SET last_synced=? WHERE id=?').run(new Date().toISOString(), task.id);
          count++;
        } catch { /* skip failed pushes */ }
      }
      return Response.json({ count, tasks: getTasksWithDates() });
    }

    default: return Response.json({ error: 'Unknown action' }, { status: 404 });
  }
}
