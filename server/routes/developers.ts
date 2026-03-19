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
      return Response.json(db.query('SELECT * FROM developers ORDER BY sort_order, id').all());
    }

    case 'POST': return (async () => {
      if (id === 'reorder') {
        const body = await req.json() as any;
        const rows = db.query('SELECT * FROM developers ORDER BY sort_order, id').all() as any[];
        reorderById(rows, body.id, body.direction);
        return Response.json(db.query('SELECT * FROM developers ORDER BY sort_order, id').all());
      }
      const body = await req.json() as any;
      const maxOrder = (db.query('SELECT MAX(sort_order) as m FROM developers').get() as any)?.m ?? -1;
      try {
        const result = db.query('INSERT INTO developers (name, sort_order) VALUES (?, ?)').run(body.name, maxOrder + 1);
        return Response.json(db.query('SELECT * FROM developers WHERE id=?').get(result.lastInsertRowid));
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
