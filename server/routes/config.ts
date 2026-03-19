import { db } from '../db';
import { isConfigured } from '../lib/jiraClient';

function getConfig() {
  const fieldMapRows = db.query('SELECT label_type, field_id FROM field_map').all() as any[];
  const fieldMap = Object.fromEntries(fieldMapRows.map((r: any) => [r.label_type, r.field_id]));
  const jiraConnectedDb = (db.query("SELECT value FROM app_config WHERE key='jira_connected'").get() as any)?.value === 'true';
  const sprintPrefix = (db.query("SELECT value FROM app_config WHERE key='sprint_prefix'").get() as any)?.value ?? 'Sprint';
  return {
    jiraConnected: jiraConnectedDb && isConfigured(),
    fieldMap,
    jiraBaseUrl: process.env.JIRA_BASE_URL ?? '',
    sprintPrefix,
  };
}

export function handleConfig(req: Request): Response | Promise<Response> {
  if (req.method === 'GET') {
    return Response.json(getConfig());
  }

  if (req.method === 'PATCH') {
    return (async () => {
      const body = await req.json() as any;
      if (body.sprintPrefix !== undefined) {
        db.query("INSERT OR REPLACE INTO app_config (key, value) VALUES ('sprint_prefix', ?)").run(String(body.sprintPrefix));
      }
      return Response.json(getConfig());
    })();
  }

  return new Response('Method not allowed', { status: 405 });
}

export async function handleImport(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const data = await req.json() as any;
  const sprintIdMap: Record<string, string> = {};
  const devIdMap: Record<string, number> = {};

  if (Array.isArray(data.sprints)) {
    for (let i = 0; i < data.sprints.length; i++) {
      const sp = data.sprints[i];
      const id = sp.id || `s${Date.now()}_${i}`;
      try {
        db.query('INSERT OR IGNORE INTO sprints (id, name, start_date, end_date, status, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
          .run(id, sp.name, sp.start ?? '', sp.end ?? '', sp.status ?? 'Planned', i);
        sprintIdMap[sp.name] = id;
      } catch { /* skip */ }
    }
  }

  if (Array.isArray(data.developers)) {
    for (let i = 0; i < data.developers.length; i++) {
      const name = data.developers[i];
      try {
        db.query('INSERT OR IGNORE INTO developers (name, sort_order) VALUES (?, ?)').run(name, i);
        const row = db.query('SELECT id FROM developers WHERE name=?').get(name) as any;
        if (row) devIdMap[name] = row.id;
      } catch { /* skip */ }
    }
  }

  if (Array.isArray(data.holidays)) {
    for (const h of data.holidays) {
      try {
        db.query('INSERT OR IGNORE INTO holidays (date, name) VALUES (?, ?)').run(h.date, h.name);
      } catch { /* skip */ }
    }
  }

  if (data.fieldMap && typeof data.fieldMap === 'object') {
    for (const [k, v] of Object.entries(data.fieldMap)) {
      db.query('INSERT OR REPLACE INTO field_map (label_type, field_id) VALUES (?, ?)').run(k, v as string);
    }
  }

  let taskCount = 0;
  if (Array.isArray(data.tasks)) {
    for (let i = 0; i < data.tasks.length; i++) {
      const t = data.tasks[i];
      const sprintId = t.sprint ? sprintIdMap[t.sprint] ?? null : null;
      const devId = t.developer ? devIdMap[t.developer] ?? null : null;
      try {
        db.query(`
          INSERT OR IGNORE INTO tasks (id, jira_key, summary, type, priority, status, assignee, sprint_id, developer_id,
            effort_days, dev_eta, effort_l0_num, effort_l0_txt, effort_l1_num, effort_l1_txt, notes, last_synced, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          t.id, t.jiraKey ?? null, t.summary ?? '', t.type ?? 'Task', t.priority ?? 'Medium',
          t.status ?? 'To Do', t.assignee ?? null, sprintId, devId,
          t.effortDays ?? 1, t.devEta || null, t.effortL0Num ?? null, t.effortL0Txt || null,
          t.effortL1Num ?? null, t.effortL1Txt || null, t.notes || null, t.lastSynced || null, i
        );
        taskCount++;
      } catch { /* skip */ }
    }
  }

  return Response.json({
    imported: {
      sprints: Object.keys(sprintIdMap).length,
      developers: Object.keys(devIdMap).length,
      tasks: taskCount,
    },
  });
}
