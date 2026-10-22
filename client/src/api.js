async function request(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  const response = await fetch(url, { ...options, headers, credentials: 'include' });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error('Request failed');
  }
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function authHeaders() {
  return { 'X-Requested-With': 'JagathaDesk' };
}

function customerHeaders() {
  return { 'X-Requested-With': 'JagathaShop' };
}

let catalogPromise;
function staticCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch('/catalog.json').then((response) => {
      if (!response.ok) throw new Error('Shop is unavailable');
      return response.json();
    });
  }
  return catalogPromise;
}

async function orCatalog(load, pick) {
  try {
    return await load();
  } catch (error) {
    try {
      return pick(await staticCatalog());
    } catch {
      throw error;
    }
  }
}

export const api = {
  health: () => request('/api/health').catch(() => ({ ok: false, payments: 'off' })),
  categories: () => orCatalog(async () => {
    const data = await request('/api/categories');
    if (!Array.isArray(data)) throw new Error('Request failed');
    return data;
  }, (catalog) => catalog.categories),
  products: () => orCatalog(async () => {
    const data = await request('/api/products');
    if (!Array.isArray(data)) throw new Error('Request failed');
    return data;
  }, (catalog) => catalog.products),
  product: (slug) => orCatalog(
    async () => {
      const data = await request(`/api/products/${slug}`);
      if (!data?.slug) throw new Error('Request failed');
      return data;
    },
    (catalog) => {
      const product = catalog.products.find((item) => item.slug === slug);
      if (!product) throw new Error('That product is not on the shelf.');
      return product;
    },
  ),
  createOrder: (body) => request('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...customerHeaders() },
    body: JSON.stringify(body),
  }),
  confirmPayment: (orderNumber, body) => request(`/api/orders/${orderNumber}/pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  confirmDemoPay: (orderNumber) => request(`/api/orders/${orderNumber}/demo-pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  }),
  myOrder: (orderNumber) => request(`/api/account/orders/${encodeURIComponent(orderNumber)}`, { headers: customerHeaders() }),
  paymentSession: (orderNumber) => request(`/api/account/orders/${encodeURIComponent(orderNumber)}/payment`, { headers: customerHeaders() }),
  deskProducts: () => request('/api/admin/products', { headers: authHeaders() }),
  saveProduct: (slug, body) => request(slug ? `/api/admin/products/${slug}` : '/api/admin/products', {
    method: slug ? 'PATCH' : 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  }),
  removeProduct: (slug) => request(`/api/admin/products/${slug}`, { method: 'DELETE', headers: authHeaders() }),
  deskCategories: () => request('/api/admin/categories', { headers: authHeaders() }),
  saveCategory: (slug, body) => request(slug ? `/api/admin/categories/${slug}` : '/api/admin/categories', {
    method: slug ? 'PATCH' : 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  }),
  removeCategory: (slug) => request(`/api/admin/categories/${slug}`, { method: 'DELETE', headers: authHeaders() }),
  banners: () => orCatalog(async () => {
    const data = await request('/api/banners');
    if (!Array.isArray(data)) throw new Error('Request failed');
    return data;
  }, (catalog) => catalog.banners || []),
  deskBanners: () => request('/api/admin/banners', { headers: authHeaders() }),
  saveBanner: (id, fields, file) => {
    const body = new FormData();
    for (const [key, value] of Object.entries(fields)) body.append(key, String(value));
    if (file) body.append('image', file);
    return request(id ? `/api/admin/banners/${id}` : '/api/admin/banners', {
      method: id ? 'PATCH' : 'POST',
      headers: authHeaders(),
      body,
    });
  },
  orderBanners: (ids) => request('/api/admin/banners/order', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ ids }),
  }),
  removeBanner: (id) => request(`/api/admin/banners/${id}`, { method: 'DELETE', headers: authHeaders() }),
  videos: () => request('/api/videos'),
  uploadVideo: (title, file) => {
    const body = new FormData();
    body.append('title', title);
    body.append('video', file);
    return request('/api/admin/videos', { method: 'POST', headers: authHeaders(), body });
  },
  removeVideo: (id) => request(`/api/admin/videos/${id}`, { method: 'DELETE', headers: authHeaders() }),
  registerStart: (body) => request('/api/account/register/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  registerVerify: (email, code) => request('/api/account/register/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  }),
  accountMe: () => request('/api/account/me', { headers: customerHeaders() }),
  accountLogout: () => request('/api/account/logout', { method: 'POST', headers: customerHeaders() }),
  staffMe: () => request('/api/admin/me', { headers: authHeaders() }),
  staffLogout: () => request('/api/admin/logout', { method: 'POST', headers: authHeaders() }),
  startCheckoutOtp: (body) => request('/api/account/otp/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  verifyCheckoutOtp: (body) => request('/api/account/otp/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  addresses: () => request('/api/account/addresses', { headers: customerHeaders() }),
  saveAddress: (id, body) => request(id ? `/api/account/addresses/${id}` : '/api/account/addresses', {
    method: id ? 'PATCH' : 'POST',
    headers: { 'Content-Type': 'application/json', ...customerHeaders() },
    body: JSON.stringify(body),
  }),
  removeAddress: (id) => request(`/api/account/addresses/${id}`, { method: 'DELETE', headers: customerHeaders() }),
  accountLogin: (email, password) => request('/api/account/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }),
  myOrders: () => request('/api/account/orders', { headers: customerHeaders() }),
  favorites: () => request('/api/account/favorites', { headers: customerHeaders() }),
  saveFavorite: (slug) => request('/api/account/favorites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...customerHeaders() },
    body: JSON.stringify({ slug }),
  }),
  removeFavorite: (slug) => request(`/api/account/favorites/${slug}`, { method: 'DELETE', headers: customerHeaders() }),
  myReviews: () => request('/api/account/reviews', { headers: customerHeaders() }),
  writeReview: (body) => request('/api/account/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...customerHeaders() },
    body: JSON.stringify(body),
  }),
  productReviews: (slug) => request(`/api/products/${slug}/reviews`),
  deskReviews: () => request('/api/admin/reviews', { headers: authHeaders() }),
  moderateReview: (id, status) => request(`/api/admin/reviews/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ status }),
  }),
  track: (number, phone) => request(`/api/orders/track?number=${encodeURIComponent(number)}&phone=${encodeURIComponent(phone)}`),
  login: (email, password) => request('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }),
  summary: () => request('/api/admin/summary', { headers: authHeaders() }),
  orders: (params = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.q) query.set('q', params.q);
    return request(`/api/admin/orders?${query}`, { headers: authHeaders() });
  },
  order: (orderNumber) => request(`/api/admin/orders/${orderNumber}`, { headers: authHeaders() }),
  updateOrder: (orderNumber, body) => request(`/api/admin/orders/${orderNumber}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  }),
  inventory: () => request('/api/admin/inventory', { headers: authHeaders() }),
  adjustStock: (body) => request('/api/admin/inventory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  }),
  uploadImage: (slug, file) => {
    const body = new FormData();
    body.append('image', file);
    return request(`/api/admin/products/${slug}/images`, {
      method: 'POST',
      headers: authHeaders(),
      body,
    });
  },
  removeImage: (slug, url) => request(`/api/admin/products/${slug}/images`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ url }),
  }),
  reports: (from, to) => {
    const query = new URLSearchParams();
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    return request(`/api/admin/reports?${query}`, { headers: authHeaders() });
  },
  shipping: () => request('/api/shipping').catch(() => null),
  settings: () => request('/api/admin/settings', { headers: authHeaders() }),
  saveSettings: (body) => request('/api/admin/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  }),
  // createBill: (body) => request('/api/admin/pos', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json', ...authHeaders() },
  //   body: JSON.stringify(body),
  // }),
  staffList: () => request('/api/admin/staff', { headers: authHeaders() }),
  createStaff: (body) => request('/api/admin/staff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  }),
};

export function inr(paise) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format((paise || 0) / 100);
}

export function when(value) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export const STATUS_LABEL = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const PAYMENT_LABEL = {
  online: 'Online payment',
  demo: 'Test payment',
  cod: 'Cash on delivery',
  whatsapp: 'WhatsApp · cash on delivery',
  cash: 'Cash at the counter',
  upi: 'UPI at the counter',
};

export const PAYMENT_STATUS_LABEL = {
  paid: 'Paid',
  awaiting: 'Awaiting payment',
  expired: 'Payment not completed',
};

export function paymentLabel(order) {
  if (order.paymentMethod === 'online' || order.paymentMethod === 'demo') {
    const kind = PAYMENT_LABEL[order.paymentMethod] || PAYMENT_LABEL.online;
    return `${kind} · ${PAYMENT_STATUS_LABEL[order.paymentStatus] || 'Awaiting payment'}`;
  }
  return PAYMENT_LABEL[order.paymentMethod] || order.paymentMethod;
}

let razorpayScript;
export function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (!razorpayScript) {
    razorpayScript = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(window.Razorpay);
      script.onerror = () => {
        razorpayScript = null;
        reject(new Error('The payment window could not load. Check the connection and try again.'));
      };
      document.body.appendChild(script);
    });
  }
  return razorpayScript;
}

export const SHOP_WHATSAPP = '919884126032';

export const STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh',
  'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry',
  'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal',
];

export async function lookupPincode(pincode) {
  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    const [result] = await response.json();
    const offices = result?.Status === 'Success' ? result.PostOffice || [] : [];
    if (!offices.length) return null;
    const state = STATES.find((item) => item.toLowerCase() === String(offices[0].State).toLowerCase()) || '';
    return { city: offices[0].District, state, localities: [...new Set(offices.map((office) => office.Name))] };
  } catch {
    return null;
  }
}

export function addressText(address) {
  return [address.addressLine, address.locality, address.landmark, address.city, address.state]
    .filter(Boolean)
    .join(', ') + (address.pincode ? ` - ${address.pincode}` : '');
}

export function sourceLabel(channel) {
  if (channel === 'store') return 'Store';
  if (channel === 'whatsapp') return 'WhatsApp';
  return 'Online';
}

export function whatsAppLink(phone, text) {
  const digits = String(phone || SHOP_WHATSAPP).replace(/\D/g, '');
  const target = digits.length > 10 ? digits : `91${digits.replace(/^91/, '')}`;
  return `https://wa.me/${target}?text=${encodeURIComponent(text)}`;
}

export function orderWhatsAppText(order) {
  const lines = (order.items || []).map((item) => `• ${item.productName} (${item.variantLabel}) × ${item.quantity}`).join('\n');
  return [
    `Hello Jagatha Organics, I placed website order ${order.orderNumber}.`,
    '',
    order.customerName,
    order.phone,
    `${order.addressLine}, ${order.city} ${order.pincode}`,
    '',
    lines,
    '',
    `Total ${inr(order.totalPaise)}`,
    'Cash on delivery. Please confirm this order.',
  ].join('\n');
}

export const ROLE_LABEL = {
  admin: 'Owner',
  billing: 'Billing staff',
  delivery: 'Delivery staff',
};

export function readStaff() {
  try {
    return JSON.parse(sessionStorage.getItem('jagatha-staff') || 'null');
  } catch {
    return null;
  }
}

export function readCustomer() {
  try {
    return JSON.parse(sessionStorage.getItem('jagatha-customer') || 'null');
  } catch {
    return null;
  }
}

function bumpSession() {
  window.dispatchEvent(new Event('jagatha-session'));
}

export function saveCustomer(result) {
  const customer = result?.customer || result;
  if (customer?.id) sessionStorage.setItem('jagatha-customer', JSON.stringify(customer));
  bumpSession();
}

export function forgetCustomer() {
  sessionStorage.removeItem('jagatha-customer-token');
  sessionStorage.removeItem('jagatha-customer');
  bumpSession();
}

export function clearCustomer() {
  forgetCustomer();
  api.accountLogout().catch(() => {});
}

export function saveStaff(staff) {
  if (staff?.role) sessionStorage.setItem('jagatha-staff', JSON.stringify(staff));
  bumpSession();
}

export function forgetStaff() {
  sessionStorage.removeItem('jagatha-admin');
  sessionStorage.removeItem('jagatha-staff');
  bumpSession();
}

export function clearStaff() {
  forgetStaff();
  api.staffLogout().catch(() => {});
}
