import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, ShoppingCart, Package, Truck, Warehouse, Loader2,
  Filter, CheckCircle, Clock, AlertCircle, XCircle, ArrowRight,
  FileText, DollarSign, Calendar, Building2, MoreVertical, Eye
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

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);

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
          .eq('project_id', supabase.raw('projects.company_id = ?', [currentUser.company_id]))
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

      if (requestsRes.data) setRequests(requestsRes.data);
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

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('pl-PL');

  const tabs: { key: TabType; label: string; icon: React.ElementType; count?: number }[] = [
    { key: 'requests', label: 'Zapotrzebowanie', icon: Package, count: stats.newRequests },
    { key: 'orders', label: 'Zamówienia', icon: ShoppingCart, count: stats.pendingOrders },
    { key: 'stock', label: 'Magazyn', icon: Warehouse }
  ];

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
              onClick={() => setShowRequestModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Nowe zapotrzebowanie
            </button>
          )}
          {activeTab === 'orders' && (
            <button
              onClick={() => setShowOrderModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Nowe zamówienie
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
        </div>

        {/* Content */}
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : activeTab === 'requests' ? (
            requests.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Brak zapotrzebowań</p>
              </div>
            ) : (
              <div className="space-y-2">
                {requests.map(req => (
                  <div
                    key={req.id}
                    className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer"
                  >
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Package className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{req.name}</p>
                      <p className="text-sm text-slate-500">
                        {RESOURCE_TYPE_LABELS[req.resource_type]} • {req.volume_required} szt.
                        {req.needed_at && ` • Do ${formatDate(req.needed_at)}`}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${RESOURCE_REQUEST_STATUS_COLORS[req.status]}`}>
                      {RESOURCE_REQUEST_STATUS_LABELS[req.status]}
                    </span>
                    {req.is_over_budget && (
                      <AlertCircle className="w-5 h-5 text-red-500" title="Przekroczony budżet" />
                    )}
                  </div>
                ))}
              </div>
            )
          ) : activeTab === 'orders' ? (
            orders.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Brak zamówień</p>
              </div>
            ) : (
              <div className="space-y-2">
                {orders.map(order => (
                  <div
                    key={order.id}
                    className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer"
                  >
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">Zamówienie #{order.number}</p>
                      <p className="text-sm text-slate-500">
                        {(order as any).contractor?.name} • {formatDate(order.order_date)}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${ORDER_STATUS_COLORS[order.status]}`}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </span>
                    <p className="text-lg font-semibold text-slate-900">{formatCurrency(order.total)}</p>
                  </div>
                ))}
              </div>
            )
          ) : (
            stocks.length === 0 ? (
              <div className="text-center py-12">
                <Warehouse className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Brak magazynów</p>
              </div>
            ) : (
              <div className="space-y-4">
                {stocks.map(stock => (
                  <div key={stock.id} className="bg-slate-50 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Warehouse className="w-6 h-6 text-green-600" />
                      <h3 className="font-semibold text-slate-900">{stock.name}</h3>
                      {stock.address && (
                        <span className="text-sm text-slate-500">{stock.address}</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {stockBalances
                        .filter(b => b.stock_id === stock.id)
                        .slice(0, 4)
                        .map(balance => (
                          <div key={balance.id} className="bg-white p-3 rounded-lg">
                            <p className="text-sm font-medium text-slate-700">{balance.name}</p>
                            <p className="text-lg font-semibold text-slate-900">
                              {balance.available_quantity} szt.
                            </p>
                            <p className="text-xs text-slate-500">{formatCurrency(balance.total_value)}</p>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default ProcurementPage;
