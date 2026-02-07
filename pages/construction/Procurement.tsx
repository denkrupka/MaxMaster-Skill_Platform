import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, ShoppingCart, Package, Truck, Warehouse, Loader2,
  Filter, CheckCircle, Clock, AlertCircle, XCircle, ArrowRight,
  FileText, DollarSign, Calendar, Building2, MoreVertical, Eye,
  X, Save, Pencil, Trash2, ChevronDown, ChevronRight
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

type TabType = 'requests' | 'orders' | 'stock';

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
  const [editingRequest, setEditingRequest] = useState<ResourceRequest | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editingStock, setEditingStock] = useState<Stock | null>(null);
  const [saving, setSaving] = useState(false);

  // Request form
  const [requestForm, setRequestForm] = useState({
    project_id: '',
    name: '',
    description: '',
    resource_type: 'material' as 'labor' | 'material' | 'equipment' | 'overhead',
    volume_required: 1,
    needed_at: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent'
  });

  // Order form
  const [orderForm, setOrderForm] = useState({
    project_id: '',
    contractor_id: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery: '',
    total: 0,
    nds_amount: 0,
    notes: ''
  });

  // Stock form
  const [stockForm, setStockForm] = useState({
    name: '',
    address: '',
    description: ''
  });

  useEffect(() => {
    if (currentUser) loadData();
  }, [currentUser]);

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [requestsRes, ordersRes, stocksRes, balancesRes, projectsRes, contractorsRes] = await Promise.all([
        supabase
          .from('resource_requests')
          .select('*, project:projects(*)')
          .order('created_at', { ascending: false }),
        supabase
          .from('orders')
          .select('*, project:projects(*), contractor:contractors(*)')
          .eq('company_id', currentUser.company_id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('stocks')
          .select('*')
          .eq('company_id', currentUser.company_id)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('stock_balances')
          .select('*, stock:stocks(*)')
          .order('name'),
        supabase
          .from('projects')
          .select('*')
          .eq('company_id', currentUser.company_id),
        supabase
          .from('contractors')
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

  const stats = useMemo(() => ({
    newRequests: requests.filter(r => r.status === 'new').length,
    pendingOrders: orders.filter(o => ['draft', 'sent', 'confirmed'].includes(o.status)).length,
    totalStockValue: stockBalances.reduce((sum, b) => sum + b.total_value, 0),
    overBudgetItems: requests.filter(r => r.is_over_budget).length
  }), [requests, orders, stockBalances]);

  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      const matchesProject = projectFilter === 'all' || r.project_id === projectFilter;
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchesSearch = !search || r.name.toLowerCase().includes(search.toLowerCase());
      return matchesProject && matchesStatus && matchesSearch;
    });
  }, [requests, projectFilter, statusFilter, search]);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchesProject = projectFilter === 'all' || o.project_id === projectFilter;
      const matchesSearch = !search || o.number?.toLowerCase().includes(search.toLowerCase());
      return matchesProject && matchesSearch;
    });
  }, [orders, projectFilter, search]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('pl-PL');

  // Request CRUD
  const handleSaveRequest = async () => {
    if (!currentUser || !requestForm.name || !requestForm.project_id) return;
    setSaving(true);
    try {
      const data = {
        project_id: requestForm.project_id,
        name: requestForm.name,
        description: requestForm.description,
        resource_type: requestForm.resource_type,
        volume_required: requestForm.volume_required,
        needed_at: requestForm.needed_at || null,
        priority: requestForm.priority,
        status: 'new' as ResourceRequestStatus,
        created_by_id: currentUser.id
      };

      if (editingRequest) {
        await supabase
          .from('resource_requests')
          .update(data)
          .eq('id', editingRequest.id);
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
    try {
      await supabase
        .from('resource_requests')
        .delete()
        .eq('id', req.id);
      await loadData();
    } catch (err) {
      console.error('Error deleting request:', err);
    }
  };

  const handleApproveRequest = async (req: ResourceRequest) => {
    try {
      await supabase
        .from('resource_requests')
        .update({ status: 'approved' })
        .eq('id', req.id);
      await loadData();
    } catch (err) {
      console.error('Error approving request:', err);
    }
  };

  const resetRequestForm = () => {
    setRequestForm({
      project_id: '',
      name: '',
      description: '',
      resource_type: 'material',
      volume_required: 1,
      needed_at: '',
      priority: 'medium'
    });
  };

  // Order CRUD
  const handleSaveOrder = async () => {
    if (!currentUser || !orderForm.contractor_id) return;
    setSaving(true);
    try {
      // Generate order number
      const countRes = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', currentUser.company_id);
      const nextNum = (countRes.count || 0) + 1;
      const orderNumber = `ORD-${new Date().getFullYear()}-${String(nextNum).padStart(4, '0')}`;

      const data = {
        company_id: currentUser.company_id,
        project_id: orderForm.project_id || null,
        contractor_id: orderForm.contractor_id,
        number: editingOrder?.number || orderNumber,
        order_date: orderForm.order_date,
        expected_delivery: orderForm.expected_delivery || null,
        total: orderForm.total,
        nds_amount: orderForm.nds_amount,
        notes: orderForm.notes,
        status: 'draft' as OrderStatus,
        created_by_id: currentUser.id
      };

      if (editingOrder) {
        await supabase
          .from('orders')
          .update(data)
          .eq('id', editingOrder.id);
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
    try {
      await supabase
        .from('orders')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', order.id);
      await loadData();
    } catch (err) {
      console.error('Error deleting order:', err);
    }
  };

  const handleUpdateOrderStatus = async (order: Order, status: OrderStatus) => {
    try {
      await supabase
        .from('orders')
        .update({ status })
        .eq('id', order.id);
      await loadData();
    } catch (err) {
      console.error('Error updating order status:', err);
    }
  };

  const resetOrderForm = () => {
    setOrderForm({
      project_id: '',
      contractor_id: '',
      order_date: new Date().toISOString().split('T')[0],
      expected_delivery: '',
      total: 0,
      nds_amount: 0,
      notes: ''
    });
  };

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
        await supabase
          .from('stocks')
          .update(data)
          .eq('id', editingStock.id);
      } else {
        await supabase.from('stocks').insert(data);
      }

      setShowStockModal(false);
      setEditingStock(null);
      resetStockForm();
      await loadData();
    } catch (err) {
      console.error('Error saving stock:', err);
    } finally {
      setSaving(false);
    }
  };

  const resetStockForm = () => {
    setStockForm({ name: '', address: '', description: '' });
  };

  const tabs: { key: TabType; label: string; icon: React.ElementType; count?: number }[] = [
    { key: 'requests', label: 'Zapotrzebowanie', icon: Package, count: stats.newRequests },
    { key: 'orders', label: 'Zamówienia', icon: ShoppingCart, count: stats.pendingOrders },
    { key: 'stock', label: 'Magazyn', icon: Warehouse }
  ];

  const priorityColors = {
    low: 'bg-slate-100 text-slate-600',
    medium: 'bg-blue-100 text-blue-600',
    high: 'bg-orange-100 text-orange-600',
    urgent: 'bg-red-100 text-red-600'
  };

  const priorityLabels = {
    low: 'Niski',
    medium: 'Średni',
    high: 'Wysoki',
    urgent: 'Pilny'
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Zaopatrzenie</h1>
          <p className="text-slate-600 mt-1">Zarządzanie zakupami i magazynem</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'requests' && (
            <button
              onClick={() => { resetRequestForm(); setEditingRequest(null); setShowRequestModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Nowe zapotrzebowanie
            </button>
          )}
          {activeTab === 'orders' && (
            <button
              onClick={() => { resetOrderForm(); setEditingOrder(null); setShowOrderModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Nowe zamówienie
            </button>
          )}
          {activeTab === 'stock' && (
            <button
              onClick={() => { resetStockForm(); setEditingStock(null); setShowStockModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Nowy magazyn
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <Package className="w-5 h-5" />
            <span className="text-sm font-medium">Nowe zapotrzebowania</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.newRequests}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-purple-600 mb-2">
            <ShoppingCart className="w-5 h-5" />
            <span className="text-sm font-medium">Zamówienia w toku</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.pendingOrders}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <Warehouse className="w-5 h-5" />
            <span className="text-sm font-medium">Wartość magazynu</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(stats.totalStockValue)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-medium">Przekroczony budżet</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.overBudgetItems}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="border-b border-slate-200">
          <nav className="flex -mb-px">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full text-xs">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-slate-200 flex flex-wrap gap-4">
          <div className="flex-1 min-w-64 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Szukaj..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <select
            value={projectFilter}
            onChange={e => setProjectFilter(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg"
          >
            <option value="all">Wszystkie projekty</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {activeTab === 'requests' && (
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-slate-200 rounded-lg"
            >
              <option value="all">Wszystkie statusy</option>
              <option value="new">Nowe</option>
              <option value="approved">Zatwierdzone</option>
              <option value="ordered">Zamówione</option>
              <option value="delivered">Dostarczone</option>
            </select>
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
                <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 mb-4">Brak zapotrzebowań</p>
                <button
                  onClick={() => { resetRequestForm(); setShowRequestModal(true); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Dodaj pierwsze zapotrzebowanie
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredRequests.map(req => (
                  <div
                    key={req.id}
                    className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 group"
                  >
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Package className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{req.name}</p>
                      <p className="text-sm text-slate-500">
                        {RESOURCE_TYPE_LABELS[req.resource_type]} • {req.volume_required} szt.
                        {req.needed_at && ` • Do ${formatDate(req.needed_at)}`}
                        • {(req as any).project?.name}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${priorityColors[req.priority]}`}>
                      {priorityLabels[req.priority]}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${RESOURCE_REQUEST_STATUS_COLORS[req.status]}`}>
                      {RESOURCE_REQUEST_STATUS_LABELS[req.status]}
                    </span>
                    {req.is_over_budget && (
                      <AlertCircle className="w-5 h-5 text-red-500" title="Przekroczony budżet" />
                    )}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                      {req.status === 'new' && (
                        <button
                          onClick={() => handleApproveRequest(req)}
                          className="p-1.5 hover:bg-green-100 rounded text-green-600"
                          title="Zatwierdź"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEditingRequest(req);
                          setRequestForm({
                            project_id: req.project_id,
                            name: req.name,
                            description: req.description || '',
                            resource_type: req.resource_type,
                            volume_required: req.volume_required,
                            needed_at: req.needed_at?.split('T')[0] || '',
                            priority: req.priority
                          });
                          setShowRequestModal(true);
                        }}
                        className="p-1.5 hover:bg-slate-200 rounded"
                      >
                        <Pencil className="w-4 h-4 text-slate-400" />
                      </button>
                      <button
                        onClick={() => handleDeleteRequest(req)}
                        className="p-1.5 hover:bg-red-100 rounded"
                      >
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
                <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 mb-4">Brak zamówień</p>
                <button
                  onClick={() => { resetOrderForm(); setShowOrderModal(true); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Dodaj pierwsze zamówienie
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredOrders.map(order => (
                  <div
                    key={order.id}
                    className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 group"
                  >
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">Zamówienie #{order.number}</p>
                      <p className="text-sm text-slate-500">
                        {(order as any).contractor?.name} • {formatDate(order.order_date)}
                        {order.expected_delivery && ` • Dostawa: ${formatDate(order.expected_delivery)}`}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${ORDER_STATUS_COLORS[order.status]}`}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </span>
                    <p className="text-lg font-semibold text-slate-900">{formatCurrency(order.total)}</p>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                      {order.status === 'draft' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(order, 'sent')}
                          className="p-1.5 hover:bg-blue-100 rounded text-blue-600"
                          title="Wyślij"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      )}
                      {order.status === 'sent' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(order, 'confirmed')}
                          className="p-1.5 hover:bg-green-100 rounded text-green-600"
                          title="Potwierdź"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      {order.status === 'confirmed' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(order, 'delivered')}
                          className="p-1.5 hover:bg-green-100 rounded text-green-600"
                          title="Dostarczone"
                        >
                          <Truck className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEditingOrder(order);
                          setOrderForm({
                            project_id: order.project_id || '',
                            contractor_id: order.contractor_id || '',
                            order_date: order.order_date?.split('T')[0] || '',
                            expected_delivery: order.expected_delivery?.split('T')[0] || '',
                            total: order.total,
                            nds_amount: order.nds_amount,
                            notes: order.notes || ''
                          });
                          setShowOrderModal(true);
                        }}
                        className="p-1.5 hover:bg-slate-200 rounded"
                      >
                        <Pencil className="w-4 h-4 text-slate-400" />
                      </button>
                      <button
                        onClick={() => handleDeleteOrder(order)}
                        className="p-1.5 hover:bg-red-100 rounded"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            stocks.length === 0 ? (
              <div className="text-center py-12">
                <Warehouse className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 mb-4">Brak magazynów</p>
                <button
                  onClick={() => { resetStockForm(); setShowStockModal(true); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Dodaj pierwszy magazyn
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {stocks.map(stock => (
                  <div key={stock.id} className="bg-slate-50 rounded-lg p-4 group">
                    <div className="flex items-center gap-3 mb-3">
                      <Warehouse className="w-6 h-6 text-green-600" />
                      <h3 className="font-semibold text-slate-900 flex-1">{stock.name}</h3>
                      {stock.address && (
                        <span className="text-sm text-slate-500">{stock.address}</span>
                      )}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                        <button
                          onClick={() => {
                            setEditingStock(stock);
                            setStockForm({
                              name: stock.name,
                              address: stock.address || '',
                              description: stock.description || ''
                            });
                            setShowStockModal(true);
                          }}
                          className="p-1.5 hover:bg-slate-200 rounded"
                        >
                          <Pencil className="w-4 h-4 text-slate-400" />
                        </button>
                      </div>
                    </div>
                    {stockBalances.filter(b => b.stock_id === stock.id).length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {stockBalances
                          .filter(b => b.stock_id === stock.id)
                          .slice(0, 8)
                          .map(balance => (
                            <div key={balance.id} className="bg-white p-3 rounded-lg">
                              <p className="text-sm font-medium text-slate-700 truncate">{balance.name}</p>
                              <p className="text-lg font-semibold text-slate-900">
                                {balance.available_quantity} szt.
                              </p>
                              <p className="text-xs text-slate-500">{formatCurrency(balance.total_value)}</p>
                            </div>
                          ))
                        }
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">Brak pozycji na magazynie</p>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                {editingRequest ? 'Edytuj zapotrzebowanie' : 'Nowe zapotrzebowanie'}
              </h2>
              <button onClick={() => setShowRequestModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa *</label>
                <input
                  type="text"
                  value={requestForm.name}
                  onChange={e => setRequestForm({ ...requestForm, name: e.target.value })}
                  placeholder="np. Kabel YKY 5x4"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Projekt *</label>
                <select
                  value={requestForm.project_id}
                  onChange={e => setRequestForm({ ...requestForm, project_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                >
                  <option value="">-- Wybierz projekt --</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Typ zasobu</label>
                  <select
                    value={requestForm.resource_type}
                    onChange={e => setRequestForm({ ...requestForm, resource_type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  >
                    <option value="material">Materiał</option>
                    <option value="equipment">Sprzęt</option>
                    <option value="labor">Praca</option>
                    <option value="overhead">Koszty pośrednie</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ilość</label>
                  <input
                    type="number"
                    value={requestForm.volume_required}
                    onChange={e => setRequestForm({ ...requestForm, volume_required: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Potrzebne do</label>
                  <input
                    type="date"
                    value={requestForm.needed_at}
                    onChange={e => setRequestForm({ ...requestForm, needed_at: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Priorytet</label>
                  <select
                    value={requestForm.priority}
                    onChange={e => setRequestForm({ ...requestForm, priority: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  >
                    <option value="low">Niski</option>
                    <option value="medium">Średni</option>
                    <option value="high">Wysoki</option>
                    <option value="urgent">Pilny</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Opis</label>
                <textarea
                  value={requestForm.description}
                  onChange={e => setRequestForm({ ...requestForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  placeholder="Dodatkowe informacje..."
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowRequestModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                onClick={handleSaveRequest}
                disabled={!requestForm.name || !requestForm.project_id || saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
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
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                {editingOrder ? 'Edytuj zamówienie' : 'Nowe zamówienie'}
              </h2>
              <button onClick={() => setShowOrderModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Dostawca *</label>
                <select
                  value={orderForm.contractor_id}
                  onChange={e => setOrderForm({ ...orderForm, contractor_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                >
                  <option value="">-- Wybierz dostawcę --</option>
                  {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Projekt</label>
                <select
                  value={orderForm.project_id}
                  onChange={e => setOrderForm({ ...orderForm, project_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                >
                  <option value="">-- Wybierz projekt --</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data zamówienia</label>
                  <input
                    type="date"
                    value={orderForm.order_date}
                    onChange={e => setOrderForm({ ...orderForm, order_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Oczekiwana dostawa</label>
                  <input
                    type="date"
                    value={orderForm.expected_delivery}
                    onChange={e => setOrderForm({ ...orderForm, expected_delivery: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Suma netto</label>
                  <input
                    type="number"
                    value={orderForm.total || ''}
                    onChange={e => setOrderForm({ ...orderForm, total: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    step="0.01"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">VAT</label>
                  <input
                    type="number"
                    value={orderForm.nds_amount || ''}
                    onChange={e => setOrderForm({ ...orderForm, nds_amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Uwagi</label>
                <textarea
                  value={orderForm.notes}
                  onChange={e => setOrderForm({ ...orderForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowOrderModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                onClick={handleSaveOrder}
                disabled={!orderForm.contractor_id || saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingOrder ? 'Zapisz' : 'Dodaj'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Modal */}
      {showStockModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                {editingStock ? 'Edytuj magazyn' : 'Nowy magazyn'}
              </h2>
              <button onClick={() => setShowStockModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa *</label>
                <input
                  type="text"
                  value={stockForm.name}
                  onChange={e => setStockForm({ ...stockForm, name: e.target.value })}
                  placeholder="np. Magazyn główny"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Adres</label>
                <input
                  type="text"
                  value={stockForm.address}
                  onChange={e => setStockForm({ ...stockForm, address: e.target.value })}
                  placeholder="np. ul. Przemysłowa 10, Warszawa"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Opis</label>
                <textarea
                  value={stockForm.description}
                  onChange={e => setStockForm({ ...stockForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowStockModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                onClick={handleSaveStock}
                disabled={!stockForm.name || saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
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
