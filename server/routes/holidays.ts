import { db } from '../db';

export function handleHolidays(req: Request, id?: string): Response | Promise<Response> {
  switch (req.method) {
    case 'GET': {
      return Response.json(db.query('SELECT * FROM holidays ORDER BY date').all());
    }

    case 'POST': return (async () => {
      const body = await req.json() as any;
      try {
        const result = db.query('INSERT INTO holidays (date, name) VALUES (?, ?)').run(body.date ?? '', body.name ?? '');
        return Response.json(db.query('SELECT * FROM holidays WHERE id=?').get(result.lastInsertRowid));
      } catch (e: any) {
        return Response.json({ error: e.message }, { status: 400 });
      }
    })();

    case 'PATCH': return (async () => {
      if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });
      const body = await req.json() as any;
      const row = db.query('SELECT * FROM holidays WHERE id=?').get(id) as any;
      if (!row) return Response.json({ error: 'Not found' }, { status: 404 });
      try {
        db.query('UPDATE holidays SET date=?, name=? WHERE id=?')
          .run(body.date ?? row.date, body.name ?? row.name, id);
        return Response.json(db.query('SELECT * FROM holidays WHERE id=?').get(id));
      } catch (e: any) {
        return Response.json({ error: e.message }, { status: 400 });
      }
    })();

    case 'DELETE': {
      if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });
      db.query('DELETE FROM holidays WHERE id=?').run(id);
      return Response.json({ ok: true });
    }

    default: return new Response('Method not allowed', { status: 405 });
  }
}
