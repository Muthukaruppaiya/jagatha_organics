import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { CartProvider } from './cart.jsx';
import { StoreLayout } from './layout.jsx';
import { Cart, Contact, Home, Missing, Product, Shop } from './pages.jsx';
import { Checkout, OrderDone, Track } from './checkout.jsx';
import { PayCancelled, PayExpired, PayFailed, PayWaiting } from './payment.jsx';
import { AccountHome, AccountLogin } from './account.jsx';
import { AdminHome, AdminLogin, AdminOrder } from './admin.jsx';
import { AdminBanners, AdminImages, AdminInventory, AdminReports, AdminReviews, AdminStaff, AdminVideos } from './desk.jsx';
import { AdminProducts } from './products-desk.jsx';
import { AdminSettings } from './settings-desk.jsx';

export default function App() {
  return (
    <CartProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<StoreLayout />}>
            <Route index element={<Home />} />
            <Route path="shop" element={<Shop />} />
            <Route path="shop/:category" element={<Shop />} />
            <Route path="product/:slug" element={<Product />} />
            <Route path="cart" element={<Cart />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="pay/:orderNumber" element={<PayWaiting />} />
            <Route path="pay/:orderNumber/cancelled" element={<PayCancelled />} />
            <Route path="pay/:orderNumber/failed" element={<PayFailed />} />
            <Route path="pay/:orderNumber/expired" element={<PayExpired />} />
            <Route path="order/:orderNumber" element={<OrderDone />} />
            <Route path="track" element={<Track />} />
            <Route path="contact" element={<Contact />} />
            <Route path="account/login" element={<AccountLogin />} />
            <Route path="account" element={<AccountHome />} />
            <Route path="*" element={<Missing />} />
          </Route>
          <Route path="admin/login" element={<AdminLogin />} />
          <Route path="admin" element={<AdminHome />} />
          <Route path="admin/orders/:orderNumber" element={<AdminOrder />} />
          {/* Store billing is paused.
          <Route path="admin/billing" element={<AdminBilling />} />
          */}
          <Route path="admin/products" element={<AdminProducts />} />
          <Route path="admin/inventory" element={<AdminInventory />} />
          <Route path="admin/images" element={<AdminImages />} />
          <Route path="admin/banners" element={<AdminBanners />} />
          <Route path="admin/videos" element={<AdminVideos />} />
          <Route path="admin/reviews" element={<AdminReviews />} />
          <Route path="admin/reports" element={<AdminReports />} />
          <Route path="admin/settings" element={<AdminSettings />} />
          <Route path="admin/staff" element={<AdminStaff />} />
        </Routes>
      </BrowserRouter>
    </CartProvider>
  );
}
