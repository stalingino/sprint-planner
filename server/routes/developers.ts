import { db } from '../db';

function reorderById(rows: any[], targetId: any, direction: number) {
  const idx = rows.findIndex((r: any) => String(r.id) === String(targetId));
  const ni = idx + direction;
  if (idx < 0 || ni < 0 || ni >= rows.length) return;
  const stmt = db.prepare('UPDATE developers SET sort_order=? WHERE id=?');
  const newOrder = [...rows];
  [newOrder[idx], newOrder[ni]] = [newOrder[ni], newOrder[idx]];
  for (let i = 0; i < newOrder.length; i++) stmt.run(i, newOrder[i].id);
}

export function handleDevelopers(req: Request, id?: string): Response | Promise<Response> {
  switch (req.method) {
    case 'GET': {
      return Response.json(
        (db.query('SELECT id, name, jira_account_id, sort_order FROM developers ORDER BY sort_order, id').all() as any[])
          .map((d: any) => ({ id: d.id, name: d.name, jiraAccountId: d.jira_account_id ?? null, sort_order: d.sort_order }))
      );
    }

    case 'POST': return (async () => {
      if (id === 'reorder') {
        const body = await req.json() as any;
        const rows = db.query('SELECT * FROM developers ORDER BY sort_order, id').all() as any[];
        reorderById(rows, body.id, body.direction);
        return Response.json(
          (db.query('SELECT id, name, jira_account_id, sort_order FROM developers ORDER BY sort_order, id').all() as any[])
            .map((d: any) => ({ id: d.id, name: d.name, jiraAccountId: d.jira_account_id ?? null, sort_order: d.sort_order }))
        );
      }
      const body = await req.json() as any;
      const maxOrder = (db.query('SELECT MAX(sort_order) as m FROM developers').get() as any)?.m ?? -1;
      try {
        const result = db.query('INSERT INTO developers (name, jira_account_id, sort_order) VALUES (?, ?, ?)').run(
          body.name, body.jiraAccountId ?? null, maxOrder + 1
        );
        const d = db.query('SELECT id, name, jira_account_id, sort_order FROM developers WHERE id=?').get(result.lastInsertRowid) as any;
        return Response.json({ id: d.id, name: d.name, jiraAccountId: d.jira_account_id ?? null, sort_order: d.sort_order });
      } catch (e: any) {
        return Response.json({ error: e.message }, { status: 400 });
      }
    })();

    case 'DELETE': {
      if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });
      db.query('DELETE FROM developers WHERE id=?').run(id);
      return Response.json({ ok: true });
    }

    default: return new Response('Method not allowed', { status: 405 });
  }
}
