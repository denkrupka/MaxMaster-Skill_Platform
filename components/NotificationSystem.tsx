
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, X, Circle, Info, ArrowRight, Calendar, ChevronRight } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { AppNotification, NotificationHub } from '../types';
import { supabase } from '../lib/supabase';
import { Button } from './Button';

export const NotificationBell = () => {
    const { state, markNotificationAsRead, markAllNotificationsAsRead } = useAppContext();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [selectedNotification, setSelectedNotification] = useState<AppNotification | null>(null);

    // Hub notifications (from Supabase notifications table)
    const [hubNotifications, setHubNotifications] = useState<NotificationHub[]>([]);
    const channelRef = useRef<any>(null);

    const userId = state.currentUser?.id;

    // Load unread hub notifications count + recent ones for dropdown
    useEffect(() => {
        if (!userId) return;
        const load = async () => {
            const { data } = await supabase
                .from('notifications')
                .select('id, title, message, link, is_read, created_at, type')
                .eq('user_id', userId)
                .eq('is_read', false)
                .order('created_at', { ascending: false })
                .limit(15);
            if (data) setHubNotifications(data as NotificationHub[]);
        };
        load();
    }, [userId]);

    // Realtime subscription for new hub notifications
    useEffect(() => {
        if (!userId) return;
        if (channelRef.current) supabase.removeChannel(channelRef.current);
        const channel = supabase
            .channel(`nb_notifications_${userId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${userId}`
            }, (payload) => {
                setHubNotifications(prev => [payload.new as NotificationHub, ...prev]);
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${userId}`
            }, (payload) => {
                const updated = payload.new as NotificationHub;
                if (updated.is_read) {
                    setHubNotifications(prev => prev.filter(n => n.id !== updated.id));
                }
            })
            .subscribe();
        channelRef.current = channel;
        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [userId]);

    const hubUnreadCount = hubNotifications.filter(n => !n.is_read).length;
    const appUnreadCount = state.appNotifications.filter(n => !n.isRead).length;
    const unreadCount = hubUnreadCount + appUnreadCount;

    const handleNotificationClick = (notification: AppNotification) => {
        markNotificationAsRead(notification.id);
        setSelectedNotification(notification);
        setIsOpen(false); // Close dropdown, open modal
    };

    const handleModalAction = () => {
        if (selectedNotification?.link) {
            navigate(selectedNotification.link);
        }
        setSelectedNotification(null);
    };

    const markAllHubAsRead = async () => {
        if (!userId) return;
        await supabase
            .from('notifications')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('is_read', false);
        setHubNotifications([]);
        markAllNotificationsAsRead();
    };

    const handleHubNotificationClick = async (notif: NotificationHub) => {
        setIsOpen(false);
        if (!notif.is_read) {
            await supabase
                .from('notifications')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('id', notif.id);
            setHubNotifications(prev => prev.filter(n => n.id !== notif.id));
        }
        if (notif.link) navigate(notif.link);
    };

    const renderDetailModal = () => {
        if (!selectedNotification) return null;

        return (
            <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSelectedNotification(null)}>
                <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative" onClick={e => e.stopPropagation()}>
                    <button 
                        onClick={() => setSelectedNotification(null)}
                        className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
                    >
                        <X size={24} />
                    </button>

                    <div className="flex items-start gap-4 mb-4">
                        <div className="bg-blue-100 p-3 rounded-full text-blue-600">
                            <Info size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">{selectedNotification.title}</h3>
                            <div className="flex items-center text-xs text-slate-500 mt-1">
                                <Calendar size={12} className="mr-1"/>
                                {new Date(selectedNotification.createdAt).toLocaleString()}
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-slate-700 text-sm leading-relaxed mb-6 max-h-[60vh] overflow-y-auto">
                        {selectedNotification.message}
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setSelectedNotification(null)}>
                            Zamknij
                        </Button>
                        {selectedNotification.link && (
                            <Button onClick={handleModalAction}>
                                Przejdź do szczegółów <ArrowRight size={16} className="ml-2"/>
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="relative">
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
            >
                <Bell size={24} />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-sm">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100 bg-slate-50">
                            <h3 className="font-bold text-slate-800 text-sm">Powiadomienia</h3>
                            {unreadCount > 0 && (
                                <button 
                                    onClick={markAllHubAsRead}
                                    className="text-blue-600 hover:text-blue-700 text-xs font-medium flex items-center"
                                    title="Oznacz wszystkie jako przeczytane"
                                >
                                    <Check size={14} className="mr-1"/> Oznacz przeczytane
                                </button>
                            )}
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                            {hubNotifications.length > 0 || state.appNotifications.filter(n => !n.isRead).length > 0 ? (
                                <div className="divide-y divide-slate-50">
                                    {/* Hub notifications (from Supabase) */}
                                    {hubNotifications.map(notif => (
                                        <div
                                            key={notif.id}
                                            onClick={() => handleHubNotificationClick(notif)}
                                            className="p-4 hover:bg-slate-50 cursor-pointer transition-colors bg-blue-50/50"
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <h4 className="text-sm font-bold text-slate-900 line-clamp-1">{notif.title}</h4>
                                                <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0 ml-2" />
                                            </div>
                                            <p className="text-xs text-slate-500 line-clamp-2 mb-2">{notif.message}</p>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] text-slate-400">
                                                    {new Date(notif.created_at).toLocaleDateString('pl-PL')} {new Date(notif.created_at).toLocaleTimeString('pl-PL', {hour: '2-digit', minute:'2-digit'})}
                                                </span>
                                                {notif.link && (
                                                    <span className="text-[10px] text-blue-500 flex items-center gap-0.5">
                                                        Przejdź <ChevronRight size={10} />
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {/* App notifications (in-memory) */}
                                    {state.appNotifications.filter(n => !n.isRead).map(notification => (
                                        <div 
                                            key={notification.id}
                                            onClick={() => handleNotificationClick(notification)}
                                            className="p-4 hover:bg-slate-50 cursor-pointer transition-colors bg-blue-50/50"
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <h4 className="text-sm font-bold text-slate-900">
                                                    {notification.title}
                                                </h4>
                                                <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5" />
                                            </div>
                                            <p className="text-xs text-slate-500 line-clamp-2 mb-2">{notification.message}</p>
                                            <div className="text-[10px] text-slate-400">
                                                {new Date(notification.createdAt).toLocaleDateString()} {new Date(notification.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-slate-400 text-sm">
                                    Brak nieprzeczytanych powiadomień
                                </div>
                            )}
                        </div>
                        {/* Footer: link to full notifications page */}
                        <div className="border-t border-slate-100 px-4 py-2 text-center">
                            <button
                                onClick={() => { setIsOpen(false); navigate('/notifications'); }}
                                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                            >
                                Zobacz wszystkie powiadomienia →
                            </button>
                        </div>
                    </div>
                </>
            )}
            
            {renderDetailModal()}
        </div>
    );
};

export const Toast = () => {
    const { state, clearToast } = useAppContext();
    
    useEffect(() => {
        if (state.toast) {
            const timer = setTimeout(() => {
                clearToast();
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [state.toast, clearToast]);

    if (!state.toast) return null;

    return (
        <div className="fixed top-4 right-4 z-[100] max-w-sm w-full bg-white rounded-lg shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-right duration-300">
            <div className="p-4 flex items-start">
                <div className="flex-shrink-0 pt-0.5">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                        <Info size={18} />
                    </div>
                </div>
                <div className="ml-3 flex-1">
                    <p className="text-sm font-bold text-slate-900">{state.toast.title}</p>
                    <p className="text-xs text-slate-500 mt-1">{state.toast.message}</p>
                </div>
                <button onClick={clearToast} className="ml-4 flex-shrink-0 text-slate-400 hover:text-slate-600">
                    <X size={18} />
                </button>
            </div>
            <div className="h-1 bg-blue-500 w-full animate-[shrink_5s_linear_forwards]" />
            <style>{`
                @keyframes shrink {
                    from { width: 100%; }
                    to { width: 0%; }
                }
            `}</style>
        </div>
    );
};
