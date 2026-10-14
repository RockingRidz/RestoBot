import React, { useState, useEffect } from 'react';
import { authenticatedFetch } from '../lib/api';
import { ShieldCheck, Lock, Unlock, Store, MapPin, Truck, Utensils, RefreshCw, CheckCircle, AlertTriangle, KeyRound, Sparkles } from 'lucide-react';

interface AccountSetupBarProps {
  onAccountTrained?: (accountData: any) => void;
}

export function AccountSetupBar({ onAccountTrained }: AccountSetupBarProps) {
  const [pin, setPin] = useState<string>('');
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [pinError, setPinError] = useState<string | null>(null);

  // Form Fields for Assigned Account
  const [restaurantName, setRestaurantName] = useState<string>('Troy Grill & Diner');
  const [wholesalers, setWholesalers] = useState<string>('Sysco Wholesale, Gordon Food Service (GFS), US Foods');
  const [location, setLocation] = useState<string>('48084 (Troy, MI)');
  
  // Menu and Ingredient presets for the account
  const [menuSummary, setMenuSummary] = useState<string>('Classic Cheeseburger, Crispy Chicken Sandwich, Loaded Fries, Vanilla Milkshake, Iced Coffee, Vadapav');
  const [ingredientsSummary, setIngredientsSummary] = useState<string>('Refined Frying Oil ($2.10/gal), Ground Beef Blend ($4.20/lb), Brioche Buns ($0.25/ea), Cheddar Cheese ($3.50/lb), Potatoes ($0.40/lb), Chicken Breast ($2.80/lb)');

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [lastTrainedTime, setLastTrainedTime] = useState<string>('');

  // Fetch initial profile
  useEffect(() => {
    authenticatedFetch('/api/account/profile')
      .then((res) => res.json())
      .then((data) => {
        if (data?.accountProfile) {
          setRestaurantName(data.accountProfile.restaurantName || 'Troy Grill & Diner');
          setWholesalers(data.accountProfile.wholesaler || 'Sysco Wholesale, GFS');
          setLocation(data.accountProfile.location || '48084 (Troy, MI)');
          if (data.accountProfile.lastTrainedAt) {
            setLastTrainedTime(new Date(data.accountProfile.lastTrainedAt).toLocaleTimeString());
          }
        }
        if (data?.isUnlocked) {
          setIsUnlocked(true);
        }
      })
      .catch((err) => console.error("Error loading account profile:", err));
  }, []);

  // Verify PIN Code
  const handleVerifyPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pin.trim()) {
      setPinError('Please enter security PIN');
      return;
    }
    setIsVerifying(true);
    setPinError(null);

    try {
      const res = await authenticatedFetch('/api/account/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsUnlocked(true);
        setStatusMessage('PIN Verified! Admin Setup Bar Unlocked.');
      } else {
        setPinError(data.error || 'Invalid security PIN.');
      }
    } catch (err: any) {
      setPinError('Connection error verifying PIN.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Submit Account Configuration & Re-train AI
  const handleSaveAndRetrain = async () => {
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const res = await authenticatedFetch('/api/account/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin,
          restaurantName,
          wholesaler: wholesalers,
          location,
          retrainAi: true
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setLastTrainedTime(new Date().toLocaleTimeString());
        setStatusMessage(`Account Assigned & Retrained: ${data.message || 'RestoBot AI fully synchronized!'}`);
        if (onAccountTrained) {
          onAccountTrained(data);
        }
      } else {
        setStatusMessage(`Error: ${data.error || 'Failed to update account'}`);
      }
    } catch (err: any) {
      setStatusMessage(`Network error saving account settings.`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-xl mb-6 font-sans">
      
      {/* Header / Lock Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3 mb-4">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-xl flex items-center justify-center ${isUnlocked ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'}`}>
            {isUnlocked ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-white tracking-wide">Account Onboarding & Setup Portal</h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                isUnlocked 
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' 
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
              }`}>
                {isUnlocked ? 'Admin Unlocked' : 'PIN Protected'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Set up restaurant profile, assigned wholesalers, ZIP location, and menu ingredients for customized AI training.
            </p>
          </div>
        </div>

        {/* Active Account Pill or Quick Status */}
        {isUnlocked ? (
          <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-mono">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-300">Active: <strong className="text-amber-400">{restaurantName}</strong></span>
            {lastTrainedTime && (
              <span className="text-[10px] text-slate-500">({lastTrainedTime})</span>
            )}
          </div>
        ) : (
          <form onSubmit={handleVerifyPin} className="flex items-center space-x-2">
            <div className="relative">
              <KeyRound className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="password"
                placeholder="Enter your PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-40 bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
            <button
              type="submit"
              disabled={isVerifying}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-xl transition flex items-center space-x-1"
            >
              {isVerifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Unlock className="w-3.5 h-3.5" />}
              <span>Unlock</span>
            </button>
          </form>
        )}
      </div>

      {pinError && (
        <div className="mb-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs px-3 py-2 rounded-xl flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{pinError}</span>
        </div>
      )}

      {/* SETUP FORM CONTENT (VISIBLE WHEN UNLOCKED OR COMPACT VIEW) */}
      {isUnlocked ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1. Restaurant Name */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300 flex items-center space-x-1.5">
                <Store className="w-3.5 h-3.5 text-amber-400" />
                <span>Restaurant Name / Account:</span>
              </label>
              <input
                type="text"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                placeholder="e.g. Troy Grill & Diner"
              />
            </div>

            {/* 2. Wholesalers Used */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300 flex items-center space-x-1.5">
                <Truck className="w-3.5 h-3.5 text-sky-400" />
                <span>Primary Wholesalers / Distributors:</span>
              </label>
              <input
                type="text"
                value={wholesalers}
                onChange={(e) => setWholesalers(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                placeholder="e.g. Sysco, Gordon Food Service (GFS), US Foods"
              />
            </div>

            {/* 3. Location / ZIP */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300 flex items-center space-x-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>Location / ZIP Code (for Weather/Events):</span>
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                placeholder="e.g. 48084 (Troy, MI)"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Menu Items Setup */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300 flex items-center space-x-1.5">
                <Utensils className="w-3.5 h-3.5 text-purple-400" />
                <span>Assigned Menu Items & Dishes:</span>
              </label>
              <textarea
                value={menuSummary}
                onChange={(e) => setMenuSummary(e.target.value)}
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>

            {/* Ingredients Setup */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Core Ingredients & Wholesaler Unit Costs:</span>
              </label>
              <textarea
                value={ingredientsSummary}
                onChange={(e) => setIngredientsSummary(e.target.value)}
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
          </div>

          {/* Action Button: Train Everything One More Time */}
          <div className="flex items-center justify-between pt-1">
            <div className="text-xs text-slate-400 flex items-center space-x-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>Ready to bind account settings to RestoBot AI training context</span>
            </div>

            <button
              onClick={handleSaveAndRetrain}
              disabled={isSaving}
              className="bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-extrabold text-xs px-5 py-2.5 rounded-xl transition shadow-lg flex items-center space-x-2 disabled:opacity-50"
            >
              {isSaving ? (
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
              ) : (
                <Sparkles className="w-4 h-4 text-slate-950" />
              )}
              <span>Train Everything One More Time & Save Account</span>
            </button>
          </div>

          {statusMessage && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs px-3.5 py-2.5 rounded-xl font-mono flex items-center justify-between">
              <span>{statusMessage}</span>
              <span className="text-[10px] text-emerald-400/80 uppercase font-bold">100% Synced</span>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-3 text-center text-xs text-slate-400 font-mono">
          <span>Enter your security PIN above to unlock account settings.</span>
        </div>
      )}

    </div>
  );
}
