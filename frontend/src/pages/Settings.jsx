/**
 * Settings — Auron · Vehicle AI
 *
 * Sections (per spec):
 *  1. Account       — avatar, display name, email, account-type badge
 *  2. Vehicle       — make/model/variant/year/fuel/transmission/driving style
 *  3. Auron AI      — response style only (Concise | Balanced | Detailed)
 *  4. Notifications — single master toggle → user_preferences.notification_enabled
 *  5. Privacy       — change email (email/Google), change password (email),
 *                     anonymous upgrade
 *  6. Sign Out      — confirmation modal
 *  7. Danger Zone   — delete account (type DELETE + backend service-role)
 *
 *  ONE global "Save Changes" button covers Vehicle + AI + Notifications.
 *  Privacy/security actions each have their own submit button (intentional UX).
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User, Car, Bot, Bell, Shield, LogOut, Trash2,
  Save, Loader2, Check, AlertTriangle,
  Eye, EyeOff, X, Zap, Mail, Lock, Ghost,
} from 'lucide-react'
import { useAuth } from '../contexts/useAuth'
import { supabase } from '../lib/supabase'
import api from '../api/axios'

// ── helpers ───────────────────────────────────────────────────────────────────

function getAccountType(user) {
  if (!user) return 'unknown'
  if (user.is_anonymous) return 'anonymous'
  const provider = user.app_metadata?.provider
  if (provider === 'google') return 'google'
  return 'email'
}

function getAvatarUrl(user) {
  // Google profile picture is stored in user_metadata
  return user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null
}

function getInitials(displayName, email) {
  if (displayName?.trim()) {
    return displayName.trim().split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  }
  if (email) return email[0].toUpperCase()
  return '?'
}

// ── reusable UI ───────────────────────────────────────────────────────────────

function SectionCard({ id, icon: Icon, title, subtitle, children }) {
  return (
    <div id={id} className="bento-card">
      <div className="p-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">{title}</h2>
            {subtitle && <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Toggle({ id, checked, onChange, disabled }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent
        transition-colors duration-200 ease-in-out cursor-pointer
        disabled:opacity-40 disabled:cursor-not-allowed
        ${checked ? 'bg-indigo-500' : 'bg-white/10'}`}
    >
      <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow
        transform transition-transform duration-200 ease-in-out
        ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  )
}

function InputField({ label, id, type = 'text', value, onChange, placeholder, disabled, hint }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-neutral-400 uppercase tracking-widest">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]
          text-white placeholder-neutral-600 text-sm
          focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.06]
          disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      />
      {hint && <p className="text-xs text-neutral-600">{hint}</p>}
    </div>
  )
}

function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])

  const colors = type === 'success'
    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
    : 'bg-red-500/10 border-red-500/20 text-red-400'

  return (
    <div className={`fixed bottom-24 md:bottom-6 right-4 z-50 flex items-center gap-2.5 px-4 py-3
      rounded-xl border backdrop-blur-xl shadow-xl text-sm font-medium max-w-sm ${colors}`}>
      {type === 'success'
        ? <Check className="w-4 h-4 flex-shrink-0" />
        : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
      <span className="flex-1">{message}</span>
      <button onClick={onClose} className="ml-1 opacity-60 hover:opacity-100 flex-shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function Modal({ open, title, description, children, onClose }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-white/[0.10] bg-[#0d0d0d] p-6 shadow-2xl">
        <h3 className="text-base font-bold text-white mb-1">{title}</h3>
        <p className="text-sm text-neutral-400 mb-5">{description}</p>
        {children}
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="bento-card p-5 space-y-4 animate-pulse">
      <div className="h-4 w-1/3 bg-white/[0.06] rounded" />
      <div className="h-3 w-2/3 bg-white/[0.04] rounded" />
      <div className="h-3 w-1/2 bg-white/[0.04] rounded" />
    </div>
  )
}

// ── default pref state (matches trimmed schema) ───────────────────────────────
const DEFAULT_PREFS = {
  vehicle_make: '',
  vehicle_model: '',
  vehicle_variant: '',
  vehicle_year: '',
  fuel_type: '',
  transmission: '',
  driving_preference: '',
  response_style: 'balanced',
  notification_enabled: true,
}

const SELECT_CLS = `w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]
  text-white text-sm focus:outline-none focus:border-indigo-500/50
  focus:bg-white/[0.06] transition-all appearance-none`

// ═══════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════
export default function Settings() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  // ── state ─────────────────────────────────────────────────────
  const [pageLoading, setPageLoading]     = useState(true)
  const [toast, setToast]                 = useState(null)
  const [displayName, setDisplayName]     = useState('')
  const [prefs, setPrefs]                 = useState(DEFAULT_PREFS)
  const [saving, setSaving]               = useState(false)
  const [saved, setSaved]                 = useState(false)

  // privacy
  const [newEmail, setNewEmail]           = useState('')
  const [savingEmail, setSavingEmail]     = useState(false)
  const [newPw, setNewPw]                 = useState('')
  const [confirmPw, setConfirmPw]         = useState('')
  const [showPw, setShowPw]               = useState(false)
  const [savingPw, setSavingPw]           = useState(false)

  // anonymous upgrade
  const [upgradeEmail, setUpgradeEmail]   = useState('')
  const [upgradePw, setUpgradePw]         = useState('')
  const [upgradeConfirm, setUpgradeConfirm] = useState('')
  const [showUpgradePw, setShowUpgradePw] = useState(false)
  const [savingUpgrade, setSavingUpgrade] = useState(false)

  // sign-out
  const [showSignOutModal, setShowSignOutModal] = useState(false)
  const [signingOut, setSigningOut]       = useState(false)

  // delete
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteText, setDeleteText]       = useState('')
  const [deleting, setDeleting]           = useState(false)

  const accountType = getAccountType(user)
  const email       = user?.email || ''
  const avatarUrl   = getAvatarUrl(user)

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
  }, [])

  // ── Load ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    async function load() {
      setPageLoading(true)
      try {
        const [{ data: profileRow }, { data: prefRow }] = await Promise.all([
          supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle(),
          supabase.from('user_preferences').select('*').eq('user_id', user.id).maybeSingle(),
        ])
        if (profileRow?.display_name) setDisplayName(profileRow.display_name)
        if (prefRow) {
          setPrefs(prev => ({
            ...prev,
            ...Object.fromEntries(
              Object.entries(prefRow).filter(([k, v]) => v !== null && k in DEFAULT_PREFS)
            ),
          }))
        }
      } catch (e) {
        console.error('[Settings] load error:', e)
      } finally {
        setPageLoading(false)
      }
    }
    load()
  }, [user])

  function setPrefsKey(key, val) {
    setPrefs(prev => ({ ...prev, [key]: val }))
  }

  // ── Global Save (Vehicle + AI + Notifications) ────────────────
  async function handleSaveAll() {
    if (saving) return
    setSaving(true)
    setSaved(false)
    try {
      const patch = {
        user_id: user.id,
        vehicle_make:        prefs.vehicle_make       || null,
        vehicle_model:       prefs.vehicle_model      || null,
        vehicle_variant:     prefs.vehicle_variant    || null,
        vehicle_year:        prefs.vehicle_year       ? parseInt(prefs.vehicle_year, 10) : null,
        fuel_type:           prefs.fuel_type          || null,
        transmission:        prefs.transmission       || null,
        driving_preference:  prefs.driving_preference || null,
        response_style:      prefs.response_style,
        notification_enabled: prefs.notification_enabled,
      }
      const { error: prefErr } = await supabase
        .from('user_preferences')
        .upsert(patch, { onConflict: 'user_id' })
      if (prefErr) throw prefErr

      // Also save display name to profiles
      if (!user.is_anonymous) {
        const { error: profileErr } = await supabase
          .from('profiles')
          .upsert({ id: user.id, display_name: displayName.trim() || null }, { onConflict: 'id' })
        if (profileErr) throw profileErr
      }

      setSaved(true)
      showToast('Settings saved successfully.')
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      showToast(e?.message || 'Failed to save settings.', 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── Change Email ──────────────────────────────────────────────
  async function handleChangeEmail() {
    if (!newEmail.trim()) { showToast('Please enter a new email address.', 'error'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) { showToast('Please enter a valid email address.', 'error'); return }
    setSavingEmail(true)
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
      if (error) throw error
      showToast('Confirmation email sent. Check your inbox to confirm the new address.')
      setNewEmail('')
    } catch (e) {
      showToast(e?.message || 'Failed to update email.', 'error')
    } finally {
      setSavingEmail(false)
    }
  }

  // ── Change Password ───────────────────────────────────────────
  async function handleChangePassword() {
    if (newPw !== confirmPw) { showToast('Passwords do not match.', 'error'); return }
    if (newPw.length < 6)   { showToast('Password must be at least 6 characters.', 'error'); return }
    setSavingPw(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw })
      if (error) throw error
      setNewPw(''); setConfirmPw('')
      showToast('Password changed successfully.')
    } catch (e) {
      showToast(e?.message || 'Failed to change password.', 'error')
    } finally {
      setSavingPw(false)
    }
  }

  // ── Anonymous Upgrade ─────────────────────────────────────────
  async function handleUpgrade() {
    if (!upgradeEmail.trim()) { showToast('Please enter an email address.', 'error'); return }
    if (upgradePw !== upgradeConfirm) { showToast('Passwords do not match.', 'error'); return }
    if (upgradePw.length < 6) { showToast('Password must be at least 6 characters.', 'error'); return }
    setSavingUpgrade(true)
    try {
      const { error } = await supabase.auth.updateUser({ email: upgradeEmail, password: upgradePw })
      if (error) throw error
      showToast('Account created! Your data is now permanently saved.')
      setUpgradeEmail(''); setUpgradePw(''); setUpgradeConfirm('')
    } catch (e) {
      showToast(e?.message || 'Failed to create account.', 'error')
    } finally {
      setSavingUpgrade(false)
    }
  }

  // ── Sign Out ──────────────────────────────────────────────────
  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
      navigate('/login')
    } catch {
      showToast('Failed to sign out.', 'error')
      setSigningOut(false)
      setShowSignOutModal(false)
    }
  }

  // ── Delete Account ────────────────────────────────────────────
  async function handleDeleteAccount() {
    if (deleteText !== 'DELETE') return
    setDeleting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await api.delete('/api/auth/delete-account', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      await signOut()
      navigate('/login')
    } catch (e) {
      showToast(
        e?.response?.data?.detail || e?.message || 'Account deletion failed.',
        'error'
      )
      setDeleting(false)
    }
  }

  // ── Loading ───────────────────────────────────────────────────
  if (pageLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="mb-6">
          <div className="h-8 w-32 bg-white/[0.06] rounded animate-pulse" />
          <div className="h-4 w-48 bg-white/[0.04] rounded animate-pulse mt-2" />
        </div>
        {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-24 md:pb-8">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-white">Settings</h1>
        <p className="text-sm text-neutral-500 mt-1">Manage your account and Auron preferences.</p>
      </div>

      {/* ══════════════════════════════════════════════════════
          1. ACCOUNT
          ══════════════════════════════════════════════════════ */}
      <SectionCard id="settings-account" icon={User} title="Account" subtitle="Your profile and account type">

        {/* Avatar row */}
        <div className="flex items-center gap-4 mb-5">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {accountType !== 'anonymous' && avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profile"
                className="w-14 h-14 rounded-full object-cover border-2 border-white/10"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500/30 to-cyan-500/20 border-2 border-white/10 flex items-center justify-center text-xl">
                {accountType === 'anonymous' ? '🚗' : (
                  <span className="text-base font-bold text-white">{getInitials(displayName, email)}</span>
                )}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate">
              {accountType === 'anonymous' ? 'Anonymous User' : (displayName || email || 'Auron User')}
            </p>
            {accountType !== 'anonymous' && email && (
              <p className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5 truncate">
                <Mail className="w-3 h-3 flex-shrink-0" />{email}
              </p>
            )}
            <div className="mt-1.5">
              {accountType === 'google' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <svg width="10" height="10" viewBox="0 0 18 18" aria-hidden="true">
                    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                    <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
                  </svg>
                  Google Account
                </span>
              )}
              {accountType === 'email' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Mail className="w-2.5 h-2.5" /> Email Account
                </span>
              )}
              {accountType === 'anonymous' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-500/10 text-neutral-400 border border-neutral-500/20">
                  <Ghost className="w-2.5 h-2.5" /> Anonymous Account
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Display Name — non-anonymous only; saved by global Save Changes */}
        {accountType !== 'anonymous' && (
          <InputField
            id="settings-display-name"
            label="Display Name"
            value={displayName}
            onChange={setDisplayName}
            placeholder="Your name"
            hint="Saved when you click Save Changes below."
          />
        )}

        {/* Anonymous message */}
        {accountType === 'anonymous' && (
          <div className="rounded-xl bg-neutral-500/5 border border-neutral-500/10 p-4">
            <p className="text-sm text-neutral-400 leading-relaxed">
              🚗 You are browsing Auron anonymously. Your preferences are saved for this session.
              Create a permanent account in <span className="text-white font-medium">Privacy &amp; Security</span> below to keep your data forever.
            </p>
          </div>
        )}
      </SectionCard>

      {/* ══════════════════════════════════════════════════════
          2. VEHICLE PREFERENCES
          ══════════════════════════════════════════════════════ */}
      <SectionCard id="settings-vehicle" icon={Car} title="Vehicle Preferences" subtitle="Your primary vehicle — used by Auron AI in every response">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <InputField id="veh-make" label="Manufacturer" value={prefs.vehicle_make} onChange={v => setPrefsKey('vehicle_make', v)} placeholder="e.g. Tata, Hyundai" />
            <InputField id="veh-model" label="Model" value={prefs.vehicle_model} onChange={v => setPrefsKey('vehicle_model', v)} placeholder="e.g. Nexon, Creta" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <InputField id="veh-variant" label="Variant" value={prefs.vehicle_variant} onChange={v => setPrefsKey('vehicle_variant', v)} placeholder="e.g. XZ+, SX(O)" />
            <InputField id="veh-year" label="Year" type="number" value={prefs.vehicle_year} onChange={v => setPrefsKey('vehicle_year', v)} placeholder="e.g. 2023" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="veh-fuel" className="text-xs font-medium text-neutral-400 uppercase tracking-widest">Fuel Type</label>
              <select id="veh-fuel" value={prefs.fuel_type} onChange={e => setPrefsKey('fuel_type', e.target.value)} className={SELECT_CLS}>
                <option value="">Select</option>
                {['Petrol','Diesel','Electric','Hybrid','CNG'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="veh-trans" className="text-xs font-medium text-neutral-400 uppercase tracking-widest">Transmission</label>
              <select id="veh-trans" value={prefs.transmission} onChange={e => setPrefsKey('transmission', e.target.value)} className={SELECT_CLS}>
                <option value="">Select</option>
                {['Manual','Automatic','AMT','CVT','DCT'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="veh-drive" className="text-xs font-medium text-neutral-400 uppercase tracking-widest">Driving Style</label>
              <select id="veh-drive" value={prefs.driving_preference} onChange={e => setPrefsKey('driving_preference', e.target.value)} className={SELECT_CLS}>
                <option value="">Select</option>
                {['Economy','Balanced','Performance'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ══════════════════════════════════════════════════════
          3. AURON AI PREFERENCES
          ══════════════════════════════════════════════════════ */}
      <SectionCard id="settings-ai" icon={Bot} title="Auron AI Preferences" subtitle="Choose how Auron responds to you">
        <div>
          <p className="text-xs font-medium text-neutral-400 uppercase tracking-widest mb-3">Response Style</p>
          <div className="grid grid-cols-3 gap-2">
            {['concise', 'balanced', 'detailed'].map(style => (
              <button
                key={style}
                id={`ai-style-${style}`}
                type="button"
                onClick={() => setPrefsKey('response_style', style)}
                className={`py-2.5 rounded-xl border text-xs font-semibold capitalize transition-all
                  ${prefs.response_style === style
                    ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                    : 'bg-white/[0.02] border-white/[0.07] text-neutral-500 hover:border-white/20 hover:text-neutral-300'
                  }`}
              >
                {style}
              </button>
            ))}
          </div>
          <p className="text-xs text-neutral-600 mt-2.5">
            {prefs.response_style === 'concise'  && 'Short, direct answers — ideal for quick lookups.'}
            {prefs.response_style === 'balanced' && 'The default — thorough but not overwhelming.'}
            {prefs.response_style === 'detailed' && 'In-depth explanations with context and examples.'}
          </p>
        </div>
      </SectionCard>

      {/* ══════════════════════════════════════════════════════
          4. NOTIFICATIONS
          ══════════════════════════════════════════════════════ */}
      <SectionCard id="settings-notifications" icon={Bell} title="Notifications" subtitle="Auron system notifications and updates">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white">Notifications</p>
            <p className="text-xs text-neutral-500 mt-0.5">Receive important Auron notifications and updates.</p>
          </div>
          <Toggle
            id="toggle-notifications"
            checked={prefs.notification_enabled}
            onChange={v => setPrefsKey('notification_enabled', v)}
          />
        </div>
      </SectionCard>

      {/* ══════════════════════════════════════════════════════
          5. PRIVACY & SECURITY
          ══════════════════════════════════════════════════════ */}
      <SectionCard id="settings-privacy" icon={Shield} title="Privacy &amp; Security" subtitle="Account security settings">

        {/* ── Anonymous → Upgrade ──────────────────────────────── */}
        {accountType === 'anonymous' && (
          <div>
            <div className="rounded-xl bg-indigo-500/5 border border-indigo-500/15 p-4 mb-4">
              <p className="text-sm font-semibold text-white mb-1">🚀 Create a permanent account</p>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Link an email and password to your anonymous session. All your current data — vehicle prefs, conversations, and documents — will be preserved.
              </p>
            </div>
            <div className="space-y-3">
              <InputField id="upgrade-email" label="Email address" type="email" value={upgradeEmail} onChange={setUpgradeEmail} placeholder="you@example.com" />
              <InputField id="upgrade-pw" label="Create password" type={showUpgradePw ? 'text' : 'password'} value={upgradePw} onChange={setUpgradePw} placeholder="Min. 6 characters" />
              <InputField id="upgrade-confirm" label="Confirm password" type={showUpgradePw ? 'text' : 'password'} value={upgradeConfirm} onChange={setUpgradeConfirm} placeholder="Repeat password" />
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => setShowUpgradePw(p => !p)} className="text-xs text-neutral-500 flex items-center gap-1.5 hover:text-neutral-300 transition-colors">
                  {showUpgradePw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showUpgradePw ? 'Hide password' : 'Show password'}
                </button>
                <button
                  id="upgrade-submit-btn"
                  type="button"
                  onClick={handleUpgrade}
                  disabled={savingUpgrade}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl btn-gradient text-xs font-semibold disabled:opacity-60 transition-all"
                >
                  {savingUpgrade
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Creating…</>
                    : <><Zap className="w-3.5 h-3.5" />Create permanent account</>
                  }
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Email user: Change Email + Change Password ────────── */}
        {accountType === 'email' && (
          <div className="space-y-6">
            {/* Change Email */}
            <div>
              <p className="text-xs font-medium text-neutral-400 uppercase tracking-widest mb-3">Change Email</p>
              <div className="space-y-3">
                <InputField
                  id="change-email"
                  label="New email address"
                  type="email"
                  value={newEmail}
                  onChange={setNewEmail}
                  placeholder="new@example.com"
                  hint="A confirmation link will be sent to the new address."
                />
                <div className="flex justify-end">
                  <button
                    id="change-email-btn"
                    type="button"
                    onClick={handleChangeEmail}
                    disabled={savingEmail}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl btn-gradient text-xs font-semibold disabled:opacity-60 transition-all"
                  >
                    {savingEmail
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Sending…</>
                      : <><Mail className="w-3.5 h-3.5" />Update email</>
                    }
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t border-white/[0.05]" />

            {/* Change Password */}
            <div>
              <p className="text-xs font-medium text-neutral-400 uppercase tracking-widest mb-3">Change Password</p>
              <div className="space-y-3">
                <InputField id="new-pw" label="New password" type={showPw ? 'text' : 'password'} value={newPw} onChange={setNewPw} placeholder="Min. 6 characters" />
                <InputField id="confirm-pw" label="Confirm new password" type={showPw ? 'text' : 'password'} value={confirmPw} onChange={setConfirmPw} placeholder="Repeat new password" />
                <div className="flex items-center justify-between">
                  <button type="button" onClick={() => setShowPw(p => !p)} className="text-xs text-neutral-500 flex items-center gap-1.5 hover:text-neutral-300 transition-colors">
                    {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {showPw ? 'Hide' : 'Show'}
                  </button>
                  <button
                    id="change-pw-btn"
                    type="button"
                    onClick={handleChangePassword}
                    disabled={savingPw}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl btn-gradient text-xs font-semibold disabled:opacity-60 transition-all"
                  >
                    {savingPw
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</>
                      : <><Lock className="w-3.5 h-3.5" />Change password</>
                    }
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Google user ───────────────────────────────────────── */}
        {accountType === 'google' && (
          <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4">
            <p className="text-sm text-neutral-400 leading-relaxed">
              Your account is managed by <span className="text-white font-medium">Google</span>. To change your email or password, visit your{' '}
              <a href="https://myaccount.google.com" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">Google Account settings</a>.
            </p>
          </div>
        )}
      </SectionCard>

      {/* ══════════════════════════════════════════════════════
          GLOBAL SAVE CHANGES BUTTON
          ══════════════════════════════════════════════════════ */}
      <div className="bento-card p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Save Changes</p>
          <p className="text-xs text-neutral-500 mt-0.5">Saves vehicle preferences, AI style, and notification settings.</p>
        </div>
        <button
          id="settings-save-btn"
          type="button"
          onClick={handleSaveAll}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl btn-gradient text-sm font-semibold
            disabled:opacity-60 disabled:cursor-not-allowed transition-all flex-shrink-0 w-full sm:w-auto justify-center"
        >
          {saving
            ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Saving…</span></>
            : saved
            ? <><Check className="w-4 h-4" /><span>Saved!</span></>
            : <><Save className="w-4 h-4" /><span>Save Changes</span></>
          }
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════
          6. SIGN OUT
          ══════════════════════════════════════════════════════ */}
      <SectionCard id="settings-signout" icon={LogOut} title="Sign Out" subtitle="End your current Auron session">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-neutral-400">You will need to sign in again to access your account.</p>
          <button
            id="settings-signout-btn"
            type="button"
            onClick={() => setShowSignOutModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.10] bg-white/[0.03] text-sm font-medium text-white hover:bg-white/[0.07] hover:border-white/20 transition-all flex-shrink-0"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </SectionCard>

      {/* ══════════════════════════════════════════════════════
          7. DANGER ZONE
          ══════════════════════════════════════════════════════ */}
      <div id="settings-danger" className="rounded-2xl border border-red-500/20 bg-red-500/[0.02] overflow-hidden">
        <div className="p-5 border-b border-red-500/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-red-400">Danger Zone</h2>
              <p className="text-xs text-neutral-500 mt-0.5">Irreversible account actions</p>
            </div>
          </div>
        </div>
        <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">Delete Account</p>
            <p className="text-xs text-neutral-500 mt-0.5">
              Permanently delete your Auron account and all associated data — documents, conversations, and preferences.
            </p>
          </div>
          <button
            id="settings-delete-btn"
            type="button"
            onClick={() => { setShowDeleteModal(true); setDeleteText('') }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/30 bg-red-500/5 text-sm font-medium text-red-400 hover:bg-red-500/10 hover:border-red-500/50 transition-all flex-shrink-0"
          >
            <Trash2 className="w-4 h-4" />
            Delete Account
          </button>
        </div>
      </div>

      {/* Branding footer */}
      <div className="flex items-center justify-center gap-2 text-xs text-neutral-600 py-2">
        <Zap className="w-3.5 h-3.5 text-indigo-400" />
        <span className="gradient-text font-semibold">Auron</span>
        <span>· Vehicle AI</span>
      </div>

      {/* ══════════════════════════════════════════════════════
          MODALS
          ══════════════════════════════════════════════════════ */}

      {/* Sign Out */}
      <Modal
        open={showSignOutModal}
        title="Sign out of Auron?"
        description="You will need to sign in again to access your account and preferences."
        onClose={() => !signingOut && setShowSignOutModal(false)}
      >
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={() => setShowSignOutModal(false)}
            disabled={signingOut}
            className="px-4 py-2 rounded-xl border border-white/10 bg-white/[0.03] text-sm text-neutral-300 hover:bg-white/[0.06] disabled:opacity-50 transition-all"
          >
            Cancel
          </button>
          <button
            id="signout-confirm-btn"
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/[0.08] text-sm font-medium text-white hover:bg-white/[0.14] disabled:opacity-60 transition-all"
          >
            {signingOut ? <><Loader2 className="w-4 h-4 animate-spin" />Signing out…</> : 'Sign Out'}
          </button>
        </div>
      </Modal>

      {/* Delete Account */}
      <Modal
        open={showDeleteModal}
        title="Delete your account?"
        description="Your account and associated data will be permanently deleted. This action cannot be undone."
        onClose={() => !deleting && (setShowDeleteModal(false), setDeleteText(''))}
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-red-500/5 border border-red-500/15 p-3 text-xs text-red-400">
            Type <span className="font-bold font-mono tracking-wider">DELETE</span> in the box below to enable the delete button.
          </div>
          <input
            id="delete-confirm-input"
            type="text"
            value={deleteText}
            onChange={e => setDeleteText(e.target.value)}
            placeholder="Type DELETE to confirm"
            className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-neutral-600 text-sm font-mono focus:outline-none focus:border-red-500/40 transition-all"
          />
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => { setShowDeleteModal(false); setDeleteText('') }}
              disabled={deleting}
              className="px-4 py-2 rounded-xl border border-white/10 bg-white/[0.03] text-sm text-neutral-300 hover:bg-white/[0.06] disabled:opacity-50 transition-all"
            >
              Cancel
            </button>
            <button
              id="delete-confirm-btn"
              type="button"
              onClick={handleDeleteAccount}
              disabled={deleteText !== 'DELETE' || deleting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-500/30 bg-red-500/10 text-sm font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {deleting
                ? <><Loader2 className="w-4 h-4 animate-spin" />Deleting…</>
                : <><Trash2 className="w-4 h-4" />Delete my account</>
              }
            </button>
          </div>
        </div>
      </Modal>

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
