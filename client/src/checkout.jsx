import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { addressText, api, inr, loadRazorpay, lookupPincode, paymentLabel, readCustomer, STATES, STATUS_LABEL, when } from './api.js';
import { useCart } from './cart.jsx';

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

function AddressForm({ initial, onSubmit, onCancel, submitLabel }) {
  const [form, setForm] = useState({ ...BLANK_ADDRESS, ...initial });
  const [localities, setLocalities] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

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
    setBusy(true);
    setError('');
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="address-form" onSubmit={submit}>
      <div className="field-grid">
        <label className="field"><input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder=" " required autoComplete="name" /><span>Name</span></label>
        <label className="field"><input value={form.phone} onChange={(e) => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder=" " required inputMode="tel" autoComplete="tel-national" /><span>10-digit mobile number</span></label>
        <label className="field"><input value={form.pincode} onChange={(e) => set('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder=" " required inputMode="numeric" autoComplete="postal-code" /><span>Pincode</span></label>
        <label className="field">
          <input value={form.locality} onChange={(e) => set('locality', e.target.value)} placeholder=" " required list="locality-options" />
          <span>Locality</span>
          <datalist id="locality-options">{localities.map((item) => <option key={item} value={item} />)}</datalist>
        </label>
        <label className="field wide"><textarea value={form.addressLine} onChange={(e) => set('addressLine', e.target.value)} placeholder=" " required rows={3} autoComplete="street-address" /><span>Address (Area and Street)</span></label>
        <label className="field"><input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder=" " required autoComplete="address-level2" /><span>City/District/Town</span></label>
        <label className="field select">
          <select value={form.state} onChange={(e) => set('state', e.target.value)} required>
            <option value="">--Select State--</option>
            {STATES.map((state) => <option key={state} value={state}>{state}</option>)}
          </select>
          <span>State</span>
        </label>
        <label className="field"><input value={form.landmark} onChange={(e) => set('landmark', e.target.value)} placeholder=" " /><span>Landmark (Optional)</span></label>
        <label className="field"><input value={form.altPhone} onChange={(e) => set('altPhone', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder=" " inputMode="tel" /><span>Alternate Phone (Optional)</span></label>
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

export function PriceDetails({ items, children }) {
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const mrp = items.reduce((sum, item) => sum + Math.max(item.comparePaise || 0, item.pricePaise) * item.quantity, 0);
  const total = items.reduce((sum, item) => sum + item.pricePaise * item.quantity, 0);
  const discount = mrp - total;
  return (
    <aside className="price-card">
      <h2>Price details</h2>
      <p><span>Price ({count} item{count === 1 ? '' : 's'})</span><b>{inr(mrp)}</b></p>
      {discount > 0 && <p><span>Discount</span><b className="save">−{inr(discount)}</b></p>}
      <p className="price-total"><span>Total amount</span><b>{inr(total)}</b></p>
      {discount > 0 && <p className="price-save">You will save {inr(discount)} on this order</p>}
      <p className="price-safe">Safe and secure payments through Razorpay</p>
      {children}
    </aside>
  );
}

export function Checkout() {
  const cart = useCart();
  const navigate = useNavigate();
  const customer = readCustomer();
  const [step, setStep] = useState('address');
  const [addresses, setAddresses] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [address, setAddress] = useState(null);
  const [editing, setEditing] = useState(customer ? null : 'new');
  const [email, setEmail] = useState(customer?.email || '');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(null);

  useEffect(() => {
    if (!customer) return;
    api.addresses()
      .then((list) => {
        setAddresses(list);
        setSelectedId(list[0]?.id || null);
        if (!list.length) setEditing('new');
      })
      .catch(() => setEditing('new'));
  }, []);

  if (cart.items.length === 0 && !started) {
    return (
      <div className="wrap page narrow">
        <h1>Checkout</h1>
        <p>Your cart is empty.</p>
        <Link className="btn" to="/shop">Shop</Link>
      </div>
    );
  }

  async function saveAndDeliver(form) {
    let next = form;
    if (customer) {
      const id = editing && editing !== 'new' ? editing : null;
      next = await api.saveAddress(id, form);
      setAddresses((current) => (id ? current.map((item) => (item.id === id ? next : item)) : [next, ...current]));
      setSelectedId(next.id);
    }
    setAddress(next);
    setEditing(null);
    setStep('summary');
  }

  function deliverHere(item) {
    setAddress(item);
    setStep('summary');
  }

  async function openPayment(next) {
    const Razorpay = await loadRazorpay();
    return new Promise((resolve) => {
      const checkout = new Razorpay({
        key: next.payment.keyId,
        order_id: next.payment.razorpayOrderId,
        amount: next.payment.amountPaise,
        currency: next.payment.currency,
        name: 'Jagatha Organics',
        description: `Order ${next.order.orderNumber}`,
        prefill: { name: address.name, contact: address.phone, email },
        theme: { color: '#1f3d32' },
        handler: (response) => resolve(response),
        modal: { ondismiss: () => resolve(null) },
      });
      checkout.open();
    });
  }

  async function pay() {
    setBusy(true);
    setError('');
    let next = started;
    try {
      if (!next) {
        next = await api.createOrder({
          ...address,
          addressId: address.id || undefined,
          email,
          notes,
          items: cart.items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
        });
        setStarted(next);
      }
      const response = await openPayment(next);
      if (!response) {
        setError('Payment not completed. Tap Pay to try again.');
        return;
      }
      const paid = await api.confirmPayment(next.order.orderNumber, {
        razorpayPaymentId: response.razorpay_payment_id,
        razorpayOrderId: response.razorpay_order_id,
        razorpaySignature: response.razorpay_signature,
      });
      cart.clear();
      navigate(`/order/${paid.orderNumber}`, { state: paid });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const total = cart.totalPaise;
  const count = cart.count;

  return (
    <div className="wrap page checkout">
      <div className="checkout-steps">
        {!customer && (
          <p className="checkout-login">Have an account? <Link to="/account/login">Sign in</Link> to use saved addresses.</p>
        )}

        <Step
          number={1}
          title="Delivery address"
          open={step === 'address'}
          done={Boolean(address)}
          locked={Boolean(started)}
          onChange={() => setStep('address')}
          summary={address && <><b>{address.name}</b> {addressText(address)}</>}
        >
          {addresses.map((item) => (
            <div key={item.id} className={selectedId === item.id ? 'address-card on' : 'address-card'}>
              {editing === item.id ? (
                <AddressForm initial={item} onSubmit={saveAndDeliver} onCancel={() => setEditing(null)} submitLabel="Save and deliver here" />
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
                      <button className="btn step-cta" type="button" onClick={() => deliverHere(item)}>Deliver here</button>
                      <button className="text-btn" type="button" onClick={() => setEditing(item.id)}>Edit</button>
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
                initial={{ name: customer?.name || '', phone: customer?.phone || '' }}
                onSubmit={saveAndDeliver}
                onCancel={addresses.length ? () => setEditing(null) : null}
                submitLabel={customer ? 'Save and deliver here' : 'Deliver here'}
              />
            </div>
          ) : (
            <button className="address-add" type="button" onClick={() => setEditing('new')}>+ Add a new address</button>
          )}
        </Step>

        <Step
          number={2}
          title="Order summary"
          open={step === 'summary'}
          done={step === 'payment'}
          locked={Boolean(started)}
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

        <Step number={3} title="Payment" open={step === 'payment'} done={false}>
          <div className="pay-option">
            <span className="pay-radio" />
            <div>
              <b>Pay online</b>
              <small>UPI · Cards · Net banking · Wallets</small>
            </div>
          </div>
          {started && <p className="note">Order {started.order.orderNumber} is waiting for payment.</p>}
          {error && <p className="status error">{error}</p>}
          <button className="btn step-cta wide" type="button" onClick={pay} disabled={busy}>{busy ? 'Opening payment…' : `Pay ${inr(total)}`}</button>
        </Step>
      </div>
      <PriceDetails items={cart.items} />
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
              <small>
                {[order.courierName, order.trackingNumber].filter(Boolean).join(' · ')}
                {/^https?:\/\//i.test(order.trackingUrl || '') && <> · <a href={order.trackingUrl} target="_blank" rel="noreferrer">Track with courier</a></>}
              </small>
            )}
          </li>
        );
      })}
    </ol>
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
        <p><small>Delivery address</small>{order.customerName}, {addressText(order)}</p>
        <p><small>Payment</small>{paymentLabel(order)}</p>
      </footer>
    </article>
  );
}

export function OrderDone() {
  const { orderNumber } = useParams();
  const location = useLocation();
  const [order, setOrder] = useState(null);

  useEffect(() => {
    const placed = location.state?.orderNumber === orderNumber ? location.state : null;
    if (placed) {
      sessionStorage.setItem(`order-${orderNumber}`, JSON.stringify(placed));
      setOrder(placed);
      return;
    }
    const saved = sessionStorage.getItem(`order-${orderNumber}`);
    if (saved) setOrder(JSON.parse(saved));
  }, [location.state, orderNumber]);

  return (
    <div className="wrap page narrow">
      <div className="done-head">
        <span className="done-tick" aria-hidden="true">✓</span>
        <div>
          <h1>{order?.paymentStatus === 'paid' ? 'Order confirmed' : 'Order placed'}</h1>
          <p className="muted">Thank you. Your order number is <b>{orderNumber}</b>.</p>
        </div>
      </div>
      {order && <OrderPanel order={order} />}
      <div className="actions">
        <Link className="btn" to={order ? `/track?number=${orderNumber}&phone=${order.phone}` : '/track'}>Track order</Link>
        <Link className="btn ghost" to="/shop">Continue shopping</Link>
      </div>
    </div>
  );
}

export function Track() {
  const [params] = useSearchParams();
  const [number, setNumber] = useState(params.get('number') || '');
  const [phone, setPhone] = useState(params.get('phone') || '');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function find(nextNumber, nextPhone) {
    setBusy(true);
    setError('');
    setOrder(null);
    try {
      setOrder(await api.track(nextNumber, nextPhone));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const presetNumber = params.get('number');
    const presetPhone = params.get('phone');
    if (presetNumber && presetPhone) find(presetNumber, presetPhone);
  }, []);

  function submit(event) {
    event.preventDefault();
    find(number, phone);
  }

  return (
    <div className="wrap page narrow">
      <h1>Track order</h1>
      <form className="track-form" onSubmit={submit}>
        <label className="field"><input value={number} onChange={(e) => setNumber(e.target.value.toUpperCase())} placeholder=" " required /><span>Order number (JO1001)</span></label>
        <label className="field"><input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder=" " inputMode="tel" required /><span>Mobile number</span></label>
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Looking…' : 'Track'}</button>
      </form>
      {error && <p className="status error">{error}</p>}
      {order && <OrderPanel order={order} />}
    </div>
  );
}
