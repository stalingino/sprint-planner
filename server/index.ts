import path from 'path';
import './db'; // initialize database on startup
import { handleTasks } from './routes/tasks';
import { handleSprints } from './routes/sprints';
import { handleDevelopers } from './routes/developers';
import { handleHolidays } from './routes/holidays';
import { handleJira } from './routes/jira';
import { handleConfig, handleImport } from './routes/config';
import { handleDb } from './routes/db';

const PORT = parseInt(process.env.PORT ?? '3000');
const DIST_PATH = path.join(import.meta.dir, '../dist');

async function serveStatic(pathname: string): Promise<Response> {
  const rel = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = Bun.file(path.join(DIST_PATH, rel));
  if (await file.exists()) return new Response(file);
  // SPA fallback
  return new Response(Bun.file(path.join(DIST_PATH, 'index.html')));
}

async function handleApi(req: Request, url: URL): Promise<Response> {
  const parts = url.pathname.split('/').filter(Boolean);
  // parts: ['api', resource, id?, sub?]
  const resource = parts[1];
  const id = parts[2];
  const sub = parts[3];

  switch (resource) {
    case 'tasks':     return handleTasks(req, id);
    case 'sprints':   return handleSprints(req, id);
    case 'developers': return handleDevelopers(req, id);
    case 'holidays':  return handleHolidays(req, id);
    case 'jira':      return handleJira(req, url, id, sub);
    case 'config':    return handleConfig(req);
    case 'import':    return handleImport(req);
    case 'db':        return handleDb(req, id);
    default:          return Response.json({ error: 'Not found' }, { status: 404 });
  }
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    try {
      if (url.pathname.startsWith('/api/')) {
        return await handleApi(req, url);
      }
      return await serveStatic(url.pathname);
    } catch (err: any) {
      console.error('[server error]', err);
      return Response.json(
        { error: err.message ?? 'Internal server error' },
        { status: err.status ?? 500 }
      );
    }
  },
});

console.log(`Sprint Planner running at http://localhost:${PORT}`);
