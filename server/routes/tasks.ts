import { db } from '../db';
import { recalcDates } from '../lib/dateUtils';
import { jiraPut, isConfigured as jiraConfigured } from '../lib/jiraClient';

function uid(): string {
  return `t${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

function mapTask(row: any): object {
  return {
    id: row.id,
    jiraKey: row.jira_key ?? '',
    summary: row.summary ?? '',
    type: row.type ?? 'Task',
    priority: row.priority ?? 'Medium',
    status: row.status ?? 'To Do',
    assignee: row.assignee ?? '',
    sprint: row.sprint_name ?? '',
    developer: row.developer_name ?? '',
    effortDays: row.effort_days ?? 1,
    devEta: row.dev_eta ?? '',
    effortL0Num: row.effort_l0_num ?? null,
    effortL0Txt: row.effort_l0_txt ?? '',
    effortL1Num: row.effort_l1_num ?? null,
    effortL1Txt: row.effort_l1_txt ?? '',
    notes: row.notes ?? '',
    lastSynced: row.last_synced ?? null,
  };
}

export function getTasksWithDates(): any[] {
  const rows = db.query(`
    SELECT t.*, s.name as sprint_name, d.name as developer_name
    FROM tasks t
    LEFT JOIN sprints s ON t.sprint_id = s.id
    LEFT JOIN developers d ON t.developer_id = d.id
    ORDER BY t.sort_order, t.id
  `).all();

  const sprints = db.query('SELECT id, name, start_date as start, end_date as end, status FROM sprints').all() as any[];
  const holidays = db.query('SELECT date, name FROM holidays').all() as any[];

  const tasks = rows.map(mapTask) as any[];
  return recalcDates(tasks, sprints, holidays);
}

function lookupSprintId(name: string | undefined | null): string | null {
  if (!name) return null;
  return (db.query('SELECT id FROM sprints WHERE name=?').get(name) as any)?.id ?? null;
}

function lookupDevId(name: string | undefined | null): number | null {
  if (!name) return null;
  return (db.query('SELECT id FROM developers WHERE name=?').get(name) as any)?.id ?? null;
}

export function handleTasks(req: Request, id?: string): Response | Promise<Response> {
  // POST /api/tasks/reorder
  if (req.method === 'POST' && id === 'reorder') {
    return (async () => {
      const body = await req.json() as any;
      const tasks = db.query('SELECT id, sort_order FROM tasks ORDER BY sort_order, id').all() as any[];
      const idx = tasks.findIndex((t: any) => t.id === body.id);
      const ni = idx + body.direction;
      if (idx >= 0 && ni >= 0 && ni < tasks.length) {
        const stmt = db.prepare('UPDATE tasks SET sort_order=? WHERE id=?');
        const newOrder = [...tasks];
        [newOrder[idx], newOrder[ni]] = [newOrder[ni], newOrder[idx]];
        for (let i = 0; i < newOrder.length; i++) stmt.run(i, newOrder[i].id);
      }
      return Response.json(getTasksWithDates());
    })();
  }

  switch (req.method) {
    case 'GET': {
      return Response.json(getTasksWithDates());
    }

    case 'POST': return (async () => {
      const body = await req.json() as any;
      const newId = uid();
      const sprintId = lookupSprintId(body.sprint);
      const devId = lookupDevId(body.developer);
      const maxOrder = (db.query('SELECT MAX(sort_order) as m FROM tasks').get() as any)?.m ?? -1;

      db.query(`
        INSERT INTO tasks (id, jira_key, summary, type, priority, status, assignee, sprint_id, developer_id,
          effort_days, dev_eta, effort_l0_num, effort_l0_txt, effort_l1_num, effort_l1_txt, notes, last_synced, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        newId, body.jiraKey ?? null, body.summary ?? 'New Task',
        body.type ?? 'Task', body.priority ?? 'Medium', body.status ?? 'To Do',
        body.assignee ?? null, sprintId, devId,
        body.effortDays ?? 1, body.devEta || null,
        body.effortL0Num ?? null, body.effortL0Txt || null,
        body.effortL1Num ?? null, body.effortL1Txt || null,
        body.notes || null, body.lastSynced ?? null, maxOrder + 1
      );

      const all = getTasksWithDates();
      return Response.json(all.find((t: any) => t.id === newId) ?? null);
    })();

    case 'PATCH': return (async () => {
      if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });
      const body = await req.json() as any;
      const row = db.query('SELECT * FROM tasks WHERE id=?').get(id) as any;
      if (!row) return Response.json({ error: 'Not found' }, { status: 404 });

      const updates: Record<string, any> = {};
      if (body.summary !== undefined) updates.summary = body.summary;
      if (body.type !== undefined) updates.type = body.type;
      if (body.priority !== undefined) updates.priority = body.priority;
      if (body.status !== undefined) updates.status = body.status;
      if (body.assignee !== undefined) updates.assignee = body.assignee;
      if (body.sprint !== undefined) updates.sprint_id = lookupSprintId(body.sprint);
      if (body.developer !== undefined) updates.developer_id = lookupDevId(body.developer);
      if (body.effortDays !== undefined) updates.effort_days = body.effortDays;
      if (body.devEta !== undefined) updates.dev_eta = body.devEta || null;
      if (body.effortL0Num !== undefined) updates.effort_l0_num = body.effortL0Num;
      if (body.effortL0Txt !== undefined) updates.effort_l0_txt = body.effortL0Txt || null;
      if (body.effortL1Num !== undefined) updates.effort_l1_num = body.effortL1Num;
      if (body.effortL1Txt !== undefined) updates.effort_l1_txt = body.effortL1Txt || null;
      if (body.notes !== undefined) updates.notes = body.notes || null;
      if (body.lastSynced !== undefined) updates.last_synced = body.lastSynced;

      if (Object.keys(updates).length > 0) {
        const setClauses = Object.keys(updates).map(k => `${k}=?`).join(', ');
        db.query(`UPDATE tasks SET ${setClauses} WHERE id=?`).run(...Object.values(updates), id);
      }

      // Auto-push assignee to Jira when developer changes
      if (body.developer !== undefined && jiraConfigured()) {
        const task = db.query('SELECT jira_key FROM tasks WHERE id=?').get(id) as any;
        if (task?.jira_key) {
          const dev = updates.developer_id
            ? (db.query('SELECT jira_account_id FROM developers WHERE id=?').get(updates.developer_id) as any)
            : null;
          const accountId = dev?.jira_account_id ?? null;
          jiraPut(`/issue/${task.jira_key}`, { fields: { assignee: accountId ? { accountId } : null } })
            .catch(() => {}); // fire-and-forget; don't fail the update
        }
      }

      const all = getTasksWithDates();
      return Response.json(all.find((t: any) => t.id === id) ?? null);
    })();

    case 'DELETE': {
      if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });
      db.query('DELETE FROM tasks WHERE id=?').run(id);
      return Response.json({ ok: true });
    }

    default: return new Response('Method not allowed', { status: 405 });
  }
}
