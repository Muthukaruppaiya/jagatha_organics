import { getPool } from './db.js';
import { loadShippingRules, loadShop, normalizeShipping, normalizeShop, saveSetting } from './shipping.js';

export function registerSettings(app, { requireStaff, allow }) {
  app.get('/api/shipping', async (_req, res, next) => {
    try {
      res.json(await loadShippingRules(getPool()));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/admin/settings', requireStaff, allow('admin'), async (_req, res, next) => {
    try {
      const pool = getPool();
      res.json({
        shop: await loadShop(pool),
        shipping: await loadShippingRules(pool),
      });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/admin/settings', requireStaff, allow('admin'), async (req, res, next) => {
    try {
      const pool = getPool();
      if (req.body?.shop) await saveSetting(pool, 'shop', normalizeShop(req.body.shop));
      if (req.body?.shipping) await saveSetting(pool, 'shipping', normalizeShipping(req.body.shipping));
      res.json({
        shop: await loadShop(pool),
        shipping: await loadShippingRules(pool),
      });
    } catch (error) {
      next(error);
    }
  });
}
