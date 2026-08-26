import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit, 
  X, 
  UtensilsCrossed, 
  Pizza, 
  FolderPlus, 
  AlertCircle, 
  Check, 
  Sparkles,
  Layers,
  Search
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DEFAULT_CURRENCY } from '../utils/currency';

export default function MenuManagement() {
  const { organization } = useAuth();
  const currency = organization?.currency || DEFAULT_CURRENCY;

  // State
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Category creation input
  const [newCatName, setNewCatName] = useState('');
  const [catSubmitting, setCatSubmitting] = useState(false);

  // Modals state
  const [pizzaModalOpen, setPizzaModalOpen] = useState(false);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Form State: Add Pizza
  const [pizzaForm, setPizzaForm] = useState({
    name: '',
    categoryId: '',
    description: '',
    sizes: [{ size_label: 'Small', price: '' }],
  });

  // Form State: Add Standard Item
  const [itemForm, setItemForm] = useState({
    name: '',
    categoryId: '',
    price: '',
    description: '',
  });

  // Search / Filter
  const [searchTerm, setSearchTerm] = useState('');

  // Flash message auto-dismiss
  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Fetch Categories & Menu Items with Prices
  const loadMenuData = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    setError(null);

    try {
      if (isSupabaseConfigured() && supabase) {
        // 1. Fetch Categories
        const { data: catData, error: catErr } = await supabase
          .from('menu_categories')
          .select('*')
          .eq('organization_id', organization.id)
          .order('created_at', { ascending: true });

        if (catErr) throw catErr;

        // 2. Fetch Menu Items with Prices
        const { data: itemData, error: itemErr } = await supabase
          .from('menu_items')
          .select(`
            id,
            organization_id,
            category_id,
            name,
            description,
            type,
            created_at,
            menu_item_prices (
              id,
              size_label,
              price
            )
          `)
          .eq('organization_id', organization.id)
          .order('created_at', { ascending: true });

        if (itemErr) throw itemErr;

        setCategories(catData || []);
        setMenuItems(itemData || []);
      } else {
        // Sandbox fallback
        const localData = JSON.parse(localStorage.getItem('restaurant_pos_menu_data') || '{"categories":[],"items":[]}');
        setCategories(localData.categories || []);
        setMenuItems(localData.items || []);
      }
    } catch (err) {
      console.error('Error loading menu data:', err);
      setError(err.message || 'Failed to load menu data.');
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

  useEffect(() => {
    loadMenuData();
  }, [loadMenuData]);

  // 1. Add Category
  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim() || !organization?.id) return;

    setCatSubmitting(true);
    try {
      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
          .from('menu_categories')
          .insert({
            organization_id: organization.id,
            name: newCatName.trim(),
          })
          .select()
          .single();

        if (error) throw error;
        setCategories((prev) => [...prev, data]);
      } else {
        const newCat = {
          id: 'cat_' + Math.random().toString(36).substring(2, 9),
          organization_id: organization.id,
          name: newCatName.trim(),
          created_at: new Date().toISOString(),
        };
        const localData = JSON.parse(localStorage.getItem('restaurant_pos_menu_data') || '{"categories":[],"items":[]}');
        localData.categories = [...(localData.categories || []), newCat];
        localStorage.setItem('restaurant_pos_menu_data', JSON.stringify(localData));
        setCategories(localData.categories);
      }

      setNewCatName('');
      showSuccess(`Category "${newCatName.trim()}" added!`);
    } catch (err) {
      setError(err.message || 'Failed to add category.');
    } finally {
      setCatSubmitting(false);
    }
  };

  // Delete Category
  const handleDeleteCategory = async (catId, catName) => {
    const itemsInCat = menuItems.filter((i) => i.category_id === catId);
    if (itemsInCat.length > 0) {
      const confirmDelete = window.confirm(
        `Category "${catName}" contains ${itemsInCat.length} menu items. Deleting this category will unassign these items. Are you sure?`
      );
      if (!confirmDelete) return;
    } else {
      if (!window.confirm(`Delete category "${catName}"?`)) return;
    }

    try {
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase
          .from('menu_categories')
          .delete()
          .eq('id', catId);
        if (error) throw error;
      } else {
        const localData = JSON.parse(localStorage.getItem('restaurant_pos_menu_data') || '{"categories":[],"items":[]}');
        localData.categories = localData.categories.filter((c) => c.id !== catId);
        localStorage.setItem('restaurant_pos_menu_data', JSON.stringify(localData));
      }
      setCategories((prev) => prev.filter((c) => c.id !== catId));
      setMenuItems((prev) => prev.map((i) => i.category_id === catId ? { ...i, category_id: null } : i));
      showSuccess(`Category "${catName}" removed.`);
    } catch (err) {
      setError(err.message || 'Failed to delete category.');
    }
  };

  // 2. Add Pizza
  const handleAddPizzaSize = () => {
    setPizzaForm((prev) => ({
      ...prev,
      sizes: [...prev.sizes, { size_label: '', price: '' }],
    }));
  };

  const handleRemovePizzaSize = (index) => {
    if (pizzaForm.sizes.length <= 1) return;
    setPizzaForm((prev) => ({
      ...prev,
      sizes: prev.sizes.filter((_, idx) => idx !== index),
    }));
  };

  const handlePizzaSizeChange = (index, field, value) => {
    setPizzaForm((prev) => {
      const updatedSizes = [...prev.sizes];
      updatedSizes[index][field] = value;
      return { ...prev, sizes: updatedSizes };
    });
  };

  const handleSavePizza = async (e) => {
    e.preventDefault();
    if (!pizzaForm.name.trim() || !organization?.id) {
      setError('Please provide a pizza name.');
      return;
    }

    const validSizes = pizzaForm.sizes.filter(
      (s) => s.size_label.trim() && !isNaN(parseFloat(s.price)) && parseFloat(s.price) > 0
    );

    if (validSizes.length === 0) {
      setError('Please add at least one valid size with a positive price.');
      return;
    }

    try {
      if (isSupabaseConfigured() && supabase) {
        // Create menu_item
        const { data: itemData, error: itemErr } = await supabase
          .from('menu_items')
          .insert({
            organization_id: organization.id,
            category_id: pizzaForm.categoryId || null,
            name: pizzaForm.name.trim(),
            description: pizzaForm.description.trim() || null,
            type: 'pizza',
          })
          .select()
          .single();

        if (itemErr) throw itemErr;

        // Insert prices
        const priceRows = validSizes.map((s) => ({
          menu_item_id: itemData.id,
          size_label: s.size_label.trim(),
          price: parseFloat(s.price),
        }));

        const { data: priceData, error: priceErr } = await supabase
          .from('menu_item_prices')
          .insert(priceRows)
          .select();

        if (priceErr) throw priceErr;

        setMenuItems((prev) => [
          ...prev,
          { ...itemData, menu_item_prices: priceData },
        ]);
      } else {
        const itemId = 'item_' + Math.random().toString(36).substring(2, 9);
        const newItem = {
          id: itemId,
          organization_id: organization.id,
          category_id: pizzaForm.categoryId || null,
          name: pizzaForm.name.trim(),
          description: pizzaForm.description.trim() || null,
          type: 'pizza',
          created_at: new Date().toISOString(),
          menu_item_prices: validSizes.map((s) => ({
            id: 'price_' + Math.random().toString(36).substring(2, 9),
            menu_item_id: itemId,
            size_label: s.size_label.trim(),
            price: parseFloat(s.price),
          })),
        };
        const localData = JSON.parse(localStorage.getItem('restaurant_pos_menu_data') || '{"categories":[],"items":[]}');
        localData.items = [...(localData.items || []), newItem];
        localStorage.setItem('restaurant_pos_menu_data', JSON.stringify(localData));
        setMenuItems(localData.items);
      }

      setPizzaForm({
        name: '',
        categoryId: '',
        description: '',
        sizes: [{ size_label: 'Small', price: '' }],
      });
      setPizzaModalOpen(false);
      showSuccess(`Pizza "${pizzaForm.name.trim()}" added successfully!`);
    } catch (err) {
      setError(err.message || 'Failed to save pizza.');
    }
  };

  // 3. Add Standard Item
  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!itemForm.name.trim() || !organization?.id) {
      setError('Please provide an item name.');
      return;
    }
    if (!itemForm.price || isNaN(parseFloat(itemForm.price)) || parseFloat(itemForm.price) <= 0) {
      setError('Please provide a valid price (PKR).');
      return;
    }

    try {
      if (isSupabaseConfigured() && supabase) {
        // Create menu_item
        const { data: itemData, error: itemErr } = await supabase
          .from('menu_items')
          .insert({
            organization_id: organization.id,
            category_id: itemForm.categoryId || null,
            name: itemForm.name.trim(),
            description: itemForm.description.trim() || null,
            type: 'standard',
          })
          .select()
          .single();

        if (itemErr) throw itemErr;

        // Insert single Regular price
        const { data: priceData, error: priceErr } = await supabase
          .from('menu_item_prices')
          .insert({
            menu_item_id: itemData.id,
            size_label: 'Regular',
            price: parseFloat(itemForm.price),
          })
          .select();

        if (priceErr) throw priceErr;

        setMenuItems((prev) => [
          ...prev,
          { ...itemData, menu_item_prices: priceData },
        ]);
      } else {
        const itemId = 'item_' + Math.random().toString(36).substring(2, 9);
        const newItem = {
          id: itemId,
          organization_id: organization.id,
          category_id: itemForm.categoryId || null,
          name: itemForm.name.trim(),
          description: itemForm.description.trim() || null,
          type: 'standard',
          created_at: new Date().toISOString(),
          menu_item_prices: [
            {
              id: 'price_' + Math.random().toString(36).substring(2, 9),
              menu_item_id: itemId,
              size_label: 'Regular',
              price: parseFloat(itemForm.price),
            },
          ],
        };
        const localData = JSON.parse(localStorage.getItem('restaurant_pos_menu_data') || '{"categories":[],"items":[]}');
        localData.items = [...(localData.items || []), newItem];
        localStorage.setItem('restaurant_pos_menu_data', JSON.stringify(localData));
        setMenuItems(localData.items);
      }

      setItemForm({ name: '', categoryId: '', price: '', description: '' });
      setItemModalOpen(false);
      showSuccess(`Item "${itemForm.name.trim()}" added successfully!`);
    } catch (err) {
      setError(err.message || 'Failed to save item.');
    }
  };

  // 4. Delete Menu Item
  const handleDeleteItem = async (itemId, itemName) => {
    if (!window.confirm(`Are you sure you want to delete "${itemName}"?`)) return;

    try {
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase.from('menu_items').delete().eq('id', itemId);
        if (error) throw error;
      } else {
        const localData = JSON.parse(localStorage.getItem('restaurant_pos_menu_data') || '{"categories":[],"items":[]}');
        localData.items = localData.items.filter((i) => i.id !== itemId);
        localStorage.setItem('restaurant_pos_menu_data', JSON.stringify(localData));
      }
      setMenuItems((prev) => prev.filter((i) => i.id !== itemId));
      showSuccess(`"${itemName}" deleted.`);
    } catch (err) {
      setError(err.message || 'Failed to delete item.');
    }
  };

  // 5. Open Edit Modal
  const handleOpenEdit = (item) => {
    const sizes = item.menu_item_prices && item.menu_item_prices.length > 0
      ? item.menu_item_prices.map((p) => ({ size_label: p.size_label, price: p.price.toString() }))
      : [{ size_label: 'Regular', price: '0' }];

    setEditingItem({
      id: item.id,
      name: item.name,
      categoryId: item.category_id || '',
      description: item.description || '',
      type: item.type,
      sizes: sizes,
    });
    setEditModalOpen(true);
  };

  // Save Edit
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingItem || !editingItem.name.trim()) return;

    const validSizes = editingItem.sizes.filter(
      (s) => s.size_label.trim() && !isNaN(parseFloat(s.price)) && parseFloat(s.price) > 0
    );

    if (validSizes.length === 0) {
      setError('Please provide at least one valid price.');
      return;
    }

    try {
      if (isSupabaseConfigured() && supabase) {
        // Update menu_item
        const { error: itemErr } = await supabase
          .from('menu_items')
          .update({
            name: editingItem.name.trim(),
            category_id: editingItem.categoryId || null,
            description: editingItem.description.trim() || null,
          })
          .eq('id', editingItem.id);

        if (itemErr) throw itemErr;

        // Delete old prices & re-insert to avoid orphaned records
        await supabase.from('menu_item_prices').delete().eq('menu_item_id', editingItem.id);

        const newPriceRows = validSizes.map((s) => ({
          menu_item_id: editingItem.id,
          size_label: s.size_label.trim(),
          price: parseFloat(s.price),
        }));

        const { data: newPrices, error: priceErr } = await supabase
          .from('menu_item_prices')
          .insert(newPriceRows)
          .select();

        if (priceErr) throw priceErr;

        setMenuItems((prev) =>
          prev.map((i) =>
            i.id === editingItem.id
              ? {
                  ...i,
                  name: editingItem.name.trim(),
                  category_id: editingItem.categoryId || null,
                  description: editingItem.description.trim() || null,
                  menu_item_prices: newPrices,
                }
              : i
          )
        );
      } else {
        const localData = JSON.parse(localStorage.getItem('restaurant_pos_menu_data') || '{"categories":[],"items":[]}');
        const updatedItems = localData.items.map((i) => {
          if (i.id === editingItem.id) {
            return {
              ...i,
              name: editingItem.name.trim(),
              category_id: editingItem.categoryId || null,
              description: editingItem.description.trim() || null,
              menu_item_prices: validSizes.map((s) => ({
                id: 'price_' + Math.random().toString(36).substring(2, 9),
                menu_item_id: i.id,
                size_label: s.size_label.trim(),
                price: parseFloat(s.price),
              })),
            };
          }
          return i;
        });
        localData.items = updatedItems;
        localStorage.setItem('restaurant_pos_menu_data', JSON.stringify(localData));
        setMenuItems(updatedItems);
      }

      setEditModalOpen(false);
      setEditingItem(null);
      showSuccess(`"${editingItem.name.trim()}" updated successfully!`);
    } catch (err) {
      setError(err.message || 'Failed to update item.');
    }
  };

  // Helper to format price or price range
  const formatItemPrice = (item) => {
    const prices = item.menu_item_prices || [];
    if (prices.length === 0) return `${currency} 0.00`;
    if (prices.length === 1) {
      return `${currency} ${parseFloat(prices[0].price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    const numPrices = prices.map((p) => parseFloat(p.price));
    const minPrice = Math.min(...numPrices);
    const maxPrice = Math.max(...numPrices);
    return `${currency} ${minPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })} - ${maxPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  // Group items by category
  const filteredItems = menuItems.filter((i) =>
    i.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const uncategorizedItems = filteredItems.filter((i) => !i.category_id);

  return (
    <div className="menu-page">
      {/* Header & Quick Action Buttons */}
      <div className="menu-header-actions">
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-dark-bold)', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <UtensilsCrossed size={28} color="var(--primary-orange)" />
            <span>Menu Management</span>
          </h1>
          <p style={{ color: 'var(--text-gray-muted)', fontSize: '0.9rem' }}>
            Manage food categories, multi-size pizzas, standard items, and pricing.
          </p>
        </div>

        <div className="menu-actions-group">
          <button
            type="button"
            onClick={() => setPizzaModalOpen(true)}
            className="btn btn-primary"
            style={{ background: 'var(--primary-orange)', borderColor: 'var(--primary-orange)', color: '#fff' }}
          >
            <Pizza size={18} />
            <span>+ Add Pizza</span>
          </button>

          <button
            type="button"
            onClick={() => setItemModalOpen(true)}
            className="btn btn-secondary"
            style={{ background: '#fff', color: 'var(--text-dark-bold)', border: '1px solid #cbd5e1' }}
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

      {/* 1. Categories Management Section */}
      <section className="categories-box">
        <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-dark-bold)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FolderPlus size={18} color="var(--primary-orange)" />
          <span>Menu Categories</span>
        </h2>

        <form onSubmit={handleAddCategory} className="categories-input-row">
          <input
            type="text"
            className="form-input"
            placeholder="New Category Name (e.g. Traditional Pizzas, Starters, Beverages)..."
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            style={{ background: '#f8fafc', color: 'var(--text-dark-bold)' }}
          />
          <button
            type="submit"
            disabled={catSubmitting || !newCatName.trim()}
            className="btn btn-primary"
            style={{ background: 'var(--primary-orange)', color: '#fff', border: 'none' }}
          >
            <span>Add Category</span>
          </button>
        </form>

        <div className="categories-chips">
          {categories.length === 0 ? (
            <span style={{ color: 'var(--text-gray-muted)', fontSize: '0.85rem' }}>
              No categories created yet. Add one above to organize your menu.
            </span>
          ) : (
            categories.map((cat) => {
              const count = menuItems.filter((i) => i.category_id === cat.id).length;
              return (
                <div key={cat.id} className="category-chip">
                  <span>{cat.name}</span>
                  <span style={{ fontSize: '0.725rem', color: '#64748b', background: '#e2e8f0', padding: '0.1rem 0.4rem', borderRadius: '10px' }}>
                    {count}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(cat.id, cat.name)}
                    className="category-chip-delete"
                    title={`Delete category ${cat.name}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* 2. Menu Items Search & Catalog */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={20} color="var(--primary-orange)" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-dark-bold)', margin: 0 }}>
              Menu Catalog ({menuItems.length} items)
            </h2>
          </div>

          <div style={{ width: '260px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search items by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ background: '#fff', color: 'var(--text-dark-bold)' }}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-gray-muted)' }}>
            Loading menu items...
          </div>
        ) : menuItems.length === 0 ? (
          <div className="card" style={{ background: '#fff', textAlign: 'center', padding: '3rem', border: '2px dashed #cbd5e1' }}>
            <UtensilsCrossed size={40} color="#cbd5e1" style={{ margin: '0 auto 1rem auto' }} />
            <h3 style={{ fontSize: '1.15rem', color: 'var(--text-dark-bold)', marginBottom: '0.5rem' }}>
              Your Menu is Empty
            </h3>
            <p style={{ color: 'var(--text-gray-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Add a multi-size pizza or standard item using the buttons above to build your POS catalog.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setPizzaModalOpen(true)}
                className="btn btn-primary"
                style={{ background: 'var(--primary-orange)', color: '#fff', border: 'none' }}
              >
                <Pizza size={16} />
                <span>Add First Pizza</span>
              </button>
              <button
                type="button"
                onClick={() => setItemModalOpen(true)}
                className="btn btn-secondary"
                style={{ background: '#fff', color: 'var(--text-dark-bold)', border: '1px solid #cbd5e1' }}
              >
                <Plus size={16} />
                <span>Add Standard Item</span>
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Render Categories */}
            {categories.map((cat) => {
              const catItems = filteredItems.filter((i) => i.category_id === cat.id);
              if (catItems.length === 0 && searchTerm) return null;

              return (
                <div key={cat.id} className="menu-category-section">
                  <div className="menu-category-title">
                    <span>{cat.name}</span>
                    <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                      ({catItems.length} {catItems.length === 1 ? 'item' : 'items'})
                    </span>
                  </div>

                  {catItems.length === 0 ? (
                    <div style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.85rem', padding: '0.5rem 0' }}>
                      No items in this category yet.
                    </div>
                  ) : (
                    <div className="menu-cards-grid">
                      {catItems.map((item) => (
                        <div key={item.id} className="menu-item-card">
                          <div>
                            <div className="menu-item-card-top">
                              <h3 className="menu-item-name">{item.name}</h3>
                              <span className={`menu-item-badge ${item.type === 'pizza' ? 'badge-pizza' : 'badge-standard'}`}>
                                {item.type === 'pizza' ? '🍕 Pizza' : 'Standard'}
                              </span>
                            </div>

                            {item.description && (
                              <p className="menu-item-desc">{item.description}</p>
                            )}

                            {/* Sizes Pill list for Pizza */}
                            {item.type === 'pizza' && item.menu_item_prices && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.75rem' }}>
                                {item.menu_item_prices.map((p, idx) => (
                                  <span
                                    key={idx}
                                    style={{
                                      fontSize: '0.725rem',
                                      background: '#f8fafc',
                                      border: '1px solid #e2e8f0',
                                      padding: '0.15rem 0.45rem',
                                      borderRadius: '4px',
                                      color: '#334155',
                                      fontWeight: 600
                                    }}
                                  >
                                    {p.size_label}: {currency} {parseFloat(p.price).toLocaleString()}
                                  </span>
                                ))}
                              </div>
                            )}

                            <div className="menu-item-price-tag">{formatItemPrice(item)}</div>
                          </div>

                          <div className="menu-item-card-footer">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(item)}
                              className="btn btn-ghost"
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', color: '#475569' }}
                            >
                              <Edit size={14} />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id, item.name)}
                              className="btn btn-ghost"
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', color: 'var(--danger-red)' }}
                            >
                              <Trash2 size={14} />
                              <span>Delete</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Uncategorized Items */}
            {uncategorizedItems.length > 0 && (
              <div className="menu-category-section">
                <div className="menu-category-title">
                  <span>Other / Uncategorized</span>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                    ({uncategorizedItems.length})
                  </span>
                </div>

                <div className="menu-cards-grid">
                  {uncategorizedItems.map((item) => (
                    <div key={item.id} className="menu-item-card">
                      <div>
                        <div className="menu-item-card-top">
                          <h3 className="menu-item-name">{item.name}</h3>
                          <span className={`menu-item-badge ${item.type === 'pizza' ? 'badge-pizza' : 'badge-standard'}`}>
                            {item.type === 'pizza' ? '🍕 Pizza' : 'Standard'}
                          </span>
                        </div>

                        {item.description && (
                          <p className="menu-item-desc">{item.description}</p>
                        )}

                        <div className="menu-item-price-tag">{formatItemPrice(item)}</div>
                      </div>

                      <div className="menu-item-card-footer">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          className="btn btn-ghost"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', color: '#475569' }}
                        >
                          <Edit size={14} />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id, item.name)}
                          className="btn btn-ghost"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', color: 'var(--danger-red)' }}
                        >
                          <Trash2 size={14} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ====================================================================
          MODAL: ADD PIZZA
          ==================================================================== */}
      {pizzaModalOpen && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Pizza size={22} color="var(--primary-orange)" />
                <span>Add New Pizza</span>
              </h3>
              <button
                type="button"
                onClick={() => setPizzaModalOpen(false)}
                className="modal-close-btn"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSavePizza}>
              <div className="form-group">
                <label className="form-label" style={{ color: 'var(--text-dark-bold)' }}>
                  Pizza Name <span className="required-mark">*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Chicken Fajita Pizza, Margherita Supreme"
                  value={pizzaForm.name}
                  onChange={(e) => setPizzaForm({ ...pizzaForm, name: e.target.value })}
                  style={{ background: '#f8fafc', color: 'var(--text-dark-bold)' }}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ color: 'var(--text-dark-bold)' }}>
                  Category
                </label>
                <select
                  className="form-input"
                  value={pizzaForm.categoryId}
                  onChange={(e) => setPizzaForm({ ...pizzaForm, categoryId: e.target.value })}
                  style={{ background: '#f8fafc', color: 'var(--text-dark-bold)' }}
                >
                  <option value="">-- Select Category --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ color: 'var(--text-dark-bold)' }}>
                  Description (Optional)
                </label>
                <textarea
                  className="form-input"
                  rows="2"
                  placeholder="Special tomato sauce, mozzarella, bell peppers, grilled chicken..."
                  value={pizzaForm.description}
                  onChange={(e) => setPizzaForm({ ...pizzaForm, description: e.target.value })}
                  style={{ background: '#f8fafc', color: 'var(--text-dark-bold)', resize: 'vertical' }}
                />
              </div>

              {/* Dynamic Sizes & Prices */}
              <div style={{ marginTop: '1.25rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                  <label className="form-label" style={{ color: 'var(--text-dark-bold)', margin: 0 }}>
                    Sizes &amp; Prices ({currency}) <span className="required-mark">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddPizzaSize}
                    className="btn btn-ghost"
                    style={{ fontSize: '0.775rem', padding: '0.2rem 0.5rem', color: 'var(--primary-orange)', fontWeight: 700 }}
                  >
                    + Add Size
                  </button>
                </div>

                {pizzaForm.sizes.map((s, idx) => (
                  <div key={idx} className="size-row">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Size (e.g. Small, Medium, Large)"
                      value={s.size_label}
                      onChange={(e) => handlePizzaSizeChange(idx, 'size_label', e.target.value)}
                      style={{ background: '#f8fafc', color: 'var(--text-dark-bold)', fontSize: '0.85rem' }}
                      required
                    />
                    <input
                      type="number"
                      step="any"
                      className="form-input"
                      placeholder={`Price (${currency})`}
                      value={s.price}
                      onChange={(e) => handlePizzaSizeChange(idx, 'price', e.target.value)}
                      style={{ background: '#f8fafc', color: 'var(--text-dark-bold)', fontSize: '0.85rem' }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePizzaSize(idx)}
                      disabled={pizzaForm.sizes.length <= 1}
                      className="btn btn-ghost"
                      style={{ padding: '0.4rem', color: pizzaForm.sizes.length <= 1 ? '#cbd5e1' : 'var(--danger-red)' }}
                      title="Remove size"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setPizzaModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1, background: '#f1f5f9', color: 'var(--text-dark-bold)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, background: 'var(--primary-orange)', color: '#fff', border: 'none' }}
                >
                  Save Pizza
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: ADD STANDARD ITEM
          ==================================================================== */}
      {itemModalOpen && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={22} color="var(--primary-orange)" />
                <span>Add Standard Item</span>
              </h3>
              <button
                type="button"
                onClick={() => setItemModalOpen(false)}
                className="modal-close-btn"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveItem}>
              <div className="form-group">
                <label className="form-label" style={{ color: 'var(--text-dark-bold)' }}>
                  Item Name <span className="required-mark">*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Garlic Bread, Chicken Burger, Mint Lemonade"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  style={{ background: '#f8fafc', color: 'var(--text-dark-bold)' }}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ color: 'var(--text-dark-bold)' }}>
                  Price ({currency}) <span className="required-mark">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  className="form-input"
                  placeholder={`e.g. 450`}
                  value={itemForm.price}
                  onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
                  style={{ background: '#f8fafc', color: 'var(--text-dark-bold)' }}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ color: 'var(--text-dark-bold)' }}>
                  Category
                </label>
                <select
                  className="form-input"
                  value={itemForm.categoryId}
                  onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })}
                  style={{ background: '#f8fafc', color: 'var(--text-dark-bold)' }}
                >
                  <option value="">-- Select Category --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ color: 'var(--text-dark-bold)' }}>
                  Description (Optional)
                </label>
                <textarea
                  className="form-input"
                  rows="2"
                  placeholder="Freshly toasted baguette with garlic herb butter..."
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  style={{ background: '#f8fafc', color: 'var(--text-dark-bold)', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setItemModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1, background: '#f1f5f9', color: 'var(--text-dark-bold)' }}
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
          MODAL: EDIT ITEM / PIZZA
          ==================================================================== */}
      {editModalOpen && editingItem && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit size={20} color="var(--primary-orange)" />
                <span>Edit {editingItem.type === 'pizza' ? 'Pizza' : 'Item'}</span>
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
                <label className="form-label" style={{ color: 'var(--text-dark-bold)' }}>
                  Name <span className="required-mark">*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={editingItem.name}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  style={{ background: '#f8fafc', color: 'var(--text-dark-bold)' }}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ color: 'var(--text-dark-bold)' }}>
                  Category
                </label>
                <select
                  className="form-input"
                  value={editingItem.categoryId}
                  onChange={(e) => setEditingItem({ ...editingItem, categoryId: e.target.value })}
                  style={{ background: '#f8fafc', color: 'var(--text-dark-bold)' }}
                >
                  <option value="">-- Select Category --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ color: 'var(--text-dark-bold)' }}>
                  Description
                </label>
                <textarea
                  className="form-input"
                  rows="2"
                  value={editingItem.description}
                  onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                  style={{ background: '#f8fafc', color: 'var(--text-dark-bold)', resize: 'vertical' }}
                />
              </div>

              {/* Sizes / Price Editing */}
              <div style={{ marginTop: '1.25rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                  <label className="form-label" style={{ color: 'var(--text-dark-bold)', margin: 0 }}>
                    {editingItem.type === 'pizza' ? `Sizes & Prices (${currency})` : `Price (${currency})`}
                  </label>
                  {editingItem.type === 'pizza' && (
                    <button
                      type="button"
                      onClick={() =>
                        setEditingItem({
                          ...editingItem,
                          sizes: [...editingItem.sizes, { size_label: '', price: '' }],
                        })
                      }
                      className="btn btn-ghost"
                      style={{ fontSize: '0.775rem', padding: '0.2rem 0.5rem', color: 'var(--primary-orange)', fontWeight: 700 }}
                    >
                      + Add Size
                    </button>
                  )}
                </div>

                {editingItem.sizes.map((s, idx) => (
                  <div key={idx} className="size-row">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Size label"
                      value={s.size_label}
                      onChange={(e) => {
                        const updated = [...editingItem.sizes];
                        updated[idx].size_label = e.target.value;
                        setEditingItem({ ...editingItem, sizes: updated });
                      }}
                      style={{ background: '#f8fafc', color: 'var(--text-dark-bold)', fontSize: '0.85rem' }}
                      required
                    />
                    <input
                      type="number"
                      step="any"
                      className="form-input"
                      placeholder="Price"
                      value={s.price}
                      onChange={(e) => {
                        const updated = [...editingItem.sizes];
                        updated[idx].price = e.target.value;
                        setEditingItem({ ...editingItem, sizes: updated });
                      }}
                      style={{ background: '#f8fafc', color: 'var(--text-dark-bold)', fontSize: '0.85rem' }}
                      required
                    />
                    {editingItem.type === 'pizza' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (editingItem.sizes.length <= 1) return;
                          setEditingItem({
                            ...editingItem,
                            sizes: editingItem.sizes.filter((_, i) => i !== idx),
                          });
                        }}
                        disabled={editingItem.sizes.length <= 1}
                        className="btn btn-ghost"
                        style={{ padding: '0.4rem', color: editingItem.sizes.length <= 1 ? '#cbd5e1' : 'var(--danger-red)' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setEditModalOpen(false);
                    setEditingItem(null);
                  }}
                  className="btn btn-secondary"
                  style={{ flex: 1, background: '#f1f5f9', color: 'var(--text-dark-bold)' }}
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
