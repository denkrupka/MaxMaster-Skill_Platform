import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus, Search, ShoppingCart, Package, Truck, Warehouse, Loader2,
  CheckCircle, Clock, AlertCircle, XCircle, AlertTriangle,
  FileText, DollarSign, Calendar, Building2, Eye,
  X, Save, Pencil, Trash2, ChevronDown, ChevronRight, BarChart3,
  ArrowUpRight, ArrowDownRight, Send, TrendingDown
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import {
  Project, ResourceRequest, Order, Stock, StockBalance,
  ResourceRequestStatus, OrderStatus, Contractor
} from '../../types';
import {
  RESOURCE_REQUEST_STATUS_LABELS, RESOURCE_REQUEST_STATUS_COLORS,
  ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, RESOURCE_TYPE_LABELS
} from '../../constants';

type TabType = 'requests' | 'orders' | 'stock' | 'dashboard';

export const ProcurementPage: React.FC = () => {
  const { state } = useAppContext();
  const { currentUser } = state;

  const [activeTab, setActiveTab] = useState<TabType>('requests');
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [stockBalances, setStockBalances] = useState<StockBalance[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [editingRequest, setEditingRequest] = useState<ResourceRequest | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editingStock, setEditingStock] = useState<Stock | null>(null);
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);

  // Zamówione modal
  const [showZamowioneModal, setShowZamowioneModal] = useState(false);
  const [zamowioneRequest, setZamowioneRequest] = useState<ResourceRequest | null>(null);
  const [zamowioneForm, setZamowioneForm] = useState({
    contractor_id: '', total: 0, expected_delivery: '', notes: ''
  });

  const [saving, setSaving] = useState(false);

  // Request form
  const [requestForm, setRequestForm] = useState({
    project_id: '', name: '', description: '',
    resource_type: 'material' as string,
    volume_required: 1, needed_at: '',
    priority: 'medium' as string
  });

  // Order form
  const [orderForm, setOrderForm] = useState({
    project_id: '', contractor_id: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery: '', total: 0, nds_percent: 0, notes: ''
  });

  // Stock/Receipt form
  const [stockForm, setStockForm] = useState({ name: '', address: '', description: '' });
  const [receiptForm, setReceiptForm] = useState({
    order_id: '', stock_id: '', quantity: 1, item_name: '', unit_price: 0
  });


  // Move request to W realizacji (partial)
  const handleMoveToRealizacja = async (req: ResourceRequest) => {
    await supabase.from('resource_requests').update({ status: 'partial' }).eq('id', req.id);
    await loadData();
  };

  // Open Zamówione modal
  const handleOpenZamowione = (req: ResourceRequest) => {
    setZamowioneRequest(req);
    setZamowioneForm({ contractor_id: '', total: 0, expected_delivery: '', notes: '' });
    setShowZamowioneModal(true);
  };

  // Confirm Zamówione - create order record
  const handleConfirmZamowione = async () => {
    if (!currentUser || !zamowioneRequest) return;
    setSaving(true);
    try {
      await supabase.from('resource_requests').update({ status: 'ordered' }).eq('id', zamowioneRequest.id);
      const orderNum = `ZAM/${new Date().getFullYear()}/${String(Date.now()).slice(-6)}`;
      await supabase.from('orders').insert({
        company_id: currentUser.company_id,
        project_id: zamowioneRequest.project_id,
        contractor_id: zamowioneForm.contractor_id || null,
        number: orderNum,
        order_date: new Date().toISOString().split('T')[0],
        expected_delivery: zamowioneForm.expected_delivery || null,
        expected_date: zamowioneForm.expected_delivery || null,
        subtotal: zamowioneForm.total,
        nds_percent: 0,
        status: 'sent' as OrderStatus,
        notes: zamowioneForm.notes || `Zamówienie z zapotrzebowania: ${zamowioneRequest.title || zamowioneRequest.name}`,
        created_by_id: currentUser.id
      });
      setShowZamowioneModal(false);
      setZamowioneRequest(null);
      await loadData();
    } catch (err) {
      console.error('Error confirming order:', err);
    } finally {
      setSaving(false);
    }
  };

  // Mark request as Dostarczone and auto-replenish stock
  const handleMarkReceivedRequest = async (req: ResourceRequest) => {
    if (!currentUser) return;
    setSaving(true);
    try {
      await supabase.from('resource_requests').update({ status: 'received' }).eq('id', req.id);
      if (stocks.length > 0 && (req.volume_required || 0) > 0) {
        const stockId = stocks[0].id;
        const itemName = req.title || req.name || 'Nieznany materiał';
        const { data: existing } = await supabase.from('stock_balances')
          .select('id, quantity').eq('stock_id', stockId).eq('name', itemName).maybeSingle();
        if (existing) {
          await supabase.from('stock_balances').update({
            quantity: existing.quantity + (req.volume_required || 0)
          }).eq('id', existing.id);
        } else {
          await supabase.from('stock_balances').insert({
            stock_id: stockId, name: itemName,
            quantity: req.volume_required || 0, reserved_quantity: 0, unit_price: 0
          });
        }
      }
      await loadData();
    } catch (err) {
      console.error('Error marking received:', err);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (currentUser) loadData();
  }, [currentUser]);

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [requestsRes, ordersRes, stocksRes, balancesRes, projectsRes, contractorsRes] = await Promise.all([
        supabase.from('resource_requests')
          .select('*, project:projects(*)')
          .order('created_at', { ascending: false }),
        supabase.from('orders')
          .select('*, project:projects(*), contractor:contractors(*), items:order_items(*)')
          .eq('company_id', currentUser.company_id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase.from('stocks')
          .select('*')
          .eq('company_id', currentUser.company_id)
          .eq('is_active', true)
          .order('name'),
        supabase.from('stock_balances')
          .select('*, stock:stocks(*)')
          .order('name'),
        supabase.from('projects')
          .select('*')
          .eq('company_id', currentUser.company_id),
        supabase.from('contractors')
          .select('*')
          .eq('company_id', currentUser.company_id)
          .eq('contractor_type', 'supplier')
          .is('deleted_at', null)
      ]);

      if (requestsRes.data) setRequests(requestsRes.data.filter(r => {
        const project = (r as any).project;
        return project && project.company_id === currentUser.company_id;
      }));
      if (ordersRes.data) setOrders(ordersRes.data);
      if (stocksRes.data) setStocks(stocksRes.data);
      if (balancesRes.data) setStockBalances(balancesRes.data);
      if (projectsRes.data) setProjects(projectsRes.data);
      if (contractorsRes.data) setContractors(contractorsRes.data);
    } catch (err) {
      console.error('Error loading procurement data:', err);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const newRequests = requests.filter(r => r.status === 'new').length;
    const pendingOrders = orders.filter(o => ['draft', 'sent', 'confirmed'].includes(o.status)).length;
    const totalStockValue = stockBalances.reduce((s, b) => s + (b.total_value || 0), 0);
    const overBudgetItems = requests.filter(r => r.is_over_budget).length;
    const lowStockAlerts = stockBalances.filter(b => {
      const avail = b.available_quantity ?? b.quantity;
      return (b.min_quantity || 0) > 0 && avail <= (b.min_quantity || 0);
    }).length;

    return { newRequests, pendingOrders, totalStockValue, overBudgetItems, lowStockAlerts };
  }, [requests, orders, stockBalances]);

  const filteredRequests = useMemo(() => requests.filter(r => {
    const matchesProject = projectFilter === 'all' || r.project_id === projectFilter;
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesSearch = !search || (r.title || r.name || '').toLowerCase().includes(search.toLowerCase());
    return matchesProject && matchesStatus && matchesSearch;
  }), [requests, projectFilter, statusFilter, search]);

  const filteredOrders = useMemo(() => orders.filter(o => {
    const matchesProject = projectFilter === 'all' || o.project_id === projectFilter;
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    const matchesSearch = !search || (o.number || o.order_number || '').toLowerCase().includes(search.toLowerCase());
    return matchesProject && matchesStatus && matchesSearch;
  }), [orders, projectFilter, statusFilter, search]);

  const filteredBalances = useMemo(() => stockBalances.filter(b => {
    const matchesSearch = !search || (b.item_name || b.name || '').toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  }), [stockBalances, search]);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(v);
  const formatDate = (d: string) => new Date(d).toLocaleDateString('pl-PL');

  // Approve request → create order
  const handleApproveRequest = async (req: ResourceRequest) => {
    if (!currentUser) return;
    setSaving(true);
    try {
      // Update request status
      await supabase.from('resource_requests').update({ status: 'ordered' }).eq('id', req.id);

      // Auto-create an order draft
      const orderNum = `ZAM/${new Date().getFullYear()}/${String(Date.now()).slice(-6)}`;
      await supabase.from('orders').insert({
        company_id: currentUser.company_id,
        project_id: req.project_id,
        contractor_id: null,
        number: orderNum,
        order_date: new Date().toISOString().split('T')[0],
        subtotal: 0,
        nds_percent: 0,
        status: 'draft',
        notes: `Zamówienie z zapotrzebowania: ${req.title || req.name}`,
        created_by_id: currentUser.id
      });
      await loadData();
    } catch (err) {
      console.error('Error approving request:', err);
    } finally {
      setSaving(false);
    }
  };

  // Confirm delivery (create stock receipt)
  const handleConfirmDelivery = async (orderId: string) => {
    if (!currentUser) return;
    setSaving(true);
    try {
      await supabase.from('orders').update({ status: 'delivered', delivery_status: 'delivered' }).eq('id', orderId);

      const order = orders.find(o => o.id === orderId);
      if (order && stocks.length > 0) {
        const stockId = stocks[0].id;

        // Create stock operation (receipt)
        const { data: op } = await supabase.from('stock_operations').insert({
          company_id: currentUser.company_id,
          project_id: order.project_id,
          stock_id: stockId,
          operation_type: 'receipt',
          order_id: orderId,
          operation_date: new Date().toISOString().split('T')[0],
          document_number: order.number || order.order_number,
          created_by_id: currentUser.id
        }).select().single();

        if (op && order.items?.length) {
          for (const item of (order as any).items) {
            // Upsert stock balance
            const { data: existing } = await supabase.from('stock_balances')
              .select('id, quantity')
              .eq('stock_id', stockId)
              .eq('name', item.name)
              .single();

            if (existing) {
              await supabase.from('stock_balances').update({
                quantity: existing.quantity + item.volume
              }).eq('id', existing.id);
            } else {
              const { data: newBalance } = await supabase.from('stock_balances').insert({
                stock_id: stockId,
                name: item.name,
                quantity: item.volume,
                reserved_quantity: 0,
                unit_price: item.unit_price || 0
              }).select().single();

              if (newBalance && op) {
                await supabase.from('stock_operation_items').insert({
                  operation_id: op.id,
                  stock_balance_id: newBalance.id,
                  order_item_id: item.id,
                  name: item.name,
                  quantity: item.volume,
                  unit_price: item.unit_price || 0
                });
              }
            }
          }
        }
      }

      setConfirmingOrderId(null);
      await loadData();
    } catch (err) {
      console.error('Error confirming delivery:', err);
    } finally {
      setSaving(false);
    }
  };

  // Send order email
  const handleSendOrder = async (order: Order) => {
    const contractor = (order as any).contractor;
    if (!contractor?.email) {
      alert('Brak adresu email kontrahenta');
      return;
    }
    try {
      await supabase.functions.invoke('send-email', {
        body: {
          template: 'ORDER_SENT',
          to: contractor.email,
          data: {
            orderNumber: order.number || order.order_number,
            contractorName: contractor.name,
            total: formatCurrency(order.total || order.total_amount || 0),
            expectedDelivery: order.expected_delivery ? formatDate(order.expected_delivery) : 'Do ustalenia',
            portalUrl: window.location.origin
          }
        }
      });
      await supabase.from('orders').update({ status: 'sent' }).eq('id', order.id);
      await loadData();
    } catch (err) {
      console.error('Error sending order:', err);
    }
  };

  // AI stock alerts
  const aiAlerts = useMemo(() => {
    const alerts: { type: 'warning' | 'danger'; message: string }[] = [];

    // Low stock alerts
    stockBalances.forEach(b => {
      const avail = b.available_quantity ?? b.quantity;
      if ((b.min_quantity || 0) > 0 && avail <= (b.min_quantity || 0)) {
        alerts.push({
          type: 'danger',
          message: `Niski stan: ${b.item_name || b.name} — pozostało ${avail} ${b.unit || 'szt'}, minimum: ${b.min_quantity}`
        });
      }
    });

    // Over-budget requests
    requests.filter(r => r.is_over_budget).forEach(r => {
      alerts.push({
        type: 'warning',
        message: `Zapotrzebowanie "${r.title || r.name}" przekracza budżet kosztorysu!`
      });
    });

    return alerts;
  }, [stockBalances, requests]);


  // Dashboard data
  const dashboardData = useMemo(() => {
    const materialCounts: Record<string, { count: number; total: number; name: string }> = {};
    requests.forEach(req => {
      const name = req.title || req.name || 'Nieznany';
      if (!materialCounts[name]) materialCounts[name] = { count: 0, total: 0, name };
      materialCounts[name].count++;
      materialCounts[name].total += req.volume_required || 0;
    });
    const topMaterials = Object.values(materialCounts).sort((a, b) => b.count - a.count).slice(0, 8);
    const totalSpend = orders.filter(o => !['draft', 'cancelled'].includes(o.status))
      .reduce((s, o) => s + (o.total || o.total_amount || 0), 0);
    const pendingRequests = requests.filter(r => ['new', 'partial'].includes(r.status));
    const pendingValue = orders.filter(o => ['sent', 'confirmed', 'shipped'].includes(o.status))
      .reduce((s, o) => s + (o.total || o.total_amount || 0), 0);
    return { topMaterials, totalSpend, pendingRequests, pendingValue };
  }, [requests, orders]);

  // Per-request AI quantity alerts
  const requestAiAlerts = useMemo(() => {
    const alertMap: Record<string, string> = {};
    requests.forEach(req => {
      if (!['new', 'partial'].includes(req.status) || !req.volume_required) return;
      const sameItem = requests.filter(r =>
        r.id !== req.id && r.project_id === req.project_id &&
        (r.title || r.name || '').toLowerCase() === (req.title || req.name || '').toLowerCase() &&
        r.status !== 'cancelled'
      );
      const totalOrdered = sameItem.reduce((s, r) => s + (r.volume_required || 0), 0);
      if (totalOrdered > 0 && Math.abs(totalOrdered - req.volume_required) / req.volume_required > 0.15) {
        alertMap[req.id] = `Sprawdź ilość! Wcześniej zamówiono ${totalOrdered} szt tego materiału.`;
      }
    });
    return alertMap;
  }, [requests]);

  // Request CRUD
  const handleSaveRequest = async () => {
    if (!currentUser || !requestForm.name || !requestForm.project_id) return;
    setSaving(true);
    try {
      const data = {
        project_id: requestForm.project_id,
        title: requestForm.name,
        name: requestForm.name,
        description: requestForm.description,
        resource_type: requestForm.resource_type,
        volume_required: requestForm.volume_required,
        needed_at: requestForm.needed_at || null,
        priority: requestForm.priority,
        status: 'new' as ResourceRequestStatus,
        requested_by_id: currentUser.id,
        created_by_id: currentUser.id
      };
      if (editingRequest) {
        await supabase.from('resource_requests').update(data).eq('id', editingRequest.id);
      } else {
        await supabase.from('resource_requests').insert(data);
      }
      setShowRequestModal(false);
      setEditingRequest(null);
      resetRequestForm();
      await loadData();
    } catch (err) {
      console.error('Error saving request:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRequest = async (req: ResourceRequest) => {
    if (!confirm('Czy na pewno chcesz usunąć to zapotrzebowanie?')) return;
    await supabase.from('resource_requests').delete().eq('id', req.id);
    await loadData();
  };

  const resetRequestForm = () => setRequestForm({
    project_id: '', name: '', description: '', resource_type: 'material',
    volume_required: 1, needed_at: '', priority: 'medium'
  });

  // Order CRUD
  const handleSaveOrder = async () => {
    if (!currentUser || !orderForm.project_id || !orderForm.contractor_id) return;
    setSaving(true);
    try {
      const orderNum = editingOrder?.number || `ZAM/${new Date().getFullYear()}/${String(Date.now()).slice(-6)}`;
      const data = {
        company_id: currentUser.company_id,
        project_id: orderForm.project_id,
        contractor_id: orderForm.contractor_id,
        number: orderNum,
        order_date: orderForm.order_date,
        expected_date: orderForm.expected_delivery || null,
        subtotal: orderForm.total,
        nds_percent: orderForm.nds_percent,
        status: 'draft' as OrderStatus,
        notes: orderForm.notes || null,
        created_by_id: currentUser.id
      };
      if (editingOrder) {
        await supabase.from('orders').update(data).eq('id', editingOrder.id);
      } else {
        await supabase.from('orders').insert(data);
      }
      setShowOrderModal(false);
      setEditingOrder(null);
      resetOrderForm();
      await loadData();
    } catch (err) {
      console.error('Error saving order:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOrder = async (order: Order) => {
    if (!confirm('Czy na pewno chcesz usunąć to zamówienie?')) return;
    await supabase.from('orders').update({ deleted_at: new Date().toISOString() }).eq('id', order.id);
    await loadData();
  };

  const resetOrderForm = () => setOrderForm({
    project_id: '', contractor_id: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery: '', total: 0, nds_percent: 0, notes: ''
  });

  // Stock CRUD
  const handleSaveStock = async () => {
    if (!currentUser || !stockForm.name) return;
    setSaving(true);
    try {
      const data = {
        company_id: currentUser.company_id,
        name: stockForm.name,
        address: stockForm.address || null,
        description: stockForm.description || null,
        is_active: true
      };
      if (editingStock) {
        await supabase.from('stocks').update(data).eq('id', editingStock.id);
      } else {
        await supabase.from('stocks').insert(data);
      }
      setShowStockModal(false);
      setEditingStock(null);
      setStockForm({ name: '', address: '', description: '' });
      await loadData();
    } catch (err) {
      console.error('Error saving stock:', err);
    } finally {
      setSaving(false);
    }
  };

  const tabs: { key: TabType; label: string; icon: React.ElementType }[] = [
    { key: 'requests', label: 'Zapotrzebowania', icon: ShoppingCart },
    { key: 'orders', label: 'Zamówienia', icon: FileText },
    { key: 'stock', label: 'Magazyn', icon: Warehouse },
    { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  ];

  const requestStatusOptions: ResourceRequestStatus[] = ['new', 'partial', 'ordered', 'received', 'cancelled'];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex justify-end">
        <div className="flex gap-2">
          {activeTab === 'requests' && (
            <button onClick={() => { resetRequestForm(); setEditingRequest(null); setShowRequestModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus className="w-5 h-5" /> Nowe zapotrzebowanie
            </button>
          )}
          {activeTab === 'orders' && (
            <button onClick={() => { resetOrderForm(); setEditingOrder(null); setShowOrderModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus className="w-5 h-5" /> Nowe zamówienie
            </button>
          )}
          {activeTab === 'dashboard' && null}
          {activeTab === 'stock' && (
            <button onClick={() => { setEditingStock(null); setStockForm({ name: '', address: '', description: '' }); setShowStockModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus className="w-5 h-5" /> Nowy magazyn
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Nowe zapotrzebowania', value: stats.newRequests, unit: 'szt', icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Aktywne zamówienia', value: stats.pendingOrders, unit: 'szt', icon: FileText, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Wartość magazynu', value: null, formatted: formatCurrency(stats.totalStockValue), icon: Warehouse, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Ponad budżet', value: stats.overBudgetItems, unit: 'szt', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Alerty magazynowe', value: stats.lowStockAlerts, unit: 'szt', icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(({ label, value, unit, formatted, icon: Icon, color, bg }) => (
          <div key={label} className={`bg-white p-4 rounded-xl border border-slate-200`}>
            <div className={`flex items-center gap-2 ${color} mb-2`}>
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{label}</span>
            </div>
            <p className={`text-xl font-bold ${color}`}>{formatted || `${value} ${unit || ''}`}</p>
          </div>
        ))}
      </div>

      {/* AI Alerts */}
      {aiAlerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {aiAlerts.map((alert, i) => (
            <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${
              alert.type === 'danger' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
            }`}>
              {alert.type === 'danger' ? <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />}
              <p className={`text-sm ${alert.type === 'danger' ? 'text-red-700' : 'text-amber-700'}`}>{alert.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="border-b border-slate-200">
          <nav className="flex -mb-px">
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm ${
                  activeTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}>
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-slate-200 flex flex-wrap gap-4">
          <div className="flex-1 min-w-64 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input type="text" placeholder="Szukaj..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg" />
          </div>
          {activeTab !== 'stock' && (
            <>
              <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
                className="px-4 py-2 border border-slate-200 rounded-lg">
                <option value="all">Wszystkie projekty</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-slate-200 rounded-lg">
                <option value="all">Wszystkie statusy</option>
                {activeTab === 'requests'
                  ? requestStatusOptions.map(s => <option key={s} value={s}>{RESOURCE_REQUEST_STATUS_LABELS[s]}</option>)
                  : ['draft','sent','confirmed','shipped','delivered','cancelled'].map(s => <option key={s} value={s}>{ORDER_STATUS_LABELS[s as OrderStatus]}</option>)
                }
              </select>
            </>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : activeTab === 'requests' ? (
            filteredRequests.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 mb-4">Brak zapotrzebowań</p>
                <button onClick={() => { resetRequestForm(); setShowRequestModal(true); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Dodaj pierwsze zapotrzebowanie
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredRequests.map(req => (
                  <div key={req.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 group">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      req.priority === 'urgent' ? 'bg-red-100' : req.priority === 'high' ? 'bg-amber-100' : 'bg-blue-100'
                    }`}>
                      <Package className={`w-5 h-5 ${
                        req.priority === 'urgent' ? 'text-red-600' : req.priority === 'high' ? 'text-amber-600' : 'text-blue-600'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{req.title || req.name}</p>
                      <p className="text-sm text-slate-500">
                        {(req as any).project?.name || 'Bez projektu'}
                        {req.volume_required && ` • Ilość: ${req.volume_required}`}
                        {req.needed_at && ` • Potrzebne: ${formatDate(req.needed_at)}`}
                      </p>
                    </div>
                    {req.is_over_budget && (
                      <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                        <AlertTriangle className="w-3 h-3" /> Przekroczone
                      </span>
                    )}
                    {requestAiAlerts[req.id] && (
                      <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded" title={requestAiAlerts[req.id]}>
                        <AlertCircle className="w-3 h-3" /> Sprawdź ilość!
                      </span>
                    )}
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${RESOURCE_REQUEST_STATUS_COLORS[req.status]}`}>
                      {RESOURCE_REQUEST_STATUS_LABELS[req.status]}
                    </span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 flex-wrap">
                      {req.status === 'new' && (
                        <button onClick={() => handleMoveToRealizacja(req)} disabled={saving}
                          className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> W realizacji
                        </button>
                      )}
                      {req.status === 'partial' && (
                        <button onClick={() => handleOpenZamowione(req)} disabled={saving}
                          className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 flex items-center gap-1">
                          <ShoppingCart className="w-3 h-3" /> Zamów
                        </button>
                      )}
                      {req.status === 'ordered' && (
                        <button onClick={() => handleMarkReceivedRequest(req)} disabled={saving}
                          className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Dostarczone
                        </button>
                      )}
                      <button onClick={() => {
                        setEditingRequest(req);
                        setRequestForm({
                          project_id: req.project_id || '',
                          name: req.title || req.name || '',
                          description: req.description || '',
                          resource_type: req.resource_type || 'material',
                          volume_required: req.volume_required || 1,
                          needed_at: req.needed_at?.split('T')[0] || '',
                          priority: req.priority || 'medium'
                        });
                        setShowRequestModal(true);
                      }} className="p-1 hover:bg-slate-200 rounded">
                        <Pencil className="w-4 h-4 text-slate-400" />
                      </button>
                      <button onClick={() => handleDeleteRequest(req)} className="p-1 hover:bg-red-100 rounded">
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : activeTab === 'orders' ? (
            filteredOrders.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 mb-4">Brak zamówień</p>
                <button onClick={() => { resetOrderForm(); setShowOrderModal(true); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Utwórz pierwsze zamówienie
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredOrders.map(order => (
                  <div key={order.id} className="p-3 bg-slate-50 rounded-lg group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                        <Truck className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">Zamówienie {order.number || order.order_number}</p>
                        <p className="text-sm text-slate-500">
                          {(order as any).contractor?.name || 'Brak dostawcy'}
                          {' • '}{(order as any).project?.name || 'Bez projektu'}
                          {order.expected_delivery && ` • Dostawa: ${formatDate(order.expected_delivery)}`}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${ORDER_STATUS_COLORS[order.status]}`}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </span>
                      <p className="text-lg font-semibold text-slate-900">
                        {formatCurrency(order.total || order.total_amount || 0)}
                      </p>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                        {order.status === 'draft' && (
                          <button onClick={() => handleSendOrder(order)}
                            className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center gap-1">
                            <Send className="w-3 h-3" /> Wyślij
                          </button>
                        )}
                        {['sent', 'confirmed', 'shipped'].includes(order.status) && (
                          <button onClick={() => setConfirmingOrderId(order.id)}
                            className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Potwierdź odbiór
                          </button>
                        )}
                        <button onClick={() => {
                          setEditingOrder(order);
                          setOrderForm({
                            project_id: order.project_id || '',
                            contractor_id: order.contractor_id || '',
                            order_date: (order.order_date || '').split('T')[0] || new Date().toISOString().split('T')[0],
                            expected_delivery: (order.expected_delivery || '').split('T')[0] || '',
                            total: order.total || order.total_amount || 0,
                            nds_percent: 0,
                            notes: order.notes || ''
                          });
                          setShowOrderModal(true);
                        }} className="p-1 hover:bg-slate-200 rounded">
                          <Pencil className="w-4 h-4 text-slate-400" />
                        </button>
                        <button onClick={() => handleDeleteOrder(order)} className="p-1 hover:bg-red-100 rounded">
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>
                    {/* Confirm delivery dialog */}
                    {confirmingOrderId === order.id && (
                      <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                        <p className="text-sm text-green-800">Potwierdzasz odbiór dostawy? Towar zostanie dodany do magazynu.</p>
                        <div className="flex gap-2">
                          <button onClick={() => setConfirmingOrderId(null)}
                            className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50">Anuluj</button>
                          <button onClick={() => handleConfirmDelivery(order.id)} disabled={saving}
                            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1">
                            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                            Potwierdź
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : activeTab === 'dashboard' ? (
            /* DASHBOARD TAB */
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Łączny wydatek', value: formatCurrency(dashboardData.totalSpend), icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
                  { label: 'Zamówienia w toku', value: formatCurrency(dashboardData.pendingValue), icon: Truck, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Zaявки w oczekiwaniu', value: `${dashboardData.pendingRequests.length} szt`, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
                  { label: 'Stan magazynu', value: formatCurrency(stats.totalStockValue), icon: Warehouse, color: 'text-purple-600', bg: 'bg-purple-50' },
                ].map(({ label, value, icon: Icon, color, bg }) => (
                  <div key={label} className={`${bg} rounded-xl p-4 border border-slate-200`}>
                    <div className={`flex items-center gap-2 ${color} mb-1`}>
                      <Icon className="w-5 h-5" />
                      <span className="text-sm font-medium">{label}</span>
                    </div>
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Top Materials */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <Package className="w-5 h-5 text-blue-600" /> Top materiały
                  </h3>
                  {dashboardData.topMaterials.length === 0 ? (
                    <p className="text-slate-500 text-sm">Brak danych</p>
                  ) : (
                    <div className="space-y-2">
                      {dashboardData.topMaterials.map((m, i) => (
                        <div key={m.name} className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{m.name}</p>
                            <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1">
                              <div className="bg-blue-500 h-1.5 rounded-full"
                                style={{ width: `${Math.min(100, (m.count / dashboardData.topMaterials[0].count) * 100)}%` }} />
                            </div>
                          </div>
                          <span className="text-sm text-slate-500 flex-shrink-0">{m.count}x</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pending Requests */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-600" /> Zaявки w oczekiwaniu
                  </h3>
                  {dashboardData.pendingRequests.length === 0 ? (
                    <p className="text-slate-500 text-sm">Brak oczekujących zaявок</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {dashboardData.pendingRequests.map(req => (
                        <div key={req.id} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            req.priority === 'urgent' ? 'bg-red-500' :
                            req.priority === 'high' ? 'bg-amber-500' : 'bg-blue-500'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{req.title || req.name}</p>
                            <p className="text-xs text-slate-400">{(req as any).project?.name || 'Bez projektu'} • {req.volume_required} szt</p>
                          </div>
                          <span className={`text-xs px-1.5 py-0.5 rounded border ${RESOURCE_REQUEST_STATUS_COLORS[req.status]}`}>
                            {RESOURCE_REQUEST_STATUS_LABELS[req.status]}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* STOCK TAB */
            <div className="space-y-6">
              {/* Stock selector */}
              {stocks.length === 0 ? (
                <div className="text-center py-12">
                  <Warehouse className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 mb-4">Brak magazynów</p>
                  <button onClick={() => { setShowStockModal(true); }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Utwórz pierwszy magazyn
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {stocks.map(s => (
                      <div key={s.id} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg text-sm">
                        <Warehouse className="w-4 h-4 text-slate-500" />
                        <span className="font-medium">{s.name}</span>
                        {s.address && <span className="text-slate-400">— {s.address}</span>}
                        <button onClick={() => {
                          setEditingStock(s);
                          setStockForm({ name: s.name, address: s.address || '', description: (s as any).description || '' });
                          setShowStockModal(true);
                        }} className="p-0.5 hover:bg-slate-200 rounded">
                          <Pencil className="w-3 h-3 text-slate-400" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Stock balances */}
                  {filteredBalances.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">Brak pozycji magazynowych</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left p-3 font-medium text-slate-600">Materiał</th>
                            <th className="text-left p-3 font-medium text-slate-600">Magazyn</th>
                            <th className="text-right p-3 font-medium text-slate-600">Ilość</th>
                            <th className="text-right p-3 font-medium text-slate-600">Dostępne</th>
                            <th className="text-right p-3 font-medium text-slate-600">Wartość</th>
                            <th className="text-center p-3 font-medium text-slate-600">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredBalances.map(b => {
                            const avail = b.available_quantity ?? b.quantity;
                            const lowStock = (b.min_quantity || 0) > 0 && avail <= (b.min_quantity || 0);
                            return (
                              <tr key={b.id} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="p-3 font-medium text-slate-900">{b.item_name || b.name}</td>
                                <td className="p-3 text-slate-500">{(b as any).stock?.name || '—'}</td>
                                <td className="p-3 text-right">{b.quantity} {b.unit || ''}</td>
                                <td className={`p-3 text-right font-medium ${lowStock ? 'text-red-600' : 'text-slate-900'}`}>
                                  {avail} {b.unit || ''}
                                </td>
                                <td className="p-3 text-right">{formatCurrency(b.total_value || b.quantity * 0)}</td>
                                <td className="p-3 text-center">
                                  {lowStock ? (
                                    <span className="flex items-center justify-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                                      <AlertTriangle className="w-3 h-3" /> Niski stan
                                    </span>
                                  ) : (
                                    <span className="flex items-center justify-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                                      <CheckCircle className="w-3 h-3" /> OK
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">{editingRequest ? 'Edytuj zapotrzebowanie' : 'Nowe zapotrzebowanie'}</h2>
              <button onClick={() => setShowRequestModal(false)} className="p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa materiału/usługi *</label>
                <input type="text" value={requestForm.name}
                  onChange={e => setRequestForm({ ...requestForm, name: e.target.value })}
                  placeholder="np. Płyty gipsowo-kartonowe 12.5mm"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Projekt *</label>
                  <select value={requestForm.project_id} onChange={e => setRequestForm({ ...requestForm, project_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg">
                    <option value="">-- Wybierz --</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Typ</label>
                  <select value={requestForm.resource_type} onChange={e => setRequestForm({ ...requestForm, resource_type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg">
                    <option value="material">Materiał</option>
                    <option value="labor">Robocizna</option>
                    <option value="equipment">Sprzęt</option>
                    <option value="overhead">Overhead</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ilość</label>
                  <input type="number" min="0" value={requestForm.volume_required}
                    onChange={e => setRequestForm({ ...requestForm, volume_required: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Priorytet</label>
                  <select value={requestForm.priority} onChange={e => setRequestForm({ ...requestForm, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg">
                    <option value="low">Niski</option>
                    <option value="medium">Średni</option>
                    <option value="high">Wysoki</option>
                    <option value="urgent">Pilny</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Potrzebne do</label>
                <input type="date" value={requestForm.needed_at}
                  onChange={e => setRequestForm({ ...requestForm, needed_at: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Opis / uwagi</label>
                <textarea value={requestForm.description}
                  onChange={e => setRequestForm({ ...requestForm, description: e.target.value })}
                  rows={2} placeholder="Dodatkowe informacje..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg resize-none" />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-3">
              <button onClick={() => setShowRequestModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Anuluj</button>
              <button onClick={handleSaveRequest} disabled={!requestForm.name || !requestForm.project_id || saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingRequest ? 'Zapisz' : 'Dodaj'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">{editingOrder ? 'Edytuj zamówienie' : 'Nowe zamówienie'}</h2>
              <button onClick={() => setShowOrderModal(false)} className="p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Projekt *</label>
                  <select value={orderForm.project_id} onChange={e => setOrderForm({ ...orderForm, project_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg">
                    <option value="">-- Wybierz --</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dostawca *</label>
                  <select value={orderForm.contractor_id} onChange={e => setOrderForm({ ...orderForm, contractor_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg">
                    <option value="">-- Wybierz --</option>
                    {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data zamówienia</label>
                  <input type="date" value={orderForm.order_date}
                    onChange={e => setOrderForm({ ...orderForm, order_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Planowana dostawa</label>
                  <input type="date" value={orderForm.expected_delivery}
                    onChange={e => setOrderForm({ ...orderForm, expected_delivery: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Wartość netto</label>
                  <input type="number" value={orderForm.total || ''} step="0.01" min="0"
                    onChange={e => setOrderForm({ ...orderForm, total: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">VAT %</label>
                  <input type="number" value={orderForm.nds_percent || ''} step="1" min="0" max="100"
                    onChange={e => setOrderForm({ ...orderForm, nds_percent: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Uwagi</label>
                <textarea value={orderForm.notes}
                  onChange={e => setOrderForm({ ...orderForm, notes: e.target.value })}
                  rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg resize-none" />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-3">
              <button onClick={() => setShowOrderModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Anuluj</button>
              <button onClick={handleSaveOrder} disabled={!orderForm.project_id || !orderForm.contractor_id || saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingOrder ? 'Zapisz' : 'Utwórz'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zamówione Modal */}
      {showZamowioneModal && zamowioneRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">🛒 Utwórz zamówienie</h2>
              <button onClick={() => setShowZamowioneModal(false)} className="p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg text-sm">
                <p className="font-medium text-blue-800">Zapotrzebowanie: {zamowioneRequest.title || zamowioneRequest.name}</p>
                <p className="text-blue-600 mt-1">Ilość: {zamowioneRequest.volume_required} szt</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Dostawca</label>
                <select value={zamowioneForm.contractor_id}
                  onChange={e => setZamowioneForm({ ...zamowioneForm, contractor_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg">
                  <option value="">-- Wybierz dostawcę --</option>
                  {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kwota netto (PLN)</label>
                  <input type="number" min="0" step="0.01" value={zamowioneForm.total || ''}
                    onChange={e => setZamowioneForm({ ...zamowioneForm, total: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Planowana dostawa</label>
                  <input type="date" value={zamowioneForm.expected_delivery}
                    onChange={e => setZamowioneForm({ ...zamowioneForm, expected_delivery: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Uwagi</label>
                <textarea value={zamowioneForm.notes}
                  onChange={e => setZamowioneForm({ ...zamowioneForm, notes: e.target.value })}
                  rows={2} placeholder="Dodatkowe informacje dla dostawcy..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg resize-none" />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-3">
              <button onClick={() => setShowZamowioneModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Anuluj</button>
              <button onClick={handleConfirmZamowione} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                Zamów i przejdź do Zamówione
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Stock Modal */}
      {showStockModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">{editingStock ? 'Edytuj magazyn' : 'Nowy magazyn'}</h2>
              <button onClick={() => setShowStockModal(false)} className="p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa *</label>
                <input type="text" value={stockForm.name}
                  onChange={e => setStockForm({ ...stockForm, name: e.target.value })}
                  placeholder="np. Magazyn główny"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Adres</label>
                <input type="text" value={stockForm.address}
                  onChange={e => setStockForm({ ...stockForm, address: e.target.value })}
                  placeholder="np. ul. Budowlana 5, Warszawa"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Opis</label>
                <textarea value={stockForm.description}
                  onChange={e => setStockForm({ ...stockForm, description: e.target.value })}
                  rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg resize-none" />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-3">
              <button onClick={() => setShowStockModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Anuluj</button>
              <button onClick={handleSaveStock} disabled={!stockForm.name || saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingStock ? 'Zapisz' : 'Dodaj'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcurementPage;
