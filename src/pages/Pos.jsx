import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  Banknote, 
  CircleDollarSign, 
  Printer, 
  Copy, 
  Check, 
  X, 
  Utensils, 
  Receipt as ReceiptIcon,
  AlertCircle,
  Pizza,
  User,
  Truck,
  MapPin,
  Phone
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DEFAULT_CURRENCY } from '../utils/currency';

export default function Pos() {
  const { organization, profile } = useAuth();
  const currency = organization?.currency || DEFAULT_CURRENCY;

  // Menu Data State
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Cart / Current Order State
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [orderType, setOrderType] = useState('walkin'); // 'walkin' | 'delivery'
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');

  // Modals State
  const [sizePickerItem, setSizePickerItem] = useState(null);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [tenderedAmount, setTenderedAmount] = useState('');
  const [completingOrder, setCompletingOrder] = useState(false);

  // Completed Order / Receipt View Modal
  const [completedOrder, setCompletedOrder] = useState(null);
  const [kitchenTicketOrder, setKitchenTicketOrder] = useState(null);
  const [copiedReceipt, setCopiedReceipt] = useState(false);
  const [error, setError] = useState(null);

  // Fetch Menu Items & Categories
  const loadCatalog = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    try {
      if (isSupabaseConfigured() && supabase) {
        // Fetch Categories
        const { data: catData, error: catErr } = await supabase
          .from('menu_categories')
          .select('*')
          .eq('organization_id', organization.id)
          .order('created_at', { ascending: true });

        if (catErr) throw catErr;

        // Fetch Menu Items with Prices
        const { data: itemData, error: itemErr } = await supabase
          .from('menu_items')
          .select(`
            id,
            organization_id,
            category_id,
            name,
            description,
            type,
            menu_item_prices (
              id,
              size_label,
              price
            )
          `)
          .eq('organization_id', organization.id);

        if (itemErr) throw itemErr;

        setCategories(catData || []);
        setMenuItems(itemData || []);
      } else {
        const localData = JSON.parse(localStorage.getItem('restaurant_pos_menu_data') || '{"categories":[],"items":[]}');
        setCategories(localData.categories || []);
        setMenuItems(localData.items || []);
      }
    } catch (err) {
      console.error('Error loading POS catalog:', err);
      setError('Could not load menu items. Please check database connection.');
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // Handle Card Click
  const handleItemCardClick = (item) => {
    const prices = item.menu_item_prices || [];
    if (prices.length === 0) {
      alert('This item has no configured price.');
      return;
    }

    if (prices.length > 1) {
      // Multi-size item (e.g. pizza) -> Open size picker modal
      setSizePickerItem(item);
    } else {
      // Single price item -> Add directly to cart
      addToCart(item, prices[0].size_label, parseFloat(prices[0].price));
    }
  };

  // Add Item to Cart
  const addToCart = (item, sizeLabel, price) => {
    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex(
        (ci) => ci.menu_item_id === item.id && ci.size_label === sizeLabel
      );

      if (existingIndex !== -1) {
        const updated = [...prevCart];
        updated[existingIndex].quantity += 1;
        updated[existingIndex].line_total = updated[existingIndex].quantity * price;
        return updated;
      } else {
        return [
          ...prevCart,
          {
            menu_item_id: item.id,
            item_name: item.name,
            size_label: sizeLabel,
            unit_price: price,
            quantity: 1,
            line_total: price,
          },
        ];
      }
    });

    if (sizePickerItem) {
      setSizePickerItem(null);
    }
  };

  // Update Cart Item Quantity
  const updateQuantity = (index, delta) => {
    setCart((prevCart) => {
      const updated = [...prevCart];
      const item = updated[index];
      const newQty = item.quantity + delta;

      if (newQty <= 0) {
        return updated.filter((_, idx) => idx !== index);
      } else {
        item.quantity = newQty;
        item.line_total = newQty * item.unit_price;
        return updated;
      }
    });
  };

  // Remove Item from Cart
  const removeCartItem = (index) => {
    setCart((prevCart) => prevCart.filter((_, idx) => idx !== index));
  };

  // Clear Entire Cart
  const clearCart = () => {
    setCart([]);
    setCustomerName('Walk-in Customer');
  };

  // Calculations
  const taxPercent = organization?.tax_percent ? parseFloat(organization.tax_percent) : 0;
  const subtotal = cart.reduce((sum, item) => sum + item.line_total, 0);
  const tax = subtotal * (taxPercent / 100);
  const total = subtotal + tax;

  // Checkout / Complete Order
  const handleConfirmOrder = async () => {
    if (cart.length === 0 || !organization?.id) return;
    setCompletingOrder(true);
    setError(null);

    try {
      let receiptNumber = 1;
      let orderRecord = null;

      if (isSupabaseConfigured() && supabase) {
        // 1. Get next receipt number for this organization
        const { data: nextNumData } = await supabase.rpc('get_next_receipt_number', {
          p_org_id: organization.id,
        });

        if (nextNumData) {
          receiptNumber = nextNumData;
        } else {
          // Fallback direct count
          const { count } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', organization.id);
          receiptNumber = (count || 0) + 1;
        }

        // 2. Insert Order
        const { data: newOrder, error: orderErr } = await supabase
          .from('orders')
          .insert({
            organization_id: organization.id,
            receipt_number: receiptNumber,
            staff_id: profile?.id || null,
            customer_name: customerName.trim() || (orderType === 'delivery' ? 'Delivery Customer' : 'Walk-in Customer'),
            order_type: orderType,
            delivery_status: orderType === 'delivery' ? 'pending' : null,
            customer_phone: orderType === 'delivery' ? customerPhone.trim() : null,
            delivery_address: orderType === 'delivery' ? deliveryAddress.trim() : null,
            subtotal: subtotal,
            tax: tax,
            total: total,
            payment_method: paymentMethod,
            status: 'completed',
          })
          .select()
          .single();

        if (orderErr) throw orderErr;
        orderRecord = newOrder;

        // 3. Insert Order Items
        const orderItemRows = cart.map((ci) => ({
          order_id: newOrder.id,
          menu_item_id: ci.menu_item_id,
          item_name: ci.item_name,
          size_label: ci.size_label,
          quantity: ci.quantity,
          unit_price: ci.unit_price,
          line_total: ci.line_total,
        }));

        const { error: itemsErr } = await supabase
          .from('order_items')
          .insert(orderItemRows);

        if (itemsErr) throw itemsErr;
      } else {
        // Sandbox fallback
        const localOrders = JSON.parse(localStorage.getItem('restaurant_pos_orders') || '[]');
        receiptNumber = localOrders.filter((o) => o.organization_id === organization.id).length + 1;
        
        orderRecord = {
          id: 'ord_' + Math.random().toString(36).substring(2, 9),
          organization_id: organization.id,
          receipt_number: receiptNumber,
          customer_name: customerName.trim() || (orderType === 'delivery' ? 'Delivery Customer' : 'Walk-in Customer'),
          order_type: orderType,
          delivery_status: orderType === 'delivery' ? 'pending' : null,
          customer_phone: orderType === 'delivery' ? customerPhone.trim() : null,
          delivery_address: orderType === 'delivery' ? deliveryAddress.trim() : null,
          subtotal,
          tax,
          total,
          payment_method: paymentMethod,
          status: 'completed',
          created_at: new Date().toISOString(),
        };

        localOrders.push(orderRecord);
        localStorage.setItem('restaurant_pos_orders', JSON.stringify(localOrders));
      }

      const orderSnapshot = {
        ...orderRecord,
        receipt_number: receiptNumber,
        items: [...cart],
        organization_name: organization.name,
        organization_phone: organization.phone,
        organization_address: organization.address,
        cashier_name: profile?.full_name || 'Cashier',
        payment_method: paymentMethod,
        subtotal,
        tax,
        total,
        created_at: new Date().toISOString(),
      };

      // Save to completed order state for Receipt View
      setCompletedOrder(orderSnapshot);

      // If kitchen invoice is enabled, also open kitchen ticket
      if (organization.kitchen_invoice_enabled) {
        setKitchenTicketOrder(orderSnapshot);
      }

      // Reset cart and checkout modal
      setCart([]);
      setCustomerName('Walk-in Customer');
      setOrderType('walkin');
      setCustomerPhone('');
      setDeliveryAddress('');
      setCheckoutModalOpen(false);
    } catch (err) {
      console.error('Error completing order:', err);
      setError(err.message || 'Failed to complete order.');
    } finally {
      setCompletingOrder(false);
    }
  };

  // Copy Receipt Text
  const copyReceiptText = () => {
    if (!completedOrder) return;
    const lines = [
      `================================`,
      `       ${completedOrder.organization_name.toUpperCase()}`,
      completedOrder.organization_address ? `  ${completedOrder.organization_address}` : '',
      completedOrder.organization_phone ? `  Tel: ${completedOrder.organization_phone}` : '',
      `================================`,
      `Receipt #: ${completedOrder.receipt_number}`,
      `Type:      ${completedOrder.order_type === 'delivery' ? 'DELIVERY ORDER' : 'WALK-IN ORDER'}`,
      `Date:      ${new Date(completedOrder.created_at).toLocaleString()}`,
      `Customer:  ${completedOrder.customer_name}`,
      completedOrder.customer_phone ? `Phone:     ${completedOrder.customer_phone}` : '',
      completedOrder.delivery_address ? `Address:   ${completedOrder.delivery_address}` : '',
      `Cashier:   ${completedOrder.cashier_name}`,
      `--------------------------------`,
      ...completedOrder.items.map(
        (i) => `${i.quantity}x ${i.item_name} (${i.size_label}) - ${currency} ${i.line_total.toFixed(2)}`
      ),
      `--------------------------------`,
      `Subtotal:  ${currency} ${completedOrder.subtotal.toFixed(2)}`,
      `Tax:       ${currency} ${completedOrder.tax.toFixed(2)}`,
      `TOTAL:     ${currency} ${completedOrder.total.toFixed(2)}`,
      `Payment:   ${completedOrder.payment_method}`,
      `================================`,
      `   Thank you for your visit!`,
      `--------------------------------`,
      `       Software by ARS`,
      `================================`,
    ]
      .filter(Boolean)
      .join('\n');

    navigator.clipboard.writeText(lines);
    setCopiedReceipt(true);
    setTimeout(() => setCopiedReceipt(false), 2000);
  };

  // Filter Catalog items
  const filteredCatalog = menuItems.filter((item) => {
    const matchesCategory =
      selectedCategory === 'all' || item.category_id === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {error && (
        <div className="alert alert-danger" style={{ marginBottom: 0 }}>
          <AlertCircle size={18} />
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="btn btn-ghost" style={{ marginLeft: 'auto', padding: '2px' }}>
            <X size={16} />
          </button>
        </div>
      )}

      <div className="pos-layout">
        {/* ====================================================================
            LEFT PANEL: CATALOG & SEARCH & TABS
            ==================================================================== */}
        <div className="pos-catalog-panel">
          {/* Search Bar */}
          <div className="pos-search-bar">
            <Search size={18} className="pos-search-icon" />
            <input
              type="text"
              className="pos-search-input"
              placeholder="Search items by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Category Tabs */}
          <div className="pos-category-tabs">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`pos-tab-btn ${selectedCategory === 'all' ? 'active' : ''}`}
            >
              All Items ({menuItems.length})
            </button>

            {categories.map((cat) => {
              const count = menuItems.filter((i) => i.category_id === cat.id).length;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`pos-tab-btn ${selectedCategory === cat.id ? 'active' : ''}`}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>

          {/* Item Cards Grid */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-gray-muted)' }}>
              Loading point of sale catalog...
            </div>
          ) : filteredCatalog.length === 0 ? (
            <div className="card" style={{ background: '#fff', textAlign: 'center', padding: '3rem', border: '1px solid #e2e8f0' }}>
              <Utensils size={36} color="#cbd5e1" style={{ margin: '0 auto 0.75rem auto' }} />
              <h3 style={{ fontSize: '1.1rem', color: 'var(--text-dark-bold)', marginBottom: '0.25rem' }}>
                No items found
              </h3>
              <p style={{ color: 'var(--text-gray-muted)', fontSize: '0.85rem' }}>
                {searchTerm
                  ? 'Try searching with a different term'
                  : 'Add items in Menu Management to start selling'}
              </p>
            </div>
          ) : (
            <div className="pos-items-grid">
              {filteredCatalog.map((item) => {
                const prices = item.menu_item_prices || [];
                const isMultiSize = prices.length > 1;
                const minPrice = prices.length > 0 ? Math.min(...prices.map((p) => parseFloat(p.price))) : 0;
                const maxPrice = prices.length > 0 ? Math.max(...prices.map((p) => parseFloat(p.price))) : 0;

                return (
                  <div
                    key={item.id}
                    className="pos-item-card"
                    onClick={() => handleItemCardClick(item)}
                    role="button"
                    tabIndex="0"
                  >
                    <div>
                      <h3 className="pos-card-name">{item.name}</h3>
                      <span className="pos-card-badge">
                        {item.type === 'pizza' ? '🍕 Pizza' : 'Standard'}
                      </span>
                    </div>

                    <div className="pos-card-price-row">
                      <div className="pos-card-price">
                        {isMultiSize
                          ? `${currency} ${minPrice.toLocaleString()} - ${maxPrice.toLocaleString()}`
                          : `${currency} ${minPrice.toLocaleString()}`}
                      </div>

                      {isMultiSize && (
                        <span className="pos-card-sizes-count">
                          {prices.length} sizes
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ====================================================================
            RIGHT PANEL: "CURRENT ORDER" CART
            ==================================================================== */}
        <div className="pos-cart-panel">
          <div className="pos-cart-header">
            <div className="pos-cart-title">
              <ShoppingBag size={18} color="var(--primary-orange)" />
              <span>Current Order</span>
            </div>

            {cart.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="btn btn-ghost"
                style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', color: 'var(--danger-red)' }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Customer Name Input */}
          <div className="pos-cart-customer">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
              <User size={13} color="var(--text-gray-muted)" />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-gray-muted)' }}>Customer:</span>
            </div>
            <input
              type="text"
              className="pos-customer-input"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer Name..."
            />
          </div>

          {/* Cart Items List */}
          {cart.length === 0 ? (
            <div className="pos-cart-empty">
              <ShoppingBag size={40} color="#cbd5e1" />
              <p style={{ fontSize: '0.9rem', color: '#94a3b8', margin: 0, fontWeight: 500 }}>
                No items in order
              </p>
              <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                Click items on the left to add to order
              </span>
            </div>
          ) : (
            <div className="pos-cart-items">
              {cart.map((item, idx) => (
                <div key={idx} className="pos-cart-item">
                  <div className="pos-cart-item-info">
                    <div className="pos-cart-item-name">{item.item_name}</div>
                    <div className="pos-cart-item-size">
                      {item.size_label} • {currency} {item.unit_price.toFixed(2)}
                    </div>
                  </div>

                  <div className="pos-cart-qty-stepper">
                    <button
                      type="button"
                      onClick={() => updateQuantity(idx, -1)}
                      className="qty-btn"
                      aria-label="Decrease quantity"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="qty-display">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(idx, 1)}
                      className="qty-btn"
                      aria-label="Increase quantity"
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  <div className="pos-cart-item-total">
                    {currency} {item.line_total.toFixed(2)}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeCartItem(idx)}
                    className="btn btn-ghost"
                    style={{ padding: '0.2rem', color: '#94a3b8' }}
                    title="Remove item"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Cart Summary & Charge Action */}
          <div className="pos-cart-footer">
            <div className="pos-summary-row">
              <span>Subtotal</span>
              <span style={{ fontWeight: 600, color: 'var(--text-dark-bold)' }}>
                {currency} {subtotal.toFixed(2)}
              </span>
            </div>

            <div className="pos-summary-row">
              <span>Tax ({taxPercent}%)</span>
              <span style={{ fontWeight: 600, color: 'var(--text-dark-bold)' }}>
                {currency} {tax.toFixed(2)}
              </span>
            </div>

            <div className="pos-summary-row total-row">
              <span>Total</span>
              <span style={{ color: 'var(--primary-orange)' }}>
                {currency} {total.toFixed(2)}
              </span>
            </div>

            <button
              type="button"
              disabled={cart.length === 0}
              onClick={() => setCheckoutModalOpen(true)}
              className="pos-charge-btn"
            >
              <CreditCard size={18} />
              <span>Charge • {currency} {total.toFixed(2)}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ====================================================================
          MODAL: SIZE PICKER (FOR PIZZAS / MULTI-SIZE ITEMS)
          ==================================================================== */}
      {sizePickerItem && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Pizza size={20} color="var(--primary-orange)" />
                <span>Select Size: {sizePickerItem.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setSizePickerItem(null)}
                className="modal-close-btn"
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-gray-muted)', marginBottom: '1.25rem' }}>
              Choose a size to add this item to the current order:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {sizePickerItem.menu_item_prices.map((p) => (
                <button
                  key={p.id || p.size_label}
                  type="button"
                  onClick={() => addToCart(sizePickerItem, p.size_label, parseFloat(p.price))}
                  className="btn btn-secondary"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.85rem 1.25rem',
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    color: 'var(--text-dark-bold)',
                    fontWeight: 700
                  }}
                >
                  <span style={{ fontSize: '0.95rem' }}>{p.size_label}</span>
                  <span style={{ color: 'var(--price-green)', fontSize: '1rem', fontWeight: 800 }}>
                    {currency} {parseFloat(p.price).toLocaleString()}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: CHECKOUT & PAYMENT METHOD SELECTOR
          ==================================================================== */}
      {checkoutModalOpen && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CircleDollarSign size={22} color="var(--primary-orange)" />
                <span>Complete Order &amp; Payment</span>
              </h3>
              <button
                type="button"
                onClick={() => setCheckoutModalOpen(false)}
                className="modal-close-btn"
              >
                <X size={20} />
              </button>
            </div>

            {/* Total Amount Due Banner */}
            <div style={{ textAlign: 'center', margin: '0.5rem 0 1.25rem 0', background: '#fff7ed', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid #ffedd5' }}>
              <div style={{ fontSize: '0.8rem', color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                Total Amount Due
              </div>
              <div style={{ fontSize: '2.25rem', fontWeight: 900, color: 'var(--primary-orange)', marginTop: '0.15rem' }}>
                {currency} {total.toFixed(2)}
              </div>
            </div>

            {/* Step 1: Order Type Selector */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ color: 'var(--text-dark-bold)', fontWeight: 800 }}>
                Order Type:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setOrderType('walkin')}
                  className="btn"
                  style={{
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${orderType === 'walkin' ? 'var(--primary-orange)' : '#e2e8f0'}`,
                    background: orderType === 'walkin' ? '#fff7ed' : '#f8fafc',
                    color: orderType === 'walkin' ? '#c2410c' : '#475569',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <User size={18} />
                  <span>Walk-in Customer</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOrderType('delivery')}
                  className="btn"
                  style={{
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${orderType === 'delivery' ? 'var(--primary-orange)' : '#e2e8f0'}`,
                    background: orderType === 'delivery' ? '#fff7ed' : '#f8fafc',
                    color: orderType === 'delivery' ? '#c2410c' : '#475569',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <Truck size={18} />
                  <span>Delivery Order</span>
                </button>
              </div>
            </div>

            {/* Delivery Customer Details Form */}
            {orderType === 'delivery' ? (
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <MapPin size={14} color="var(--primary-orange)" />
                  <span>Delivery Information (Required)</span>
                </div>

                <div className="form-group" style={{ marginBottom: '0.65rem' }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Customer Name <span className="required-mark">*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Usman Ali"
                    value={customerName === 'Walk-in Customer' ? '' : customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    style={{ background: '#fff' }}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '0.65rem' }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Customer Phone Number <span className="required-mark">*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="03xx-xxxxxxx"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    style={{ background: '#fff' }}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Delivery Address <span className="required-mark">*</span></label>
                  <textarea
                    rows={2}
                    className="form-input"
                    placeholder="House #, Street, Block, Area, Landmarks..."
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    style={{ background: '#fff', resize: 'vertical' }}
                    required
                  />
                </div>
              </div>
            ) : (
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ color: 'var(--text-dark-bold)' }}>
                  Customer Name (Optional)
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Walk-in Customer"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  style={{ background: '#f8fafc' }}
                />
              </div>
            )}

            {/* Step 2: Payment Method */}
            <label className="form-label" style={{ color: 'var(--text-dark-bold)', fontWeight: 800 }}>
              Select Payment Method:
            </label>

            <div className="payment-methods-grid">
              <div
                className={`payment-method-card ${paymentMethod === 'Cash' ? 'selected' : ''}`}
                onClick={() => setPaymentMethod('Cash')}
              >
                <Banknote size={24} />
                <span>Cash</span>
              </div>

              <div
                className={`payment-method-card ${paymentMethod === 'Card' ? 'selected' : ''}`}
                onClick={() => setPaymentMethod('Card')}
              >
                <CreditCard size={24} />
                <span>Credit Card</span>
              </div>

              <div
                className={`payment-method-card ${paymentMethod === 'Other' ? 'selected' : ''}`}
                onClick={() => setPaymentMethod('Other')}
              >
                <CircleDollarSign size={24} />
                <span>Other</span>
              </div>
            </div>

            {/* Cash Tendered & Change Helper */}
            {paymentMethod === 'Cash' && (
              <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
                <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                  <label className="form-label" style={{ color: 'var(--text-dark-bold)', fontSize: '0.8rem' }}>
                    Cash Tendered (Optional)
                  </label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    placeholder="Enter cash given by customer..."
                    value={tenderedAmount}
                    onChange={(e) => setTenderedAmount(e.target.value)}
                    style={{ background: '#fff', color: 'var(--text-dark-bold)' }}
                  />
                </div>

                {tenderedAmount && parseFloat(tenderedAmount) >= total && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontWeight: 700, color: 'var(--price-green)' }}>
                    <span>Change Due:</span>
                    <span>{currency} {(parseFloat(tenderedAmount) - total).toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setCheckoutModalOpen(false)}
                className="btn btn-secondary"
                style={{ flex: 1, background: '#f1f5f9', color: 'var(--text-dark-bold)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={completingOrder || (orderType === 'delivery' && (!customerPhone.trim() || !deliveryAddress.trim()))}
                onClick={handleConfirmOrder}
                className="btn btn-primary"
                style={{ flex: 1, background: 'var(--primary-orange)', color: '#fff', border: 'none', fontWeight: 800 }}
              >
                <span>{completingOrder ? 'Processing...' : 'Confirm & Charge'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: RECEIPT VIEW
          ==================================================================== */}
      {completedOrder && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ReceiptIcon size={22} color="var(--primary-orange)" />
                <span>Order Receipt #{completedOrder.receipt_number}</span>
              </h3>
              <button
                type="button"
                onClick={() => setCompletedOrder(null)}
                className="modal-close-btn"
              >
                <X size={20} />
              </button>
            </div>

            {/* Printable Receipt Paper */}
            <div className="receipt-wrapper" id="printable-receipt">
              <div className="receipt-header-center">
                {organization?.logo_url && (
                  <img src={organization.logo_url} alt="Logo" className="receipt-logo-img" />
                )}
                <div className="receipt-restaurant-name">{completedOrder.organization_name}</div>
                {completedOrder.organization_address && (
                  <div className="receipt-meta-line">{completedOrder.organization_address}</div>
                )}
                {completedOrder.organization_phone && (
                  <div className="receipt-meta-line">Tel: {completedOrder.organization_phone}</div>
                )}
                <div className="receipt-badge-pill">
                  <span>RECEIPT #{completedOrder.receipt_number}</span>
                  <span>•</span>
                  <span>{new Date(completedOrder.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}, {new Date(completedOrder.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>

              {/* Order Type & Customer/Cashier Info Grid */}
              <div className="receipt-info-grid">
                <div>
                  <div className="receipt-info-label">Order Type</div>
                  <div className="receipt-info-val" style={{ color: completedOrder.order_type === 'delivery' ? '#ea580c' : '#0f172a' }}>
                    {completedOrder.order_type === 'delivery' ? '🛵 DELIVERY' : '🚶 WALK-IN'}
                  </div>
                </div>
                <div>
                  <div className="receipt-info-label">Cashier</div>
                  <div className="receipt-info-val">{completedOrder.cashier_name || 'Staff'}</div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div className="receipt-info-label">Customer</div>
                  <div className="receipt-info-val">
                    {completedOrder.customer_name || 'Customer'}
                    {completedOrder.customer_phone && ` (${completedOrder.customer_phone})`}
                  </div>
                  {completedOrder.delivery_address && (
                    <div style={{ fontSize: '0.775rem', color: '#475569', marginTop: '0.2rem', lineHeight: 1.4 }}>
                      <strong>Address:</strong> {completedOrder.delivery_address}
                    </div>
                  )}
                </div>
              </div>

              {/* Itemized Table */}
              <table className="receipt-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th style={{ textAlign: 'center' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Price</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {completedOrder.items.map((it, idx) => (
                    <tr key={idx}>
                      <td>
                        <div className="receipt-item-title">{it.item_name}</div>
                        {it.size_label && <div className="receipt-item-sub">{it.size_label}</div>}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#334155' }}>{it.quantity}</td>
                      <td style={{ textAlign: 'right', color: '#64748b' }}>{it.unit_price.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>{it.line_total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="receipt-totals">
                <div className="receipt-total-row">
                  <span>Subtotal</span>
                  <span>{currency} {completedOrder.subtotal.toFixed(2)}</span>
                </div>
                <div className="receipt-total-row">
                  <span>Tax ({taxPercent}%)</span>
                  <span>{currency} {completedOrder.tax.toFixed(2)}</span>
                </div>
                <div className="receipt-grand-total">
                  <span>TOTAL</span>
                  <span>{currency} {completedOrder.total.toFixed(2)}</span>
                </div>
                <div className="receipt-total-row" style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
                  <span>Payment Method</span>
                  <span style={{ fontWeight: 700, color: '#334155' }}>{completedOrder.payment_method}</span>
                </div>
              </div>

              <div className="receipt-footer-msg">
                <div>Thank you for your visit! Please come again.</div>
                <div style={{ marginTop: '0.45rem', fontWeight: 800, fontSize: '0.75rem', color: '#94a3b8', letterSpacing: '0.04em' }}>
                  Software by ARS
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '0.65rem', marginTop: '1.25rem' }}>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn btn-secondary"
                style={{ flex: 1, background: '#f8fafc', color: 'var(--text-dark-bold)', border: '1px solid #cbd5e1' }}
              >
                <Printer size={16} />
                <span>Print</span>
              </button>

              <button
                type="button"
                onClick={copyReceiptText}
                className="btn btn-secondary"
                style={{ flex: 1, background: '#f8fafc', color: 'var(--text-dark-bold)', border: '1px solid #cbd5e1' }}
              >
                {copiedReceipt ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                <span>{copiedReceipt ? 'Copied!' : 'Copy Text'}</span>
              </button>

              <button
                type="button"
                onClick={() => setCompletedOrder(null)}
                className="btn btn-primary"
                style={{ flex: 1.2, background: 'var(--primary-orange)', color: '#fff', border: 'none', fontWeight: 800 }}
              >
                <span>New Order</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: KITCHEN TICKET (only when kitchen_invoice_enabled)
          ==================================================================== */}
      {kitchenTicketOrder && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '360px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Utensils size={20} color="#10b981" />
                <span>Kitchen Ticket #{kitchenTicketOrder.receipt_number}</span>
              </h3>
              <button type="button" onClick={() => setKitchenTicketOrder(null)} className="modal-close-btn"><X size={20} /></button>
            </div>

            {/* Kitchen-facing ticket — no prices */}
            <div style={{ background: '#ffffff', border: '2px dashed #94a3b8', borderRadius: 'var(--radius-lg)', padding: '1.5rem', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              <div style={{ textAlign: 'center', fontWeight: 900, fontSize: '1.2rem', letterSpacing: '0.05em', marginBottom: '0.25rem', color: '#0f172a', textTransform: 'uppercase' }}>
                🍽️ KITCHEN ORDER
              </div>
              <div style={{ textAlign: 'center', fontSize: '0.85rem', color: '#475569', marginBottom: '0.35rem' }}>
                Table / Customer: <strong>{kitchenTicketOrder.customer_name || 'Walk-in'}</strong>
              </div>
              <div style={{ textAlign: 'center', fontSize: '0.775rem', color: '#94a3b8', marginBottom: '1.15rem' }}>
                {new Date(kitchenTicketOrder.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '0.85rem' }}>
                {kitchenTicketOrder.items.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0.5rem 0', borderBottom: idx < kitchenTicketOrder.items.length - 1 ? '1px dotted #e2e8f0' : 'none' }}>
                    <div>
                      <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>{item.item_name}</span>
                      {item.size_label && <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: '0.4rem', fontWeight: 600 }}>({item.size_label})</span>}
                    </div>
                    <span style={{ fontSize: '1.35rem', fontWeight: 900, color: '#ea580c', minWidth: '36px', textAlign: 'right' }}>×{item.quantity}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8', borderTop: '1px dashed #cbd5e1', paddingTop: '0.65rem' }}>
                Cashier: {kitchenTicketOrder.cashier_name || 'Staff'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.65rem', marginTop: '1.1rem' }}>
              <button type="button" onClick={() => window.print()} className="btn btn-secondary" style={{ flex: 1 }}>
                <Printer size={16} /><span>Print</span>
              </button>
              <button type="button" onClick={() => setKitchenTicketOrder(null)} className="btn btn-primary" style={{ flex: 1, background: '#10b981', border: 'none', color: '#fff', fontWeight: 800 }}>
                <Check size={16} /><span>Got It</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
