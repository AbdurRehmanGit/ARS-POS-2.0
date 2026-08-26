import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart3, TrendingUp, ShoppingBag, DollarSign, Calendar,
  PackageOpen, Award, Sun, AlertCircle, RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DEFAULT_CURRENCY, formatPrice, getCurrency } from '../utils/currency';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// JS Date.getDay() returns 0=Sun, 1=Mon, ... 6=Sat → remap to 0=Mon ... 6=Sun
const jsDateDayToIndex = (d) => (d === 0 ? 6 : d - 1);

function getDateRange(filter) {
  const now = new Date();
  const start = new Date(now);
  switch (filter) {
    case 'week': {
      const dayIdx = jsDateDayToIndex(now.getDay());
      start.setDate(now.getDate() - dayIdx);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case 'month':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    case '3months':
      start.setMonth(now.getMonth() - 3);
      start.setHours(0, 0, 0, 0);
      break;
    case 'all':
    default:
      return null; // no filter
  }
  return start;
}

// Pure CSS Bar Chart Component
function BarChart({ data, maxValue, color = '#f97316', valuePrefix = '', compact = false }) {
  if (!data || data.length === 0) return null;
  const max = maxValue || Math.max(...data.map((d) => d.value), 1);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: compact ? '0.35rem' : '0.6rem', height: '140px', width: '100%' }}>
      {data.map((item, idx) => {
        const pct = max > 0 ? (item.value / max) * 100 : 0;
        const isHighest = item.value === Math.max(...data.map((d) => d.value)) && item.value > 0;
        return (
          <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', height: '100%', justifyContent: 'flex-end' }}>
            {/* Value label */}
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: isHighest ? color : '#64748b', textAlign: 'center', lineHeight: 1.1 }}>
              {item.value > 0 ? (valuePrefix ? `${valuePrefix}${item.value >= 1000 ? (item.value / 1000).toFixed(1) + 'k' : item.value.toFixed(0)}` : item.value) : ''}
            </div>
            {/* Bar */}
            <div
              style={{
                width: '100%',
                height: `${Math.max(pct, item.value > 0 ? 3 : 0)}%`,
                background: isHighest ? color : `${color}55`,
                borderRadius: '4px 4px 0 0',
                transition: 'height 0.4s ease',
                position: 'relative',
                minHeight: item.value > 0 ? '4px' : '0',
              }}
            />
            {/* Label */}
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textAlign: 'center' }}>{item.label}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function Reports() {
  const { organization } = useAuth();
  const [orders, setOrders] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateFilter, setDateFilter] = useState('month');

  const loadData = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    setError(null);

    try {
      if (isSupabaseConfigured() && supabase) {
        const [ordersRes, itemsRes] = await Promise.all([
          supabase
            .from('orders')
            .select('id, total, subtotal, tax, created_at, status')
            .eq('organization_id', organization.id)
            .eq('status', 'completed'),
          supabase
            .from('order_items')
            .select('item_name, size_label, quantity, line_total, order_id')
            .in('order_id',
              (await supabase
                .from('orders')
                .select('id')
                .eq('organization_id', organization.id)
                .eq('status', 'completed')
              ).data?.map((o) => o.id) || []
            )
        ]);

        if (ordersRes.error) throw ordersRes.error;
        setOrders(ordersRes.data || []);
        setOrderItems(itemsRes.data || []);
      } else {
        const localOrders = JSON.parse(localStorage.getItem('restaurant_pos_orders') || '[]');
        const org = localOrders.filter((o) => o.organization_id === organization.id && o.status === 'completed');
        const items = org.flatMap((o) => (o.order_items || []).map((i) => ({ ...i, order_id: o.id })));
        setOrders(org);
        setOrderItems(items);
      }
    } catch (err) {
      console.error('Reports load error:', err);
      setError(err.message || 'Failed to load report data.');
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // Apply date filter
  const filteredOrders = useMemo(() => {
    const startDate = getDateRange(dateFilter);
    if (!startDate) return orders;
    return orders.filter((o) => new Date(o.created_at) >= startDate);
  }, [orders, dateFilter]);

  const filteredOrderIds = useMemo(() => new Set(filteredOrders.map((o) => o.id)), [filteredOrders]);

  const filteredItems = useMemo(() =>
    orderItems.filter((i) => filteredOrderIds.has(i.order_id)),
    [orderItems, filteredOrderIds]
  );

  // Summary Calculations
  const totalRevenue = filteredOrders.reduce((s, o) => s + parseFloat(o.total || 0), 0);
  const totalOrders = filteredOrders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todaySales = orders
    .filter((o) => new Date(o.created_at) >= todayStart)
    .reduce((s, o) => s + parseFloat(o.total || 0), 0);

  // Top Selling Items (by quantity)
  const topItems = useMemo(() => {
    const map = {};
    filteredItems.forEach((item) => {
      const key = `${item.item_name}|${item.size_label || 'Regular'}`;
      if (!map[key]) {
        map[key] = { name: item.item_name, size: item.size_label || 'Regular', qty: 0, revenue: 0 };
      }
      map[key].qty += item.quantity;
      map[key].revenue += parseFloat(item.line_total || 0);
    });
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [filteredItems]);

  // Orders by Day of Week
  const ordersByDay = useMemo(() => {
    const counts = Array(7).fill(0);
    filteredOrders.forEach((o) => {
      const d = new Date(o.created_at).getDay();
      counts[jsDateDayToIndex(d)]++;
    });
    return DAY_SHORT.map((label, idx) => ({ label, value: counts[idx] }));
  }, [filteredOrders]);

  // Revenue by Day of Week
  const revenueByDay = useMemo(() => {
    const sums = Array(7).fill(0);
    filteredOrders.forEach((o) => {
      const d = new Date(o.created_at).getDay();
      sums[jsDateDayToIndex(d)] += parseFloat(o.total || 0);
    });
    return DAY_SHORT.map((label, idx) => ({ label, value: Math.round(sums[idx]) }));
  }, [filteredOrders]);

  const bestDay = revenueByDay.reduce((best, d) => d.value > best.value ? d : best, { label: '—', value: 0 });

  const currency = organization?.currency || DEFAULT_CURRENCY;
  const currObj = getCurrency(currency);
  const formatAmount = (n) => formatPrice(n, currency);

  const FILTER_LABELS = {
    week: 'This Week',
    month: 'This Month',
    '3months': 'Last 3 Months',
    all: 'All Time',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header */}
      <div className="menu-header-actions">
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <BarChart3 size={28} color="var(--primary-orange)" />
            <span>Sales Reports &amp; Analytics</span>
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Revenue breakdown, top items, and day-of-week performance.</p>
        </div>
        <div className="menu-actions-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Calendar size={16} color="#64748b" />
            <select className="form-input" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} style={{ width: 'auto', fontWeight: 700 }}>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="3months">Last 3 Months</option>
              <option value="all">All Time</option>
            </select>
          </div>
          <button type="button" onClick={loadData} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
            <RefreshCw size={15} /><span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: 0 }}>
          <AlertCircle size={18} /><span>{error}</span>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>Calculating analytics...</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.1rem' }}>
            {[
              {
                icon: TrendingUp, color: '#f97316', bg: '#fff7ed', border: '#fed7aa',
                label: `Total Revenue (${FILTER_LABELS[dateFilter]})`,
                value: formatAmount(totalRevenue),
              },
              {
                icon: ShoppingBag, color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe',
                label: `Total Orders (${FILTER_LABELS[dateFilter]})`,
                value: totalOrders.toString(),
              },
              {
                icon: DollarSign, color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe',
                label: 'Avg Order Value',
                value: formatAmount(avgOrderValue),
              },
              {
                icon: Sun, color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0',
                label: "Today's Sales",
                value: formatAmount(todaySales),
              },
            ].map((card, idx) => {
              const Icon = card.icon;
              return (
                <div key={idx} style={{ background: '#fff', border: `1px solid ${card.border}`, borderRadius: 'var(--radius-lg)', padding: '1.35rem', boxShadow: '0 1px 3px rgba(15,23,42,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={18} color={card.color} />
                    </div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{card.label}</span>
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>{card.value}</div>
                </div>
              );
            })}
          </div>

          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            {/* Orders by Day of Week */}
            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <BarChart3 size={17} color="var(--primary-orange)" />
                Orders by Day of Week
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem' }}>{FILTER_LABELS[dateFilter]} · {totalOrders} total orders</p>
              {totalOrders === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.85rem' }}>No data for this period.</div>
              ) : (
                <BarChart data={ordersByDay} color="#f97316" />
              )}
            </div>

            {/* Revenue by Day of Week */}
            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <TrendingUp size={17} color="#10b981" />
                Revenue by Day of Week
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem' }}>
                {FILTER_LABELS[dateFilter]}
                {bestDay.value > 0 && (
                  <span style={{ marginLeft: '0.5rem', fontWeight: 700, color: '#10b981' }}>
                    · Best: {bestDay.label} ({formatAmount(bestDay.value)})
                  </span>
                )}
              </p>
              {totalOrders === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.85rem' }}>No data for this period.</div>
              ) : (
                <BarChart data={revenueByDay} color="#10b981" valuePrefix={currObj.symbol + ' '} />
              )}
            </div>
          </div>

          {/* Top Selling Items */}
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Award size={17} color="var(--primary-orange)" />
              Top Selling Items
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem' }}>{FILTER_LABELS[dateFilter]} · ranked by quantity sold</p>

            {topItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                <PackageOpen size={36} color="#cbd5e1" style={{ margin: '0 auto 0.5rem auto' }} />
                <p style={{ fontSize: '0.875rem' }}>No sales data for this period.</p>
              </div>
            ) : (
              <div>
                {/* Table header */}
                <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto auto', gap: '0.5rem 1rem', padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: 'var(--radius-md)', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>
                  <span>#</span><span>Item</span><span style={{ textAlign: 'right' }}>Qty</span><span style={{ textAlign: 'right' }}>Revenue</span>
                </div>
                {topItems.map((item, idx) => {
                  const maxQty = topItems[0].qty;
                  const barPct = maxQty > 0 ? (item.qty / maxQty) * 100 : 0;
                  return (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto auto', gap: '0.5rem 1rem', padding: '0.65rem 0.75rem', borderBottom: idx < topItems.length - 1 ? '1px solid #f1f5f9' : 'none', alignItems: 'center' }}>
                      <span style={{ fontWeight: 900, color: idx === 0 ? 'var(--primary-orange)' : '#94a3b8', fontSize: '0.9rem' }}>{idx + 1}</span>
                      <div>
                        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>{item.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.3rem' }}>{item.size}</div>
                        {/* Mini bar */}
                        <div style={{ height: '4px', background: '#f1f5f9', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${barPct}%`, background: idx === 0 ? 'var(--primary-orange)' : '#cbd5e1', borderRadius: '2px', transition: 'width 0.5s ease' }} />
                        </div>
                      </div>
                      <span style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a', textAlign: 'right' }}>{item.qty}</span>
                      <span style={{ fontWeight: 700, color: '#15803d', textAlign: 'right', fontSize: '0.875rem' }}>
                        {formatAmount(item.revenue)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
