'use client';

import { useState } from 'react';
import { Alert, Button, Card, Field, Input } from '@/components/ui';
import { apiFetch, setAccessToken } from '@/lib/api';

/**
 * Admin login. On success stores the access token in memory (lib/api) and hands
 * the username up to AdminApp; the refresh token arrives as an httpOnly cookie.
 */
export default function LoginForm({ notice, onLoggedIn }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: { username: username.trim(), password },
      });
      setAccessToken(data.accessToken);
      onLoggedIn(data.admin.username);
    } catch (err) {
      if (err.status === 401) setError('שם משתמש או סיסמה שגויים');
      else setError('שגיאת שרת — ודאו שהשרת פועל ונסו שוב');
      setPending(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-7 w-7 text-emerald-600"
          aria-hidden="true"
        >
          <rect x="5" y="10" width="14" height="10" rx="2" strokeLinejoin="round" />
          <path strokeLinecap="round" d="M8 10V7a4 4 0 1 1 8 0v3" />
          <circle cx="12" cy="15" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      </div>
      <h1 className="mt-4 text-center text-2xl font-extrabold text-slate-900">
        כניסה למערכת הניהול
      </h1>
      <p className="mt-1 text-center text-sm text-slate-500">
        לוח הבקרה של דפי-נט — למנהלים בלבד
      </p>

      {notice && (
        <Alert tone="warning" className="mt-4">
          {notice}
        </Alert>
      )}

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        <Field label="שם משתמש" required>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
          />
        </Field>
        <Field label="סיסמה" required>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </Field>

        {error && <Alert tone="danger">{error}</Alert>}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'מתחברים…' : 'התחברות'}
        </Button>
      </form>

      <p className="mt-4 text-center text-xs text-slate-400">למרצה: micha / 1234</p>
    </Card>
  );
}
