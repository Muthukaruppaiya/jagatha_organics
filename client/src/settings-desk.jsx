import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AdminShell } from './admin.jsx';
import { api, readStaff, STATES } from './api.js';
import { DEFAULT_SHIPPING, normalizeShipping } from './shipping.js';

function rupeeField(value, onChange, placeholder) {
  return (
    <input
      type="number"
      min="0"
      step="1"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
    />
  );
}

export function AdminSettings() {
  const person = readStaff();
  const [shop, setShop] = useState({ name: 'Jagatha Organics', address: '', phone: '', email: '', gstin: '' });
  const [shipping, setShipping] = useState(DEFAULT_SHIPPING);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.settings()
      .then((data) => {
        if (data.shop) setShop(data.shop);
        if (data.shipping) setShipping(normalizeShipping(data.shipping));
      })
      .catch((err) => setError(err.message));
  }, []);

  function setDefault(key, value) {
    setShipping((current) => ({ ...current, [key]: value }));
  }

  function setStateRule(name, patch) {
    setShipping((current) => {
      const next = { ...(current.states || {}) };
      const currentRule = next[name] || { mode: 'inherit', flatRupees: current.defaultFlatRupees, slabGrams: current.defaultSlabGrams, slabRupees: current.defaultSlabRupees };
      const merged = { ...currentRule, ...patch };
      if (merged.mode === 'inherit') delete next[name];
      else next[name] = merged;
      return { ...current, states: next };
    });
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSaved('');
    try {
      const next = await api.saveSettings({ shop, shipping: normalizeShipping(shipping) });
      setShop(next.shop);
      setShipping(next.shipping);
      setSaved('Settings saved. New orders will use these delivery charges.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (person && person.role !== 'admin') return <Navigate to="/admin" replace />;

  const visible = STATES.filter((state) => state.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <AdminShell eyebrow="Desk" title="Settings" lead="Shop details for invoices, and delivery charges by state. Tamil Nadu is free until you change it.">
      <form className="settings-desk" onSubmit={save}>
        <section className="glass order-card-block">
          <h2>Shop for printouts</h2>
          <div className="settings-grid">
            <label>Shop name<input value={shop.name} onChange={(event) => setShop({ ...shop, name: event.target.value })} required /></label>
            <label>Phone<input value={shop.phone} onChange={(event) => setShop({ ...shop, phone: event.target.value.replace(/\D/g, '').slice(0, 10) })} inputMode="tel" /></label>
            <label className="wide">Address<textarea value={shop.address} onChange={(event) => setShop({ ...shop, address: event.target.value })} rows={2} /></label>
            <label>Email<input type="email" value={shop.email} onChange={(event) => setShop({ ...shop, email: event.target.value })} /></label>
            <label>GSTIN<input value={shop.gstin} onChange={(event) => setShop({ ...shop, gstin: event.target.value.toUpperCase().slice(0, 15) })} placeholder="Optional" /></label>
          </div>
        </section>

        <section className="glass order-card-block">
          <h2>Default delivery</h2>
          <p className="muted">Used for any state that is set to Inherit. Weight is by pack grams.</p>
          <div className="settings-grid">
            <label>Charge
              <select value={shipping.defaultMode} onChange={(event) => setDefault('defaultMode', event.target.value)}>
                <option value="free">Free</option>
                <option value="flat">Flat ₹ per order</option>
                <option value="weight">₹ per weight slab</option>
              </select>
            </label>
            {shipping.defaultMode === 'flat' && (
              <label>Flat ₹ {rupeeField(shipping.defaultFlatRupees, (value) => setDefault('defaultFlatRupees', value), '75')}</label>
            )}
            {shipping.defaultMode === 'weight' && (
              <>
                <label>₹ per slab {rupeeField(shipping.defaultSlabRupees, (value) => setDefault('defaultSlabRupees', value), '75')}</label>
                <label>Slab grams {rupeeField(shipping.defaultSlabGrams, (value) => setDefault('defaultSlabGrams', value), '500')}</label>
              </>
            )}
          </div>
        </section>

        <section className="glass order-card-block">
          <div className="editor-head">
            <h2>State charges</h2>
            <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Find a state" aria-label="Find a state" />
          </div>
          <div className="state-rates">
            <div className="state-rate head">
              <span>State</span>
              <span>Charge</span>
              <span>Amount</span>
            </div>
            {visible.map((name) => {
              const rule = shipping.states?.[name] || { mode: 'inherit', flatRupees: shipping.defaultFlatRupees, slabGrams: shipping.defaultSlabGrams, slabRupees: shipping.defaultSlabRupees };
              return (
                <div key={name} className="state-rate">
                  <b>{name}</b>
                  <select value={rule.mode} onChange={(event) => setStateRule(name, { mode: event.target.value })}>
                    <option value="inherit">Inherit default</option>
                    <option value="free">Free</option>
                    <option value="flat">Flat ₹</option>
                    <option value="weight">₹ / slab</option>
                  </select>
                  {rule.mode === 'flat' && rupeeField(rule.flatRupees, (value) => setStateRule(name, { flatRupees: value }), '75')}
                  {rule.mode === 'weight' && (
                    <span className="state-weight">
                      {rupeeField(rule.slabRupees, (value) => setStateRule(name, { slabRupees: value }), '75')}
                      <small>/ {rule.slabGrams || shipping.defaultSlabGrams}g</small>
                    </span>
                  )}
                  {(rule.mode === 'inherit' || rule.mode === 'free') && <small className="muted">{rule.mode === 'free' ? 'No delivery charge' : 'Uses default'}</small>}
                </div>
              );
            })}
          </div>
        </section>

        {error && <p className="status error">{error}</p>}
        {saved && <p className="note">{saved}</p>}
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button>
      </form>
    </AdminShell>
  );
}
