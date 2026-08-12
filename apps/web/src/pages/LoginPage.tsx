import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { Button, Input } from '../components/ui/Form';
import { ApiClientError } from '../lib/api';
import { PageLoader } from '../components/ui/PageLoader';

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <PageLoader />;
  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password, rememberMe);
      toast('Giriş başarılı', 'success');
      navigate('/');
    } catch (error) {
      const message =
        error instanceof ApiClientError ? error.message : 'Giriş yapılamadı';
      toast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-navy-950 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-0 h-[420px] w-[420px] rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[520px] w-[520px] rounded-full bg-navy-700/40 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1400px] items-center px-6 py-10 lg:px-10">
        <div className="grid w-full items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45 }}
            className="hidden lg:block"
          >
            <p className="text-5xl font-semibold tracking-[-0.04em] text-white xl:text-6xl">WoonWork</p>
            <p className="mt-5 max-w-xl text-lg text-ink-300">
              Şirketinizin projelerini, görevlerini ve belgelerini tek çalışma masasında yönetin.
            </p>
            <div className="mt-10 grid max-w-lg gap-3 text-sm text-ink-300">
              <div className="border border-white/10 bg-white/5 px-4 py-3">
                Çok kiracılı mimari · güvenli tenant izolasyonu
              </div>
              <div className="border border-white/10 bg-white/5 px-4 py-3">
                Projeler, görevler, notlar ve ekip tek yerde
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="mx-auto w-full max-w-md"
          >
            <div className="mb-8 lg:hidden">
              <p className="text-4xl font-semibold tracking-tight text-white">WoonWork</p>
              <p className="mt-2 text-sm text-ink-300">Şirket çalışma platformu</p>
            </div>

            <form
              onSubmit={onSubmit}
              className="border border-white/10 bg-white p-7 text-[var(--ww-text)] shadow-[var(--ww-shadow-overlay)]"
            >
              <h1 className="text-2xl font-semibold tracking-tight">Giriş Yap</h1>
              <p className="mt-1 text-sm text-navy-500">Hesabınızla çalışma alanınıza devam edin.</p>

              <div className="mt-6 space-y-4">
                <Input
                  label="E-posta"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@woontegra.com"
                />
                <Input
                  label="Şifre"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <label className="flex items-center gap-2 text-sm text-navy-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-navy-300"
                  />
                  Beni Hatırla
                </label>
              </div>

              <Button type="submit" className="mt-6 w-full" disabled={submitting}>
                {submitting ? 'Giriş yapılıyor...' : 'Giriş Yap'}
              </Button>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
