async function request(method: string, path: string, body?: object): Promise<any> {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

const get = (path: string) => request('GET', path);
const post = (path: string, body?: object) => request('POST', path, body);
const patch = (path: string, body: object) => request('PATCH', path, body);
const del = (path: string) => request('DELETE', path);

export const api = {
  tasks: {
    list: () => get('/api/tasks'),
    create: (data: object) => post('/api/tasks', data),
    update: (id: string, data: object) => patch(`/api/tasks/${id}`, data),
    remove: (id: string) => del(`/api/tasks/${id}`),
    reorder: (id: string, direction: number) => post('/api/tasks/reorder', { id, direction }),
  },
  sprints: {
    list: () => get('/api/sprints'),
    create: (data: object) => post('/api/sprints', data),
    update: (id: string, data: object) => patch(`/api/sprints/${id}`, data),
    remove: (id: string) => del(`/api/sprints/${id}`),
  },
  developers: {
    list: () => get('/api/developers'),
    create: (name: string, jiraAccountId?: string | null) => post('/api/developers', { name, jiraAccountId }),
    remove: (id: number) => del(`/api/developers/${id}`),
    reorder: (id: number, direction: number) => post('/api/developers/reorder', { id, direction }),
  },
  holidays: {
    list: () => get('/api/holidays'),
    create: (date: string, name: string) => post('/api/holidays', { date, name }),
    update: (id: number, data: object) => patch(`/api/holidays/${id}`, data),
    remove: (id: number) => del(`/api/holidays/${id}`),
  },
  config: {
    get: () => get('/api/config'),
  },
  jira: {
    discover: () => post('/api/jira/discover'),
    pull: (key: string) => post(`/api/jira/pull/${key}`),
    push: (taskId: string) => post(`/api/jira/push/${taskId}`),
    pullAll: () => post('/api/jira/pull-all'),
    pushAll: () => post('/api/jira/push-all'),
    searchUsers: (q: string) => get(`/api/jira/search-users?q=${encodeURIComponent(q)}`),
  },
  import: (data: object) => post('/api/import', data),
  db: {
    stats: () => get('/api/db/stats'),
    backup: () => fetch('/api/db/backup'),   // raw fetch — caller streams as download
    restore: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return fetch('/api/db/restore', { method: 'POST', body: form })
        .then(async res => {
          const json = await res.json().catch(() => ({ error: 'Request failed' }));
          if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
          return json;
        });
    },
  },
};
