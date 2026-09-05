import React, { useState, useEffect, useCallback } from 'react';
import { 
  Receipt as ReceiptIcon, 
  Search, 
  Filter, 
  Download, 
  Trash2, 
  Eye, 
  Printer, 
  Copy, 
  Check, 
  X, 
  AlertTriangle, 
  Calendar, 
  CreditCard, 
  Plus, 
  Minus,
  AlertCircle,
  ShoppingBag,
  Utensils,
  Truck,
  User,
  MapPin,
  Phone
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DEFAULT_CURRENCY } from '../utils/currency';

export default function OrderHistory() {
  const { organization } = useAuth();
  const currency = organization?.currency || DEFAULT_CURRENCY;

  // State
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Filters
  const [dateFilter, setDateFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [orderTypeFilter, setOrderTypeFilter] = useState('all'); // 'all' | 'walkin' | 'delivery'
  const [searchTerm, setSearchTerm] = useState('');

  // Order View/Edit Modal
  const [viewingOrder, setViewingOrder] = useState(null);
  const [editingOrderItems, setEditingOrderItems] = useState([]);
  const [savingEdit, setSavingEdit] = useState(false);

  // "Add Item from Menu" in Edit Modal
  const [menuItems, setMenuItems] = useState([]);
  const [addItemSearch, setAddItemSearch] = useState('');
  const [addItemSizeTarget, setAddItemSizeTarget] = useState(null); // item needing size selection

  // Receipt Modal
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [copiedReceipt, setCopiedReceipt] = useState(false);

  // Clear History Modal
  const [clearHistoryModalOpen, setClearHistoryModalOpen] = useState(false);
  const [confirmOrgName, setConfirmOrgName] = useState('');
  const [clearingHistory, setClearingHistory] = useState(false);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Fetch Orders + Menu Items in parallel
  const loadData = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    setError(null);

    try {
      if (isSupabaseConfigured() && supabase) {
        const [ordersRes, menuRes] = await Promise.all([
          supabase
            .from('orders')
            .select(`
              id, organization_id, receipt_number, staff_id, customer_name,
              customer_phone, delivery_address, order_type, delivery_status, rider_id,
              subtotal, tax, total, payment_method, status, created_at,
              profiles ( full_name ),
              riders ( name, phone ),
              order_items (
                id, menu_item_id, item_name, size_label,
                quantity, unit_price, line_total
              )
            `)
            .eq('organization_id', organization.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('menu_items')
            .select(`id, name, type, menu_item_prices ( id, size_label, price )`)
            .eq('organization_id', organization.id)
        ]);

        if (ordersRes.error) throw ordersRes.error;
        if (menuRes.error) throw menuRes.error;

        setOrders(ordersRes.data || []);
        setMenuItems(menuRes.data || []);
      } else {
        const localOrders = JSON.parse(localStorage.getItem('restaurant_pos_orders') || '[]');
        const localMenu = JSON.parse(localStorage.getItem('restaurant_pos_menu_data') || '{"items":[]}');
        setOrders(localOrders.filter((o) => o.organization_id === organization.id));
        setMenuItems(localMenu.items || []);
      }
    } catch (err) {
      console.error('Error loading orders:', err);
      setError(err.message || 'Failed to load orders.');
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered Orders
  const filteredOrders = orders.filter((order) => {
    const orderDate = new Date(order.created_at);

    if (dateFilter === 'today') {
      const today = new Date();
      if (
        orderDate.getDate() !== today.getDate() ||
        orderDate.getMonth() !== today.getMonth() ||
        orderDate.getFullYear() !== today.getFullYear()
      ) return false;
    } else if (dateFilter === 'yesterday') {
      const yest = new Date(); yest.setDate(yest.getDate() - 1);
      if (
        orderDate.getDate() !== yest.getDate() ||
        orderDate.getMonth() !== yest.getMonth() ||
        orderDate.getFullYear() !== yest.getFullYear()
      ) return false;
    } else if (dateFilter === '7days') {
      const past = new Date(); past.setDate(past.getDate() - 7);
      if (orderDate < past) return false;
    } else if (dateFilter === '30days') {
      const past = new Date(); past.setDate(past.getDate() - 30);
      if (orderDate < past) return false;
    }

    if (paymentFilter !== 'all' && order.payment_method !== paymentFilter) return false;

    if (orderTypeFilter === 'walkin' && order.order_type === 'delivery') return false;
    if (orderTypeFilter === 'delivery' && order.order_type !== 'delivery') return false;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchReceipt = order.receipt_number?.toString().includes(term);
      const matchCust = order.customer_name?.toLowerCase().includes(term);
      const matchPhone = order.customer_phone?.toLowerCase().includes(term);
      const matchAddress = order.delivery_address?.toLowerCase().includes(term);
      const matchStaff = order.profiles?.full_name?.toLowerCase().includes(term);
      if (!matchReceipt && !matchCust && !matchPhone && !matchAddress && !matchStaff) return false;
    }

    return true;
  });

  // 1. Open View/Edit Modal
  const handleOpenViewEdit = (order) => {
    setViewingOrder(order);
    setEditingOrderItems(
      order.order_items ? JSON.parse(JSON.stringify(order.order_items)) : []
    );
    setAddItemSearch('');
    setAddItemSizeTarget(null);
  };

  // Adjust Quantity
  const handleItemQtyChange = (idx, delta) => {
    setEditingOrderItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[idx] };
      const newQty = item.quantity + delta;
      if (newQty <= 0) return updated.filter((_, i) => i !== idx);
      item.quantity = newQty;
      item.line_total = parseFloat((newQty * item.unit_price).toFixed(2));
      updated[idx] = item;
      return updated;
    });
  };

  const handleRemoveItemLine = (idx) => {
    setEditingOrderItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // Add Menu Item to edit modal cart
  const handleAddMenuItemToOrder = (menuItem) => {
    const prices = menuItem.menu_item_prices || [];
    if (prices.length === 0) return;
    if (prices.length > 1) {
      setAddItemSizeTarget(menuItem);
      return;
    }
    // Single price — add directly
    addLineItem(menuItem, prices[0].size_label, parseFloat(prices[0].price));
    setAddItemSearch('');
  };

  const handleSelectSizeAndAdd = (menuItem, sizeLabel, price) => {
    addLineItem(menuItem, sizeLabel, price);
    setAddItemSizeTarget(null);
    setAddItemSearch('');
  };

  const addLineItem = (menuItem, sizeLabel, price) => {
    setEditingOrderItems((prev) => {
      const existingIdx = prev.findIndex(
        (ci) => ci.item_name === menuItem.name && ci.size_label === sizeLabel
      );
      if (existingIdx !== -1) {
        const updated = [...prev];
        const item = { ...updated[existingIdx] };
        item.quantity += 1;
        item.line_total = parseFloat((item.quantity * item.unit_price).toFixed(2));
        updated[existingIdx] = item;
        return updated;
      }
      return [
        ...prev,
        {
          id: null,
          menu_item_id: menuItem.id,
          item_name: menuItem.name,
          size_label: sizeLabel,
          quantity: 1,
          unit_price: price,
          line_total: price,
        }
      ];
    });
  };

  // Menu item search results
  const menuSearchResults = addItemSearch.trim().length >= 1
    ? menuItems.filter((m) =>
        m.name.toLowerCase().includes(addItemSearch.toLowerCase())
      ).slice(0, 8)
    : [];

  // Recalculated totals for edit modal
  const editSubtotal = editingOrderItems.reduce((s, i) => s + i.line_total, 0);
  const taxPercent = organization?.tax_percent ? parseFloat(organization.tax_percent) : 0;
  const editTax = editSubtotal * (taxPercent / 100);
  const editTotal = editSubtotal + editTax;

  // Save Order Edits
  const handleSaveOrderEdits = async () => {
    if (!viewingOrder) return;
    if (editingOrderItems.length === 0) {
      alert('An order must have at least one item. Delete the order instead if you want to remove it entirely.');
      return;
    }

    setSavingEdit(true);
    try {
      if (isSupabaseConfigured() && supabase) {
        const { error: orderErr } = await supabase
          .from('orders')
          .update({ subtotal: editSubtotal, tax: editTax, total: editTotal })
          .eq('id', viewingOrder.id);
        if (orderErr) throw orderErr;

        await supabase.from('order_items').delete().eq('order_id', viewingOrder.id);

        const newRows = editingOrderItems.map((it) => ({
          order_id: viewingOrder.id,
          menu_item_id: it.menu_item_id || null,
          item_name: it.item_name,
          size_label: it.size_label,
          quantity: it.quantity,
          unit_price: it.unit_price,
          line_total: it.line_total,
        }));

        const { data: savedItems, error: itemErr } = await supabase
          .from('order_items').insert(newRows).select();
        if (itemErr) throw itemErr;

        setOrders((prev) =>
          prev.map((o) =>
            o.id === viewingOrder.id
              ? { ...o, subtotal: editSubtotal, tax: editTax, total: editTotal, order_items: savedItems }
              : o
          )
        );
      } else {
        const local = JSON.parse(localStorage.getItem('restaurant_pos_orders') || '[]');
        const updated = local.map((o) =>
          o.id === viewingOrder.id
            ? { ...o, subtotal: editSubtotal, tax: editTax, total: editTotal, order_items: editingOrderItems }
            : o
        );
        localStorage.setItem('restaurant_pos_orders', JSON.stringify(updated));
        setOrders(updated);
      }

      showSuccess(`Order #${viewingOrder.receipt_number} updated successfully!`);
      setViewingOrder(null);
    } catch (err) {
      console.error('Error updating order:', err);
      setError('Failed to save order changes.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete Single Order
  const handleDeleteOrder = async (orderId, receiptNum) => {
    if (!window.confirm(`Delete Order #${receiptNum}? This cannot be undone.`)) return;
    try {
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase.from('orders').delete().eq('id', orderId);
        if (error) throw error;
      } else {
        const local = JSON.parse(localStorage.getItem('restaurant_pos_orders') || '[]');
        localStorage.setItem('restaurant_pos_orders', JSON.stringify(local.filter((o) => o.id !== orderId)));
      }
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      showSuccess(`Order #${receiptNum} deleted.`);
    } catch (err) {
      setError(err.message || 'Failed to delete order.');
    }
  };

  // Clear All History
  const handleClearAllHistory = async () => {
    if (confirmOrgName.trim() !== (organization?.name || '')) {
      alert('Restaurant name does not match. Please type it exactly.');
      return;
    }
    setClearingHistory(true);
    try {
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase.from('orders').delete().eq('organization_id', organization.id);
        if (error) throw error;
      } else {
        const local = JSON.parse(localStorage.getItem('restaurant_pos_orders') || '[]');
        localStorage.setItem('restaurant_pos_orders', JSON.stringify(local.filter((o) => o.organization_id !== organization.id)));
      }
      setOrders([]);
      setClearHistoryModalOpen(false);
      setConfirmOrgName('');
      showSuccess('All order history cleared.');
    } catch (err) {
      setError(err.message || 'Failed to clear history.');
    } finally {
      setClearingHistory(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredOrders.length === 0) { alert('No orders to export.'); return; }
    const headers = ['Receipt #','Date Time','Type','Customer','Phone','Address','Staff','Payment','Subtotal','Tax','Total','Status','Delivery Status'];
    const rows = filteredOrders.map((o) => [
      o.receipt_number,
      `"${new Date(o.created_at).toLocaleString()}"`,
      o.order_type === 'delivery' ? 'Delivery' : 'Walk-in',
      `"${o.customer_name || 'Walk-in'}"`,
      `"${o.customer_phone || ''}"`,
      `"${o.delivery_address || ''}"`,
      `"${o.profiles?.full_name || 'Staff'}"`,
      o.payment_method,
      parseFloat(o.subtotal).toFixed(2),
      parseFloat(o.tax).toFixed(2),
      parseFloat(o.total).toFixed(2),
      o.status,
      o.delivery_status || ''
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Open Receipt
  const handleOpenReceipt = (order) => {
    setReceiptOrder({
      ...order,
      organization_name: organization?.name || 'Restaurant',
      organization_phone: organization?.phone,
      organization_address: organization?.address,
      cashier_name: order.profiles?.full_name || 'Staff',
      items: order.order_items || [],
    });
  };

  const copyReceiptText = () => {
    if (!receiptOrder) return;
    const lines = [
      `================================`,
      `       ${receiptOrder.organization_name.toUpperCase()}`,
      receiptOrder.organization_address ? `  ${receiptOrder.organization_address}` : '',
      receiptOrder.organization_phone ? `  Tel: ${receiptOrder.organization_phone}` : '',
      `================================`,
      `Receipt #: ${receiptOrder.receipt_number}`,
      `Type:      ${receiptOrder.order_type === 'delivery' ? 'DELIVERY ORDER' : 'WALK-IN ORDER'}`,
      `Date:      ${new Date(receiptOrder.created_at).toLocaleString()}`,
      `Customer:  ${receiptOrder.customer_name}`,
      receiptOrder.customer_phone ? `Phone:     ${receiptOrder.customer_phone}` : '',
      receiptOrder.delivery_address ? `Address:   ${receiptOrder.delivery_address}` : '',
      `Cashier:   ${receiptOrder.cashier_name}`,
      `--------------------------------`,
      ...receiptOrder.items.map((i) => `${i.quantity}x ${i.item_name} (${i.size_label || 'Regular'}) - ${currency} ${parseFloat(i.line_total).toFixed(2)}`),
      `--------------------------------`,
      `Subtotal:  ${currency} ${parseFloat(receiptOrder.subtotal).toFixed(2)}`,
      `Tax:       ${currency} ${parseFloat(receiptOrder.tax).toFixed(2)}`,
      `TOTAL:     ${currency} ${parseFloat(receiptOrder.total).toFixed(2)}`,
      `Payment:   ${receiptOrder.payment_method}`,
      `================================`,
      `   Thank you for your visit!`,
      `--------------------------------`,
      `       Software by ARS`,
      `================================`,
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(lines);
    setCopiedReceipt(true);
    setTimeout(() => setCopiedReceipt(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header */}
      <div className="menu-header-actions">
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <ReceiptIcon size={28} color="var(--primary-orange)" />
            <span>Order History</span>
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            View, edit, and reprint past orders. Filter by walk-in vs delivery and export CSV reports.
          </p>
        </div>
        <div className="menu-actions-group">
          <button type="button" onClick={handleExportCSV} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
            <Download size={16} /><span>Export CSV</span>
          </button>
          <button type="button" onClick={() => setClearHistoryModalOpen(true)} className="btn btn-danger" style={{ fontSize: '0.85rem' }}>
            <Trash2 size={16} /><span>Clear History</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="alert alert-danger" style={{ marginBottom: 0 }}>
          <AlertCircle size={18} /><span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="btn btn-ghost" style={{ marginLeft: 'auto', padding: '2px' }}><X size={16} /></button>
        </div>
      )}
      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: 0 }}>
          <Check size={18} /><span>{successMsg}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="card" style={{ display: 'flex', gap: '0.85rem', alignItems: 'center', flexWrap: 'wrap', padding: '1rem 1.25rem' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search size={18} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input type="text" className="form-input" placeholder="Search receipt #, customer, phone, address, staff..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ paddingLeft: '2.5rem', background: '#fff' }} />
        </div>

        {/* Order Type Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Truck size={16} color="#64748b" />
          <select className="form-input" value={orderTypeFilter} onChange={(e) => setOrderTypeFilter(e.target.value)} style={{ width: 'auto', background: '#fff', fontWeight: 600 }}>
            <option value="all">All Types ({orders.length})</option>
            <option value="walkin">Walk-in Only ({orders.filter((o) => o.order_type !== 'delivery').length})</option>
            <option value="delivery">Delivery Only ({orders.filter((o) => o.order_type === 'delivery').length})</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Calendar size={16} color="#64748b" />
          <select className="form-input" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} style={{ width: 'auto', background: '#fff', fontWeight: 600 }}>
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <CreditCard size={16} color="#64748b" />
          <select className="form-input" value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} style={{ width: 'auto', background: '#fff', fontWeight: 600 }}>
            <option value="all">All Payments</option>
            <option value="Cash">Cash</option>
            <option value="Card">Card</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="data-table-wrapper">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Loading order history...</div>
        ) : filteredOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem', color: '#64748b' }}>
            <ReceiptIcon size={42} color="#cbd5e1" style={{ margin: '0 auto 0.75rem auto' }} />
            <h3 style={{ fontSize: '1.15rem', color: '#0f172a', marginBottom: '0.35rem' }}>No Orders Found</h3>
            <p style={{ fontSize: '0.875rem' }}>{searchTerm || dateFilter !== 'all' || paymentFilter !== 'all' || orderTypeFilter !== 'all' ? 'No orders matched your filters.' : 'Orders from the POS terminal will appear here.'}</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Receipt #</th>
                <th>Type</th>
                <th>Date &amp; Time</th>
                <th>Customer Details</th>
                <th>Staff</th>
                <th>Items</th>
                <th>Payment</th>
                <th>Total ({currency})</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => {
                const itemCount = order.order_items?.reduce((s, i) => s + i.quantity, 0) || 0;
                const isDelivery = order.order_type === 'delivery';

                return (
                  <tr key={order.id}>
                    <td style={{ fontWeight: 800, color: 'var(--primary-orange)', fontFamily: 'var(--font-mono)' }}>#{order.receipt_number}</td>
                    <td>
                      {isDelivery ? (
                        <span 
                          style={{ 
                            padding: '0.2rem 0.5rem', 
                            background: '#fff7ed', 
                            color: '#c2410c', 
                            border: '1px solid #fed7aa', 
                            borderRadius: 'var(--radius-full)', 
                            fontSize: '0.725rem', 
                            fontWeight: 800,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}
                        >
                          <Truck size={11} />
                          <span>Delivery</span>
                        </span>
                      ) : (
                        <span 
                          style={{ 
                            padding: '0.2rem 0.5rem', 
                            background: '#f1f5f9', 
                            color: '#475569', 
                            border: '1px solid #e2e8f0', 
                            borderRadius: 'var(--radius-full)', 
                            fontSize: '0.725rem', 
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}
                        >
                          <User size={11} />
                          <span>Walk-in</span>
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.825rem', color: '#475569' }}>{new Date(order.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{order.customer_name || 'Walk-in'}</div>
                      {order.customer_phone && <div style={{ fontSize: '0.75rem', color: '#2563eb' }}>{order.customer_phone}</div>}
                      {order.delivery_address && (
                        <div style={{ fontSize: '0.725rem', color: '#64748b', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={order.delivery_address}>
                          {order.delivery_address}
                        </div>
                      )}
                    </td>
                    <td style={{ color: '#475569', fontSize: '0.85rem' }}>{order.profiles?.full_name || 'Staff'}</td>
                    <td style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>{itemCount} {itemCount === 1 ? 'item' : 'items'}</td>
                    <td><span className="badge badge-muted">{order.payment_method}</span></td>
                    <td style={{ fontWeight: 900, color: '#0f172a', fontSize: '0.95rem' }}>{currency} {parseFloat(order.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td>
                      <span className={`badge ${order.status === 'completed' ? 'badge-active' : 'badge-danger'}`}>{order.status}</span>
                      {isDelivery && order.delivery_status && (
                        <div style={{ fontSize: '0.7rem', color: '#ea580c', fontWeight: 700, textTransform: 'capitalize', marginTop: '0.15rem' }}>
                          {order.delivery_status.replace('_', ' ')}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        <button type="button" onClick={() => handleOpenViewEdit(order)} className="btn btn-ghost" style={{ padding: '0.3rem 0.5rem', color: '#475569' }} title="View & Edit"><Eye size={15} /></button>
                        <button type="button" onClick={() => handleOpenReceipt(order)} className="btn btn-ghost" style={{ padding: '0.3rem 0.5rem', color: 'var(--primary-orange)' }} title="Print Receipt"><Printer size={15} /></button>
                        <button type="button" onClick={() => handleDeleteOrder(order.id, order.receipt_number)} className="btn btn-ghost" style={{ padding: '0.3rem 0.5rem', color: 'var(--danger-red)' }} title="Delete"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ====== MODAL: VIEW & EDIT ORDER ====== */}
      {viewingOrder && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '620px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ReceiptIcon size={20} color="var(--primary-orange)" />
                <span>Edit Order #{viewingOrder.receipt_number}</span>
              </h3>
              <button type="button" onClick={() => setViewingOrder(null)} className="modal-close-btn"><X size={20} /></button>
            </div>

            {/* Order Meta */}
            <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0', marginBottom: '1.25rem', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span>Customer: <strong>{viewingOrder.customer_name}</strong></span>
              <span>Date: {new Date(viewingOrder.created_at).toLocaleString()}</span>
              <span>Payment: <strong>{viewingOrder.payment_method}</strong></span>
            </div>

            {/* Current Line Items */}
            <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>Order Items:</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
              {editingOrderItems.length === 0 && (
                <div style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8', fontSize: '0.85rem', border: '1px dashed #e2e8f0', borderRadius: 'var(--radius-md)' }}>
                  No items. Add items from menu below.
                </div>
              )}
              {editingOrderItems.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', padding: '0.6rem 0.85rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)', gap: '0.65rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>{item.item_name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.size_label} · {currency} {parseFloat(item.unit_price).toFixed(2)}</div>
                  </div>
                  <div className="pos-cart-qty-stepper">
                    <button type="button" onClick={() => handleItemQtyChange(idx, -1)} className="qty-btn"><Minus size={12} /></button>
                    <span className="qty-display">{item.quantity}</span>
                    <button type="button" onClick={() => handleItemQtyChange(idx, 1)} className="qty-btn"><Plus size={12} /></button>
                  </div>
                  <div style={{ fontWeight: 800, color: '#0f172a', minWidth: '72px', textAlign: 'right', fontSize: '0.9rem' }}>
                    {currency} {item.line_total.toFixed(2)}
                  </div>
                  <button type="button" onClick={() => handleRemoveItemLine(idx)} className="btn btn-ghost" style={{ padding: '0.2rem', color: 'var(--danger-red)' }}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>

            {/* ADD ITEM FROM MENU */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem', marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', color: '#0f172a' }}>
                <Utensils size={15} color="var(--primary-orange)" />
                <span>Add Item from Menu</span>
              </label>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search menu items to add (e.g. Burger, Fries)..."
                  value={addItemSearch}
                  onChange={(e) => { setAddItemSearch(e.target.value); setAddItemSizeTarget(null); }}
                  style={{ paddingLeft: '2.25rem', background: '#fff' }}
                />
              </div>

              {/* Size picker for multi-size */}
              {addItemSizeTarget && (
                <div style={{ marginTop: '0.65rem', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 'var(--radius-md)', padding: '0.65rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#c2410c', marginBottom: '0.5rem' }}>
                    Select size for: {addItemSizeTarget.name}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {addItemSizeTarget.menu_item_prices.map((p) => (
                      <button
                        key={p.id || p.size_label}
                        type="button"
                        onClick={() => handleSelectSizeAndAdd(addItemSizeTarget, p.size_label, parseFloat(p.price))}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.825rem', padding: '0.4rem 0.85rem', background: '#fff', border: '1px solid #fed7aa', fontWeight: 700, color: '#0f172a' }}
                      >
                        {p.size_label} — {currency} {parseFloat(p.price).toLocaleString()}
                      </button>
                    ))}
                    <button type="button" onClick={() => setAddItemSizeTarget(null)} className="btn btn-ghost" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Search Results Dropdown */}
              {menuSearchResults.length > 0 && !addItemSizeTarget && (
                <div style={{ marginTop: '0.5rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: '0 4px 12px rgba(15,23,42,0.08)' }}>
                  {menuSearchResults.map((item) => {
                    const prices = item.menu_item_prices || [];
                    const minP = prices.length > 0 ? Math.min(...prices.map((p) => parseFloat(p.price))) : 0;
                    const maxP = prices.length > 0 ? Math.max(...prices.map((p) => parseFloat(p.price))) : 0;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleAddMenuItemToOrder(item)}
                        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.9rem', background: 'transparent', border: 'none', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', textAlign: 'left', transition: 'background var(--transition-fast)' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <div>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>{item.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.type === 'pizza' ? `🍕 ${prices.length} sizes` : 'Standard'}</div>
                        </div>
                        <div style={{ fontWeight: 800, color: '#15803d', fontSize: '0.875rem' }}>
                          {currency} {prices.length > 1 ? `${minP.toLocaleString()} - ${maxP.toLocaleString()}` : minP.toLocaleString()}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {addItemSearch.trim().length >= 1 && menuSearchResults.length === 0 && !addItemSizeTarget && (
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.5rem', textAlign: 'center' }}>
                  No menu items found for "{addItemSearch}"
                </p>
              )}
            </div>

            {/* Recalculated Totals */}
            <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#475569' }}>
                <span>Subtotal:</span>
                <span style={{ fontWeight: 700 }}>{currency} {editSubtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#475569' }}>
                <span>Tax ({taxPercent}%):</span>
                <span style={{ fontWeight: 700 }}>{currency} {editTax.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', borderTop: '1px dashed #cbd5e1', paddingTop: '0.4rem', marginTop: '0.2rem' }}>
                <span>New Total:</span>
                <span style={{ color: 'var(--primary-orange)' }}>{currency} {editTotal.toFixed(2)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" onClick={() => setViewingOrder(null)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button type="button" disabled={savingEdit} onClick={handleSaveOrderEdits} className="btn btn-primary" style={{ flex: 1, background: 'var(--primary-orange)', color: '#fff', border: 'none' }}>
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== MODAL: RECEIPT REPRINT ====== */}
      {receiptOrder && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Printer size={20} color="var(--primary-orange)" />
                <span>Receipt #{receiptOrder.receipt_number}</span>
              </h3>
              <button type="button" onClick={() => setReceiptOrder(null)} className="modal-close-btn"><X size={20} /></button>
            </div>
            <div className="receipt-wrapper">
              <div className="receipt-header-center">
                {organization?.logo_url && (
                  <img src={organization.logo_url} alt="Logo" className="receipt-logo-img" />
                )}
                <div className="receipt-restaurant-name">{receiptOrder.organization_name}</div>
                {receiptOrder.organization_address && <div className="receipt-meta-line">{receiptOrder.organization_address}</div>}
                {receiptOrder.organization_phone && <div className="receipt-meta-line">Tel: {receiptOrder.organization_phone}</div>}
                <div className="receipt-badge-pill">
                  <span>RECEIPT #{receiptOrder.receipt_number}</span>
                  <span>•</span>
                  <span>{new Date(receiptOrder.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}, {new Date(receiptOrder.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>

              {/* Customer & Cashier Info Grid */}
              <div className="receipt-info-grid">
                <div>
                  <div className="receipt-info-label">Customer</div>
                  <div className="receipt-info-val">{receiptOrder.customer_name || 'Walk-in'}</div>
                </div>
                <div>
                  <div className="receipt-info-label">Cashier</div>
                  <div className="receipt-info-val">{receiptOrder.cashier_name || 'Staff'}</div>
                </div>
              </div>

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
                  {receiptOrder.items.map((it, idx) => (
                    <tr key={idx}>
                      <td>
                        <div className="receipt-item-title">{it.item_name}</div>
                        <div className="receipt-item-sub">{it.size_label || 'Regular'}</div>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#334155' }}>{it.quantity}</td>
                      <td style={{ textAlign: 'right', color: '#64748b' }}>{parseFloat(it.unit_price).toFixed(2)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>{parseFloat(it.line_total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="receipt-totals">
                <div className="receipt-total-row">
                  <span>Subtotal</span>
                  <span>{currency} {parseFloat(receiptOrder.subtotal).toFixed(2)}</span>
                </div>
                <div className="receipt-total-row">
                  <span>Tax</span>
                  <span>{currency} {parseFloat(receiptOrder.tax).toFixed(2)}</span>
                </div>
                <div className="receipt-grand-total">
                  <span>TOTAL</span>
                  <span>{currency} {parseFloat(receiptOrder.total).toFixed(2)}</span>
                </div>
                <div className="receipt-total-row" style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
                  <span>Payment Method</span>
                  <span style={{ fontWeight: 700, color: '#334155' }}>{receiptOrder.payment_method}</span>
                </div>
              </div>

              <div className="receipt-footer-msg">
                <div>Thank you for your visit! Please come again.</div>
                <div style={{ marginTop: '0.45rem', fontWeight: 800, fontSize: '0.75rem', color: '#94a3b8', letterSpacing: '0.04em' }}>
                  Software by ARS
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.65rem', marginTop: '1.25rem' }}>
              <button type="button" onClick={() => window.print()} className="btn btn-secondary" style={{ flex: 1 }}><Printer size={16} /><span>Print</span></button>
              <button type="button" onClick={copyReceiptText} className="btn btn-secondary" style={{ flex: 1 }}>
                {copiedReceipt ? <Check size={16} color="#10b981" /> : <Copy size={16} />}<span>{copiedReceipt ? 'Copied!' : 'Copy'}</span>
              </button>
              <button type="button" onClick={() => setReceiptOrder(null)} className="btn btn-primary" style={{ flex: 1, background: 'var(--primary-orange)', border: 'none', color: '#fff' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ====== MODAL: CLEAR HISTORY ====== */}
      {clearHistoryModalOpen && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: 'var(--danger-red)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={22} /><span>Clear All Order History</span>
              </h3>
              <button type="button" onClick={() => setClearHistoryModalOpen(false)} className="modal-close-btn"><X size={20} /></button>
            </div>
            <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.5, marginBottom: '1rem' }}>
              This will permanently delete ALL past orders and receipts for <strong>{organization?.name}</strong>. This cannot be undone.
            </p>
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '0.85rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ color: '#b91c1c', fontSize: '0.85rem' }}>
                Type <strong>"{organization?.name}"</strong> to confirm:
              </label>
              <input type="text" className="form-input" placeholder={organization?.name || ''} value={confirmOrgName} onChange={(e) => setConfirmOrgName(e.target.value)} style={{ background: '#fff', marginTop: '0.5rem' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" onClick={() => { setClearHistoryModalOpen(false); setConfirmOrgName(''); }} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button type="button" disabled={confirmOrgName.trim() !== (organization?.name || '') || clearingHistory} onClick={handleClearAllHistory} className="btn btn-danger" style={{ flex: 1.3 }}>
                {clearingHistory ? 'Deleting...' : 'Confirm Clear All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
