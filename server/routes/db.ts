import { writeFileSync, renameSync, statSync } from 'fs';
import { db, dbPath, closeDb } from '../db';

const SQLITE_MAGIC = 'SQLite format 3';

export async function handleDb(req: Request, action?: string): Promise<Response> {
  switch (action) {
    case 'stats': {
      if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
      const file = Bun.file(dbPath);
      const exists = await file.exists();
      const size = exists ? statSync(dbPath).size : 0;
      const taskCount = (db.query('SELECT COUNT(*) as n FROM tasks').get() as any)?.n ?? 0;
      const sprintCount = (db.query('SELECT COUNT(*) as n FROM sprints').get() as any)?.n ?? 0;
      const developerCount = (db.query('SELECT COUNT(*) as n FROM developers').get() as any)?.n ?? 0;
      return Response.json({ size, taskCount, sprintCount, developerCount, path: dbPath });
    }

    case 'backup': {
      if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
      // Flush WAL into main file for a consistent snapshot
      db.exec('PRAGMA wal_checkpoint(FULL)');
      const file = Bun.file(dbPath);
      if (!await file.exists()) {
        return Response.json({ error: 'Database file not found' }, { status: 404 });
      }
      const date = new Date().toISOString().slice(0, 10);
      return new Response(file, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="sprint-planner-${date}.db"`,
        },
      });
    }

    case 'restore': {
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) return Response.json({ error: 'No file provided' }, { status: 400 });

      const buffer = Buffer.from(await file.arrayBuffer());

      // Validate SQLite magic bytes
      if (buffer.length < 16 || buffer.slice(0, 15).toString('utf8') !== SQLITE_MAGIC) {
        return Response.json({ error: 'Not a valid SQLite database file' }, { status: 400 });
      }

      const tempPath = dbPath + '.restore';
      writeFileSync(tempPath, buffer);

      // Send response first, then swap the file and exit
      // Docker's --restart=unless-stopped will bring the server back up
      setTimeout(() => {
        try {
          closeDb();
          renameSync(tempPath, dbPath);
        } finally {
          process.exit(0);
        }
      }, 150);

      return Response.json({ ok: true, message: 'Restore complete. Server is restarting…' });
    }

    default:
      return Response.json({ error: 'Unknown db action' }, { status: 404 });
  }
}
