async function request(url, options) {
  const response = await fetch(url, options);
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
  const token = sessionStorage.getItem('jagatha-admin');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function customerHeaders() {
  const token = sessionStorage.getItem('jagatha-customer-token');
  return token ? { Authorization: `Bearer ${token}` } : {};
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
  videos: () => request('/api/videos'),
  uploadVideo: (title, file) => {
    const body = new FormData();
    body.append('title', title);
    body.append('video', file);
    return request('/api/admin/videos', { method: 'POST', headers: authHeaders(), body });
  },
  removeVideo: (id) => request(`/api/admin/videos/${id}`, { method: 'DELETE', headers: authHeaders() }),
  register: (body) => request('/api/account/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
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
  createBill: (body) => request('/api/admin/pos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  }),
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
  cod: 'Cash on delivery',
  whatsapp: 'WhatsApp · cash on delivery',
  cash: 'Cash at the counter',
  upi: 'UPI at the counter',
};

export const SHOP_WHATSAPP = '919884126032';

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

export function saveCustomer(result) {
  sessionStorage.setItem('jagatha-customer-token', result.token);
  sessionStorage.setItem('jagatha-customer', JSON.stringify(result.customer));
}

export function clearCustomer() {
  sessionStorage.removeItem('jagatha-customer-token');
  sessionStorage.removeItem('jagatha-customer');
}
