import { ownerError } from './lib/displayText';
import { WorkspaceViews } from './components/WorkspaceViews';
import { api } from './lib/api';
import React, { useState, useEffect } from 'react';
import { SetupWizard } from './components/SetupWizard';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { LoginForm } from './components/LoginForm';
import { clearInvitePasswordPending, invitePasswordPending, supabase } from './lib/supabaseClient';
import { ActiveTab } from './types';


export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileRetry, setProfileRetry] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [accountProfile, setAccountProfile] = useState<any>(null);
  const [needsInvitePassword, setNeedsInvitePassword] = useState(invitePasswordPending);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const demo = import.meta.env.DEV && import.meta.env.VITE_RESTOBOT_ALLOW_DEMO !== 'false' && localStorage.getItem('restobot_demo_mode') === '1';
      if (demo) {
        if (!cancelled) {
          setIsAuthenticated(true);
          setAuthReady(true);
          setAccountProfile({ restaurantName: 'RestoBot Demo', currencySymbol: '$' });
          setIsConfigured(true);
        }
        return;
      } else {
        try {
          const { data } = await supabase.auth.getSession();
          if (!cancelled) {
            setIsAuthenticated(!!data.session);
            setAuthReady(true);
          }
        } catch {
          if (!cancelled) {
            setIsAuthenticated(false);
            setAuthReady(true);
          }
        }
      }

      const savedConfig = localStorage.getItem('restobot_config');
      if (savedConfig && !cancelled) {
        try { setAccountProfile(JSON.parse(savedConfig)); setIsConfigured(true); } catch { localStorage.removeItem('restobot_config'); }
      }
    };

    bootstrap();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'PASSWORD_RECOVERY') setNeedsInvitePassword(true);
      if (session) {
        localStorage.removeItem('restobot_demo_mode');
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(import.meta.env.DEV && import.meta.env.VITE_RESTOBOT_ALLOW_DEMO !== 'false' && localStorage.getItem('restobot_demo_mode') === '1');
      }
    });

    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    setProfileReady(false);
    setProfileError('');
    api('/api/account/profile').then(result => {
      if (cancelled) return;
      setAccountProfile({...result.accountProfile, currencySymbol: '$'});
      const demo = import.meta.env.DEV && import.meta.env.VITE_RESTOBOT_ALLOW_DEMO !== 'false' && localStorage.getItem('restobot_demo_mode') === '1';
      setIsConfigured(!!result.setupComplete || demo);
      setProfileReady(true);
    }).catch(error => { if (!cancelled) setProfileError(ownerError(error)); });
    return () => { cancelled = true; };
  }, [isAuthenticated, profileRetry]);

  const handleSetupComplete = async (config: any) => {
    const { pin, ...publicConfig } = config;
    await api('/api/account/initial-setup', { method: 'POST', body: JSON.stringify({ ...publicConfig, pin, wholesaler: config.wholesalers }) });
    localStorage.setItem('restobot_config', JSON.stringify(publicConfig));
    setAccountProfile(publicConfig);
    setIsConfigured(true);
  };

  const handleResetConfig = () => {
    localStorage.removeItem('restobot_config');
    setIsConfigured(false);
    setAccountProfile(null);
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400 text-sm">
        Checking session…
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginForm
        onAuthenticated={(mode) => {
          setIsAuthenticated(true);
          if (mode === 'demo') {
            setAccountProfile({ restaurantName: 'RestoBot Demo', currencySymbol: '$' });
            setIsConfigured(true);
          }
        }}
      />
    );
  }

  if (needsInvitePassword) {
    const savePassword = async (event: React.FormEvent) => {
      event.preventDefault();
      setPasswordError(null);
      if (newPassword.length < 12) {
        setPasswordError('Use at least 12 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setPasswordError('Passwords do not match.');
        return;
      }
      setSavingPassword(true);
      try {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        clearInvitePasswordPending();
        setNewPassword('');
        setConfirmPassword('');
        setNeedsInvitePassword(false);
      } catch (error: any) {
        setPasswordError(ownerError(error));
      } finally {
        setSavingPassword(false);
      }
    };
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 px-4">
        <form onSubmit={savePassword} className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-8 text-white space-y-4">
          <h1 className="text-2xl font-bold">Set your RestoBot password</h1>
          <p className="text-sm text-slate-300">Your email link is confirmed. Choose a password for future sign-ins.</p>
          <label className="block text-sm">Password
            <input type="password" autoComplete="new-password" required minLength={12} value={newPassword} onChange={event => setNewPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-3" />
          </label>
          <label className="block text-sm">Confirm password
            <input type="password" autoComplete="new-password" required minLength={12} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-3" />
          </label>
          {passwordError && <p role="alert" className="text-sm text-rose-300">{passwordError}</p>}
          <button type="submit" disabled={savingPassword} className="w-full rounded-lg bg-emerald-600 p-3 font-semibold disabled:opacity-50">{savingPassword ? 'Saving…' : 'Set password'}</button>
        </form>
      </div>
    );
  }

  if (!profileReady) {
    return <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-300"><p role="status">{profileError || 'Loading your restaurant…'}</p>{profileError && <><button onClick={() => setProfileRetry(n => n + 1)}>Retry</button><button onClick={async () => {localStorage.removeItem('restobot_demo_mode');await supabase.auth.signOut({scope:'local'});setIsAuthenticated(false);setIsConfigured(false);}}>Back to sign in</button></>}</div>;
  }

  if (!isConfigured) {
    return <SetupWizard onComplete={handleSetupComplete} />;
  }

  return (
    <div className="rinet-app">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        marginAlertsCount={0}
        lowStockCount={0}
        showConsole={false}
      />

      <div className="rinet-workspace">
        <Navbar
          restaurantName={accountProfile?.restaurantName || 'RestoBot'}
          onResetConfig={() => setActiveTab('settings')}
          onAlerts={() => setActiveTab('margin')}
        />

        <main className="rinet-main">
          {import.meta.env.DEV && import.meta.env.VITE_RESTOBOT_ALLOW_DEMO !== 'false' && localStorage.getItem('restobot_demo_mode') === '1' && <div className="demo-banner">Demo workspace · sample data for preview</div>}
          <WorkspaceViews activeTab={activeTab} setActiveTab={setActiveTab} currencySymbol={accountProfile?.currencySymbol || '$'} />
        </main>
      </div>
    </div>
  );
}
