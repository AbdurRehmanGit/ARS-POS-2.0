import React, { useState, useEffect, useCallback } from 'react';
import { 
  Boxes, 
  Plus, 
  Upload, 
  Download, 
  Search, 
  Edit, 
  Trash2, 
  AlertTriangle, 
  Check, 
  X, 
  FileSpreadsheet,
  AlertCircle,
  Filter
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DEFAULT_CURRENCY } from '../utils/currency';

export default function Inventory() {
  const { organization } = useAuth();
  const currency = organization?.currency || DEFAULT_CURRENCY;

  // State
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Form State
  const [form, setForm] = useState({
    name: '',
    category: '',
    price: '',
    unit: 'pieces',
    current_stock: '',
    low_stock_alert: '5',
  });

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Fetch Inventory Items
  const loadInventory = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    setError(null);

    try {
      if (isSupabaseConfigured() && supabase) {
        const { data, error: err } = await supabase
          .from('inventory_items')
          .select('*')
          .eq('organization_id', organization.id)
          .order('name', { ascending: true });

        if (err) throw err;
        setItems(data || []);
      } else {
        const local = JSON.parse(localStorage.getItem('restaurant_pos_inventory') || '[]');
        setItems(local.filter((i) => i.organization_id === organization.id));
      }
    } catch (err) {
      console.error('Error loading inventory:', err);
      setError(err.message || 'Failed to load inventory items.');
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  // Extract unique categories
  const categories = Array.from(
    new Set(items.map((i) => i.category).filter(Boolean))
  );

  // 1. Add Inventory Item
  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !organization?.id) {
      setError('Please provide an item name.');
      return;
    }

    const payload = {
      organization_id: organization.id,
      name: form.name.trim(),
      category: form.category.trim() || 'General',
      price: parseFloat(form.price) || 0,
      unit: form.unit.trim() || 'pieces',
      current_stock: parseFloat(form.current_stock) || 0,
      low_stock_alert: parseFloat(form.low_stock_alert) || 5,
    };

    try {
      if (isSupabaseConfigured() && supabase) {
        const { data, error: insertErr } = await supabase
          .from('inventory_items')
          .insert(payload)
          .select()
          .single();

        if (insertErr) throw insertErr;
        setItems((prev) => [...prev, data]);
      } else {
        const newItem = {
          id: 'inv_' + Math.random().toString(36).substring(2, 9),
          ...payload,
          created_at: new Date().toISOString(),
        };
        const local = JSON.parse(localStorage.getItem('restaurant_pos_inventory') || '[]');
        local.push(newItem);
        localStorage.setItem('restaurant_pos_inventory', JSON.stringify(local));
        setItems((prev) => [...prev, newItem]);
      }

      setAddModalOpen(false);
      setForm({
        name: '',
        category: '',
        price: '',
        unit: 'pieces',
        current_stock: '',
        low_stock_alert: '5',
      });
      showSuccess(`"${payload.name}" added to inventory.`);
    } catch (err) {
      setError(err.message || 'Failed to save inventory item.');
    }
  };

  // 2. Edit Item
  const handleOpenEdit = (item) => {
    setEditingItem({
      id: item.id,
      name: item.name,
      category: item.category || '',
      price: item.price.toString(),
      unit: item.unit || 'pieces',
      current_stock: item.current_stock.toString(),
      low_stock_alert: item.low_stock_alert.toString(),
    });
    setEditModalOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingItem || !editingItem.name.trim()) return;

    const payload = {
      name: editingItem.name.trim(),
      category: editingItem.category.trim() || 'General',
      price: parseFloat(editingItem.price) || 0,
      unit: editingItem.unit.trim() || 'pieces',
      current_stock: parseFloat(editingItem.current_stock) || 0,
      low_stock_alert: parseFloat(editingItem.low_stock_alert) || 5,
    };

    try {
      if (isSupabaseConfigured() && supabase) {
        const { error: updateErr } = await supabase
          .from('inventory_items')
          .update(payload)
          .eq('id', editingItem.id);

        if (updateErr) throw updateErr;
      } else {
        const local = JSON.parse(localStorage.getItem('restaurant_pos_inventory') || '[]');
        const updated = local.map((i) =>
          i.id === editingItem.id ? { ...i, ...payload } : i
        );
        localStorage.setItem('restaurant_pos_inventory', JSON.stringify(updated));
      }

      setItems((prev) =>
        prev.map((i) => (i.id === editingItem.id ? { ...i, ...payload } : i))
      );
      setEditModalOpen(false);
      setEditingItem(null);
      showSuccess(`"${payload.name}" updated successfully.`);
    } catch (err) {
      setError(err.message || 'Failed to update item.');
    }
  };

  // 3. Delete Item
  const handleDeleteItem = async (itemId, itemName) => {
    if (!window.confirm(`Are you sure you want to delete "${itemName}"?`)) return;

    try {
      if (isSupabaseConfigured() && supabase) {
        const { error: delErr } = await supabase
          .from('inventory_items')
          .delete()
          .eq('id', itemId);
        if (delErr) throw delErr;
      } else {
        const local = JSON.parse(localStorage.getItem('restaurant_pos_inventory') || '[]');
        const filtered = local.filter((i) => i.id !== itemId);
        localStorage.setItem('restaurant_pos_inventory', JSON.stringify(filtered));
      }

      setItems((prev) => prev.filter((i) => i.id !== itemId));
      showSuccess(`"${itemName}" deleted from inventory.`);
    } catch (err) {
      setError(err.message || 'Failed to delete item.');
    }
  };

  // 4. Download CSV Template
  const handleDownloadTemplate = () => {
    const csvContent =
      'name,category,price,unit,current_stock,low_stock_alert\n' +
      'Mozzarella Cheese,Dairy,1200,kg,15,5\n' +
      'Pizza Flour,Baking,150,kg,50,10\n' +
      'Tomato Sauce,Canned Goods,350,liters,20,8\n' +
      'Olive Oil,Oils,2200,liters,8,3\n' +
      'Pepperoni Slices,Meat,1800,kg,12,4\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'inventory_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 5. Upload & Parse CSV (Bulk Insert / Update)
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target.result;
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

        if (lines.length <= 1) {
          setError('CSV file is empty or only has headers.');
          return;
        }

        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
        const rows = lines.slice(1);
        let insertedCount = 0;
        let updatedCount = 0;

        const parsedRows = rows.map((line) => {
          const vals = line.split(',').map((v) => v.trim());
          const rowObj = {};
          headers.forEach((h, idx) => {
            rowObj[h] = vals[idx] || '';
          });
          return {
            name: rowObj.name || 'Unnamed Item',
            category: rowObj.category || 'General',
            price: parseFloat(rowObj.price) || 0,
            unit: rowObj.unit || 'pieces',
            current_stock: parseFloat(rowObj.current_stock) || 0,
            low_stock_alert: parseFloat(rowObj.low_stock_alert) || 5,
          };
        });

        if (isSupabaseConfigured() && supabase) {
          for (const row of parsedRows) {
            // Check if item exists in this organization
            const { data: existing } = await supabase
              .from('inventory_items')
              .select('id')
              .eq('organization_id', organization.id)
              .ilike('name', row.name)
              .maybeSingle();

            if (existing) {
              await supabase
                .from('inventory_items')
                .update(row)
                .eq('id', existing.id);
              updatedCount++;
            } else {
              await supabase.from('inventory_items').insert({
                ...row,
                organization_id: organization.id,
              });
              insertedCount++;
            }
          }
          await loadInventory();
        } else {
          // Local sandbox handling
          const local = JSON.parse(localStorage.getItem('restaurant_pos_inventory') || '[]');
          parsedRows.forEach((row) => {
            const existingIdx = local.findIndex(
              (i) => i.organization_id === organization.id && i.name.toLowerCase() === row.name.toLowerCase()
            );
            if (existingIdx !== -1) {
              local[existingIdx] = { ...local[existingIdx], ...row };
              updatedCount++;
            } else {
              local.push({
                id: 'inv_' + Math.random().toString(36).substring(2, 9),
                organization_id: organization.id,
                ...row,
                created_at: new Date().toISOString(),
              });
              insertedCount++;
            }
          });
          localStorage.setItem('restaurant_pos_inventory', JSON.stringify(local));
          setItems(local.filter((i) => i.organization_id === organization.id));
        }

        showSuccess(`CSV Processed: ${insertedCount} items added, ${updatedCount} items updated.`);
      } catch (uploadErr) {
        console.error('Error processing CSV:', uploadErr);
        setError('Failed to parse and process CSV file.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  // Filter items
  const filteredItems = items.filter((i) => {
    const matchesCat =
      selectedCategory === 'all' || i.category === selectedCategory;
    const matchesSearch =
      i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (i.category && i.category.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header & Quick Action Buttons */}
      <div className="menu-header-actions">
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Boxes size={28} color="var(--primary-orange)" />
            <span>Inventory Management</span>
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Track raw stock, ingredient units, cost prices, and automated low-stock warnings.
          </p>
        </div>

        <div className="menu-actions-group">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem' }}
            title="Download template CSV for bulk inventory"
          >
            <Download size={16} />
            <span>CSV Template</span>
          </button>

          <label
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem', cursor: 'pointer', margin: 0 }}
            title="Upload CSV to bulk add/update inventory"
          >
            <Upload size={16} />
            <span>Upload CSV</span>
            <input
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
          </label>

          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="btn btn-primary"
            style={{ background: 'var(--primary-orange)', border: 'none', color: '#fff' }}
          >
            <Plus size={18} />
            <span>+ Add Item</span>
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

      {/* Search & Category Filter Bar */}
      <div className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', padding: '1rem 1.25rem' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={18} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search inventory by item name or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2.5rem', background: '#fff' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={16} color="#64748b" />
          <select
            className="form-input"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ width: 'auto', background: '#fff', fontWeight: 600 }}
          >
            <option value="all">All Categories ({items.length})</option>
            {categories.map((c, idx) => (
              <option key={idx} value={c}>
                {c} ({items.filter((i) => i.category === c).length})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Inventory Items Table */}
      <div className="data-table-wrapper">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
            Loading inventory stock...
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem', color: '#64748b' }}>
            <Boxes size={42} color="#cbd5e1" style={{ margin: '0 auto 0.75rem auto' }} />
            <h3 style={{ fontSize: '1.15rem', color: '#0f172a', marginBottom: '0.35rem' }}>
              No Inventory Items Found
            </h3>
            <p style={{ fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              {searchTerm || selectedCategory !== 'all'
                ? 'Try adjusting your search or category filter.'
                : 'Add items or upload a CSV to start tracking ingredient stock.'}
            </p>
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="btn btn-primary"
              style={{ background: 'var(--primary-orange)', color: '#fff', border: 'none' }}
            >
              <Plus size={16} />
              <span>Add First Item</span>
            </button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Category</th>
                <th>Price ({currency})</th>
                <th>Unit</th>
                <th>Current Stock</th>
                <th>Low Stock Alert</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const isLowStock = parseFloat(item.current_stock) <= parseFloat(item.low_stock_alert);

                return (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 800, color: '#0f172a' }}>
                      {item.name}
                    </td>
                    <td>
                      <span className="badge badge-muted">{item.category || 'General'}</span>
                    </td>
                    <td style={{ fontWeight: 700, color: '#15803d' }}>
                      {currency} {parseFloat(item.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ color: '#475569', fontWeight: 600 }}>{item.unit}</td>
                    <td style={{ fontWeight: 800, fontSize: '0.95rem', color: isLowStock ? '#dc2626' : '#0f172a' }}>
                      {parseFloat(item.current_stock).toLocaleString()}
                    </td>
                    <td style={{ color: '#64748b', fontWeight: 600 }}>
                      {parseFloat(item.low_stock_alert).toLocaleString()}
                    </td>
                    <td>
                      {isLowStock ? (
                        <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <AlertTriangle size={12} />
                          <span>Low Stock</span>
                        </span>
                      ) : (
                        <span className="badge badge-active">In Stock</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          className="btn btn-ghost"
                          style={{ padding: '0.3rem 0.5rem', color: '#475569' }}
                          title="Edit stock & details"
                        >
                          <Edit size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id, item.name)}
                          className="btn btn-ghost"
                          style={{ padding: '0.3rem 0.5rem', color: 'var(--danger-red)' }}
                          title="Delete item"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ====================================================================
          MODAL: ADD INVENTORY ITEM
          ==================================================================== */}
      {addModalOpen && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={22} color="var(--primary-orange)" />
                <span>Add Inventory Item</span>
              </h3>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="modal-close-btn"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveItem}>
              <div className="form-group">
                <label className="form-label">
                  Item Name <span className="required-mark">*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Mozzarella Cheese, Pizza Flour, Chicken Breast"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <input
                    type="text"
                    list="category-suggestions"
                    className="form-input"
                    placeholder="e.g. Dairy, Meat, Baking"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  />
                  <datalist id="category-suggestions">
                    {categories.map((c, i) => (
                      <option key={i} value={c} />
                    ))}
                  </datalist>
                </div>

                <div className="form-group">
                  <label className="form-label">Unit</label>
                  <select
                    className="form-input"
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  >
                    <option value="pieces">pieces</option>
                    <option value="kg">kg</option>
                    <option value="grams">grams</option>
                    <option value="liters">liters</option>
                    <option value="ml">ml</option>
                    <option value="packs">packs</option>
                    <option value="boxes">boxes</option>
                    <option value="cans">cans</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.85rem' }}>
                <div className="form-group">
                  <label className="form-label">Price ({currency})</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    placeholder="0"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Current Stock <span className="required-mark">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    placeholder="0"
                    value={form.current_stock}
                    onChange={(e) => setForm({ ...form, current_stock: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Low Stock Alert</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    placeholder="5"
                    value={form.low_stock_alert}
                    onChange={(e) => setForm({ ...form, low_stock_alert: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, background: 'var(--primary-orange)', color: '#fff', border: 'none' }}
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: EDIT INVENTORY ITEM
          ==================================================================== */}
      {editModalOpen && editingItem && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit size={20} color="var(--primary-orange)" />
                <span>Edit Inventory Item</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEditModalOpen(false);
                  setEditingItem(null);
                }}
                className="modal-close-btn"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="form-group">
                <label className="form-label">
                  Item Name <span className="required-mark">*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={editingItem.name}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <input
                    type="text"
                    list="category-suggestions-edit"
                    className="form-input"
                    value={editingItem.category}
                    onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                  />
                  <datalist id="category-suggestions-edit">
                    {categories.map((c, i) => (
                      <option key={i} value={c} />
                    ))}
                  </datalist>
                </div>

                <div className="form-group">
                  <label className="form-label">Unit</label>
                  <select
                    className="form-input"
                    value={editingItem.unit}
                    onChange={(e) => setEditingItem({ ...editingItem, unit: e.target.value })}
                  >
                    <option value="pieces">pieces</option>
                    <option value="kg">kg</option>
                    <option value="grams">grams</option>
                    <option value="liters">liters</option>
                    <option value="ml">ml</option>
                    <option value="packs">packs</option>
                    <option value="boxes">boxes</option>
                    <option value="cans">cans</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.85rem' }}>
                <div className="form-group">
                  <label className="form-label">Price ({currency})</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    value={editingItem.price}
                    onChange={(e) => setEditingItem({ ...editingItem, price: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Current Stock</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    value={editingItem.current_stock}
                    onChange={(e) => setEditingItem({ ...editingItem, current_stock: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Low Stock Alert</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    value={editingItem.low_stock_alert}
                    onChange={(e) => setEditingItem({ ...editingItem, low_stock_alert: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setEditModalOpen(false);
                    setEditingItem(null);
                  }}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, background: 'var(--primary-orange)', color: '#fff', border: 'none' }}
                >
                  Update Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
