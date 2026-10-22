import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { addressText, api, clearCustomer, inr, lookupPincode, paymentLabel, readCustomer, saveCustomer, STATES, STATUS_LABEL, when } from './api.js';
import { useCart } from './cart.jsx';
import { cartGrams, DEFAULT_SHIPPING, pinNumber, shippingHint, shippingPaise } from './shipping.js';

const BLANK_ADDRESS = {
  name: '',
  phone: '',
  pincode: '',
  locality: '',
  addressLine: '',
  city: '',
  state: 'Tamil Nadu',
  landmark: '',
  altPhone: '',
  addressType: 'home',
};

function cleanPhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length >= 12) digits = digits.slice(-10);
  else if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
  else if (digits.length > 10) digits = digits.slice(-10);
  return digits;
}

const PAY_METHODS = [
  { id: 'upi', label: 'UPI', hint: 'GPay, PhonePe, Paytm' },
  { id: 'card', label: 'Cards', hint: 'Visa, Mastercard, Rupay' },
  { id: 'netbanking', label: 'Net banking', hint: 'All Indian banks' },
  { id: 'wallet', label: 'Wallets', hint: 'Paytm, Amazon Pay' },
];

function PayIcon({ id }) {
  if (id === 'card') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M2 10h20" stroke="currentColor" strokeWidth="1.7" /><path d="M6 15h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
    );
  }
  if (id === 'netbanking') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 19h18M4 19V10l8-5 8 5v9" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M9 19v-5h6v5" fill="none" stroke="currentColor" strokeWidth="1.7" /></svg>
    );
  }
  if (id === 'wallet') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M3 10h18" stroke="currentColor" strokeWidth="1.7" /><circle cx="16.5" cy="14.5" r="1.2" fill="currentColor" /></svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M8 12.5c1.2 2 6.8 2 8 0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /><circle cx="9" cy="10" r="1" fill="currentColor" /><circle cx="15" cy="10" r="1" fill="currentColor" /></svg>
  );
}

function AddressForm({ initial, onSubmit, onCancel, submitLabel }) {
  const [form, setForm] = useState({ ...BLANK_ADDRESS, ...initial });
  const [localities, setLocalities] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const setPhone = (key, value) => set(key, cleanPhone(value).slice(0, 10));

  useEffect(() => {
    if (!/^\d{6}$/.test(form.pincode)) return undefined;
    let live = true;
    lookupPincode(form.pincode).then((found) => {
      if (!live || !found) return;
      setLocalities(found.localities);
      setForm((current) => ({
        ...current,
        city: current.city || found.city,
        state: found.state || current.state,
        locality: current.locality || (found.localities.length === 1 ? found.localities[0] : ''),
      }));
    });
    return () => { live = false; };
  }, [form.pincode]);

  async function submit(event) {
    event.preventDefault();
    const root = event.currentTarget;
    const live = (name) => root.elements.namedItem(name)?.value ?? form[name];
    const next = {
      ...form,
      name: String(live('name') || '').trim(),
      phone: cleanPhone(live('phone')),
      pincode: String(live('pincode') || '').replace(/\D/g, '').slice(0, 6),
      locality: String(live('locality') || '').trim(),
      addressLine: String(live('addressLine') || '').trim(),
      city: String(live('city') || '').trim(),
      state: String(live('state') || form.state).trim(),
      landmark: String(live('landmark') || '').trim(),
      altPhone: cleanPhone(live('altPhone')),
    };
    if (!/^\d{10}$/.test(next.phone)) {
      setError('Enter a 10-digit mobile number.');
      return;
    }
    setForm(next);
    setBusy(true);
    setError('');
    try {
      await onSubmit(next);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="address-form" onSubmit={submit}>
      <div className="field-grid">
        <label className="field"><input name="name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder=" " required autoComplete="name" /><span>Name</span></label>
        <label className="field"><input name="phone" value={form.phone} onChange={(e) => setPhone('phone', e.target.value)} onInput={(e) => setPhone('phone', e.target.value)} placeholder=" " required inputMode="tel" autoComplete="tel" minLength={10} maxLength={10} pattern="[0-9]{10}" /><span>10-digit mobile number</span></label>
        <label className="field"><input name="pincode" value={form.pincode} onChange={(e) => set('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder=" " required inputMode="numeric" autoComplete="postal-code" /><span>Pincode</span></label>
        <label className="field">
          <input name="locality" value={form.locality} onChange={(e) => set('locality', e.target.value)} placeholder=" " required list="locality-options" />
          <span>Locality</span>
          <datalist id="locality-options">{localities.map((item) => <option key={item} value={item} />)}</datalist>
        </label>
        <label className="field wide"><textarea name="addressLine" value={form.addressLine} onChange={(e) => set('addressLine', e.target.value)} placeholder=" " required rows={3} autoComplete="street-address" /><span>Address (Area and Street)</span></label>
        <label className="field"><input name="city" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder=" " required autoComplete="address-level2" /><span>City/District/Town</span></label>
        <label className="field select">
          <select name="state" value={form.state} onChange={(e) => set('state', e.target.value)} required>
            <option value="">--Select State--</option>
            {STATES.map((state) => <option key={state} value={state}>{state}</option>)}
          </select>
          <span>State</span>
        </label>
        <label className="field"><input name="landmark" value={form.landmark} onChange={(e) => set('landmark', e.target.value)} placeholder=" " /><span>Landmark (Optional)</span></label>
        <label className="field"><input name="altPhone" value={form.altPhone} onChange={(e) => setPhone('altPhone', e.target.value)} placeholder=" " inputMode="tel" autoComplete="tel" /><span>Alternate Phone (Optional)</span></label>
      </div>
      <fieldset className="address-type">
        <legend>Address Type</legend>
        <label><input type="radio" name="addressType" checked={form.addressType === 'home'} onChange={() => set('addressType', 'home')} /> Home <small>(All day delivery)</small></label>
        <label><input type="radio" name="addressType" checked={form.addressType === 'work'} onChange={() => set('addressType', 'work')} /> Work <small>(Delivery between 10 AM - 5 PM)</small></label>
      </fieldset>
      {error && <p className="status error">{error}</p>}
      <div className="step-actions">
        <button className="btn step-cta" type="submit" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
        {onCancel && <button className="text-btn" type="button" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

function Step({ number, title, done, open, summary, onChange, locked, children }) {
  return (
    <section className={`step${open ? ' open' : ''}${done ? ' done' : ''}`}>
      <header className="step-head">
        <span className="step-no">{done && !open ? '✓' : number}</span>
        <div>
          <h2>{title}</h2>
          {done && !open && summary && <div className="step-summary">{summary}</div>}
        </div>
        {done && !open && onChange && !locked && <button className="step-change" type="button" onClick={onChange}>Change</button>}
      </header>
      {open && <div className="step-body">{children}</div>}
    </section>
  );
}

export function PriceDetails({ items, pincode = '', state = '', onPincode, shippingPaise: lockedShipping, children }) {
  const [rules, setRules] = useState(DEFAULT_SHIPPING);
  useEffect(() => {
    api.shipping().then((data) => { if (data) setRules(data); });
  }, []);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const mrp = items.reduce((sum, item) => sum + Math.max(item.comparePaise || 0, item.pricePaise) * item.quantity, 0);
  const goods = items.reduce((sum, item) => sum + item.pricePaise * item.quantity, 0);
  const discount = mrp - goods;
  const pinReady = Boolean(pinNumber(pincode) || state);
  const delivery = Number.isInteger(lockedShipping) ? lockedShipping : shippingPaise({ pincode, state, grams: cartGrams(items) }, rules);
  const total = goods + (pinReady || Number.isInteger(lockedShipping) ? delivery : 0);
  return (
    <aside className="price-card">
      <h2>Price details</h2>
      <p><span>Price ({count} item{count === 1 ? '' : 's'})</span><b>{inr(mrp)}</b></p>
      {discount > 0 && <p><span>Discount</span><b className="save">−{inr(discount)}</b></p>}
      {onPincode && (
        <label className="field">
          <input value={pincode} onChange={(event) => onPincode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder=" " inputMode="numeric" autoComplete="postal-code" />
          <span>Delivery pincode</span>
        </label>
      )}
      <p>
        <span>Delivery</span>
        <b className={(pinReady && delivery === 0) ? 'save' : undefined}>
          {!pinReady && !Number.isInteger(lockedShipping) ? 'Enter pincode' : delivery === 0 ? 'Free' : inr(delivery)}
        </b>
      </p>
      <p className="price-total"><span>Total amount</span><b>{inr(total)}</b></p>
      {discount > 0 && <p className="price-save">You will save {inr(discount)} on this order</p>}
      <p className="price-safe">{shippingHint(rules, { pincode, state, paise: delivery })}</p>
      <p className="price-safe">Safe and secure payments through Razorpay</p>
      {children}
    </aside>
  );
}

function accountEmail(customer) {
  const email = customer?.email || '';
  return email.endsWith('@phone.jagathaorganics.com') ? '' : email;
}

export function Checkout() {
  const cart = useCart();
  const navigate = useNavigate();
  const [account, setAccount] = useState(() => readCustomer());
  const [step, setStep] = useState(() => (readCustomer() ? 'address' : 'mobile'));
  const [addresses, setAddresses] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [address, setAddress] = useState(null);
  const [editing, setEditing] = useState(() => (readCustomer() ? null : 'new'));
  const [email, setEmail] = useState(() => accountEmail(readCustomer()));
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(null);
  const [payMethod, setPayMethod] = useState('upi');
  const [gateway, setGateway] = useState('');
  const [shipRules, setShipRules] = useState(DEFAULT_SHIPPING);
  const [accountKind, setAccountKind] = useState('');
  const [otpPhone, setOtpPhone] = useState(() => readCustomer()?.phone || '');
  const [otpName, setOtpName] = useState(() => readCustomer()?.name || '');
  const [otpCode, setOtpCode] = useState('');
  const [otpShown, setOtpShown] = useState('');
  const [otpSent, setOtpSent] = useState(null);
  const [otpWait, setOtpWait] = useState(0);

  useEffect(() => {
    api.health().then((data) => setGateway(data.payments || 'off')).catch(() => setGateway('off'));
    api.shipping().then((data) => { if (data) setShipRules(data); });
  }, []);

  useEffect(() => {
    if (account) return undefined;
    let live = true;
    api.accountMe()
      .then((me) => {
        if (!live) return;
        saveCustomer(me);
        setAccount(me);
        setEmail(accountEmail(me));
        setOtpPhone(me.phone || '');
        setOtpName(me.name || '');
        setStep('address');
      })
      .catch(() => {});
    return () => { live = false; };
  }, [account]);

  useEffect(() => {
    if (otpWait <= 0) return undefined;
    const timer = window.setTimeout(() => setOtpWait((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [otpWait]);

  useEffect(() => {
    if (!account) return;
    api.addresses()
      .then((list) => {
        setAddresses(list);
        setSelectedId(list[0]?.id || null);
        if (!list.length) setEditing('new');
      })
      .catch(() => setEditing('new'));
  }, [account?.id]);

  if (cart.items.length === 0 && !started) {
    return (
      <div className="wrap page narrow">
        <h1>Checkout</h1>
        <p>Your cart is empty.</p>
        <Link className="btn" to="/shop">Shop</Link>
      </div>
    );
  }

  function applyAccount(result) {
    saveCustomer(result);
    setAccount(result.customer);
    setEmail(accountEmail(result.customer));
    setAddresses(result.addresses || []);
    setSelectedId(result.addresses?.[0]?.id || null);
    setAccountKind(result.exists ? (result.addresses?.length ? 'returning' : 'existing') : 'new');
    setEditing(result.addresses?.length ? null : 'new');
    setStep('address');
  }

  function useDifferentNumber() {
    clearCustomer();
    setAccount(null);
    setAddresses([]);
    setSelectedId(null);
    setAddress(null);
    setEditing('new');
    setAccountKind('');
    setOtpSent(null);
    setOtpShown('');
    setOtpCode('');
    setOtpWait(0);
    setStep('mobile');
  }

  async function sendCheckoutCode() {
    setBusy(true);
    setError('');
    try {
      const sent = await api.startCheckoutOtp({ phone: otpPhone, name: otpName });
      setOtpSent(sent);
      setOtpShown(sent.code || '');
      setOtpCode(sent.code || '');
      setOtpName(sent.name || otpName);
      setOtpWait(30);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyCheckoutCode(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      applyAccount(await api.verifyCheckoutOtp({ phone: otpPhone, name: otpName, code: otpCode }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveAndDeliver(form) {
    const id = editing && editing !== 'new' ? editing : null;
    const next = await api.saveAddress(id, form);
    setAddresses((current) => (id ? current.map((item) => (item.id === id ? next : item)) : [next, ...current]));
    setSelectedId(next.id);
    setAddress(next);
    setEditing(null);
    setStep('summary');
  }

  function deliverHere(item) {
    setAddress(item);
    setStep('summary');
  }

  async function pay() {
    setBusy(true);
    setError('');
    let next = started;
    try {
      if (!next) {
        next = await api.createOrder({
          ...address,
          phone: cleanPhone(address.phone),
          altPhone: cleanPhone(address.altPhone),
          addressId: address.id || undefined,
          email,
          notes,
          items: cart.items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
        });
        setStarted(next);
      }
      if (next.payment?.demo || gateway === 'demo') {
        const paid = await api.confirmDemoPay(next.order.orderNumber);
        cart.clear();
        navigate(`/order/${paid.orderNumber}`, { state: paid });
        return;
      }
      navigate(`/pay/${next.order.orderNumber}`);
      return;
    } catch (err) {
      setError(err.message);
      if (/sign in with your mobile/i.test(err.message)) {
        useDifferentNumber();
      } else if (/mobile number/i.test(err.message)) {
        setStep('address');
        setEditing(address?.id || 'new');
      }
    } finally {
      setBusy(false);
    }
  }

  const count = cart.count;
  const delivery = started?.order?.shippingPaise ?? shippingPaise({ pincode: address?.pincode, state: address?.state, grams: cartGrams(cart.items) }, shipRules);
  const payable = started?.payment?.amountPaise ?? (cart.totalPaise + delivery);

  return (
    <div className="wrap page checkout">
      <div className="checkout-steps">
        <Step
          number={1}
          title="Mobile number"
          open={step === 'mobile'}
          done={Boolean(account)}
          locked={Boolean(started)}
          onChange={useDifferentNumber}
          summary={account && <><b>{account.name}</b> · +91 {account.phone}</>}
        >
          {account && !otpSent ? (
            <div className="otp-panel">
              <p>You are ordering as <b>{account.name}</b> with <b>+91 {account.phone}</b>.</p>
              <div className="step-actions">
                <button className="btn step-cta" type="button" onClick={() => setStep('address')}>Continue</button>
                <button className="text-btn" type="button" onClick={useDifferentNumber}>Use a different number</button>
              </div>
            </div>
          ) : otpSent ? (
            <form className="otp-panel" onSubmit={verifyCheckoutCode}>
              <p>
                {otpSent.exists
                  ? <>Welcome back{otpSent.name ? `, ${otpSent.name}` : ''}. Enter the code for <b>+91 {otpSent.phone}</b> to load your saved address.</>
                  : <>No account uses <b>+91 {otpSent.phone}</b> yet. Enter the code to create one, then add your address.</>}
              </p>
              {otpShown && (
                <div className="otp-show">
                  <small>Your verification code</small>
                  <b>{otpShown}</b>
                  <small>Shown on screen because SMS is not connected yet.</small>
                </div>
              )}
              <input
                className="otp-input"
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="••••••"
                aria-label="Verification code"
                autoFocus
                required
              />
              {error && <p className="status error">{error}</p>}
              <div className="step-actions">
                <button className="btn step-cta" type="submit" disabled={busy || otpCode.length !== 6}>
                  {busy ? 'Checking…' : otpSent.exists ? 'Verify and load account' : 'Verify and create account'}
                </button>
                <button className="text-btn" type="button" onClick={sendCheckoutCode} disabled={busy || otpWait > 0}>
                  {otpWait > 0 ? `Resend code in ${otpWait}s` : 'Resend code'}
                </button>
                <button className="text-btn" type="button" onClick={() => { setOtpSent(null); setOtpShown(''); setOtpCode(''); setError(''); }}>
                  Change number
                </button>
              </div>
            </form>
          ) : (
            <form className="otp-panel" onSubmit={(event) => { event.preventDefault(); sendCheckoutCode(); }}>
              <p>Enter your 10-digit mobile number. If it is already on file we will load that account. If not, we will create one.</p>
              <div className="field-grid">
                <label className="field">
                  <input
                    value={otpName}
                    onChange={(event) => setOtpName(event.target.value)}
                    placeholder=" "
                    autoComplete="name"
                    required
                  />
                  <span>Name</span>
                </label>
                <label className="field">
                  <input
                    value={otpPhone}
                    onChange={(event) => setOtpPhone(cleanPhone(event.target.value).slice(0, 10))}
                    placeholder=" "
                    inputMode="tel"
                    autoComplete="tel"
                    minLength={10}
                    maxLength={10}
                    pattern="[0-9]{10}"
                    required
                  />
                  <span>10-digit mobile number</span>
                </label>
              </div>
              {error && <p className="status error">{error}</p>}
              <div className="step-actions">
                <button className="btn step-cta" type="submit" disabled={busy || otpPhone.length !== 10 || otpName.trim().length < 2}>
                  {busy ? 'Sending…' : 'Send verification code'}
                </button>
              </div>
            </form>
          )}
        </Step>

        <Step
          number={2}
          title="Delivery address"
          open={step === 'address'}
          done={Boolean(address)}
          locked={Boolean(started) || !account}
          onChange={() => setStep('address')}
          summary={address && <><b>{address.name}</b> {address.phone && <span> · {address.phone}</span>} {addressText(address)}</>}
        >
          {accountKind === 'returning' && addresses.length > 0 && editing !== 'new' && (
            <p className="note">Welcome back. Continue with this saved address, or change it before we show the order summary.</p>
          )}
          {accountKind === 'new' && addresses.length === 0 && (
            <p className="note">Account created. Add your delivery address, then we will take you to the order summary.</p>
          )}
          {accountKind === 'existing' && addresses.length === 0 && (
            <p className="note">Welcome back. Add a delivery address, then we will take you to the order summary.</p>
          )}
          {addresses.map((item) => (
            <div key={item.id} className={selectedId === item.id ? 'address-card on' : 'address-card'}>
              {editing === item.id ? (
                <AddressForm initial={item} onSubmit={saveAndDeliver} onCancel={() => setEditing(null)} submitLabel="Save and continue" />
              ) : (
                <>
                  <label className="address-pick">
                    <input type="radio" name="address" checked={selectedId === item.id} onChange={() => setSelectedId(item.id)} />
                    <span>
                      <b>{item.name}</b>
                      <em className="address-tag">{item.addressType}</em>
                      <b>{item.phone}</b>
                      <small>{addressText(item)}</small>
                    </span>
                  </label>
                  {selectedId === item.id && (
                    <div className="address-actions">
                      <button className="btn step-cta" type="button" onClick={() => deliverHere(item)}>Continue with this address</button>
                      <button className="text-btn" type="button" onClick={() => setEditing(item.id)}>Change address</button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
          {editing === 'new' ? (
            <div className="address-card on new">
              {addresses.length > 0 && <p className="address-new-title">Add a new address</p>}
              <AddressForm
                key={address?.id || address?.phone || 'new'}
                initial={address || { name: account?.name || otpName, phone: account?.phone || otpPhone }}
                onSubmit={saveAndDeliver}
                onCancel={addresses.length ? () => setEditing(null) : null}
                submitLabel="Save and continue"
              />
            </div>
          ) : (
            <button className="address-add" type="button" onClick={() => setEditing('new')}>+ Add a new address</button>
          )}
        </Step>

        <Step
          number={3}
          title="Order summary"
          open={step === 'summary'}
          done={step === 'payment'}
          locked={Boolean(started) || !address}
          onChange={() => setStep('summary')}
          summary={`${count} item${count === 1 ? '' : 's'}`}
        >
          <ul className="summary-lines">
            {cart.items.map((item) => (
              <li key={item.variantId}>
                <img src={item.image} alt="" />
                <div>
                  <Link to={`/product/${item.slug}`}>{item.name}</Link>
                  <small>{item.label}</small>
                  <p className="summary-price">
                    {item.comparePaise > item.pricePaise && <s>{inr(item.comparePaise * item.quantity)}</s>}
                    <b>{inr(item.pricePaise * item.quantity)}</b>
                    {item.comparePaise > item.pricePaise && (
                      <em>{Math.round((1 - item.pricePaise / item.comparePaise) * 100)}% off</em>
                    )}
                  </p>
                  <div className="summary-qty">
                    <div className="stepper small">
                      <button type="button" onClick={() => cart.setQty(item.variantId, item.quantity - 1)} aria-label="Decrease quantity">−</button>
                      <span>{item.quantity}</span>
                      <button type="button" onClick={() => cart.setQty(item.variantId, item.quantity + 1)} aria-label="Increase quantity">+</button>
                    </div>
                    <button className="text-btn" type="button" onClick={() => cart.remove(item.variantId)}>Remove</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="summary-extra">
            <label className="field"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder=" " autoComplete="email" /><span>Email for the order confirmation (Optional)</span></label>
            <label className="field"><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder=" " maxLength={300} /><span>Note for the kitchen (Optional)</span></label>
          </div>
          <div className="step-actions end">
            <button className="btn step-cta" type="button" onClick={() => setStep('payment')} disabled={!cart.items.length}>Continue</button>
          </div>
        </Step>

        <Step number={4} title="Payment" open={step === 'payment'} done={false}>
          <div className="pay-panel">
            <div className="pay-head">
              <div>
                <b>Pay with Razorpay</b>
                <small>UPI, cards, net banking, and wallets</small>
              </div>
              {gateway === 'live' && <span className="pay-badge">Live</span>}
              {gateway === 'test' && <span className="pay-badge test">Test</span>}
              {gateway === 'demo' && <span className="pay-badge test">Demo</span>}
            </div>
            <p className="pay-label">Payment method</p>
            <div className="pay-methods">
              {PAY_METHODS.map((method) => (
                <button
                  key={method.id}
                  type="button"
                  className={payMethod === method.id ? 'on' : ''}
                  onClick={() => setPayMethod(method.id)}
                >
                  <PayIcon id={method.id} />
                  <span>
                    <b>{method.label}</b>
                    <small>{method.hint}</small>
                  </span>
                </button>
              ))}
            </div>
            <ul className="pay-recap">
              <li><span>Items ({count})</span><b>{inr(cart.totalPaise)}</b></li>
              <li><span>Delivery</span><b className={!delivery ? 'save' : undefined}>{delivery ? inr(delivery) : 'Free'}</b></li>
              <li className="pay-due"><span>Amount payable</span><b>{inr(payable)}</b></li>
            </ul>
            {address?.phone && <p className="pay-contact">Paying as {address.name} · +91 {address.phone}</p>}
            {started && <p className="note">Order {started.order.orderNumber} is waiting. Tap pay to finish.</p>}
            {gateway === 'demo' && <p className="note">No money will be charged. This confirms the order so you can test packing and tracking.</p>}
            {gateway === 'off' && <p className="status error">Razorpay keys are not loaded. Add the live Key ID and Secret to server/.env to take a real payment.</p>}
            {error && <p className="status error">{error}</p>}
            <button className="btn step-cta wide" type="button" onClick={pay} disabled={busy || gateway === 'off'}>
              {busy ? (gateway === 'demo' ? 'Confirming…' : 'Opening Razorpay…') : gateway === 'demo' ? `Complete test payment · ${inr(payable)}` : `Pay ${inr(payable)}`}
            </button>
            <p className="pay-trust">
              {gateway === 'demo'
                ? 'Local demo checkout. Add Razorpay live keys later to take real UPI and card payments.'
                : 'Encrypted checkout. You will complete UPI, card, or net banking in the Razorpay window.'}
            </p>
          </div>
        </Step>
      </div>
      <PriceDetails items={cart.items} pincode={address?.pincode || ''} state={address?.state || ''} shippingPaise={started?.order?.shippingPaise} />
    </div>
  );
}

const TRACK_STEPS = [
  { status: 'pending', label: 'Ordered' },
  { status: 'confirmed', label: 'Confirmed' },
  { status: 'packed', label: 'Packed' },
  { status: 'shipped', label: 'Shipped' },
  { status: 'delivered', label: 'Delivered' },
];

export function OrderTimeline({ order }) {
  const events = order.events || [];
  const at = (status) => events.find((event) => event.status === status);
  if (order.status === 'cancelled') {
    const cancelled = [...events].reverse().find((event) => event.status === 'cancelled');
    return (
      <ol className="timeline">
        <li className="done"><b>Ordered</b><small>{when(order.createdAt)}</small></li>
        <li className="done cancelled"><b>Cancelled</b><small>{cancelled ? `${when(cancelled.at)}${cancelled.note ? ` · ${cancelled.note}` : ''}` : ''}</small></li>
      </ol>
    );
  }
  const current = Math.max(0, TRACK_STEPS.findIndex((step) => step.status === order.status));
  return (
    <ol className="timeline">
      {TRACK_STEPS.map((step, index) => {
        const event = at(step.status);
        const time = event?.at || (index === 0 ? order.createdAt : null);
        const shipped = step.status === 'shipped' && index <= current && (order.courierName || order.trackingNumber);
        return (
          <li key={step.status} className={index <= current ? 'done' : ''}>
            <b>{step.label}</b>
            {index <= current && time && <small>{when(time)}</small>}
            {index <= current && event?.note && !shipped && <small>{event.note}</small>}
            {shipped && (
              <small>{[order.courierName, order.trackingNumber].filter(Boolean).join(' · ')}</small>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function courierLink(order) {
  return /^https?:\/\//i.test(order.trackingUrl || '') ? order.trackingUrl : '';
}

function CourierBox({ order }) {
  const url = courierLink(order);
  if (!order.courierName && !order.trackingNumber && !url) {
    if (order.status === 'shipped' || order.status === 'delivered') {
      return <p className="courier-wait">Courier details will appear here when the kitchen adds them.</p>;
    }
    return null;
  }
  return (
    <div className="courier-box">
      <h3>Courier tracking</h3>
      {order.courierName && <p><small>Courier</small><b>{order.courierName}</b></p>}
      {order.trackingNumber && <p><small>Tracking number</small><b>{order.trackingNumber}</b></p>}
      {url && (
        <>
          <a className="btn" href={url} target="_blank" rel="noreferrer">Open tracking link</a>
          <p className="courier-url"><a href={url} target="_blank" rel="noreferrer">{url}</a></p>
        </>
      )}
    </div>
  );
}

export function OrderPanel({ order }) {
  return (
    <article className="track-card">
      <header>
        <div>
          <small>Order</small>
          <b>{order.orderNumber}</b>
        </div>
        <div>
          <small>Placed</small>
          <b>{when(order.createdAt)}</b>
        </div>
        <div>
          <small>Total</small>
          <b>{inr(order.totalPaise)}</b>
        </div>
      </header>
      <OrderTimeline order={order} />
      <CourierBox order={order} />
      <ul className="summary-lines compact">
        {order.items.map((item, index) => (
          <li key={`${item.productSlug}-${index}`}>
            {item.imageUrl && <img src={item.imageUrl} alt="" />}
            <div>
              <span>{item.productName}</span>
              <small>{item.variantLabel} × {item.quantity}</small>
            </div>
            <b>{inr(item.unitPricePaise * item.quantity)}</b>
          </li>
        ))}
      </ul>
      <footer>
        <p><small>Delivery</small>{order.shippingPaise ? inr(order.shippingPaise) : 'Free'}</p>
        <p><small>Delivery address</small>{order.customerName}, {addressText(order)}</p>
        <p><small>Payment</small>{paymentLabel(order)}</p>
      </footer>
    </article>
  );
}

function ConfettiBurst() {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 18 }, (_, index) => <i key={index} style={{ '--n': index }} />)}
    </div>
  );
}

export function OrderDone() {
  const { orderNumber } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const number = String(orderNumber || '').toUpperCase();
    const placed = location.state?.orderNumber === number ? location.state : null;
    if (placed) {
      sessionStorage.setItem(`order-${number}`, JSON.stringify(placed));
      setOrder(placed);
    }
    let live = true;
    api.myOrder(number)
      .then((next) => {
        if (!live) return;
        sessionStorage.setItem(`order-${number}`, JSON.stringify(next));
        setOrder(next);
        if (next.paymentStatus === 'awaiting') navigate(`/pay/${number}`, { replace: true });
        if (next.paymentStatus === 'expired') navigate(`/pay/${number}/expired`, { replace: true });
      })
      .catch((err) => {
        if (!live) return;
        if (!placed) {
          const saved = sessionStorage.getItem(`order-${number}`);
          if (saved) setOrder(JSON.parse(saved));
          else setError(err.message);
        }
      });
    return () => { live = false; };
  }, [location.state, orderNumber, navigate]);

  const confirmed = order?.paymentStatus === 'paid';
  return (
    <div className="wrap page narrow">
      <div className={`done-celebrate${confirmed ? ' paid' : ''}`}>
        {confirmed && <ConfettiBurst />}
        <div className="done-head">
          <span className="done-tick" aria-hidden="true">✓</span>
          <div>
            <h1>{confirmed ? 'Order confirmed' : 'Order placed'}</h1>
            <p className="muted">Thank you. Your order number is <b>{orderNumber}</b>.</p>
            {confirmed && <p className="done-toast">Payment received. We are packing your order.</p>}
          </div>
        </div>
      </div>
      {error && <p className="status error">{error}</p>}
      {order && <OrderPanel order={order} />}
      <div className="actions">
        <Link className="btn" to="/track">Track order</Link>
        <Link className="btn ghost" to="/shop">Continue shopping</Link>
      </div>
    </div>
  );
}

function isActiveOrder(order) {
  return order.status !== 'delivered' && order.status !== 'cancelled' && order.paymentStatus !== 'expired';
}

function TrackProductList({ orders, onOpen }) {
  const lines = orders.flatMap((order) => {
    const items = order.items?.length ? order.items : [{ productName: order.orderNumber, variantLabel: '', quantity: 1, unitPricePaise: order.totalPaise, imageUrl: '' }];
    return items.map((item, index) => ({ order, item, key: `${order.orderNumber}-${index}` }));
  });
  return (
    <ul className="track-products">
      {lines.map(({ order, item, key }) => (
        <li key={key}>
          <button type="button" className="track-product" onClick={() => onOpen(order.orderNumber)}>
            {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span className="track-product-ph" aria-hidden="true" />}
            <span>
              <b>{item.productName}</b>
              <small>{[item.variantLabel, item.quantity > 1 ? `× ${item.quantity}` : ''].filter(Boolean).join(' · ')}</small>
              <small>{STATUS_LABEL[order.status] || order.status} · {when(order.createdAt)}</small>
            </span>
            <em>{inr(item.unitPricePaise * (item.quantity || 1))}</em>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function Track() {
  const [account, setAccount] = useState(() => readCustomer());
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [otpPhone, setOtpPhone] = useState(() => readCustomer()?.phone || '');
  const [otpCode, setOtpCode] = useState('');
  const [otpShown, setOtpShown] = useState('');
  const [otpSent, setOtpSent] = useState(null);
  const [otpWait, setOtpWait] = useState(0);

  useEffect(() => {
    if (otpWait <= 0) return undefined;
    const timer = window.setTimeout(() => setOtpWait((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [otpWait]);

  async function loadOrders() {
    setBusy(true);
    setError('');
    try {
      setOrders(await api.myOrders());
    } catch (err) {
      if (/sign in/i.test(err.message)) {
        clearCustomer();
        setAccount(null);
        setOrders([]);
      }
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (account) {
      loadOrders();
      return undefined;
    }
    let live = true;
    api.accountMe()
      .then((me) => {
        if (!live) return;
        saveCustomer(me);
        setAccount(me);
      })
      .catch(() => {});
    return () => { live = false; };
  }, [account?.id]);

  async function sendCode(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const sent = await api.startCheckoutOtp({ phone: otpPhone, lookup: true });
      setOtpSent(sent);
      setOtpShown(sent.code || '');
      setOtpCode(sent.code || '');
      setOtpWait(30);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api.verifyCheckoutOtp({ phone: otpPhone, code: otpCode });
      saveCustomer(result);
      setAccount(result.customer);
      setOtpSent(null);
      setOtpShown('');
      setOtpCode('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const active = orders.filter(isActiveOrder);
  const past = orders.filter((order) => !isActiveOrder(order));
  const openOrder = orders.find((order) => order.orderNumber === selected);

  return (
    <div className="wrap page narrow">
      <h1>Track order</h1>
      {!account ? (
        otpSent ? (
          <form className="otp-panel glass" onSubmit={verifyCode}>
            <p>Enter the code for <b>+91 {otpSent.phone}</b> to see your orders.</p>
            {otpShown && (
              <div className="otp-show">
                <small>Your verification code</small>
                <b>{otpShown}</b>
                <small>Shown on screen because SMS is not connected yet.</small>
              </div>
            )}
            <input
              className="otp-input"
              value={otpCode}
              onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="••••••"
              aria-label="Verification code"
              autoFocus
              required
            />
            {error && <p className="status error">{error}</p>}
            <div className="step-actions">
              <button className="btn" type="submit" disabled={busy || otpCode.length !== 6}>{busy ? 'Checking…' : 'Show my orders'}</button>
              <button className="text-btn" type="button" onClick={sendCode} disabled={busy || otpWait > 0}>
                {otpWait > 0 ? `Resend code in ${otpWait}s` : 'Resend code'}
              </button>
              <button className="text-btn" type="button" onClick={() => { setOtpSent(null); setOtpShown(''); setOtpCode(''); setError(''); }}>Change number</button>
            </div>
          </form>
        ) : (
          <form className="otp-panel glass" onSubmit={sendCode}>
            <p>Sign in with your mobile number. Your ordered products will show here.</p>
            <label className="field">
              <input
                value={otpPhone}
                onChange={(event) => setOtpPhone(cleanPhone(event.target.value).slice(0, 10))}
                placeholder=" "
                inputMode="tel"
                autoComplete="tel"
                minLength={10}
                maxLength={10}
                pattern="[0-9]{10}"
                required
              />
              <span>10-digit mobile number</span>
            </label>
            {error && <p className="status error">{error}</p>}
            <button className="btn" type="submit" disabled={busy || otpPhone.length !== 10}>{busy ? 'Checking…' : 'Continue'}</button>
          </form>
        )
      ) : openOrder ? (
        <>
          <button className="text-btn track-back" type="button" onClick={() => setSelected(null)}>Back to products</button>
          {error && <p className="status error">{error}</p>}
          <OrderPanel order={openOrder} />
        </>
      ) : (
        <>
          {error && <p className="status error">{error}</p>}
          {busy && orders.length === 0 && <p className="muted">Loading your orders…</p>}
          {!busy && active.length === 0 && (
            <p className="muted">No active orders right now. When you place an order, the products will show here.</p>
          )}
          <TrackProductList orders={active} onOpen={setSelected} />
          {past.length > 0 && (
            <section className="track-past">
              <h2>Past orders</h2>
              <TrackProductList orders={past} onOpen={setSelected} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
