import React, { useState } from 'react';

interface SetupWizardProps {
  onComplete: (config: any) => void | Promise<void>;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState({
    restaurantName: '',
    location: '',
    wholesalers: '',
    cuisineType: '',
    pin: '',
  });

  const nextStep = () => setStep((s) => s + 1);
  const prevStep = () => setStep((s) => s - 1);

  const handleSubmit = async () => {
    if (saving) return;
    setSaving(true); setError('');
    try { await onComplete(config); } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    borderRadius: '12px',
    border: '1px solid #cbd5e1',
    fontSize: '16px',
    marginBottom: '24px',
    boxSizing: 'border-box',
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        backgroundColor: '#f8fafc',
        fontFamily: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',
        padding: '20px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '40px',
          borderRadius: '24px',
          boxShadow:
            '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          maxWidth: '500px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        {error && <p role="alert" style={{color:'crimson'}}>{error}</p>}
        {saving && <p role="status">Saving configuration…</p>}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#1e293b', marginBottom: '8px' }}>
            Welcome to RestoBot
          </h1>
          <p style={{ color: '#64748b', fontSize: '16px' }}>
            Let's configure your AI supply chain in a few seconds.
          </p>
        </div>

        <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'center', gap: '8px' }}>
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              style={{
                width: '40px',
                height: '6px',
                borderRadius: '3px',
                backgroundColor: s <= step ? '#3b82f6' : '#e2e8f0',
                transition: 'background-color 0.3s ease',
              }}
            />
          ))}
        </div>

        {step === 1 && (
          <div style={{ textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#475569' }}>
              Restaurant Name
            </label>
            <input
              style={inputStyle}
              placeholder="e.g. The Golden Griddle"
              value={config.restaurantName}
              onChange={(e) => setConfig({ ...config, restaurantName: e.target.value })}
            />
          </div>
        )}

        {step === 2 && (
          <div style={{ textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#475569' }}>
              Location (City, State)
            </label>
            <input
              style={inputStyle}
              placeholder="e.g. Troy, Michigan"
              value={config.location}
              onChange={(e) => setConfig({ ...config, location: e.target.value })}
            />
          </div>
        )}

        {step === 3 && (
          <div style={{ textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#475569' }}>
              Primary Wholesalers
            </label>
            <input
              style={inputStyle}
              placeholder="e.g. Sysco, US Foods, GFS"
              value={config.wholesalers}
              onChange={(e) => setConfig({ ...config, wholesalers: e.target.value })}
            />
          </div>
        )}

        {step === 4 && (
          <div style={{ textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#475569' }}>
              Account PIN
            </label>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={4}
              style={inputStyle}
              placeholder="Enter a 4-digit PIN"
              value={config.pin}
              onChange={(e) => setConfig({ ...config, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
            />
            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '-12px' }}>
              PIN unlocks admin setup later. Sign-in is handled separately.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px' }}>
          <button
            onClick={prevStep}
            disabled={step === 1}
            style={{
              padding: '12px 24px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: 'transparent',
              color: '#64748b',
              cursor: step === 1 ? 'not-allowed' : 'pointer',
              fontWeight: '600',
            }}
          >
            Back
          </button>
          {step < 4 ? (
            <button
              onClick={nextStep}
              disabled={step === 1 && !config.restaurantName}
              style={{
                padding: '12px 24px',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: '#3b82f6',
                color: 'white',
                cursor: step === 1 && !config.restaurantName ? 'not-allowed' : 'pointer',
                fontWeight: '600',
              }}
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={saving || !/^\d{4}$/.test(config.pin)}
              style={{
                padding: '12px 24px',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: '#10b981',
                color: 'white',
                cursor: config.pin.length !== 4 ? 'not-allowed' : 'pointer',
                fontWeight: '600',
              }}
            >
              Finish & Launch
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
