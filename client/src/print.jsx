import { addressText, inr, paymentLabel, when } from './api.js';

export function PrintSheet({ shop, order, kind = 'invoice' }) {
  const goods = (order.items || []).reduce((sum, item) => sum + item.unitPricePaise * item.quantity, 0);
  const packing = kind === 'slip';
  return (
    <section className={`print-sheet ${kind}`}>
      <header className="print-head">
        <div>
          <p className="eyebrow">Jagatha Organics</p>
          <h1>{packing ? 'Packing slip' : 'Invoice'}</h1>
          <p>{shop?.name || 'Jagatha Organics'}</p>
          {shop?.address && <p>{shop.address}</p>}
          <p>
            {shop?.phone ? `+91 ${shop.phone}` : ''}
            {shop?.email ? ` · ${shop.email}` : ''}
          </p>
          {shop?.gstin && <p>GSTIN {shop.gstin}</p>}
        </div>
        <div className="print-meta">
          <p><small>Order</small><b>{order.orderNumber}</b></p>
          <p><small>Date</small><b>{when(order.createdAt)}</b></p>
          <p><small>Payment</small><b>{paymentLabel(order)}</b></p>
        </div>
      </header>
      <div className="print-to">
        <div>
          <small>{packing ? 'Ship to' : 'Bill to'}</small>
          <b>{order.customerName}</b>
          <p>{addressText(order)}</p>
          {order.phone && <p>+91 {order.phone}</p>}
        </div>
        {(order.courierName || order.trackingNumber) && (
          <div>
            <small>Courier</small>
            <b>{order.courierName || '—'}</b>
            <p>{order.trackingNumber}</p>
          </div>
        )}
      </div>
      <table className="print-lines">
        <thead>
          <tr>
            <th>Pack</th>
            <th>Qty</th>
            {!packing && <th>Rate</th>}
            {!packing && <th>Amount</th>}
          </tr>
        </thead>
        <tbody>
          {(order.items || []).map((item, index) => (
            <tr key={`${item.productSlug}-${index}`}>
              <td>{item.productName}<small>{item.variantLabel}</small></td>
              <td>{item.quantity}</td>
              {!packing && <td>{inr(item.unitPricePaise)}</td>}
              {!packing && <td>{inr(item.unitPricePaise * item.quantity)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {!packing && (
        <div className="print-totals">
          <p><span>Items</span><b>{inr(goods)}</b></p>
          <p><span>Delivery</span><b>{order.shippingPaise ? inr(order.shippingPaise) : 'Free'}</b></p>
          <p className="grand"><span>Total</span><b>{inr(order.totalPaise)}</b></p>
        </div>
      )}
      {order.notes && <p className="print-note">Note: {order.notes}</p>}
      <footer>Thank you for choosing Jagatha Organics.</footer>
    </section>
  );
}
