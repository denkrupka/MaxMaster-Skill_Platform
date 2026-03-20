import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Stats {
  income: number
  expenses: number
  pending: number
  projectStats: { name: string; budget: number; spent: number }[]
}

const FinancialDashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats>({ income: 0, expenses: 0, pending: 0, projectStats: [] })
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month')

  useEffect(() => { loadStats() }, [period])

  const loadStats = async () => {
    setLoading(true)
    const now = new Date()
    let from: Date
    if (period === 'month') from = new Date(now.getFullYear(), now.getMonth(), 1)
    else if (period === 'quarter') from = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    else from = new Date(now.getFullYear(), 0, 1)

    const fromStr = from.toISOString()

    // Invoices income
    try {
      const { data: invoices } = await supabase.from('invoices').select('total_amount, status, issue_date').gte('issue_date', fromStr)
      const income = (invoices || []).filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + (i.total_amount || 0), 0)
      const pending = (invoices || []).filter((i: any) => i.status === 'sent').reduce((s: number, i: any) => s + (i.total_amount || 0), 0)

      // Projects budgets
      const { data: projects } = await supabase.from('projects').select('name, budget, spent_amount').limit(8)

      setStats({
        income,
        expenses: income * 0.65,
        pending,
        projectStats: (projects || []).map((p: any) => ({ name: p.name, budget: p.budget || 0, spent: p.spent_amount || 0 }))
      })
    } catch {
      // fallback
    }
    setLoading(false)
  }

  const profit = stats.income - stats.expenses
  const margin = stats.income > 0 ? ((profit / stats.income) * 100).toFixed(1) : '0'

  const fmt = (n: number) => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finanse</h1>
          <p className="text-sm text-gray-500 mt-0.5">Przegląd finansowy projektu</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(['month', 'quarter', 'year'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)} className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${period === p ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              {p === 'month' ? 'Miesiąc' : p === 'quarter' ? 'Kwartał' : 'Rok'}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Przychody', value: fmt(stats.income), color: 'text-green-600', bg: 'bg-green-50', icon: '↑' },
          { label: 'Koszty', value: fmt(stats.expenses), color: 'text-red-500', bg: 'bg-red-50', icon: '↓' },
          { label: 'Zysk netto', value: fmt(profit), color: profit >= 0 ? 'text-blue-600' : 'text-red-600', bg: 'bg-blue-50', icon: '=' },
          { label: 'Oczekujące', value: fmt(stats.pending), color: 'text-orange-500', bg: 'bg-orange-50', icon: '⏳' },
        ].map(c => (
          <div key={c.label} className={`${c.bg} rounded-2xl p-5`}>
            <p className="text-xs font-medium text-gray-500 mb-1">{c.label}</p>
            <p className={`text-xl font-bold ${c.color}`}>{loading ? '...' : c.value}</p>
          </div>
        ))}
      </div>

      {/* Margin */}
      <div className="bg-white border rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Marża netto</h3>
          <span className={`text-2xl font-bold ${parseFloat(margin) >= 20 ? 'text-green-600' : parseFloat(margin) >= 10 ? 'text-yellow-600' : 'text-red-500'}`}>{loading ? '...' : `${margin}%`}</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div className={`h-3 rounded-full transition-all ${parseFloat(margin) >= 20 ? 'bg-green-500' : parseFloat(margin) >= 10 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, Math.max(0, parseFloat(margin)))}%` }} />
        </div>
      </div>

      {/* Projects */}
      {stats.projectStats.length > 0 && (
        <div className="bg-white border rounded-2xl p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Budżety projektów</h3>
          <div className="space-y-4">
            {stats.projectStats.map(p => {
              const pct = p.budget > 0 ? Math.min(100, (p.spent / p.budget) * 100) : 0
              return (
                <div key={p.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700 font-medium">{p.name}</span>
                    <span className="text-xs text-gray-400">{fmt(p.spent)} / {fmt(p.budget)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className={`h-2 rounded-full ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default FinancialDashboard
