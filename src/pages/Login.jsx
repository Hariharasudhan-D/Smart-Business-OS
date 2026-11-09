import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Receipt } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import { Field, fieldClass } from '../components/ui/Input';

export default function Login() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const target = location.state?.from?.pathname ?? '/';
  if (isAuthenticated) return <Navigate to={target} replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await login(email.trim(), password);
      navigate(target, { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <Receipt size={24} />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-slate-900">Smart Business OS</h1>
          <p className="mt-1 text-sm text-slate-500">Admin sign in</p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" noValidate>
          <Field label="Email">
            <input
              className={fieldClass(false)}
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
            />
          </Field>
          <Field label="Password">
            <div className="relative">
              <input
                className={`${fieldClass(false)} pr-11`}
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-600"
                aria-label={show ? 'Hide password' : 'Show password'}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Field>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-400">Use your shop admin email and password, the same as the website.</p>
      </div>
    </div>
  );
}
