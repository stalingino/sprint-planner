const base = (process.env.JIRA_BASE_URL ?? '').replace(/\/$/, '');
const email = process.env.JIRA_EMAIL ?? '';
const token = process.env.JIRA_TOKEN ?? '';

export function isConfigured(): boolean {
  return !!(base && email && token);
}

function authHeader(): string {
  return 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');
}

export async function jiraGet(path: string): Promise<any> {
  if (!isConfigured()) {
    throw Object.assign(new Error('Jira credentials not configured in environment'), { status: 503 });
  }
  const res = await fetch(`${base}/rest/api/3${path}`, {
    headers: { Authorization: authHeader(), Accept: 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw Object.assign(new Error(`Jira GET ${path}: ${res.status} — ${text}`), { status: 502 });
  }
  return res.json();
}

export async function jiraPut(path: string, body: object): Promise<void> {
  if (!isConfigured()) {
    throw Object.assign(new Error('Jira credentials not configured in environment'), { status: 503 });
  }
  const res = await fetch(`${base}/rest/api/3${path}`, {
    method: 'PUT',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    throw Object.assign(new Error(`Jira PUT ${path}: ${res.status} — ${text}`), { status: 502 });
  }
}
