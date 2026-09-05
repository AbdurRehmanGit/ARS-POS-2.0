import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Receipt,
  Users,
  PieChart,
  BarChart3,
  FileSpreadsheet,
  AlertCircle,
  Check,
  X,
  PackageCheck,
  Percent,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DEFAULT_CURRENCY, formatPrice } from '../utils/currency';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const CATEGORY_COLORS = {
  'Staff Salaries': '#3b82f6',
  'Ingredients': '#f97316',
  'Utilities': '#eab308',
  'Rent': '#8b5cf6',
  'Maintenance': '#06b6d4',
  'Packaging': '#ec4899',
  'Marketing': '#10b981',
  'Transport / Fuel': '#f43f5e',
  'Other': '#64748b'
};

function getMonthYearLabel(year, monthIdx) {
  return `${MONTH_NAMES[monthIdx]} ${year}`;
}

export default function ProfitAndLoss() {
  const { organization } = useAuth();
  const currency = organization?.currency || DEFAULT_CURRENCY;
  const formatAmount = (val) => formatPrice(val, currency);

  // Selected Month State (defaults to current month)
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth()); // 0-11

  // Data State
  const [allOrders, setAllOrders] = useState([]);
  const [allExpenses, setAllExpenses] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // CSV Export Modal State
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvStartMonth, setCsvStartMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  );
  const [csvEndMonth, setCsvEndMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  );
  const [csvError, setCsvError] = useState(null);

  // 1. Fetch Orders, Expenses & Staff
  const loadData = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    setError(null);

    try {
      if (isSupabaseConfigured() && supabase) {
        // Fetch completed orders
        const { data: orderData, error: orderErr } = await supabase
          .from('orders')
          .select('id, receipt_number, total, subtotal, tax, status, order_type, created_at')
          .eq('organization_id', organization.id)
          .eq('status', 'completed');

        if (orderErr) throw orderErr;

        // Fetch all expenses
        const { data: expData, error: expErr } = await supabase
          .from('expenses')
          .select('*')
          .eq('organization_id', organization.id);

        if (expErr) throw expErr;

        // Fetch staff
        const { data: staffData, error: staffErr } = await supabase
          .from('staff')
          .select('id, name, salary, created_at')
          .eq('organization_id', organization.id);

        if (staffErr) throw staffErr;

        setAllOrders(orderData || []);
        setAllExpenses(expData || []);
        setStaffList(staffData || []);
      } else {
        const localOrders = JSON.parse(localStorage.getItem('restaurant_pos_orders') || '[]');
        const orgOrders = localOrders.filter(
          (o) => o.organization_id === organization.id && o.status === 'completed'
        );

        const localExpenses = JSON.parse(localStorage.getItem('restaurant_pos_expenses') || '[]');
        const orgExpenses = localExpenses.filter((e) => e.organization_id === organization.id);

        const localStaff = JSON.parse(localStorage.getItem('restaurant_pos_staff') || '[]');
        const orgStaff = localStaff.filter((s) => s.organization_id === organization.id);

        setAllOrders(orgOrders);
        setAllExpenses(orgExpenses);
        setStaffList(orgStaff);
      }
    } catch (err) {
      console.error('Error loading Profit & Loss data:', err);
      setError(err.message || 'Failed to load report data.');
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Navigate Previous Month
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  // Navigate Next Month
  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  // Jump to Current Month
  const handleCurrentMonth = () => {
    const today = new Date();
    setSelectedYear(today.getFullYear());
    setSelectedMonth(today.getMonth());
  };

  // Compute month metrics helper
  const computeMonthMetrics = useCallback((year, monthIdx) => {
    const monthPrefix = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;

    // Month Orders
    const monthOrders = allOrders.filter((o) => {
      const d = o.created_at ? o.created_at.slice(0, 7) : '';
      return d === monthPrefix;
    });

    const revenue = monthOrders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);

    // Month Expenses (Logged)
    const monthExpenses = allExpenses.filter((e) => {
      const d = e.expense_date ? e.expense_date.slice(0, 7) : '';
      return d === monthPrefix;
    });

    const loggedExpenseTotal = monthExpenses.reduce(
      (sum, e) => sum + parseFloat(e.amount || 0),
      0
    );

    // Staff Salaries (Monthly)
    const staffSalaryTotal = staffList.reduce(
      (sum, s) => sum + parseFloat(s.salary || 0),
      0
    );

    const totalExpenses = loggedExpenseTotal + staffSalaryTotal;
    const netProfit = revenue - totalExpenses;
    const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    // Category breakdown
    const categoryTotals = {};
    if (staffSalaryTotal > 0) {
      categoryTotals['Staff Salaries'] = staffSalaryTotal;
    }
    monthExpenses.forEach((e) => {
      const cat = e.category || 'Other';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + parseFloat(e.amount || 0);
    });

    return {
      year,
      monthIdx,
      label: getMonthYearLabel(year, monthIdx),
      monthPrefix,
      ordersCount: monthOrders.length,
      revenue,
      loggedExpenseTotal,
      staffSalaryTotal,
      totalExpenses,
      netProfit,
      profitMargin,
      monthExpenses,
      categoryTotals
    };
  }, [allOrders, allExpenses, staffList]);

  // Current Selected Month Calculation
  const currentMonthData = useMemo(() => {
    return computeMonthMetrics(selectedYear, selectedMonth);
  }, [computeMonthMetrics, selectedYear, selectedMonth]);

  // Last 6 Months Historical Trend Data
  const trendHistory = useMemo(() => {
    const history = [];
    for (let i = 5; i >= 0; i--) {
      let m = selectedMonth - i;
      let y = selectedYear;
      while (m < 0) {
        m += 12;
        y -= 1;
      }
      history.push(computeMonthMetrics(y, m));
    }
    return history;
  }, [computeMonthMetrics, selectedYear, selectedMonth]);

  const maxTrendVal = useMemo(() => {
    const maxVal = Math.max(
      ...trendHistory.map((h) => Math.max(h.revenue, h.totalExpenses, Math.abs(h.netProfit))),
      1000
    );
    return maxVal;
  }, [trendHistory]);

  // SPRINT H: CSV Export Handler
  const handleExportCSV = () => {
    setCsvError(null);
    if (!csvStartMonth || !csvEndMonth) {
      setCsvError('Please select both a start and end month.');
      return;
    }

    if (csvStartMonth > csvEndMonth) {
      setCsvError('Start Month cannot be after End Month (minimum range is 1 full month).');
      return;
    }

    // Parse start and end
    const [startYear, startM] = csvStartMonth.split('-').map(Number);
    const [endYear, endM] = csvEndMonth.split('-').map(Number);

    const exportMonths = [];
    let curY = startYear;
    let curM = startM - 1; // 0-11
    const targetY = endYear;
    const targetM = endM - 1;

    while (curY < targetY || (curY === targetY && curM <= targetM)) {
      exportMonths.push(computeMonthMetrics(curY, curM));
      curM++;
      if (curM > 11) {
        curM = 0;
        curY++;
      }
    }

    if (exportMonths.length === 0) {
      setCsvError('No data found for the selected range.');
      return;
    }

    // Generate CSV Content
    // Header
    const csvRows = [];
    csvRows.push([
      'Profit & Loss Statement',
      `"${organization?.name || 'Restaurant'}"`,
      `"Period: ${csvStartMonth} to ${csvEndMonth}"`,
      `"Generated: ${new Date().toLocaleString()}"`
    ].join(','));
    csvRows.push(''); // blank line

    // Section 1: Monthly Summary Table
    csvRows.push([
      'Month',
      'Completed Orders',
      `Total Revenue (${currency})`,
      `Total Expenses (${currency})`,
      `Staff Salaries (${currency})`,
      `Logged Purchases (${currency})`,
      `Net Profit / Loss (${currency})`,
      'Status',
      'Profit Margin (%)'
    ].join(','));

    exportMonths.forEach((m) => {
      csvRows.push([
        `"${m.label}"`,
        m.ordersCount,
        m.revenue.toFixed(2),
        m.totalExpenses.toFixed(2),
        m.staffSalaryTotal.toFixed(2),
        m.loggedExpenseTotal.toFixed(2),
        m.netProfit.toFixed(2),
        m.netProfit >= 0 ? 'PROFIT' : 'LOSS',
        `${m.profitMargin.toFixed(2)}%`
      ].join(','));
    });

    csvRows.push(''); // blank line
    csvRows.push('--- CATEGORY BREAKDOWN BY MONTH ---');
    csvRows.push(['Month', 'Expense Category', `Amount (${currency})`, '% of Total Expenses'].join(','));

    exportMonths.forEach((m) => {
      Object.entries(m.categoryTotals).forEach(([cat, amt]) => {
        const pct = m.totalExpenses > 0 ? (amt / m.totalExpenses) * 100 : 0;
        csvRows.push([
          `"${m.label}"`,
          `"${cat}"`,
          amt.toFixed(2),
          `${pct.toFixed(1)}%`
        ].join(','));
      });
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `profit_loss_${csvStartMonth}_to_${csvEndMonth}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setCsvModalOpen(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header & Controls */}
      <div className="menu-header-actions">
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <TrendingUp size={28} color="var(--primary-orange)" />
            <span>Profit &amp; Loss Report</span>
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Comprehensive monthly financial statements, operational costs, staff payroll, and profit margin analysis.
          </p>
        </div>

        <div className="menu-actions-group">
          {/* Month Navigator */}
          <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)', padding: '0.25rem 0.4rem', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
            <button
              type="button"
              onClick={handlePrevMonth}
              className="btn btn-ghost"
              style={{ padding: '0.4rem' }}
              title="Previous Month"
            >
              <ChevronLeft size={18} />
            </button>

            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a', minWidth: '150px', textAlign: 'center', padding: '0 0.5rem' }}>
              {currentMonthData.label}
            </span>

            <button
              type="button"
              onClick={handleNextMonth}
              className="btn btn-ghost"
              style={{ padding: '0.4rem' }}
              title="Next Month"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <button
            type="button"
            onClick={handleCurrentMonth}
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem', fontWeight: 700 }}
          >
            Current Month
          </button>

          <button
            type="button"
            onClick={() => setCsvModalOpen(true)}
            className="btn btn-primary"
            style={{ background: 'var(--primary-orange)', border: 'none', color: '#fff', fontWeight: 800 }}
          >
            <Download size={16} />
            <span>Download CSV</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: 0 }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>
          Calculating Profit &amp; Loss Statement...
        </div>
      ) : (
        <>
          {/* Key Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.1rem' }}>
            {/* 1. Total Revenue */}
            <div className="card" style={{ padding: '1.35rem', borderLeft: '4px solid #10b981' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: 'var(--radius-sm)', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={18} />
                </div>
                <span style={{ fontSize: '0.775rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total Revenue
                </span>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#059669', letterSpacing: '-0.02em' }}>
                {formatAmount(currentMonthData.revenue)}
              </div>
              <div style={{ fontSize: '0.775rem', color: '#64748b', marginTop: '0.35rem' }}>
                From {currentMonthData.ordersCount} completed orders
              </div>
            </div>

            {/* 2. Total Expenses */}
            <div className="card" style={{ padding: '1.35rem', borderLeft: '4px solid #f97316' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: 'var(--radius-sm)', background: '#fff7ed', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingDown size={18} />
                </div>
                <span style={{ fontSize: '0.775rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total Expenses
                </span>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#ea580c', letterSpacing: '-0.02em' }}>
                {formatAmount(currentMonthData.totalExpenses)}
              </div>
              <div style={{ fontSize: '0.775rem', color: '#64748b', marginTop: '0.35rem' }}>
                {formatAmount(currentMonthData.loggedExpenseTotal)} purchases + {formatAmount(currentMonthData.staffSalaryTotal)} payroll
              </div>
            </div>

            {/* 3. Net Profit / Loss */}
            <div
              className="card"
              style={{
                padding: '1.35rem',
                borderLeft: `4px solid ${currentMonthData.netProfit >= 0 ? '#10b981' : '#dc2626'}`,
                background: currentMonthData.netProfit >= 0 ? '#ffffff' : '#fff5f5'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: 'var(--radius-sm)',
                      background: currentMonthData.netProfit >= 0 ? '#ecfdf5' : '#fee2e2',
                      color: currentMonthData.netProfit >= 0 ? '#059669' : '#dc2626',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {currentMonthData.netProfit >= 0 ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                  </div>
                  <span style={{ fontSize: '0.775rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Net {currentMonthData.netProfit >= 0 ? 'Profit' : 'Loss'}
                  </span>
                </div>

                <span
                  className="badge"
                  style={{
                    background: currentMonthData.netProfit >= 0 ? '#ecfdf5' : '#fef2f2',
                    color: currentMonthData.netProfit >= 0 ? '#059669' : '#dc2626',
                    border: `1px solid ${currentMonthData.netProfit >= 0 ? '#a7f3d0' : '#fecaca'}`,
                    fontWeight: 800,
                    fontSize: '0.75rem',
                    textTransform: 'uppercase'
                  }}
                >
                  {currentMonthData.netProfit >= 0 ? 'PROFIT' : 'LOSS'}
                </span>
              </div>

              <div
                style={{
                  fontSize: '1.65rem',
                  fontWeight: 900,
                  color: currentMonthData.netProfit >= 0 ? '#059669' : '#dc2626',
                  letterSpacing: '-0.02em'
                }}
              >
                {currentMonthData.netProfit < 0 ? '-' : ''}
                {formatAmount(Math.abs(currentMonthData.netProfit))}
              </div>

              <div style={{ fontSize: '0.775rem', color: '#64748b', marginTop: '0.35rem' }}>
                Revenue minus total expenses
              </div>
            </div>

            {/* 4. Profit Margin */}
            <div className="card" style={{ padding: '1.35rem', borderLeft: '4px solid #8b5cf6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: 'var(--radius-sm)', background: '#f5f3ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Percent size={18} />
                </div>
                <span style={{ fontSize: '0.775rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Profit Margin
                </span>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 900, color: currentMonthData.profitMargin >= 0 ? '#7c3aed' : '#dc2626', letterSpacing: '-0.02em' }}>
                {currentMonthData.profitMargin.toFixed(1)}%
              </div>
              <div style={{ fontSize: '0.775rem', color: '#64748b', marginTop: '0.35rem' }}>
                {currentMonthData.revenue > 0 ? 'Of gross order revenue' : 'No revenue recorded this month'}
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
            {/* 1. Expense Breakdown by Category */}
            <div className="card">
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PieChart size={18} color="var(--primary-orange)" />
                <span>Expense Breakdown by Category</span>
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem' }}>
                {currentMonthData.label} · Total {formatAmount(currentMonthData.totalExpenses)}
              </p>

              {currentMonthData.totalExpenses === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                  No expenses or staff payroll recorded for {currentMonthData.label}.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {Object.entries(currentMonthData.categoryTotals).map(([cat, amt]) => {
                    const pct = currentMonthData.totalExpenses > 0
                      ? (amt / currentMonthData.totalExpenses) * 100
                      : 0;
                    const catColor = CATEGORY_COLORS[cat] || '#64748b';

                    return (
                      <div key={cat}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem', fontSize: '0.85rem' }}>
                          <span style={{ fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: catColor, display: 'inline-block' }} />
                            {cat}
                          </span>
                          <span style={{ fontWeight: 800, color: '#0f172a' }}>
                            {formatAmount(amt)} <span style={{ color: '#64748b', fontWeight: 600, fontSize: '0.775rem' }}>({pct.toFixed(1)}%)</span>
                          </span>
                        </div>
                        <div style={{ height: '7px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${pct}%`,
                              background: catColor,
                              borderRadius: '4px',
                              transition: 'width 0.4s ease'
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. Month-over-Month Trend Chart */}
            <div className="card">
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BarChart3 size={18} color="#3b82f6" />
                <span>6-Month Financial Trend</span>
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem' }}>
                Comparing Revenue, Expenses &amp; Net Profit across past 6 months
              </p>

              {/* Pure CSS Bar Comparison Chart */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', height: '170px', width: '100%', paddingTop: '1rem' }}>
                {trendHistory.map((item, idx) => {
                  const revPct = maxTrendVal > 0 ? (item.revenue / maxTrendVal) * 100 : 0;
                  const expPct = maxTrendVal > 0 ? (item.totalExpenses / maxTrendVal) * 100 : 0;

                  return (
                    <div
                      key={idx}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.35rem',
                        height: '100%',
                        justifyContent: 'flex-end'
                      }}
                    >
                      {/* Bars Group */}
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '120px', width: '100%', justifyContent: 'center' }}>
                        {/* Revenue Bar */}
                        <div
                          title={`Revenue: ${formatAmount(item.revenue)}`}
                          style={{
                            width: '45%',
                            maxWidth: '18px',
                            height: `${Math.max(revPct, item.revenue > 0 ? 4 : 0)}%`,
                            background: '#10b981',
                            borderRadius: '3px 3px 0 0',
                            transition: 'height 0.3s ease'
                          }}
                        />

                        {/* Expense Bar */}
                        <div
                          title={`Expenses: ${formatAmount(item.totalExpenses)}`}
                          style={{
                            width: '45%',
                            maxWidth: '18px',
                            height: `${Math.max(expPct, item.totalExpenses > 0 ? 4 : 0)}%`,
                            background: '#f97316',
                            borderRadius: '3px 3px 0 0',
                            transition: 'height 0.3s ease'
                          }}
                        />
                      </div>

                      {/* Month Label */}
                      <div
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          color: item.monthPrefix === currentMonthData.monthPrefix ? 'var(--primary-orange)' : '#64748b',
                          textAlign: 'center',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {MONTH_NAMES[item.monthIdx].slice(0, 3)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Trend Legend */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1.25rem', marginTop: '0.85rem', paddingTop: '0.65rem', borderTop: '1px solid #f1f5f9', fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '9px', height: '9px', background: '#10b981', borderRadius: '2px', display: 'inline-block' }} />
                  Revenue
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '9px', height: '9px', background: '#f97316', borderRadius: '2px', display: 'inline-block' }} />
                  Expenses
                </span>
              </div>
            </div>
          </div>

          {/* Detailed Itemized Ledger for the Selected Month */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Receipt size={18} color="var(--primary-orange)" />
                <span>Month Statement Transparency Ledger</span>
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
                Itemized breakdown of all revenue sources, staff payroll, and operational purchase entries for {currentMonthData.label}.
              </p>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Source / Description</th>
                    <th>Category</th>
                    <th style={{ textAlign: 'right' }}>Credit (Revenue)</th>
                    <th style={{ textAlign: 'right' }}>Debit (Expense)</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Revenue Summary Row */}
                  <tr style={{ background: '#f0fdf4' }}>
                    <td>
                      <span className="badge" style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', fontWeight: 800, fontSize: '0.725rem' }}>
                        REVENUE
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 800, color: '#15803d' }}>
                        POS Gross Sales ({currentMonthData.ordersCount} completed orders)
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#16a34a' }}>
                        Walk-in and delivery sales combined
                      </div>
                    </td>
                    <td style={{ color: '#15803d', fontWeight: 700 }}>Orders Total</td>
                    <td style={{ textAlign: 'right', fontWeight: 900, color: '#15803d', fontSize: '0.95rem' }}>
                      {formatAmount(currentMonthData.revenue)}
                    </td>
                    <td style={{ textAlign: 'right', color: '#94a3b8' }}>—</td>
                  </tr>

                  {/* Staff Salaries Line Item */}
                  {currentMonthData.staffSalaryTotal > 0 && (
                    <tr style={{ background: '#f8fafc' }}>
                      <td>
                        <span className="badge" style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', fontWeight: 800, fontSize: '0.725rem' }}>
                          PAYROLL
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>
                          Staff Monthly Salaries ({staffList.length} staff member{staffList.length === 1 ? '' : 's'})
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          Auto-calculated recurring payroll
                        </div>
                      </td>
                      <td>
                        <span className="badge" style={{ background: '#eff6ff', color: '#2563eb', fontSize: '0.725rem', fontWeight: 700 }}>
                          Staff Salaries
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', color: '#94a3b8' }}>—</td>
                      <td style={{ textAlign: 'right', fontWeight: 900, color: '#dc2626', fontSize: '0.95rem' }}>
                        {formatAmount(currentMonthData.staffSalaryTotal)}
                      </td>
                    </tr>
                  )}

                  {/* Individual Logged Expenses */}
                  {currentMonthData.monthExpenses.map((exp) => (
                    <tr key={exp.id}>
                      <td>
                        <span className="badge" style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', fontWeight: 800, fontSize: '0.725rem' }}>
                          PURCHASE
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>{exp.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {exp.expense_date} {exp.notes ? `• ${exp.notes}` : ''}
                        </div>
                      </td>
                      <td>
                        <span className="badge" style={{ background: '#f1f5f9', color: '#334155', fontSize: '0.725rem', fontWeight: 700 }}>
                          {exp.category}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', color: '#94a3b8' }}>—</td>
                      <td style={{ textAlign: 'right', fontWeight: 900, color: '#dc2626', fontSize: '0.95rem' }}>
                        {formatAmount(exp.amount)}
                      </td>
                    </tr>
                  ))}

                  {/* Empty state if nothing */}
                  {currentMonthData.monthExpenses.length === 0 && currentMonthData.staffSalaryTotal === 0 && currentMonthData.revenue === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                        No financial activity logged for {currentMonthData.label}.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1' }}>
                    <th colSpan={3} style={{ fontWeight: 900, fontSize: '0.95rem', color: '#0f172a' }}>
                      NET RESULT ({currentMonthData.label}):
                    </th>
                    <th style={{ textAlign: 'right', color: '#15803d', fontWeight: 900, fontSize: '1rem' }}>
                      {formatAmount(currentMonthData.revenue)}
                    </th>
                    <th style={{ textAlign: 'right', color: '#dc2626', fontWeight: 900, fontSize: '1rem' }}>
                      {formatAmount(currentMonthData.totalExpenses)}
                    </th>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {/* SPRINT H: CSV Export Modal */}
      {csvModalOpen && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileSpreadsheet size={20} color="var(--primary-orange)" />
                <span>Export Profit &amp; Loss CSV</span>
              </h3>
              <button
                type="button"
                onClick={() => setCsvModalOpen(false)}
                className="modal-close-btn"
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Select a date range for your financial export. Minimum allowed range is <strong>1 full month</strong>.
            </p>

            {csvError && (
              <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
                <AlertCircle size={16} />
                <span>{csvError}</span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label">Start Month</label>
                <input
                  type="month"
                  className="form-input"
                  value={csvStartMonth}
                  onChange={(e) => setCsvStartMonth(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">End Month</label>
                <input
                  type="month"
                  className="form-input"
                  value={csvEndMonth}
                  onChange={(e) => setCsvEndMonth(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setCsvModalOpen(false)}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExportCSV}
                className="btn btn-primary"
                style={{ flex: 1.5, background: 'var(--primary-orange)', border: 'none', color: '#fff', fontWeight: 800 }}
              >
                <Download size={16} />
                <span>Download CSV</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
