# Sprint Planner

A Jira-synced sprint planning tool with Gantt timeline, workload view, and full bi-directional Jira sync. Built with Bun, React, SQLite, and Docker.

## Features

- Pull Jira issues by key — auto-fetches summary, type, priority, status, and custom fields
- Push changes back to Jira (Development ETA, Dev Effort L0/L1)
- Gantt timeline view with sprint bands, holiday/weekend shading, and today marker
- Workload view — per-developer utilization cards with capacity indicators
- Sprint spillover detection
- Working-day scheduling that excludes weekends and configured holidays
- Persistent SQLite storage (survives container restarts)
- Migration path from the old localStorage-based version

## Quick Start

### Development

```bash
cp .env.example .env        # fill in JIRA_* vars
bun install
bun run dev                 # Bun API server on :3000, Vite dev server on :5173
```

Open http://localhost:5173

### Docker (production)

Build and run with plain `docker`:

```bash
docker build -t sprint-planner .

docker run -d \
  --name sprint-planner \
  --restart unless-stopped \
  -p 3000:3000 \
  -e JIRA_BASE_URL=https://yoursite.atlassian.net \
  -e JIRA_EMAIL=you@example.com \
  -e JIRA_TOKEN=your_api_token \
  sprint-planner
```

Open http://localhost:3000

> **`--restart unless-stopped` is required** for the DB restore feature — restore writes the new database file and exits the process so Docker restarts the container with fresh data.

To update to a new image without losing data: download a backup first (Config → Database → Download Backup), then `docker stop/rm`, rebuild, `docker run`, and restore via the UI.

#### Jenkins pipeline example

```groovy
stage('Deploy') {
  steps {
    sh 'docker build -t sprint-planner .'
    sh 'docker stop sprint-planner || true'
    sh 'docker rm sprint-planner || true'
    sh """
      docker run -d \\
        --name sprint-planner \\
        --restart unless-stopped \\
        -p 3000:3000 \\
        -e JIRA_BASE_URL=${JIRA_BASE_URL} \\
        -e JIRA_EMAIL=${JIRA_EMAIL} \\
        -e JIRA_TOKEN=${JIRA_TOKEN} \\
        sprint-planner
    """
  }
}
```

## Environment Variables

Set these in `.env` (for dev) or as `-e` flags in `docker run`:

| Variable | Description |
|----------|-------------|
| `JIRA_BASE_URL` | Your Jira instance URL, e.g. `https://yoursite.atlassian.net` |
| `JIRA_EMAIL` | Your Atlassian account email |
| `JIRA_TOKEN` | Your Jira API token (generate at id.atlassian.com) |
| `PORT` | Server port (default: `3000`) |
| `DB_PATH` | Path to SQLite database file (default: `./data/sprint-planner.db`) |

Credentials are never exposed to the browser — the server proxies all Jira API calls.

## Pages

### Plan
- **Issue Adder Bar** — enter a Jira key and pull it, or add a manual task
- **Pull All / Push All** — batch sync all Jira-linked tasks
- **Tasks tab** — editable table: assign sprint/developer, set effort days, change status
  - Expand a row to edit Dev ETA, Effort L0/L1 fields, and notes
  - Per-row ↓ pull and ↑ push buttons for individual sync
- **Timeline tab** — Gantt chart across all sprints; scroll to today automatically
- **Workload tab** — per-developer effort vs capacity per sprint

### Config
- **Jira Connection** — shows connection status; "Discover / Refresh Fields" maps custom field IDs
- **Sprints** — add/edit/delete sprints (name, start date, end date, status)
- **Developers** — add/remove/reorder team members
- **Holidays** — add/remove dates excluded from working-day calculations
- **Database** — download a backup (.db file) or restore from a previous backup; shows current DB size and record counts

## Jira Custom Fields

On first connect, click **Discover / Refresh Fields** in the Config page. The app auto-maps these fields by name and schema type:

| Field | Type |
|-------|------|
| Development ETA | Date |
| Dev Effort L0 | Number |
| Dev Effort L0 | Text/Option |
| Dev Effort L1 | Number |
| Dev Effort L1 | Text/Option |

## Project Structure

```
sprint-planner/
├── server/
│   ├── index.ts              # Bun HTTP server — API router + static file serving
│   ├── db.ts                 # SQLite init, schema, WAL mode
│   ├── lib/
│   │   ├── dateUtils.ts      # Working-day scheduling logic
│   │   └── jiraClient.ts     # Jira REST API client (uses env vars)
│   └── routes/
│       ├── tasks.ts          # Task CRUD + date computation
│       ├── sprints.ts        # Sprint CRUD
│       ├── developers.ts     # Developer CRUD + reorder
│       ├── holidays.ts       # Holiday CRUD
│       ├── jira.ts           # pull / push / discover / pull-all / push-all
│       └── config.ts         # GET /api/config + POST /api/import
├── client/
│   ├── main.tsx              # App root, page switcher, toast
│   ├── api.ts                # All fetch() calls in one place
│   ├── types.ts              # TypeScript interfaces
│   ├── constants.ts          # Color palette, button/input styles
│   ├── dateUtils.ts          # Client-side date helpers
│   ├── pages/
│   │   ├── PlanPage.tsx      # Issue adder + Tasks/Timeline/Workload tabs
│   │   └── ConfigPage.tsx    # Jira status + Sprints/Developers/Holidays editors
│   └── components/
│       ├── layout/           # Toast
│       ├── plan/             # TasksTable, TimelineView, WorkloadView, IssueAdderBar
│       └── config/           # SprintEditor, DeveloperEditor, HolidayEditor
├── data/                     # SQLite database (volume-mounted in Docker)
├── Dockerfile
├── vite.config.ts
└── package.json
```

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tasks` | List all tasks with computed start/end dates |
| POST | `/api/tasks` | Create manual task |
| PATCH | `/api/tasks/:id` | Update task fields |
| DELETE | `/api/tasks/:id` | Delete task |
| POST | `/api/tasks/reorder` | Reorder tasks (`{ id, direction: 1 \| -1 }`) |
| GET | `/api/sprints` | List sprints |
| POST | `/api/sprints` | Create sprint |
| PATCH | `/api/sprints/:id` | Update sprint |
| DELETE | `/api/sprints/:id` | Delete sprint |
| GET | `/api/developers` | List developers |
| POST | `/api/developers` | Add developer |
| POST | `/api/developers/reorder` | Reorder developer |
| DELETE | `/api/developers/:id` | Remove developer |
| GET | `/api/holidays` | List holidays |
| POST | `/api/holidays` | Add holiday |
| PATCH | `/api/holidays/:id` | Update holiday |
| DELETE | `/api/holidays/:id` | Delete holiday |
| GET | `/api/config` | Jira connection status + field map |
| POST | `/api/jira/discover` | Discover and save Jira custom field IDs |
| POST | `/api/jira/pull/:key` | Pull one Jira issue |
| POST | `/api/jira/push/:taskId` | Push task fields to Jira |
| POST | `/api/jira/pull-all` | Refresh all Jira-linked tasks |
| POST | `/api/jira/push-all` | Push all Jira-linked tasks |
| POST | `/api/import` | Import from old localStorage export |
| GET | `/api/db/stats` | DB file size, task/sprint/developer counts |
| GET | `/api/db/backup` | Download the SQLite database file |
| POST | `/api/db/restore` | Upload a .db file to replace the database (triggers server restart) |

## Migrating from the Old Version

If you used the previous single-file `sprint_planner.jsx` version:

1. Open the old app in your browser
2. In DevTools console, run: `copy(localStorage.getItem('sprint-planner-state'))`
3. Start the new app — a migration banner appears automatically if localStorage data is detected
4. Click **Import from localStorage** — all sprints, developers, holidays, and tasks are imported
5. Your old localStorage is cleared after a successful import

Alternatively, paste the copied JSON into a file and POST it to `/api/import`.

## Building for Production

```bash
bun run build       # outputs to dist/
bun run start       # serves dist/ as static + API on PORT
```

The server serves the built frontend for all non-`/api` routes (SPA fallback to `index.html`).
