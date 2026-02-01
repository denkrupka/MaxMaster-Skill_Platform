
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, BellOff, CheckCheck, Filter, Loader2, ChevronDown,
  Clock, AlertCircle, Calendar, ClipboardList, UserCheck, MessageSquare,
  Briefcase, BarChart3, Settings, Mail, X, ChevronRight
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { NotificationHub, NotificationType_Hub } from '../../types';

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

const PAGE_SIZE = 20;

const timeAgo = (dateStr: string): string => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);

  if (diffSec < 60) return 'przed chwila';
  if (diffMin < 60) return `${diffMin} min temu`;
  if (diffHour < 24) return `${diffHour} godz. temu`;
  if (diffDay < 7) return `${diffDay} ${diffDay === 1 ? 'dzien' : 'dni'} temu`;
  if (diffWeek < 4) return `${diffWeek} ${diffWeek === 1 ? 'tydzien' : 'tygodni'} temu`;
  return date.toLocaleDateString('pl-PL');
};

interface NotificationTypeConfig {
  icon: React.ReactNode;
  color: string;
  label: string;
}

const NOTIFICATION_TYPE_CONFIG: Record<NotificationType_Hub, NotificationTypeConfig> = {
  attendance_reminder: {
    icon: <Clock className="w-4 h-4" />,
    color: 'text-blue-500 bg-blue-50',
    label: 'Przypomnienie o obecnosci'
  },
  day_request_new: {
    icon: <ClipboardList className="w-4 h-4" />,
    color: 'text-amber-500 bg-amber-50',
    label: 'Nowy wniosek dniowy'
  },
  day_request_approved: {
    icon: <CheckCheck className="w-4 h-4" />,
    color: 'text-green-500 bg-green-50',
    label: 'Wniosek zatwierdzony'
  },
  day_request_rejected: {
    icon: <X className="w-4 h-4" />,
    color: 'text-red-500 bg-red-50',
    label: 'Wniosek odrzucony'
  },
  time_off_new: {
    icon: <Calendar className="w-4 h-4" />,
    color: 'text-indigo-500 bg-indigo-50',
    label: 'Nowy wniosek urlopowy'
  },
  time_off_approved: {
    icon: <UserCheck className="w-4 h-4" />,
    color: 'text-green-500 bg-green-50',
    label: 'Urlop zatwierdzony'
  },
  time_off_rejected: {
    icon: <X className="w-4 h-4" />,
    color: 'text-red-500 bg-red-50',
    label: 'Urlop odrzucony'
  },
  schedule_updated: {
    icon: <Calendar className="w-4 h-4" />,
    color: 'text-purple-500 bg-purple-50',
    label: 'Grafik zaktualizowany'
  },
  task_assigned: {
    icon: <Briefcase className="w-4 h-4" />,
    color: 'text-blue-500 bg-blue-50',
    label: 'Zadanie przypisane'
  },
  task_status_changed: {
    icon: <ClipboardList className="w-4 h-4" />,
    color: 'text-cyan-500 bg-cyan-50',
    label: 'Zmiana statusu zadania'
  },
  task_comment: {
    icon: <MessageSquare className="w-4 h-4" />,
    color: 'text-slate-500 bg-slate-50',
    label: 'Komentarz do zadania'
  },
  timesheet_ready: {
    icon: <BarChart3 className="w-4 h-4" />,
    color: 'text-emerald-500 bg-emerald-50',
    label: 'Karta czasu gotowa'
  },
  general: {
    icon: <Bell className="w-4 h-4" />,
    color: 'text-slate-500 bg-slate-50',
    label: 'Ogolne'
  }
};

const ALL_NOTIFICATION_TYPES: NotificationType_Hub[] = [
  'attendance_reminder', 'day_request_new', 'day_request_approved', 'day_request_rejected',
  'time_off_new', 'time_off_approved', 'time_off_rejected',
  'schedule_updated', 'task_assigned', 'task_status_changed', 'task_comment',
  'timesheet_ready', 'general'
];

type ReadFilter = 'all' | 'unread' | 'read';

// ---------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------

export const NotificationsPage: React.FC = () => {
  const { state } = useAppContext();
  const { currentUser } = state;
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<NotificationHub[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  // Filters
  const [typeFilter, setTypeFilter] = useState<NotificationType_Hub | 'all'>('all');
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');

  const userId = currentUser?.id;
  const companyId = currentUser?.company_id;
  const channelRef = useRef<any>(null);

  // Build query
  const buildQuery = useCallback((offset: number, limit: number) => {
    let query = supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (typeFilter !== 'all') {
      query = query.eq('type', typeFilter);
    }
    if (readFilter === 'unread') {
      query = query.eq('is_read', false);
    } else if (readFilter === 'read') {
      query = query.eq('is_read', true);
    }

    return query;
  }, [userId, typeFilter, readFilter]);

  // Load notifications
  const loadNotifications = useCallback(async (reset = true) => {
    if (!userId) return;

    if (reset) {
      setLoading(true);
      setNotifications([]);
    } else {
      setLoadingMore(true);
    }

    try {
      const offset = reset ? 0 : notifications.length;
      const { data, error } = await buildQuery(offset, PAGE_SIZE);

      if (!error && data) {
        if (reset) {
          setNotifications(data);
        } else {
          setNotifications(prev => [...prev, ...data]);
        }
        setHasMore(data.length === PAGE_SIZE);
      }
    } catch (err) {
      console.error('Error loading notifications:', err);
    }

    setLoading(false);
    setLoadingMore(false);
  }, [userId, buildQuery, notifications.length]);

  // Initial load
  useEffect(() => {
    loadNotifications(true);
  }, [userId, typeFilter, readFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;

    // Clean up existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`notifications_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const newNotification = payload.new as NotificationHub;

          // Check if it matches current filters
          if (typeFilter !== 'all' && newNotification.type !== typeFilter) return;
          if (readFilter === 'read' && !newNotification.is_read) return;

          setNotifications(prev => [newNotification, ...prev]);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, typeFilter, readFilter]);

  // Mark single notification as read
  const markAsRead = async (notification: NotificationHub) => {
    if (notification.is_read) {
      // Already read, just navigate
      if (notification.link) navigate(notification.link);
      return;
    }

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notification.id);

      if (!error) {
        setNotifications(prev =>
          prev.map(n => n.id === notification.id
            ? { ...n, is_read: true, read_at: new Date().toISOString() }
            : n
          )
        );
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }

    if (notification.link) {
      navigate(notification.link);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    if (!userId) return;
    setMarkingAll(true);

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (!error) {
        setNotifications(prev =>
          prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
        );
      }
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
    setMarkingAll(false);
  };

  // Stats
  const unreadCount = useMemo(
    () => notifications.filter(n => !n.is_read).length,
    [notifications]
  );

  // Access check
  if (!currentUser) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-red-800">Brak dostepu</h2>
          <p className="text-red-600">Zaloguj sie aby zobaczyc powiadomienia.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-[900px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Powiadomienia</h1>
          <p className="text-slate-500 mt-1">
            {unreadCount > 0
              ? `Masz ${unreadCount} nieprzeczytanych powiadomien`
              : 'Wszystkie powiadomienia przeczytane'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            disabled={markingAll}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {markingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
            Oznacz wszystkie jako przeczytane
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 mb-4 flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-slate-400" />

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as NotificationType_Hub | 'all')}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Wszystkie typy</option>
          {ALL_NOTIFICATION_TYPES.map(type => (
            <option key={type} value={type}>
              {NOTIFICATION_TYPE_CONFIG[type]?.label || type}
            </option>
          ))}
        </select>

        {/* Read/Unread toggle */}
        <div className="flex bg-slate-100 rounded-lg p-0.5">
          {([
            { key: 'all', label: 'Wszystkie' },
            { key: 'unread', label: 'Nieprzeczytane' },
            { key: 'read', label: 'Przeczytane' }
          ] as { key: ReadFilter; label: string }[]).map(opt => (
            <button
              key={opt.key}
              onClick={() => setReadFilter(opt.key)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                readFilter === opt.key
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {(typeFilter !== 'all' || readFilter !== 'all') && (
          <button
            onClick={() => { setTypeFilter('all'); setReadFilter('all'); }}
            className="text-xs text-slate-400 hover:text-slate-600 ml-auto flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Wyczysc filtry
          </button>
        )}
      </div>

      {/* Notification List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-16">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span className="ml-3 text-slate-500">Ladowanie powiadomien...</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center p-16">
            <BellOff className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-600 mb-2">Brak powiadomien</h3>
            <p className="text-slate-400 text-sm">
              {readFilter === 'unread'
                ? 'Nie masz nieprzeczytanych powiadomien.'
                : 'Nie masz jeszcze zadnych powiadomien.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map(notification => {
              const config = NOTIFICATION_TYPE_CONFIG[notification.type] || NOTIFICATION_TYPE_CONFIG.general;
              const colorParts = config.color.split(' ');

              return (
                <div
                  key={notification.id}
                  onClick={() => markAsRead(notification)}
                  className={`flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors hover:bg-blue-50/50 ${
                    !notification.is_read ? 'bg-blue-50/30' : ''
                  }`}
                >
                  {/* Unread dot */}
                  <div className="flex-shrink-0 mt-1.5 w-2">
                    {!notification.is_read && (
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                    )}
                  </div>

                  {/* Icon */}
                  <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${config.color}`}>
                    {config.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className={`text-sm ${!notification.is_read ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
                        {notification.title}
                      </h4>
                      <span className="text-xs text-slate-400 flex-shrink-0 whitespace-nowrap">
                        {timeAgo(notification.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">
                      {notification.message}
                    </p>
                    {notification.link && (
                      <div className="flex items-center gap-1 text-xs text-blue-500 mt-1">
                        <span>Przejdz do szczegolbw</span>
                        <ChevronRight className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Load more */}
        {!loading && hasMore && notifications.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 text-center">
            <button
              onClick={() => loadNotifications(false)}
              disabled={loadingMore}
              className="px-6 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 mx-auto"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Ladowanie...
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Zaladuj wiecej
                </>
              )}
            </button>
          </div>
        )}

        {/* End indicator */}
        {!loading && !hasMore && notifications.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 text-center text-xs text-slate-400">
            Wyswietlono wszystkie powiadomienia ({notifications.length})
          </div>
        )}
      </div>
    </div>
  );
};
