import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Wallet,
  Plus,
  Search,
  Filter,
  Calendar,
  DollarSign,
  Users,
  Edit2,
  Trash2,
  Check,
  X,
  AlertCircle,
  TrendingDown,
  Receipt,
  FileText,
  Tag,
  ArrowUpDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DEFAULT_CURRENCY, formatPrice } from '../utils/currency';

const DEFAULT_CATEGORIES = [
  'Ingredients',
  'Utilities',
  'Maintenance',
  'Rent',
  'Packaging',
  'Marketing',
  'Transport / Fuel',
  'Other'
];

export default function ExpenseManagement() {
  const { organization } = useAuth();
  const currency = organization?.currency || DEFAULT_CURRENCY;
  const formatAmount = (val) => formatPrice(val, currency);

  // Data State
  const [expenses, setExpenses] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [customCategories, setCustomCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('this_month'); // 'today' | 'this_week' | 'this_month' | 'last_month' | 'all' | 'custom'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Add/Edit Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    category: 'Ingredients',
    amount: '',
    expense_date: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Delete Confirmation Modal
  const [deletingExpense, setDeletingExpense] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  // 1. Fetch Expenses & Staff Salaries
  const loadData = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    setError(null);

    try {
      if (isSupabaseConfigured() && supabase) {
        // Fetch expenses
        const { data: expData, error: expErr } = await supabase
          .from('expenses')
          .select('*')
          .eq('organization_id', organization.id)
          .order('expense_date', { ascending: false })
          .order('created_at', { ascending: false });

        if (expErr) throw expErr;

        // Fetch staff for salary auto-aggregation
        const { data: staffData, error: staffErr } = await supabase
          .from('staff')
          .select('id, name, salary, created_at')
          .eq('organization_id', organization.id);

        if (staffErr) throw staffErr;

        setExpenses(expData || []);
        setStaffList(staffData || []);

        // Collect custom categories
        const usedCats = new Set((expData || []).map((e) => e.category).filter(Boolean));
        const custom = Array.from(usedCats).filter((c) => !DEFAULT_CATEGORIES.includes(c));
        setCustomCategories(custom);
      } else {
        const localExpenses = JSON.parse(localStorage.getItem('restaurant_pos_expenses') || '[]');
        const orgExpenses = localExpenses.filter((e) => e.organization_id === organization.id);
        
        const localStaff = JSON.parse(localStorage.getItem('restaurant_pos_staff') || '[]');
        const orgStaff = localStaff.filter((s) => s.organization_id === organization.id);

        setExpenses(orgExpenses.sort((a, b) => new Date(b.expense_date) - new Date(a.expense_date)));
        setStaffList(orgStaff);

        const usedCats = new Set(orgExpenses.map((e) => e.category).filter(Boolean));
        const custom = Array.from(usedCats).filter((c) => !DEFAULT_CATEGORIES.includes(c));
        setCustomCategories(custom);
      }
    } catch (err) {
      console.error('Error loading expenses:', err);
      setError(err.message || 'Failed to load expense records.');
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Merge default categories + any custom ones created
  const allAvailableCategories = useMemo(() => {
    const set = new Set([...DEFAULT_CATEGORIES, ...customCategories]);
    return Array.from(set);
  }, [customCategories]);

  // Date Range Helper
  const dateRangeBounds = useMemo(() => {
    const now = new Date();
    let start = null;
    let end = null;

    if (dateFilter === 'today') {
      const todayStr = now.toISOString().slice(0, 10);
      start = todayStr;
      end = todayStr;
    } else if (dateFilter === 'this_week') {
      const curr = new Date(now);
      const day = curr.getDay(); // 0 is Sunday
      const diff = curr.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(curr.setDate(diff));
      start = monday.toISOString().slice(0, 10);
      end = now.toISOString().slice(0, 10);
    } else if (dateFilter === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      start = firstDay.toISOString().slice(0, 10);
      end = lastDay.toISOString().slice(0, 10);
    } else if (dateFilter === 'last_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      start = firstDay.toISOString().slice(0, 10);
      end = lastDay.toISOString().slice(0, 10);
    } else if (dateFilter === 'custom') {
      start = customStartDate || null;
      end = customEndDate || null;
    }

    return { start, end };
  }, [dateFilter, customStartDate, customEndDate]);

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      // Search filter
      const search = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !search ||
        (exp.name && exp.name.toLowerCase().includes(search)) ||
        (exp.notes && exp.notes.toLowerCase().includes(search)) ||
        (exp.category && exp.category.toLowerCase().includes(search));

      // Category filter
      const matchesCategory =
        categoryFilter === 'all' || exp.category === categoryFilter;

      // Date filter
      let matchesDate = true;
      if (dateRangeBounds.start && exp.expense_date < dateRangeBounds.start) {
        matchesDate = false;
      }
      if (dateRangeBounds.end && exp.expense_date > dateRangeBounds.end) {
        matchesDate = false;
      }

      return matchesSearch && matchesCategory && matchesDate;
    });
  }, [expenses, searchTerm, categoryFilter, dateRangeBounds]);

  // Calculate Totals
  const loggedExpensesTotal = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
  }, [filteredExpenses]);

  // Monthly Staff Salaries Total (Sum of active staff members' monthly salaries)
  const monthlySalariesTotal = useMemo(() => {
    return staffList.reduce((sum, s) => sum + parseFloat(s.salary || 0), 0);
  }, [staffList]);

  // Grand Total Expense (Logged + Staff Salaries)
  const grandTotalExpenses = useMemo(() => {
    // For monthly view, include monthly staff salaries
    return loggedExpensesTotal + (dateFilter === 'this_month' || dateFilter === 'last_month' ? monthlySalariesTotal : 0);
  }, [loggedExpensesTotal, monthlySalariesTotal, dateFilter]);

  // Modal Handlers
  const handleOpenAddModal = () => {
    setEditingExpense(null);
    setFormData({
      name: '',
      category: allAvailableCategories[0] || 'Ingredients',
      amount: '',
      expense_date: new Date().toISOString().slice(0, 10),
      notes: '',
    });
    setIsAddingNewCategory(false);
    setNewCategoryInput('');
    setModalOpen(true);
  };

  const handleOpenEditModal = (exp) => {
    setEditingExpense(exp);
    setFormData({
      name: exp.name || '',
      category: exp.category || 'Ingredients',
      amount: exp.amount?.toString() || '',
      expense_date: exp.expense_date || new Date().toISOString().slice(0, 10),
      notes: exp.notes || '',
    });
    setIsAddingNewCategory(false);
    setNewCategoryInput('');
    setModalOpen(true);
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter an expense name/description.');
      return;
    }
    const numAmount = parseFloat(formData.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Please enter a valid expense amount greater than 0.');
      return;
    }

    let finalCategory = formData.category;
    if (isAddingNewCategory) {
      if (!newCategoryInput.trim()) {
        alert('Please enter a category name or select an existing one.');
        return;
      }
      finalCategory = newCategoryInput.trim();
      if (!customCategories.includes(finalCategory)) {
        setCustomCategories((prev) => [...prev, finalCategory]);
      }
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      organization_id: organization.id,
      name: formData.name.trim(),
      category: finalCategory,
      amount: numAmount,
      expense_date: formData.expense_date,
      notes: formData.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingExpense) {
        // UPDATE
        if (isSupabaseConfigured() && supabase) {
          const { error: updErr } = await supabase
            .from('expenses')
            .update(payload)
            .eq('id', editingExpense.id);
          if (updErr) throw updErr;
        } else {
          const local = JSON.parse(localStorage.getItem('restaurant_pos_expenses') || '[]');
          const updated = local.map((x) => (x.id === editingExpense.id ? { ...x, ...payload } : x));
          localStorage.setItem('restaurant_pos_expenses', JSON.stringify(updated));
        }
        showSuccess(`Expense "${formData.name}" updated successfully!`);
      } else {
        // CREATE
        if (isSupabaseConfigured() && supabase) {
          const { error: insErr } = await supabase
            .from('expenses')
            .insert([{ ...payload, created_at: new Date().toISOString() }]);
          if (insErr) throw insErr;
        } else {
          const local = JSON.parse(localStorage.getItem('restaurant_pos_expenses') || '[]');
          const newEntry = {
            id: 'exp_' + Math.random().toString(36).substring(2, 9),
            ...payload,
            created_at: new Date().toISOString(),
          };
          local.push(newEntry);
          localStorage.setItem('restaurant_pos_expenses', JSON.stringify(local));
        }
        showSuccess(`Expense "${formData.name}" logged successfully!`);
      }

      setModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('Error saving expense:', err);
      setError(err.message || 'Failed to save expense.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async () => {
    if (!deletingExpense) return;
    setDeleting(true);
    try {
      if (isSupabaseConfigured() && supabase) {
        const { error: delErr } = await supabase
          .from('expenses')
          .delete()
          .eq('id', deletingExpense.id);
        if (delErr) throw delErr;
      } else {
        const local = JSON.parse(localStorage.getItem('restaurant_pos_expenses') || '[]');
        const updated = local.filter((x) => x.id !== deletingExpense.id);
        localStorage.setItem('restaurant_pos_expenses', JSON.stringify(updated));
      }
      showSuccess(`Expense "${deletingExpense.name}" deleted.`);
      setDeletingExpense(null);
      await loadData();
    } catch (err) {
      console.error('Error deleting expense:', err);
      setError(err.message || 'Failed to delete expense.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div className="menu-header-actions">
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Wallet size={28} color="var(--primary-orange)" />
            <span>Expense Management</span>
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Track restaurant operational purchases, ingredient costs, utilities, and recurring staff payroll.
          </p>
        </div>

        <div className="menu-actions-group">
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="btn btn-primary"
            style={{ background: 'var(--primary-orange)', border: 'none', color: '#fff', fontWeight: 800 }}
          >
            <Plus size={18} />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="alert alert-danger" style={{ marginBottom: 0 }}>
          <AlertCircle size={18} />
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="btn btn-ghost" style={{ marginLeft: 'auto', padding: '2px' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: 0 }}>
          <Check size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {/* Logged Purchases */}
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--primary-orange)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-orange)' }}>
              <Receipt size={17} />
            </div>
            <span style={{ fontSize: '0.775rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Logged Expenses
            </span>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a' }}>
            {formatAmount(loggedExpensesTotal)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
            {filteredExpenses.length} transaction{filteredExpenses.length === 1 ? '' : 's'} in selected period
          </div>
        </div>

        {/* Staff Salaries (Monthly Recurring) */}
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
              <Users size={17} />
            </div>
            <span style={{ fontSize: '0.775rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Staff Monthly Payroll
            </span>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a' }}>
            {formatAmount(monthlySalariesTotal)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#3b82f6', fontWeight: 700, marginTop: '0.25rem' }}>
            Auto-calculated from {staffList.length} active staff member{staffList.length === 1 ? '' : 's'}
          </div>
        </div>

        {/* Grand Total Period Expense */}
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #dc2626' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
              <TrendingDown size={17} />
            </div>
            <span style={{ fontSize: '0.775rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Expenses (incl. Payroll)
            </span>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#dc2626' }}>
            {formatAmount(grandTotalExpenses)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
            Logged costs + automatic monthly staff salary
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', gap: '0.85rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search size={18} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search expense description, notes, category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2.5rem', background: '#fff' }}
          />
        </div>

        {/* Category Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Tag size={16} color="#64748b" />
          <select
            className="form-input"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ width: 'auto', fontWeight: 700, padding: '0.55rem 0.85rem' }}
          >
            <option value="all">All Categories</option>
            {allAvailableCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Date Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Calendar size={16} color="#64748b" />
          <select
            className="form-input"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            style={{ width: 'auto', fontWeight: 700, padding: '0.55rem 0.85rem' }}
          >
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="this_week">This Week</option>
            <option value="today">Today</option>
            <option value="all">All Time</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        {/* Custom Date Inputs */}
        {dateFilter === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <input
              type="date"
              className="form-input"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              style={{ width: 'auto', padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
            />
            <span style={{ color: '#64748b' }}>to</span>
            <input
              type="date"
              className="form-input"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              style={{ width: 'auto', padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
            />
          </div>
        )}
      </div>

      {/* Expenses Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3.5rem', color: '#64748b' }}>
            Loading expense records...
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem', color: '#64748b' }}>
            <FileText size={40} color="#cbd5e1" style={{ margin: '0 auto 0.75rem auto' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
              No expenses found
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' }}>
              {searchTerm || categoryFilter !== 'all' || dateFilter !== 'all'
                ? 'Try adjusting your filters or search term.'
                : 'Click "Add Expense" above to start logging restaurant purchases.'}
            </p>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="btn btn-primary"
              style={{ background: 'var(--primary-orange)', border: 'none', color: '#fff', fontWeight: 700 }}
            >
              <Plus size={16} />
              <span>Log New Expense</span>
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Notes</th>
                  <th style={{ textAlign: 'right', width: '110px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id}>
                    <td style={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>
                      {exp.expense_date}
                    </td>
                    <td>
                      <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                        {exp.name}
                      </div>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: '#fff7ed',
                          color: '#c2410c',
                          border: '1px solid #fed7aa',
                          fontSize: '0.75rem',
                          fontWeight: 700
                        }}
                      >
                        {exp.category}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 900, fontSize: '1rem', color: '#dc2626' }}>
                      {formatAmount(exp.amount)}
                    </td>
                    <td style={{ color: '#64748b', fontSize: '0.85rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {exp.notes || '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(exp)}
                          className="btn btn-ghost"
                          style={{ padding: '0.4rem', color: '#2563eb' }}
                          title="Edit Expense"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingExpense(exp)}
                          className="btn btn-ghost"
                          style={{ padding: '0.4rem', color: '#dc2626' }}
                          title="Delete Expense"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Expense Modal */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Wallet size={20} color="var(--primary-orange)" />
                <span>{editingExpense ? 'Edit Expense' : 'Log New Expense'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="modal-close-btn"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveExpense}>
              <div className="form-group">
                <label className="form-label">
                  Expense Description / Item <span className="required-mark">*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Chicken 10kg, Flour 50kg, Electricity Bill, Packaging Bags"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem' }}>
                {/* Category */}
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <label className="form-label" style={{ margin: 0 }}>Category <span className="required-mark">*</span></label>
                    <button
                      type="button"
                      onClick={() => setIsAddingNewCategory(!isAddingNewCategory)}
                      style={{ background: 'none', border: 'none', color: 'var(--primary-orange)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                    >
                      {isAddingNewCategory ? '← Existing Category' : '+ Custom Category'}
                    </button>
                  </div>

                  {isAddingNewCategory ? (
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Type new category..."
                      value={newCategoryInput}
                      onChange={(e) => setNewCategoryInput(e.target.value)}
                      required
                    />
                  ) : (
                    <select
                      className="form-input"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      required
                    >
                      {allAvailableCategories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Amount */}
                <div className="form-group">
                  <label className="form-label">
                    Amount ({currency}) <span className="required-mark">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    className="form-input"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Purchase Date */}
              <div className="form-group">
                <label className="form-label">Date of Purchase <span className="required-mark">*</span></label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.expense_date}
                  onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                  required
                />
              </div>

              {/* Notes */}
              <div className="form-group">
                <label className="form-label">Optional Note / Supplier Details</label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="e.g. Paid to Metro Cash & Carry, Invoice #9823"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                  style={{ flex: 1.5, background: 'var(--primary-orange)', border: 'none', color: '#fff', fontWeight: 800 }}
                >
                  {submitting ? 'Saving...' : editingExpense ? 'Update Expense' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingExpense && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '420px', textAlign: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
              <Trash2 size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
              Delete Expense?
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Are you sure you want to delete <strong>"{deletingExpense.name}"</strong> ({formatAmount(deletingExpense.amount)})? This action cannot be undone.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setDeletingExpense(null)}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteExpense}
                className="btn btn-danger"
                style={{ flex: 1.2 }}
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
