import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, inr, loadRazorpay } from './api.js';
import { useCart } from './cart.jsx';

function goPaid(navigate, cart, order) {
  cart.clear();
  sessionStorage.setItem(`order-${order.orderNumber}`, JSON.stringify(order));
  navigate(`/order/${order.orderNumber}`, { replace: true, state: order });
}

function routeForStatus(orderNumber, paymentStatus) {
  if (paymentStatus === 'paid') return `/order/${orderNumber}`;
  if (paymentStatus === 'expired') return `/pay/${orderNumber}/expired`;
  return '';
}

function PayFrame({ tone, mark, title, children, actions }) {
  return (
    <div className="wrap page narrow">
      <div className={`pay-result ${tone}`}>
        <span className="pay-result-mark" aria-hidden="true">{mark}</span>
        <h1>{title}</h1>
        {children}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}

export function PayWaiting() {
  const { orderNumber } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const cart = useCart();
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const launched = useRef(false);
  const number = String(orderNumber || '').toUpperCase();

  async function loadSession() {
    const next = await api.paymentSession(number);
    setSession(next);
    const dest = routeForStatus(number, next.paymentStatus);
    if (dest && dest !== `/pay/${number}`) {
      if (next.paymentStatus === 'paid') {
        const order = await api.myOrder(number).catch(() => null);
        if (order) {
          goPaid(navigate, cart, order);
          return next;
        }
      }
      navigate(dest, { replace: true });
    }
    return next;
  }

  useEffect(() => {
    let live = true;
    loadSession().catch((err) => {
      if (live) setError(err.message);
    });
    const tick = window.setInterval(() => {
      loadSession().catch(() => {});
    }, 4000);
    return () => {
      live = false;
      window.clearInterval(tick);
    };
  }, [number, navigate]);

  async function finish(response) {
    setBusy(true);
    setError('');
    try {
      const paid = await api.confirmPayment(number, {
        razorpayPaymentId: response.razorpay_payment_id,
        razorpayOrderId: response.razorpay_order_id,
        razorpaySignature: response.razorpay_signature,
      });
      goPaid(navigate, cart, paid);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function openPay(current = session) {
    if (!current?.keyId || !current.razorpayOrderId) {
      setError('This payment window is not open yet. Try again in a moment.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const Razorpay = await loadRazorpay();
      let settled = false;
      const checkout = new Razorpay({
        key: current.keyId,
        order_id: current.razorpayOrderId,
        amount: current.amountPaise,
        currency: current.currency || 'INR',
        name: 'Jagatha Organics',
        description: `Order ${current.orderNumber}`,
        prefill: {
          name: current.customerName,
          contact: current.phone,
          email: current.email && !/@phone\.jagathaorganics\.com$/i.test(current.email) ? current.email : '',
        },
        notes: { order: current.orderNumber, phone: current.phone },
        theme: { color: '#1f3d32' },
        retry: { enabled: true, max_count: 1 },
        handler: (response) => {
          settled = true;
          finish(response);
        },
        modal: {
          ondismiss: () => {
            if (settled) return;
            setBusy(false);
            navigate(`/pay/${number}/cancelled`, { replace: true });
          },
        },
      });
      checkout.on('payment.failed', (event) => {
        settled = true;
        const reason = event?.error?.description || 'The bank did not complete this payment.';
        navigate(`/pay/${number}/failed`, { replace: true, state: { reason } });
      });
      checkout.open();
    } catch (err) {
      setBusy(false);
      setError(err.message);
    }
  }

  useEffect(() => {
    if (!session?.razorpayOrderId || session.paymentStatus !== 'awaiting') return undefined;
    if (launched.current) return undefined;
    if (location.state?.manual) return undefined;
    launched.current = true;
    openPay(session);
    return undefined;
  }, [session?.razorpayOrderId, session?.paymentStatus]);

  return (
    <PayFrame
      tone="wait"
      mark={<span className="pay-spin" />}
      title="Waiting for payment"
      actions={(
        <>
          <button className="btn" type="button" onClick={() => openPay()} disabled={busy || !session?.razorpayOrderId}>
            {busy ? 'Opening Razorpay…' : `Pay ${session ? inr(session.amountPaise) : ''}`}
          </button>
          <Link className="btn ghost" to={`/pay/${number}/cancelled`}>Cancel payment</Link>
        </>
      )}
    >
      <p>Order <b>{number}</b> is held for 30 minutes. Complete UPI, card, or net banking in the Razorpay window.</p>
      {session?.amountPaise ? <p className="pay-result-amount">Amount payable <b>{inr(session.amountPaise)}</b></p> : null}
      <p className="muted">If you already paid, stay on this page. We will confirm it here.</p>
      {error && <p className="status error">{error}</p>}
    </PayFrame>
  );
}

export function PayCancelled() {
  const { orderNumber } = useParams();
  const navigate = useNavigate();
  const cart = useCart();
  const number = String(orderNumber || '').toUpperCase();
  const [amount, setAmount] = useState(0);

  useEffect(() => {
    api.paymentSession(number)
      .then(async (session) => {
        setAmount(session.amountPaise || 0);
        if (session.paymentStatus === 'paid') {
          const order = await api.myOrder(number).catch(() => null);
          if (order) goPaid(navigate, cart, order);
          return;
        }
        if (session.paymentStatus === 'expired') navigate(`/pay/${number}/expired`, { replace: true });
      })
      .catch(() => {});
  }, [number, navigate, cart]);

  return (
    <PayFrame
      tone="cancel"
      mark="!"
      title="Payment cancelled"
      actions={(
        <>
          <Link className="btn" to={`/pay/${number}`}>Try payment again</Link>
          <Link className="btn ghost" to="/checkout">Back to checkout</Link>
          <Link className="text-btn" to="/track">Track this order</Link>
        </>
      )}
    >
      <p>No money was taken for order <b>{number}</b>. The packs are still reserved until the payment window closes.</p>
      {amount > 0 && <p className="pay-result-amount">Amount payable <b>{inr(amount)}</b></p>}
      <p className="muted">Tap try again to open Razorpay, or come back from Track if you need a moment.</p>
    </PayFrame>
  );
}

export function PayFailed() {
  const { orderNumber } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const cart = useCart();
  const number = String(orderNumber || '').toUpperCase();
  const reason = location.state?.reason || 'The payment did not go through.';

  useEffect(() => {
    api.paymentSession(number)
      .then(async (session) => {
        if (session.paymentStatus === 'paid') {
          const order = await api.myOrder(number).catch(() => null);
          if (order) goPaid(navigate, cart, order);
          return;
        }
        if (session.paymentStatus === 'expired') navigate(`/pay/${number}/expired`, { replace: true });
      })
      .catch(() => {});
  }, [number, navigate, cart]);

  return (
    <PayFrame
      tone="fail"
      mark="×"
      title="Payment failed"
      actions={(
        <>
          <Link className="btn" to={`/pay/${number}`}>Try another method</Link>
          <a className="btn ghost" href="https://wa.me/919884126032" target="_blank" rel="noreferrer">WhatsApp the kitchen</a>
          <Link className="text-btn" to="/track">Track this order</Link>
        </>
      )}
    >
      <p>{reason}</p>
      <p>Order <b>{number}</b> is still waiting. You can try UPI, a card, or net banking again.</p>
      <p className="muted">If money left your account, message us on WhatsApp with this order number. We will match it before packing.</p>
    </PayFrame>
  );
}

export function PayExpired() {
  const { orderNumber } = useParams();
  const number = String(orderNumber || '').toUpperCase();

  return (
    <PayFrame
      tone="expire"
      mark="⏱"
      title="Payment window closed"
      actions={(
        <>
          <Link className="btn" to="/checkout">Place a new order</Link>
          <Link className="btn ghost" to="/shop">Continue shopping</Link>
          <Link className="text-btn" to="/track">Track orders</Link>
        </>
      )}
    >
      <p>Order <b>{number}</b> was not paid in time. The packs have been returned to the shelf.</p>
      <p className="muted">Add the items to your cart again if you still want them. Nothing was charged.</p>
    </PayFrame>
  );
}
