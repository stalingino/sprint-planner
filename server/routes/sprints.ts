import { db } from '../db';

function mapSprint(row: any) {
  return {
    id: row.id,
    name: row.name,
    start: row.start_date,
    end: row.end_date,
    status: row.status,
  };
}

export function handleSprints(req: Request, id?: string): Response | Promise<Response> {
  switch (req.method) {
    case 'GET': {
      const rows = db.query('SELECT * FROM sprints ORDER BY sort_order, start_date').all();
      return Response.json(rows.map(mapSprint));
    }

    case 'POST': return (async () => {
      const body = await req.json() as any;
      const newId = `s${Date.now()}`;
      const maxOrder = (db.query('SELECT MAX(sort_order) as m FROM sprints').get() as any)?.m ?? -1;
      db.query('INSERT INTO sprints (id, name, start_date, end_date, status, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
        .run(newId, body.name ?? 'New Sprint', body.start ?? '', body.end ?? '', body.status ?? 'Planned', maxOrder + 1);
      return Response.json(mapSprint(db.query('SELECT * FROM sprints WHERE id=?').get(newId)));
    })();

    case 'PATCH': return (async () => {
      if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });
      const body = await req.json() as any;
      const row = db.query('SELECT * FROM sprints WHERE id=?').get(id) as any;
      if (!row) return Response.json({ error: 'Not found' }, { status: 404 });
      db.query('UPDATE sprints SET name=?, start_date=?, end_date=?, status=? WHERE id=?')
        .run(body.name ?? row.name, body.start ?? row.start_date, body.end ?? row.end_date, body.status ?? row.status, id);
      return Response.json(mapSprint(db.query('SELECT * FROM sprints WHERE id=?').get(id)));
    })();

    case 'DELETE': {
      if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });
      db.query('DELETE FROM sprints WHERE id=?').run(id);
      return Response.json({ ok: true });
    }

    default: return new Response('Method not allowed', { status: 405 });
  }
}
