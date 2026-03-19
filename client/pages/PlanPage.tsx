import { useState, useEffect } from 'react';
import type { Task, Sprint, Developer, Holiday } from '../types';
import { C, btnStyle, devColors } from '../constants';
import { api } from '../api';
import { IssueAdderBar } from '../components/plan/IssueAdderBar';
import { TasksTable } from '../components/plan/TasksTable';
import { TimelineView } from '../components/plan/TimelineView';
import { WorkloadView } from '../components/plan/WorkloadView';

interface Props {
  onNotify: (msg: string, type?: string) => void;
  onJiraConnected: (v: boolean) => void;
}

type Tab = 'tasks' | 'timeline' | 'workload';

export function PlanPage({ onNotify, onJiraConnected }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [tab, setTab] = useState<Tab>('tasks');
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [showMigration, setShowMigration] = useState(false);
  const [importing, setImporting] = useState(false);

  async function loadAll() {
    const [t, s, d, h, cfg] = await Promise.all([
      api.tasks.list(),
      api.sprints.list(),
      api.developers.list(),
      api.holidays.list(),
      api.config.get(),
    ]);
    setTasks(t);
    setSprints(s);
    setDevelopers(d);
    setHolidays(h);
    onJiraConnected(cfg.jiraConnected);
    if (t.length === 0 && s.length === 0 && localStorage.getItem('sprint-planner-state')) {
      setShowMigration(true);
    }
  }

  useEffect(() => {
    loadAll().catch(e => onNotify(e.message, 'error'));
  }, []);

  async function handleUpdate(id: string, patch: Partial<Task>) {
    try {
      await api.tasks.update(id, patch);
      setTasks(await api.tasks.list());
    } catch (e: any) {
      onNotify(e.message, 'error');
    }
  }

  async function handleRemove(id: string) {
    try {
      await api.tasks.remove(id);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (e: any) {
      onNotify(e.message, 'error');
    }
  }

  async function handleMove(id: string, direction: number) {
    try {
      setTasks(await api.tasks.reorder(id, direction));
    } catch (e: any) {
      onNotify(e.message, 'error');
    }
  }

  async function handlePull(key: string) {
    try {
      const result = await api.jira.pull(key);
      setTasks(result.tasks);
      onNotify(`${key} pulled from Jira`, 'success');
    } catch (e: any) {
      onNotify(`Failed to pull ${key}: ${e.message}`, 'error');
    }
  }

  async function handlePush(task: Task) {
    setSyncing(s => ({ ...s, [task.id]: true }));
    try {
      await api.jira.push(task.id);
      setTasks(await api.tasks.list());
      onNotify(`${task.jiraKey} synced to Jira ✓`, 'success');
    } catch (e: any) {
      onNotify(`Sync failed for ${task.jiraKey}: ${e.message}`, 'error');
    }
    setSyncing(s => ({ ...s, [task.id]: false }));
  }

  async function handlePullAll() {
    try {
      const result = await api.jira.pullAll();
      setTasks(result.tasks);
      onNotify(`Refreshed ${result.count} issues from Jira`, 'success');
    } catch (e: any) {
      onNotify(`Pull all failed: ${e.message}`, 'error');
    }
  }

  async function handlePushAll() {
    try {
      const result = await api.jira.pushAll();
      setTasks(result.tasks);
      onNotify(`Pushed ${result.count} issues to Jira`, 'success');
    } catch (e: any) {
      onNotify(`Push all failed: ${e.message}`, 'error');
    }
  }

  async function handleManualAdd() {
    try {
      await api.tasks.create({
        summary: 'New Task',
        type: 'Task',
        priority: 'Medium',
        status: 'To Do',
        sprint: sprints[0]?.name || '',
        effortDays: 1,
      });
      setTasks(await api.tasks.list());
    } catch (e: any) {
      onNotify(e.message, 'error');
    }
  }

  async function handleImport() {
    const raw = localStorage.getItem('sprint-planner-state');
    if (!raw) return;
    setImporting(true);
    try {
      const data = JSON.parse(raw);
      const result = await api.import(data);
      await loadAll();
      localStorage.removeItem('sprint-planner-state');
      setShowMigration(false);
      onNotify(`Imported: ${result.imported.tasks} tasks, ${result.imported.sprints} sprints, ${result.imported.developers} developers`, 'success');
    } catch (e: any) {
      onNotify(`Import failed: ${e.message}`, 'error');
    }
    setImporting(false);
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', borderRadius: '8px 8px 0 0',
    background: active ? C.surface : 'transparent', color: active ? C.text : C.muted,
    border: active ? `1px solid ${C.border}` : '1px solid transparent', borderBottom: 'none',
    fontFamily: "'JetBrains Mono', monospace",
  });

  const devNames = developers.map(d => d.name);

  return (
    <div>
      {/* Migration banner */}
      {showMigration && (
        <div style={{
          padding: '12px 24px', background: C.purple + '18', borderBottom: `1px solid ${C.purple}44`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 12, color: C.purple, fontWeight: 600 }}>
            Found existing data in browser storage. Import it to continue where you left off.
          </span>
          <button style={btnStyle(C.purple)} onClick={handleImport} disabled={importing}>
            {importing ? 'Importing…' : '↑ Import from localStorage'}
          </button>
          <button style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 18 }}
            onClick={() => setShowMigration(false)}>×</button>
        </div>
      )}

      <IssueAdderBar
        onPull={handlePull}
        onManualAdd={handleManualAdd}
        onPullAll={handlePullAll}
        onPushAll={handlePushAll}
      />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, padding: '0 24px', paddingTop: 12 }}>
        {([['tasks', '📋 Tasks'], ['timeline', '📊 Timeline'], ['workload', '👥 Workload']] as const).map(([key, label]) => (
          <button key={key} style={tabStyle(tab === key)} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: '0 8px 8px 8px',
        margin: '0 24px 24px', minHeight: 400,
      }}>
        {tab === 'tasks' && (
          <TasksTable
            tasks={tasks}
            sprints={sprints}
            developers={developers}
            syncing={syncing}
            devColors={devColors}
            onUpdate={handleUpdate}
            onRemove={handleRemove}
            onMove={handleMove}
            onPull={handlePull}
            onPush={handlePush}
          />
        )}
        {tab === 'timeline' && (
          <TimelineView
            tasks={tasks}
            sprints={sprints}
            holidays={holidays}
            devColors={devColors}
            developers={devNames}
          />
        )}
        {tab === 'workload' && (
          <WorkloadView
            tasks={tasks}
            sprints={sprints}
            developers={devNames}
            holidays={holidays}
            devColors={devColors}
          />
        )}
      </div>
    </div>
  );
}
