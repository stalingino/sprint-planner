import { useState } from 'react';
import { C, inputStyle, btnStyle } from '../../constants';

interface Props {
  onPull: (key: string) => Promise<void>;
  onManualAdd: () => Promise<void>;
  onPullAll: () => Promise<void>;
  onPushAll: () => Promise<void>;
}

export function IssueAdderBar({ onPull, onManualAdd, onPullAll, onPushAll }: Props) {
  const [issueKey, setIssueKey] = useState('');
  const [fetching, setFetching] = useState(false);

  async function handlePull() {
    if (!issueKey.trim()) return;
    setFetching(true);
    await onPull(issueKey.trim());
    setIssueKey('');
    setFetching(false);
  }

  return (
    <div style={{
      padding: '12px 24px', borderBottom: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center', gap: 12, background: C.surface2,
    }}>
      <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>Add Jira Issue:</span>
      <input
        style={{ ...inputStyle, width: 160, fontSize: 13, fontWeight: 700 }}
        placeholder="e.g. PKIS-123"
        value={issueKey}
        onChange={e => setIssueKey(e.target.value.toUpperCase())}
        onKeyDown={e => { if (e.key === 'Enter' && issueKey.trim()) handlePull(); }}
      />
      <button style={btnStyle(C.green)} disabled={fetching || !issueKey.trim()} onClick={handlePull}>
        {fetching ? 'Fetching…' : '↓ Pull from Jira'}
      </button>
      <span style={{ fontSize: 10, color: C.muted }}>or</span>
      <button style={btnStyle(C.muted)} onClick={onManualAdd}>
        + Manual Task
      </button>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
        <button style={btnStyle(C.blue)} onClick={onPullAll}>↓ Pull All</button>
        <button style={btnStyle(C.orange)} onClick={onPushAll}>↑ Push All</button>
      </div>
    </div>
  );
}
