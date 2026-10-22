export const DEFAULT_SHIPPING = {
  defaultMode: 'weight',
  defaultFlatRupees: 75,
  defaultSlabGrams: 500,
  defaultSlabRupees: 75,
  states: {
    'Tamil Nadu': { mode: 'free' },
  },
};

const TN_PIN_FROM = 600001;
const TN_PIN_TO = 643282;
const MODES = new Set(['inherit', 'free', 'flat', 'weight']);

export function pinNumber(pincode) {
  const digits = String(pincode || '').replace(/\D/g, '');
  if (digits.length !== 6) return 0;
  return Number(digits);
}

export function isTamilNaduPin(pincode) {
  const pin = pinNumber(pincode);
  return pin >= TN_PIN_FROM && pin <= TN_PIN_TO;
}

function itemGrams(item) {
  const n = Number(item.grams ?? item.weightGrams);
  if (Number.isFinite(n) && n > 0) return n;
  const match = String(item.label || item.variantLabel || '').match(/(\d+)\s*g/i);
  return match ? Number(match[1]) : 0;
}

export function cartGrams(items) {
  return (items || []).reduce((sum, item) => {
    const quantity = Math.max(0, Number(item.quantity) || 0);
    return sum + (itemGrams(item) || 500) * quantity;
  }, 0);
}

function rupees(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n);
}

function grams(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.round(n);
}

export function normalizeShipping(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const states = {};
  const incoming = source.states && typeof source.states === 'object' ? source.states : {};
  for (const [name, rule] of Object.entries(incoming)) {
    const mode = MODES.has(rule?.mode) ? rule.mode : 'inherit';
    if (mode === 'inherit') continue;
    states[name] = {
      mode,
      flatRupees: rupees(rule.flatRupees, 75),
      slabGrams: grams(rule.slabGrams, 500),
      slabRupees: rupees(rule.slabRupees, 75),
    };
  }
  return {
    defaultMode: ['free', 'flat', 'weight'].includes(source.defaultMode) ? source.defaultMode : 'weight',
    defaultFlatRupees: rupees(source.defaultFlatRupees, 75),
    defaultSlabGrams: grams(source.defaultSlabGrams, 500),
    defaultSlabRupees: rupees(source.defaultSlabRupees, 75),
    states,
  };
}

export function resolveState(pincode, state) {
  const named = String(state || '').trim();
  if (named) return named;
  return isTamilNaduPin(pincode) ? 'Tamil Nadu' : '';
}

export function resolveRule(config, state) {
  const rules = normalizeShipping(config);
  const override = rules.states[state];
  if (override) return override;
  return {
    mode: rules.defaultMode,
    flatRupees: rules.defaultFlatRupees,
    slabGrams: rules.defaultSlabGrams,
    slabRupees: rules.defaultSlabRupees,
  };
}

export function shippingPaise(input, config) {
  const pincode = typeof input === 'object' ? input?.pincode : input;
  const gramsValue = typeof input === 'object' ? input?.grams : arguments[1];
  const state = typeof input === 'object' ? input?.state : '';
  const rules = typeof input === 'object' ? config : arguments[2];
  const resolved = resolveState(pincode, state);
  if (!pinNumber(pincode) && !resolved) return 0;
  const rule = resolveRule(rules, resolved);
  if (rule.mode === 'free') return 0;
  if (rule.mode === 'flat') return rule.flatRupees * 100;
  const weight = Math.max(0, Number(gramsValue) || 0);
  if (weight <= 0) return 0;
  return Math.ceil(weight / rule.slabGrams) * (rule.slabRupees * 100);
}

export function shippingHint(config, { pincode, state, paise } = {}) {
  const resolved = resolveState(pincode, state);
  if (!resolved && !pinNumber(pincode)) return 'Enter a pincode to see delivery for that state.';
  const rule = resolveRule(config, resolved);
  const where = resolved || 'this pincode';
  if (rule.mode === 'free' || paise === 0) return `Free delivery for ${where}.`;
  if (rule.mode === 'flat') return `Delivery to ${where}: ₹${rule.flatRupees} per order.`;
  return `Delivery to ${where}: ₹${rule.slabRupees} per ${rule.slabGrams}g.`;
}

export async function loadShippingRules(pool) {
  const { rows } = await pool.query(`SELECT value FROM settings WHERE key = 'shipping'`);
  if (!rows[0]) return normalizeShipping(DEFAULT_SHIPPING);
  try {
    return normalizeShipping(JSON.parse(rows[0].value));
  } catch {
    return normalizeShipping(DEFAULT_SHIPPING);
  }
}

export const DEFAULT_SHOP = {
  name: 'Jagatha Organics',
  address: 'Theni, Tamil Nadu',
  phone: '9884126032',
  email: '',
  gstin: '',
};

export function normalizeShop(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    name: String(source.name || DEFAULT_SHOP.name).trim().slice(0, 80) || DEFAULT_SHOP.name,
    address: String(source.address || DEFAULT_SHOP.address).trim().slice(0, 200),
    phone: String(source.phone || DEFAULT_SHOP.phone).replace(/\D/g, '').slice(0, 10),
    email: String(source.email || '').trim().slice(0, 120),
    gstin: String(source.gstin || '').trim().toUpperCase().slice(0, 15),
  };
}

export async function loadShop(pool) {
  const { rows } = await pool.query(`SELECT value FROM settings WHERE key = 'shop'`);
  if (!rows[0]) return { ...DEFAULT_SHOP };
  try {
    return normalizeShop(JSON.parse(rows[0].value));
  } catch {
    return { ...DEFAULT_SHOP };
  }
}

export async function saveSetting(pool, key, value) {
  await pool.query(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, JSON.stringify(value)],
  );
}
