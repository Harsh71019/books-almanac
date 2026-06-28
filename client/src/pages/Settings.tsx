import { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/features/auth/AuthContext';
import { useSettings, useUpdateSettings } from '@/lib/queries';

const card = { background: '#f4ecdc', border: '1px solid #ddcfb0', borderRadius: 12, padding: '28px 30px' };
const label = { fontSize: 10.5, letterSpacing: '.22em', textTransform: 'uppercase' as const, color: '#a2906f', marginBottom: 10 };
const inputStyle = { fontFamily: "'Spline Sans'", fontSize: 15, padding: '12px 14px', border: '1px solid #d3c3a1', borderRadius: 8, background: '#f6efe1', color: '#221b13', outline: 'none', width: '100%' };
const btnPrimary = { padding: '12px 26px', border: 'none', borderRadius: 9, background: '#221b13', color: '#f3ecdf', fontFamily: "'Spline Sans'", fontSize: 14, fontWeight: 500, cursor: 'pointer' };
const btnGhost = { padding: '12px 26px', border: '1px solid #d3c3a1', borderRadius: 9, background: 'transparent', color: '#7a6e58', fontFamily: "'Spline Sans'", fontSize: 14, cursor: 'pointer' };

export function SettingsPage() {
  const { user, logout } = useAuth();
  const { data: settings } = useSettings();
  const update = useUpdateSettings();

  const [goal, setGoal] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings?.yearlyGoal != null) setGoal(String(settings.yearlyGoal));
  }, [settings?.yearlyGoal]);

  async function saveGoal() {
    const n = parseInt(goal, 10);
    if (!n || n < 0) return;
    await update.mutateAsync({ yearlyGoal: n });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleExport() {
    const a = document.createElement('a');
    a.href = '/api/books/export';
    a.download = '';
    a.click();
  }

  return (
    <AppShell>
      <section style={{ padding: 'clamp(40px,5vw,64px) clamp(28px,6vw,72px) 80px', maxWidth: 680, animation: 'fadeUp .5s ease both' }}>
        <div style={{ fontSize: 11, letterSpacing: '.34em', textTransform: 'uppercase', color: '#b15539', marginBottom: 16 }}>Preferences</div>
        <h1 style={{ fontFamily: "'Newsreader', serif", fontWeight: 400, fontSize: 52, letterSpacing: '-.02em', lineHeight: 1, marginBottom: 48, color: '#221b13' }}>Settings</h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Account */}
          <div style={card}>
            <div style={label}>Account</div>
            <div style={{ fontFamily: "'Newsreader', serif", fontSize: 22, color: '#221b13', marginBottom: 4 }}>{user?.displayName}</div>
            <div style={{ fontSize: 13, color: '#9a8a6c' }}>@{user?.username}</div>
          </div>

          {/* Yearly goal */}
          <div style={card}>
            <div style={label}>Yearly reading goal</div>
            <p style={{ fontSize: 14, color: '#7a6e58', marginBottom: 16, fontFamily: "'Newsreader', serif", fontStyle: 'italic' }}>How many books do you want to read this year?</p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <input
                type="number" min={1} max={500} value={goal}
                onChange={e => setGoal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveGoal()}
                placeholder="e.g. 24"
                style={{ ...inputStyle, width: 120 }}
              />
              <button onClick={saveGoal} disabled={update.isPending} style={btnPrimary}>
                {update.isPending ? '…' : 'Save'}
              </button>
              {saved && <span style={{ fontFamily: "'Newsreader', serif", fontStyle: 'italic', color: '#1f8a5b', fontSize: 15 }}>Saved!</span>}
            </div>
          </div>

          {/* Export */}
          <div style={card}>
            <div style={label}>Data export</div>
            <p style={{ fontSize: 14, color: '#7a6e58', marginBottom: 16, fontFamily: "'Newsreader', serif", fontStyle: 'italic' }}>Download your entire library as JSON.</p>
            <button onClick={handleExport} style={btnGhost}>Export library</button>
          </div>

          {/* Sign out */}
          <div style={card}>
            <div style={label}>Session</div>
            <p style={{ fontSize: 14, color: '#7a6e58', marginBottom: 16, fontFamily: "'Newsreader', serif", fontStyle: 'italic' }}>Sign out of your reading account.</p>
            <button onClick={logout} style={{ ...btnGhost, color: '#b15539', borderColor: 'rgba(177,85,57,.4)' }}>Sign out</button>
          </div>

        </div>
      </section>
    </AppShell>
  );
}
