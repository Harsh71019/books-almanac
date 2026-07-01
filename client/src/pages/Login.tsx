import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';

export function LoginPage() {
  const { login, user, isLoading } = useAuth();
  const navigate = useNavigate();

  // If already authenticated (e.g. after a background refetch completes while
  // we were briefly on this page), send them home.
  useEffect(() => {
    if (!isLoading && user) navigate('/', { replace: true });
  }, [user, isLoading, navigate]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch {
      setError('Wrong username or password.');
    } finally {
      setLoading(false);
    }
  };

  const field = { width: '100%', fontFamily: "'Spline Sans'", fontSize: 15, padding: '13px 16px', border: '1px solid #d3c3a1', borderRadius: 8, background: '#f6efe1', color: '#221b13', outline: 'none' };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(120% 120% at 80% 0%, #f3ecdf 0%, #ece2cf 55%, #e6dbc4 100%)', padding: '0 16px' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontFamily: "'Newsreader', serif", fontStyle: 'italic', fontWeight: 500, fontSize: 56, lineHeight: 1, color: '#221b13', letterSpacing: '-.01em' }}>Shelf</div>
          <div style={{ fontSize: 11, letterSpacing: '.32em', textTransform: 'uppercase', color: '#a2906f', marginTop: 10 }}>Reading Log</div>
        </div>

        <form onSubmit={handleSubmit} style={{ background: '#f4ecdc', border: '1px solid #ddcfb0', borderRadius: 16, padding: '36px 34px', boxShadow: '0 24px 40px -20px rgba(60,40,15,.25)' }}>
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="username" style={{ display: 'block', fontSize: 10.5, letterSpacing: '.2em', textTransform: 'uppercase', color: '#9a8a6c', marginBottom: 8 }}>Username</label>
            <input id="username" type="text" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} required placeholder="your username" style={field} />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label htmlFor="password" style={{ display: 'block', fontSize: 10.5, letterSpacing: '.2em', textTransform: 'uppercase', color: '#9a8a6c', marginBottom: 8 }}>Password</label>
            <input id="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" style={field} />
          </div>

          {error && (
            <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(177,85,57,.1)', border: '1px solid rgba(177,85,57,.3)', borderRadius: 8, fontSize: 13.5, color: '#b15539', fontFamily: "'Newsreader', serif", fontStyle: 'italic' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{ width: '100%', padding: '15px', border: 'none', borderRadius: 10, background: '#221b13', color: '#f3ecdf', fontFamily: "'Spline Sans'", fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            {loading && <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#f3ecdf', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />}
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
