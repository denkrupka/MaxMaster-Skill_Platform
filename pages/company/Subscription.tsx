import React, { useState, useMemo, useRef } from 'react';
import {
  Package, CreditCard, FileText, Users, Plus, Minus, Check, AlertCircle,
  Download, Clock, ExternalLink, Loader2, Settings, Zap, Search, X,
  ToggleLeft, ToggleRight, UserPlus, Award, Receipt, ShoppingCart, Trash2, Calendar
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Role, UserStatus } from '../../types';
import { MODULE_LABELS, MODULE_DESCRIPTIONS, COMPANY_SUBSCRIPTION_DISPLAY_LABELS, COMPANY_SUBSCRIPTION_DISPLAY_COLORS } from '../../constants';
import {
  isStripeConfigured,
  getCardBrandName,
  formatCurrency
} from '../../lib/stripeService';
import { supabase } from '../../lib/supabase';

const MODULE_INFO: Record<string, { name: string; description: string; icon: React.ReactNode }> = {
  recruitment: {
    name: 'Rekrutacja',
    description: 'Zarządzanie kandydatami, procesem rekrutacji i dokumentami HR',
    icon: <UserPlus className="w-5 h-5" />
  },
  skills: {
    name: 'Umiejętności',
    description: 'Zarządzanie kompetencjami, szkoleniami i certyfikatami pracowników',
    icon: <Award className="w-5 h-5" />
  }
};

// Cart item type for tracking module purchases
interface CartItem {
  moduleCode: string;
  moduleName: string;
  currentUsers: number;
  newUsers: number;
  pricePerUser: number;
  isNewModule: boolean; // true for new module activation, false for adding seats
}

export const CompanySubscriptionPage: React.FC = () => {
  const { state, refreshData, grantModuleAccess, revokeModuleAccess } = useAppContext();
  const { currentCompany, users, companyModules, modules, moduleUserAccess, paymentHistory: allPaymentHistory } = state;

  const [activeTab, setActiveTab] = useState<'modules' | 'usage' | 'history' | 'subscription'>('modules');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Module access management state
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [accessSearch, setAccessSearch] = useState('');
  const [accessLoading, setAccessLoading] = useState<string | null>(null);

  // Invoices state
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  // Cart state for module purchases
  const [cart, setCart] = useState<CartItem[]>([]);
  const [pendingUsers, setPendingUsers] = useState<Record<string, number>>({});
  const [cartBadgeAnimation, setCartBadgeAnimation] = useState<string | null>(null);
  const [flyingNumber, setFlyingNumber] = useState<{moduleCode: string, value: number, x: number, y: number} | null>(null);

  // Purchase flow state
  const [purchaseMode, setPurchaseMode] = useState<'none' | 'now' | 'next_month' | 'reduce'>('none');
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  // Refs for animation
  const cartIconRef = useRef<HTMLButtonElement>(null);
  const cartSectionRef = useRef<HTMLDivElement>(null);

  // Stripe configuration state
  const stripeEnabled = isStripeConfigured();

  // Get company users
  const companyUsers = useMemo(() => {
    if (!currentCompany) return [];
    return users.filter(u => u.company_id === currentCompany.id);
  }, [users, currentCompany]);

  // Get company modules with details
  const myModules = useMemo(() => {
    if (!currentCompany) return [];
    return companyModules
      .filter(cm => cm.company_id === currentCompany.id)
      .map(cm => {
        const mod = modules.find(m => m.code === cm.module_code);
        const usersInModule = moduleUserAccess.filter(
          mua => mua.company_id === currentCompany.id && mua.module_code === cm.module_code && mua.is_enabled
        ).length;
        return {
          ...cm,
          module: mod,
          activeUsers: usersInModule
        };
      });
  }, [companyModules, modules, moduleUserAccess, currentCompany]);

  // Compute subscription display status (like super admin panel)
  // BRAK - no active subscription and no demo
  // DEMO - has demo modules but no paid subscriptions
  // AKTYWNA - has active paid subscription
  const subscriptionDisplayStatus = useMemo(() => {
    const activeModules = myModules.filter(m => m.is_active);

    // Check for any paid subscription (has stripe_subscription_id)
    const hasPaidSubscription = activeModules.some(m => m.stripe_subscription_id);

    if (hasPaidSubscription) {
      return { key: 'active', text: COMPANY_SUBSCRIPTION_DISPLAY_LABELS['active'], color: COMPANY_SUBSCRIPTION_DISPLAY_COLORS['active'] };
    }

    // Check for DEMO (active modules without stripe subscription)
    const hasDemoModules = activeModules.some(m => !m.stripe_subscription_id);
    if (hasDemoModules) {
      return { key: 'demo', text: COMPANY_SUBSCRIPTION_DISPLAY_LABELS['demo'], color: COMPANY_SUBSCRIPTION_DISPLAY_COLORS['demo'] };
    }

    // No subscriptions
    return { key: 'none', text: COMPANY_SUBSCRIPTION_DISPLAY_LABELS['none'], color: COMPANY_SUBSCRIPTION_DISPLAY_COLORS['none'] };
  }, [myModules]);

  // Calculate totals
  const totals = useMemo(() => {
    const monthly = myModules.reduce((sum, m) => {
      if (m.is_active) {
        return sum + (m.max_users * m.price_per_user);
      }
      return sum;
    }, 0);

    return {
      monthlyTotal: monthly,
      bonusBalance: currentCompany?.bonus_balance || 0,
      nextPayment: monthly - (currentCompany?.bonus_balance || 0)
    };
  }, [myModules, currentCompany]);

  // Get payment history for current company
  const paymentHistory = useMemo(() => {
    if (!currentCompany) return [];
    return allPaymentHistory.filter(ph => ph.company_id === currentCompany.id);
  }, [allPaymentHistory, currentCompany]);

  // Helper function to get module status display
  const getModuleStatus = (companyMod: typeof myModules[0] | undefined) => {
    if (!companyMod) {
      return { text: 'BRAK', color: 'bg-slate-100 text-slate-600', hasDate: false };
    }

    // Check if it's a demo module
    if (companyMod.demo_end_date) {
      const demoEndDate = new Date(companyMod.demo_end_date);
      const now = new Date();
      if (demoEndDate > now) {
        return {
          text: `DEMO do ${demoEndDate.toLocaleDateString('pl-PL')}`,
          color: 'bg-amber-100 text-amber-700',
          hasDate: true
        };
      }
    }

    // Active module
    if (companyMod.is_active) {
      if (companyMod.deactivated_at) {
        const deactivationDate = new Date(companyMod.deactivated_at);
        return {
          text: `AKTYWNY DO ${deactivationDate.toLocaleDateString('pl-PL')}`,
          color: 'bg-green-100 text-green-700',
          hasDate: true
        };
      }
      return { text: 'AKTYWNY', color: 'bg-green-100 text-green-700', hasDate: false };
    }

    return { text: 'BRAK', color: 'bg-slate-100 text-slate-600', hasDate: false };
  };

  // Get total cart count
  const cartTotalUsers = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.newUsers, 0);
  }, [cart]);

  // Calculate days in current month
  const getDaysInMonth = () => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return lastDay.getDate();
  };

  const getDaysRemaining = () => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return lastDay.getDate() - now.getDate() + 1;
  };

  // Calculate pro-rata price for immediate purchase
  const calculateProRataPrice = (pricePerUser: number, newUsers: number) => {
    const daysInMonth = getDaysInMonth();
    const daysRemaining = getDaysRemaining();
    return (pricePerUser * newUsers * daysRemaining) / daysInMonth;
  };

  // Calculate total cart value for immediate purchase
  const cartTotalValueNow = useMemo(() => {
    return cart.reduce((sum, item) => {
      return sum + calculateProRataPrice(item.pricePerUser, item.newUsers);
    }, 0);
  }, [cart]);

  // Calculate total cart value for next month
  const cartTotalValueNextMonth = useMemo(() => {
    return cart.reduce((sum, item) => {
      return sum + (item.pricePerUser * item.newUsers);
    }, 0);
  }, [cart]);

  // Handle adding users to pending (counter increment)
  // For existing modules, allow negative values (reduction) but not below -(max_users - 1)
  const handlePendingChange = (moduleCode: string, delta: number, minValue: number = 0) => {
    setPendingUsers(prev => {
      const current = prev[moduleCode] || 0;
      const newValue = Math.max(minValue, current + delta);
      if (newValue === 0) {
        const { [moduleCode]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [moduleCode]: newValue };
    });
  };

  // Handle adding to cart with animation
  const handleAddToCart = (moduleCode: string, moduleName: string, currentUsers: number, pricePerUser: number, isNewModule: boolean, buttonElement: HTMLButtonElement, overrideCount?: number) => {
    const count = overrideCount ?? pendingUsers[moduleCode] ?? 0;
    if (count === 0) return;

    const buttonRect = buttonElement.getBoundingClientRect();
    setFlyingNumber({
      moduleCode,
      value: count,
      x: buttonRect.left + buttonRect.width / 2,
      y: buttonRect.top
    });

    setTimeout(() => {
      setFlyingNumber(null);
      setCart(prev => {
        const existingIndex = prev.findIndex(item => item.moduleCode === moduleCode);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            newUsers: updated[existingIndex].newUsers + count
          };
          return updated;
        } else {
          return [...prev, { moduleCode, moduleName, currentUsers, newUsers: count, pricePerUser, isNewModule }];
        }
      });

      setPendingUsers(prev => {
        const { [moduleCode]: _, ...rest } = prev;
        return rest;
      });

      setCartBadgeAnimation(moduleCode);
      setTimeout(() => setCartBadgeAnimation(null), 600);
    }, 500);
  };

  // Handle updating cart item
  const handleCartItemChange = (moduleCode: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.moduleCode === moduleCode) {
          const newUsers = Math.max(0, item.newUsers + delta);
          return { ...item, newUsers };
        }
        return item;
      }).filter(item => item.newUsers > 0);
    });
  };

  // Handle removing from cart
  const handleRemoveFromCart = (moduleCode: string) => {
    setCart(prev => prev.filter(item => item.moduleCode !== moduleCode));
  };

  // Handle clearing cart
  const handleClearCart = () => {
    if (confirmClear) {
      setCart([]);
      setPurchaseMode('none');
      setConfirmClear(false);
    } else {
      setConfirmClear(true);
    }
  };

  // Scroll to cart section
  const scrollToCart = () => {
    cartSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Handle purchase now (pro-rata for existing, checkout for new)
  const handlePurchaseNow = async () => {
    if (!currentCompany || cart.length === 0) return;

    setLoading('purchase-now');
    setError(null);

    try {
      // Check if there are any new modules that need Stripe Checkout
      const newModules = cart.filter(item => item.isNewModule);
      const existingModules = cart.filter(item => !item.isNewModule);

      // For new modules - redirect to Stripe Checkout
      if (newModules.length > 0) {
        // Prepare modules array for checkout (supports multiple modules in one session)
        const modulesForCheckout = newModules.map(item => ({
          moduleCode: item.moduleCode,
          quantity: item.newUsers
        }));

        console.log('Creating checkout session for modules:', modulesForCheckout);

        const { data, error: fnError } = await supabase.functions.invoke('stripe-checkout', {
          body: {
            action: 'create-checkout-session',
            companyId: currentCompany.id,
            modules: modulesForCheckout, // Array of modules
            successUrl: `${window.location.origin}/#/company/subscription?success=true`,
            cancelUrl: `${window.location.origin}/#/company/subscription?canceled=true`
          }
        });

        console.log('Checkout response:', { data, fnError });

        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);

        if (data?.url) {
          // Clear cart and redirect to Stripe
          setCart([]);
          setPurchaseMode('none');
          console.log('Redirecting to:', data.url);
          window.location.href = data.url;
          return;
        } else {
          throw new Error('Nie otrzymano URL sesji płatności');
        }
      }

      // For existing modules - create prorated payment checkout
      if (existingModules.length > 0) {
        // Process first existing module (redirect to checkout)
        const item = existingModules[0];
        const companyMod = myModules.find(cm => cm.module_code === item.moduleCode);
        if (!companyMod) throw new Error('Module not found');

        console.log('Creating prorated payment for module:', item.moduleCode, 'additional users:', item.newUsers);

        const { data, error: fnError } = await supabase.functions.invoke('stripe-checkout', {
          body: {
            action: 'create-prorated-payment',
            companyId: currentCompany.id,
            moduleCode: item.moduleCode,
            additionalQuantity: item.newUsers,
            successUrl: `${window.location.origin}/#/company/subscription?success=true`,
            cancelUrl: `${window.location.origin}/#/company/subscription?canceled=true`
          }
        });

        console.log('Prorated payment response:', { data, fnError });

        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);

        if (data?.url) {
          setCart([]);
          setPurchaseMode('none');
          window.location.href = data.url;
          return;
        } else {
          throw new Error('Nie otrzymano URL sesji płatności');
        }
      }
    } catch (err) {
      console.error('Purchase now error:', err);
      setError(err instanceof Error ? err.message : 'Wystąpił błąd podczas zakupu');
    } finally {
      setLoading(null);
    }
  };

  // Handle purchase for next month
  const handlePurchaseNextMonth = async () => {
    if (!currentCompany || cart.length === 0) return;

    setLoading('purchase-next-month');
    setError(null);

    try {
      // Check if there are any new modules - they need Stripe Checkout (can't schedule new subscription)
      const newModules = cart.filter(item => item.isNewModule);
      const existingModules = cart.filter(item => !item.isNewModule);

      // For new modules - redirect to Stripe Checkout (same as "now" - can't schedule new subscription)
      if (newModules.length > 0) {
        const modulesForCheckout = newModules.map(item => ({
          moduleCode: item.moduleCode,
          quantity: item.newUsers
        }));

        const { data, error: fnError } = await supabase.functions.invoke('stripe-checkout', {
          body: {
            action: 'create-checkout-session',
            companyId: currentCompany.id,
            modules: modulesForCheckout,
            successUrl: `${window.location.origin}/#/company/subscription?success=true`,
            cancelUrl: `${window.location.origin}/#/company/subscription?canceled=true`
          }
        });

        if (fnError) throw fnError;

        if (data?.url) {
          setCart([]);
          setPurchaseMode('none');
          window.location.href = data.url;
          return;
        }
      }

      // For existing modules - schedule subscription update
      let effectiveDate: Date | null = null;
      for (const item of existingModules) {
        const companyMod = myModules.find(cm => cm.module_code === item.moduleCode);
        if (!companyMod) continue;

        const newMaxUsers = companyMod.max_users + item.newUsers;

        const { data, error: fnError } = await supabase.functions.invoke('stripe-checkout', {
          body: {
            action: 'schedule-subscription-update',
            companyId: currentCompany.id,
            moduleCode: item.moduleCode,
            quantity: newMaxUsers
          }
        });

        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);
        if (data?.effectiveDate) {
          effectiveDate = new Date(data.effectiveDate);
        }
      }

      const dateStr = effectiveDate
        ? effectiveDate.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
        : 'następnego okresu rozliczeniowego';
      setSuccess(`Zmiany zostały zaplanowane. Nowe miejsca będą dostępne od ${dateStr}.`);
      setCart([]);
      setPurchaseMode('none');
      await refreshData();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error('Purchase next month error:', err);
      setError(err instanceof Error ? err.message : 'Wystąpił błąd podczas planowania zakupu');
    } finally {
      setLoading(null);
    }
  };

  // Handle subscription reduction (schedule decrease from next month)
  const handleReduceSubscription = async () => {
    if (!currentCompany || cart.length === 0) return;

    setLoading('reduce');
    setError(null);

    try {
      // Process reductions (only existing modules with negative newUsers)
      const reductions = cart.filter(item => item.newUsers < 0 && !item.isNewModule);

      let effectiveDate: Date | null = null;
      for (const item of reductions) {
        const companyMod = myModules.find(cm => cm.module_code === item.moduleCode);
        if (!companyMod) continue;

        // Calculate new total quantity (current + negative change)
        const newMaxUsers = companyMod.max_users + item.newUsers; // item.newUsers is negative

        const { data, error: fnError } = await supabase.functions.invoke('stripe-checkout', {
          body: {
            action: 'schedule-subscription-update',
            companyId: currentCompany.id,
            moduleCode: item.moduleCode,
            quantity: newMaxUsers
          }
        });

        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);
        if (data?.effectiveDate) {
          effectiveDate = new Date(data.effectiveDate);
        }
      }

      const dateStr = effectiveDate
        ? effectiveDate.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
        : 'następnego okresu rozliczeniowego';
      setSuccess(`Zmniejszenie subskrypcji zostało zaplanowane. Zmiana wejdzie w życie od ${dateStr}.`);
      setCart([]);
      setPurchaseMode('none');
      await refreshData();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error('Reduce subscription error:', err);
      setError(err instanceof Error ? err.message : 'Wystąpił błąd podczas zmniejszania subskrypcji');
    } finally {
      setLoading(null);
    }
  };

  // Handle cancel purchase mode
  const handleCancelPurchase = () => {
    if (confirmCancel) {
      setPurchaseMode('none');
      setConfirmCancel(false);
    } else {
      setConfirmCancel(true);
    }
  };

  // Get active module codes for usage tab
  const activeModuleCodes = useMemo(() => {
    return myModules.filter(m => m.is_active).map(m => m.module_code);
  }, [myModules]);

  // Get company users (excluding global users and admins) for access management
  const accessibleUsers = useMemo(() => {
    if (!currentCompany) return [];
    return users.filter(u =>
      u.company_id === currentCompany.id &&
      !u.is_global_user &&
      u.role !== Role.COMPANY_ADMIN &&
      u.status !== UserStatus.INACTIVE
    );
  }, [users, currentCompany]);

  // Filter users by search
  const filteredAccessUsers = useMemo(() => {
    return accessibleUsers.filter(u =>
      u.first_name.toLowerCase().includes(accessSearch.toLowerCase()) ||
      u.last_name.toLowerCase().includes(accessSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(accessSearch.toLowerCase())
    );
  }, [accessibleUsers, accessSearch]);

  // Check if user has access to a module
  const hasModuleAccess = (userId: string, moduleCode: string): boolean => {
    return moduleUserAccess.some(
      mua => mua.user_id === userId && mua.module_code === moduleCode && mua.is_enabled
    );
  };

  // Get users with/without access to selected module
  const usersWithAccess = useMemo(() => {
    if (!selectedModule) return [];
    return filteredAccessUsers.filter(u => hasModuleAccess(u.id, selectedModule));
  }, [filteredAccessUsers, selectedModule, moduleUserAccess]);

  const usersWithoutAccess = useMemo(() => {
    if (!selectedModule) return [];
    return filteredAccessUsers.filter(u => !hasModuleAccess(u.id, selectedModule));
  }, [filteredAccessUsers, selectedModule, moduleUserAccess]);

  // Toggle user access
  const toggleAccess = async (userId: string, moduleCode: string, currentAccess: boolean) => {
    setAccessLoading(userId);
    setError(null);
    try {
      if (currentAccess) {
        await revokeModuleAccess(userId, moduleCode);
      } else {
        await grantModuleAccess(userId, moduleCode);
      }
    } catch (err) {
      console.error('Error toggling access:', err);
      setError(err instanceof Error ? err.message : 'Wystąpił błąd podczas zmiany dostępu');
    } finally {
      setAccessLoading(null);
    }
  };

  // Fetch invoices from Stripe
  const fetchInvoices = async () => {
    if (!currentCompany?.stripe_customer_id) return;

    setInvoicesLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          action: 'list-invoices',
          customerId: currentCompany.stripe_customer_id
        }
      });

      if (fnError) throw fnError;
      setInvoices(data?.invoices || []);
    } catch (err) {
      console.error('Error fetching invoices:', err);
    } finally {
      setInvoicesLoading(false);
    }
  };

  // Fetch invoices when tab changes to subscription management
  React.useEffect(() => {
    if (activeTab === 'subscription' && currentCompany?.stripe_customer_id) {
      fetchInvoices();
    }
  }, [activeTab, currentCompany?.stripe_customer_id]);

  // Handle Stripe checkout for module activation
  const handleActivateModule = async (moduleCode: string, maxUsers: number = 10) => {
    if (!currentCompany) return;

    setLoading(moduleCode);
    setError(null);

    try {
      // Call Edge Function to create Stripe Checkout session
      const { data, error: fnError } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          action: 'create-checkout-session',
          companyId: currentCompany.id,
          moduleCode,
          quantity: maxUsers,
          successUrl: `${window.location.origin}/#/company/subscription?success=true&module=${moduleCode}`,
          cancelUrl: `${window.location.origin}/#/company/subscription?canceled=true`
        }
      });

      if (fnError) throw fnError;

      if (data?.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err instanceof Error ? err.message : 'Wystąpił błąd podczas tworzenia sesji płatności');
    } finally {
      setLoading(null);
    }
  };

  // Handle opening Stripe Customer Portal
  const handleOpenPortal = async () => {
    if (!currentCompany?.stripe_customer_id) {
      setError('Brak konta Stripe. Najpierw aktywuj moduł.');
      return;
    }

    setLoading('portal');
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          action: 'create-portal-session',
          customerId: currentCompany.stripe_customer_id,
          returnUrl: `${window.location.origin}/#/company/subscription`
        }
      });

      if (fnError) throw fnError;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Portal error:', err);
      setError(err instanceof Error ? err.message : 'Nie udało się otworzyć panelu zarządzania');
    } finally {
      setLoading(null);
    }
  };

  // Handle changing user count for a module
  const handleChangeSeats = async (moduleCode: string, delta: number) => {
    const companyMod = myModules.find(cm => cm.module_code === moduleCode);
    if (!companyMod || !currentCompany) return;

    const newCount = Math.max(1, companyMod.max_users + delta);
    if (newCount === companyMod.max_users) return;

    setLoading(moduleCode);
    setError(null);

    try {
      // Update via Edge Function (which handles Stripe subscription update)
      const { data, error: fnError } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          action: 'update-subscription',
          companyId: currentCompany.id,
          moduleCode,
          quantity: newCount
        }
      });

      if (fnError) throw fnError;

      setSuccess(`Liczba miejsc zmieniona na ${newCount}`);
      await refreshData();

      // Clear success after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Update seats error:', err);
      setError(err instanceof Error ? err.message : 'Nie udało się zmienić liczby miejsc');
    } finally {
      setLoading(null);
    }
  };

  // Check URL params for success/cancel
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');

    // Always reset loading state when returning from Stripe
    setLoading(null);
    setPurchaseMode('none');

    if (urlParams.get('success') === 'true') {
      setSuccess('Płatność zakończona pomyślnie! Moduł został aktywowany.');
      setCart([]); // Clear cart after successful payment
      refreshData();
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname + '#/company/subscription');
    }
    if (urlParams.get('canceled') === 'true') {
      setError('Płatność została anulowana. Możesz spróbować ponownie.');
      // Don't clear cart on cancel - user may want to retry
      window.history.replaceState({}, '', window.location.pathname + '#/company/subscription');
    }
  }, []);

  if (!currentCompany) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
          <p className="text-yellow-800">Brak przypisanej firmy</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Subskrypcja</h1>
        <p className="text-slate-500 mt-1">Zarządzaj modułami i płatnościami</p>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
          <Check className="w-5 h-5 text-green-600" />
          <p className="text-green-800">{success}</p>
          <button onClick={() => setSuccess(null)} className="ml-auto text-green-600 hover:text-green-800">
            &times;
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-800">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800">
            &times;
          </button>
        </div>
      )}

      {/* Status Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
              <CreditCard className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Status subskrypcji</p>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border mt-1 ${subscriptionDisplayStatus.color}`}>
                {subscriptionDisplayStatus.text}
              </span>
            </div>
          </div>

          <div className="text-center">
            <p className="text-sm text-slate-500">Balans bonusowy</p>
            <p className="text-2xl font-bold text-green-600">{totals.bonusBalance.toFixed(2)} PLN</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('modules')}
          className={`px-3 py-2 text-sm font-medium transition border-b-2 -mb-px whitespace-nowrap ${
            activeTab === 'modules'
              ? 'text-blue-600 border-blue-600'
              : 'text-slate-500 border-transparent hover:text-slate-700'
          }`}
        >
          <Package className="w-4 h-4 inline mr-1" />
          Moduły
        </button>
        <button
          onClick={() => { setActiveTab('usage'); setSelectedModule(null); }}
          className={`px-3 py-2 text-sm font-medium transition border-b-2 -mb-px whitespace-nowrap ${
            activeTab === 'usage'
              ? 'text-blue-600 border-blue-600'
              : 'text-slate-500 border-transparent hover:text-slate-700'
          }`}
        >
          <Users className="w-4 h-4 inline mr-1" />
          Wykorzystanie
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-3 py-2 text-sm font-medium transition border-b-2 -mb-px whitespace-nowrap ${
            activeTab === 'history'
              ? 'text-blue-600 border-blue-600'
              : 'text-slate-500 border-transparent hover:text-slate-700'
          }`}
        >
          <FileText className="w-4 h-4 inline mr-1" />
          Historia
        </button>
        <button
          onClick={() => setActiveTab('subscription')}
          className={`px-3 py-2 text-sm font-medium transition border-b-2 -mb-px whitespace-nowrap ${
            activeTab === 'subscription'
              ? 'text-blue-600 border-blue-600'
              : 'text-slate-500 border-transparent hover:text-slate-700'
          }`}
        >
          <Settings className="w-4 h-4 inline mr-1" />
          Subskrypcja
        </button>
      </div>

      {/* Modules Tab */}
      {activeTab === 'modules' && (
        <div className="space-y-4">
          {/* Flying number animation */}
          {flyingNumber && (
            <div
              className="fixed z-50 pointer-events-none"
              style={{
                left: flyingNumber.x,
                top: flyingNumber.y,
                animation: 'flyToCart 0.5s ease-in-out forwards'
              }}
            >
              <span className="bg-blue-600 text-white px-3 py-1 rounded-full font-bold text-lg shadow-lg">
                +{flyingNumber.value}
              </span>
            </div>
          )}

          <style>{`
            @keyframes flyToCart {
              0% { transform: translate(0, 0) scale(1); opacity: 1; }
              100% { transform: translate(${cartIconRef.current ? cartIconRef.current.getBoundingClientRect().left - (flyingNumber?.x || 0) : 0}px, ${cartIconRef.current ? cartIconRef.current.getBoundingClientRect().top - (flyingNumber?.y || 0) : 0}px) scale(0.5); opacity: 0; }
            }
            @keyframes badgePulse {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.2); }
            }
          `}</style>

          {/* Available Modules */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Dostępne moduły</h3>
              <button
                ref={cartIconRef}
                onClick={scrollToCart}
                className={`relative p-2 rounded-lg transition ${
                  cartTotalUsers > 0 ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                }`}
                disabled={cart.length === 0}
              >
                <ShoppingCart className="w-5 h-5" />
                {cartTotalUsers > 0 && (
                  <span
                    className={`absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1`}
                    style={cartBadgeAnimation ? { animation: 'badgePulse 0.3s ease-in-out 2' } : {}}
                  >
                    {cartTotalUsers}
                  </span>
                )}
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {modules.filter(m => m.is_active).map(mod => {
                const companyMod = myModules.find(cm => cm.module_code === mod.code);
                const isActive = companyMod?.is_active;
                const hasDemo = companyMod?.demo_end_date && new Date(companyMod.demo_end_date) > new Date();
                const isLoading = loading === mod.code;
                const moduleStatus = getModuleStatus(companyMod);
                const pendingCount = pendingUsers[mod.code] || 0;
                const currentMaxUsers = companyMod?.max_users || 0;

                return (
                  <div key={mod.code} className="p-5">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          isActive ? 'bg-green-100' : hasDemo ? 'bg-amber-100' : 'bg-slate-100'
                        }`}>
                          <Package className={`w-6 h-6 ${isActive ? 'text-green-600' : hasDemo ? 'text-amber-600' : 'text-slate-400'}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-slate-900">{mod.name_pl}</h4>
                            <span className={`px-2 py-0.5 ${moduleStatus.color} text-xs rounded-full font-medium`}>
                              {moduleStatus.text}
                            </span>
                          </div>
                          <p className="text-sm text-slate-500 mt-1">{mod.description_pl || MODULE_DESCRIPTIONS[mod.code]}</p>
                          <p className="text-sm font-medium text-blue-600 mt-2">{mod.base_price_per_user} PLN / użytkownik / miesiąc</p>
                        </div>
                      </div>

                      {/* Active/Demo modules - show current users and add/reduce seats */}
                      {(isActive || hasDemo) && companyMod && (
                        <div className="flex items-start gap-6">
                          <div className="text-center">
                            <p className="text-sm text-slate-500">Użytkowników</p>
                            <p className="text-lg font-bold text-slate-900">{currentMaxUsers}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-slate-500 mb-1">Dokup lub zmniejsz</p>
                            <div className="flex items-center gap-2">
                              <button
                                className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition"
                                disabled={isLoading || pendingCount <= -(currentMaxUsers - 1)}
                                onClick={() => handlePendingChange(mod.code, -1, -(currentMaxUsers - 1))}
                              >
                                <Minus className="w-4 h-4 text-slate-600" />
                              </button>
                              <span className={`w-10 text-center font-bold text-lg ${pendingCount < 0 ? 'text-red-600' : 'text-blue-600'}`}>{pendingCount}</span>
                              <button
                                className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition"
                                disabled={isLoading}
                                onClick={() => handlePendingChange(mod.code, 1, -(currentMaxUsers - 1))}
                              >
                                <Plus className="w-4 h-4 text-slate-600" />
                              </button>
                            </div>
                          </div>
                          {pendingCount !== 0 && (
                            <div className="text-center">
                              <p className="text-sm text-slate-500 mb-1">&nbsp;</p>
                              {pendingCount > 0 ? (
                                <button
                                  onClick={(e) => handleAddToCart(mod.code, mod.name_pl, currentMaxUsers, mod.base_price_per_user, false, e.currentTarget)}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                                >
                                  <ShoppingCart className="w-4 h-4" />
                                  Dodaj
                                </button>
                              ) : (
                                <button
                                  onClick={(e) => handleAddToCart(mod.code, mod.name_pl, currentMaxUsers, mod.base_price_per_user, false, e.currentTarget)}
                                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2"
                                >
                                  <ShoppingCart className="w-4 h-4" />
                                  Zmniejsz
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Inactive modules - show counter to select seats for activation */}
                      {!isActive && !hasDemo && (
                        <div className="flex items-start gap-6">
                          <div className="text-center">
                            <p className="text-sm text-slate-500 mb-1">Wybierz miejsca</p>
                            <div className="flex items-center gap-2">
                              <button
                                className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition"
                                disabled={isLoading || pendingCount <= 1}
                                onClick={() => handlePendingChange(mod.code, -1)}
                              >
                                <Minus className="w-4 h-4 text-slate-600" />
                              </button>
                              <span className="w-10 text-center font-bold text-lg text-blue-600">{pendingCount || 1}</span>
                              <button
                                className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition"
                                disabled={isLoading}
                                onClick={() => handlePendingChange(mod.code, 1)}
                              >
                                <Plus className="w-4 h-4 text-slate-600" />
                              </button>
                            </div>
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-slate-500 mb-1">&nbsp;</p>
                            <button
                              onClick={(e) => {
                                // Pass count directly (use pendingCount or default to 1)
                                const countToAdd = pendingCount || 1;
                                handleAddToCart(mod.code, mod.name_pl, 0, mod.base_price_per_user, true, e.currentTarget, countToAdd);
                              }}
                              disabled={isLoading || !stripeEnabled}
                              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition ${
                                stripeEnabled ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50' : 'bg-slate-100 text-slate-500 cursor-not-allowed'
                              }`}
                            >
                              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                              Do koszyka
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cart Section */}
          {cart.length > 0 && (
            <div ref={cartSectionRef} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-blue-50">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-blue-600" />
                    Koszyk
                  </h3>
                  <span className="text-sm text-slate-500">{cart.length} {cart.length === 1 ? 'moduł' : cart.length < 5 ? 'moduły' : 'modułów'}</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Moduł</th>
                      <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Obecnie</th>
                      <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Zmiana</th>
                      <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Łącznie</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Akcje</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cart.map(item => {
                      const isReduction = item.newUsers < 0;
                      const minChange = item.isNewModule ? 1 : -(item.currentUsers - 1);
                      return (
                        <tr key={item.moduleCode} className="hover:bg-slate-50">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.isNewModule ? 'bg-blue-100' : isReduction ? 'bg-red-100' : 'bg-green-100'}`}>
                                <Package className={`w-4 h-4 ${item.isNewModule ? 'text-blue-600' : isReduction ? 'text-red-600' : 'text-green-600'}`} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-slate-900">{item.moduleName}</p>
                                  {item.isNewModule && (
                                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-medium">NOWY</span>
                                  )}
                                  {isReduction && (
                                    <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded font-medium">ZMNIEJSZENIE</span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500">{item.pricePerUser} PLN/użytkownik</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-center">
                            {item.isNewModule ? (
                              <span className="text-blue-600 font-medium">—</span>
                            ) : (
                              <span className="text-slate-600 font-medium">{item.currentUsers}</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <button className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition" disabled={item.newUsers <= minChange} onClick={() => handleCartItemChange(item.moduleCode, -1)}>
                                <Minus className="w-3 h-3 text-slate-600" />
                              </button>
                              <span className={`w-8 text-center font-bold ${isReduction ? 'text-red-600' : 'text-blue-600'}`}>{item.newUsers > 0 ? '+' : ''}{item.newUsers}</span>
                              <button className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition" onClick={() => handleCartItemChange(item.moduleCode, 1)}>
                                <Plus className="w-3 h-3 text-slate-600" />
                              </button>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <span className={`font-bold ${isReduction ? 'text-red-600' : 'text-green-600'}`}>{item.currentUsers + item.newUsers}</span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button onClick={() => handleRemoveFromCart(item.moduleCode)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition" title="Usuń z koszyka">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {purchaseMode === 'none' && (() => {
                const hasNewModules = cart.some(i => i.isNewModule);
                const hasReductions = cart.some(i => i.newUsers < 0);
                const hasAdditions = cart.some(i => i.newUsers > 0 && !i.isNewModule);
                const onlyReductions = hasReductions && !hasNewModules && !hasAdditions;

                return (
                  <div className="px-5 py-4 border-t border-slate-200 bg-slate-50">
                    <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
                      <div className="text-sm text-slate-600">
                        {onlyReductions ? (
                          <span className="text-red-600 font-medium">Zmniejszenie o {Math.abs(cartTotalUsers)} miejsc</span>
                        ) : (
                          <><span className="font-medium">{cartTotalUsers}</span> użytkowników w koszyku</>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {onlyReductions ? (
                          // Only show reduction button when cart contains only reductions
                          <button onClick={() => setPurchaseMode('reduce')} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2">
                            <Calendar className="w-4 h-4" />Zmniejsz subskrypcję
                          </button>
                        ) : (
                          <>
                            {!hasReductions && (
                              <button onClick={() => setPurchaseMode('now')} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2">
                                <Zap className="w-4 h-4" />{hasNewModules ? 'Aktywuj teraz' : 'Dokup na już'}
                              </button>
                            )}
                            {!hasNewModules && !hasReductions && (
                              <button onClick={() => setPurchaseMode('next_month')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2">
                                <Calendar className="w-4 h-4" />Dokup od następnego miesiąca
                              </button>
                            )}
                            {hasReductions && hasAdditions && (
                              <p className="text-sm text-amber-600">Nie można mieszać dokupowania i zmniejszania. Usuń jedne z koszyka.</p>
                            )}
                          </>
                        )}
                        <button onClick={handleClearCart} className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${confirmClear ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>
                          <Trash2 className="w-4 h-4" />{confirmClear ? 'Na pewno?' : 'Wyczyść'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {purchaseMode === 'now' && (
                <div className="px-5 py-4 border-t border-slate-200 bg-green-50">
                  <div className="space-y-4">
                    <h4 className="font-semibold text-green-800 flex items-center gap-2">
                      <Zap className="w-5 h-5" />
                      {cart.some(i => i.isNewModule) ? 'Aktywacja modułu' : 'Kalkulacja - dokup na już'}
                    </h4>
                    <div className="bg-white rounded-lg p-4 border border-green-200">
                      {cart.some(i => i.isNewModule) ? (
                        <>
                          <p className="text-sm text-slate-600 mb-3">Zostaniesz przekierowany do strony płatności Stripe:</p>
                          <div className="space-y-2">
                            {cart.filter(i => i.isNewModule).map(item => (
                              <div key={item.moduleCode} className="flex justify-between text-sm">
                                <span className="text-slate-600">{item.moduleName}: {item.newUsers} użytkowników × {item.pricePerUser} PLN</span>
                                <span className="font-medium text-slate-900">{(item.newUsers * item.pricePerUser).toFixed(2)} PLN/mies.</span>
                              </div>
                            ))}
                            <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between">
                              <div>
                                <span className="font-semibold text-slate-900">Miesięczna subskrypcja</span>
                                <p className="text-xs text-slate-500">
                                  {new Date().toLocaleDateString('pl-PL')} — {new Date(new Date().setMonth(new Date().getMonth() + 1)).toLocaleDateString('pl-PL')}
                                </p>
                              </div>
                              <span className="font-bold text-xl text-green-600">{cart.filter(i => i.isNewModule).reduce((sum, i) => sum + i.newUsers * i.pricePerUser, 0).toFixed(2)} PLN</span>
                            </div>
                          </div>
                          <p className="text-xs text-slate-500 mt-3">Po dokonaniu płatności moduł zostanie aktywowany automatycznie. Subskrypcja odnawia się co miesiąc.</p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-slate-600 mb-3">Proporcjonalna opłata za pozostałe dni miesiąca ({getDaysRemaining()} dni z {getDaysInMonth()}):</p>
                          <div className="space-y-2">
                            {cart.map(item => {
                              const proRataPrice = calculateProRataPrice(item.pricePerUser, item.newUsers);
                              return (
                                <div key={item.moduleCode} className="flex justify-between text-sm">
                                  <span className="text-slate-600">{item.moduleName}: {item.newUsers} × {item.pricePerUser} PLN × {getDaysRemaining()}/{getDaysInMonth()} dni</span>
                                  <span className="font-medium text-slate-900">{proRataPrice.toFixed(2)} PLN</span>
                                </div>
                              );
                            })}
                            <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between">
                              <span className="font-semibold text-slate-900">Razem do zapłaty teraz:</span>
                              <span className="font-bold text-xl text-green-600">{cartTotalValueNow.toFixed(2)} PLN</span>
                            </div>
                          </div>
                          <p className="text-xs text-slate-500 mt-3">Od następnego miesiąca będzie pobierana pełna opłata za wszystkich użytkowników ({cartTotalValueNextMonth.toFixed(2)} PLN/mies. więcej).</p>
                        </>
                      )}
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={handleCancelPurchase} className={`px-4 py-2 rounded-lg transition ${confirmCancel ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>{confirmCancel ? 'Na pewno anulować?' : 'Anuluj'}</button>
                      <button onClick={handlePurchaseNow} disabled={loading === 'purchase-now'} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2 disabled:opacity-50">
                        {loading === 'purchase-now' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        {cart.some(i => i.isNewModule) ? 'Przejdź do płatności' : 'Kup teraz'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {purchaseMode === 'next_month' && (
                <div className="px-5 py-4 border-t border-slate-200 bg-blue-50">
                  <div className="space-y-4">
                    <h4 className="font-semibold text-blue-800 flex items-center gap-2"><Calendar className="w-5 h-5" />Kalkulacja - dokup od następnego miesiąca</h4>
                    <div className="bg-white rounded-lg p-4 border border-blue-200">
                      <p className="text-sm text-slate-600 mb-3">Nowe miejsca będą aktywowane z początkiem następnego okresu rozliczeniowego:</p>
                      <div className="space-y-2">
                        {cart.map(item => (
                          <div key={item.moduleCode} className="flex justify-between text-sm">
                            <span className="text-slate-600">{item.moduleName}: +{item.newUsers} użytkowników × {item.pricePerUser} PLN</span>
                            <span className="font-medium text-slate-900">{(item.newUsers * item.pricePerUser).toFixed(2)} PLN/mies.</span>
                          </div>
                        ))}
                        <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between">
                          <span className="font-semibold text-slate-900">Wzrost miesięcznej opłaty:</span>
                          <span className="font-bold text-xl text-blue-600">+{cartTotalValueNextMonth.toFixed(2)} PLN</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-3">Obecnie nie zostanie pobrana żadna opłata. Zmiana zostanie aktywowana z początkiem następnego okresu rozliczeniowego.</p>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={handleCancelPurchase} className={`px-4 py-2 rounded-lg transition ${confirmCancel ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>{confirmCancel ? 'Na pewno anulować?' : 'Anuluj'}</button>
                      <button onClick={handlePurchaseNextMonth} disabled={loading === 'purchase-next-month'} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50">
                        {loading === 'purchase-next-month' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Zaplanuj zakup
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {purchaseMode === 'reduce' && (
                <div className="px-5 py-4 border-t border-slate-200 bg-red-50">
                  <div className="space-y-4">
                    <h4 className="font-semibold text-red-800 flex items-center gap-2"><Calendar className="w-5 h-5" />Zmniejszenie subskrypcji</h4>
                    <div className="bg-white rounded-lg p-4 border border-red-200">
                      <p className="text-sm text-slate-600 mb-3">Liczba miejsc zostanie zmniejszona od następnego okresu rozliczeniowego:</p>
                      <div className="space-y-2">
                        {cart.filter(item => item.newUsers < 0).map(item => (
                          <div key={item.moduleCode} className="flex justify-between text-sm">
                            <span className="text-slate-600">{item.moduleName}: {item.newUsers} użytkowników (z {item.currentUsers} na {item.currentUsers + item.newUsers})</span>
                            <span className="font-medium text-red-600">{(item.newUsers * item.pricePerUser).toFixed(2)} PLN/mies.</span>
                          </div>
                        ))}
                        <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between">
                          <span className="font-semibold text-slate-900">Zmniejszenie miesięcznej opłaty:</span>
                          <span className="font-bold text-xl text-red-600">{cartTotalValueNextMonth.toFixed(2)} PLN</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-3">Zmniejszenie wejdzie w życie od następnego okresu rozliczeniowego. Do tego czasu obecna liczba miejsc pozostaje aktywna.</p>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={handleCancelPurchase} className={`px-4 py-2 rounded-lg transition ${confirmCancel ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>{confirmCancel ? 'Na pewno anulować?' : 'Anuluj'}</button>
                      <button onClick={handleReduceSubscription} disabled={loading === 'reduce'} className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2 disabled:opacity-50">
                        {loading === 'reduce' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Zmniejsz subskrypcję
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Stripe Info */}
          {!stripeEnabled && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">Stripe nie jest skonfigurowany</p>
                <p className="text-sm text-amber-600 mt-1">
                  Ustaw zmienną środowiskową <code className="bg-amber-100 px-1 rounded">VITE_STRIPE_PUBLISHABLE_KEY</code> aby aktywować płatności online.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Usage Tab */}
      {activeTab === 'usage' && (
        <div className="space-y-6">
          {/* Active Modules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myModules.filter(m => m.is_active).map(cm => {
              const moduleInfo = MODULE_INFO[cm.module_code];
              const isSelected = selectedModule === cm.module_code;

              return (
                <div
                  key={cm.id}
                  onClick={() => setSelectedModule(isSelected ? null : cm.module_code)}
                  className={`bg-white border rounded-xl p-4 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-blue-500 ring-2 ring-blue-100'
                      : 'border-slate-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-100 text-blue-600">
                      {moduleInfo?.icon || <Package className="w-5 h-5" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{cm.module?.name_pl || MODULE_LABELS[cm.module_code]}</h3>
                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-600 rounded-full">Aktywny</span>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">{moduleInfo?.description || ''}</p>
                      <p className="text-sm text-blue-600 mt-2">
                        <Users className="w-4 h-4 inline mr-1" />
                        {cm.activeUsers} / {cm.max_users} użytkowników
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {myModules.filter(m => m.is_active).length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Brak aktywnych modułów</p>
            </div>
          )}

          {/* User Access Management */}
          {selectedModule && (
            <div className="bg-white border border-slate-200 rounded-xl">
              <div className="p-4 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                      {MODULE_INFO[selectedModule]?.icon || <Package className="w-4 h-4" />}
                    </div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      Dostęp do: {MODULE_INFO[selectedModule]?.name || MODULE_LABELS[selectedModule]}
                    </h2>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Szukaj użytkownika..."
                      value={accessSearch}
                      onChange={(e) => setAccessSearch(e.target.value)}
                      className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg w-full sm:w-64 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Users with Access */}
              <div className="p-4 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  Z dostępem ({usersWithAccess.length})
                </h3>
                {usersWithAccess.length > 0 ? (
                  <div className="space-y-2">
                    {usersWithAccess.map(user => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3 bg-green-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <span className="text-green-700 font-medium text-sm">
                              {user.first_name.charAt(0)}{user.last_name.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{user.first_name} {user.last_name}</p>
                            <p className="text-xs text-slate-500">{user.email}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleAccess(user.id, selectedModule, true)}
                          disabled={accessLoading === user.id}
                          className="flex items-center gap-2 px-3 py-1.5 text-red-600 hover:bg-red-100 rounded-lg transition disabled:opacity-50"
                        >
                          {accessLoading === user.id ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <ToggleRight className="w-5 h-5" />
                          )}
                          <span className="text-sm hidden sm:inline">Usuń dostęp</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 py-2">Brak użytkowników z dostępem</p>
                )}
              </div>

              {/* Users without Access */}
              <div className="p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <X className="w-4 h-4 text-slate-400" />
                  Bez dostępu ({usersWithoutAccess.length})
                </h3>
                {usersWithoutAccess.length > 0 ? (
                  <div className="space-y-2">
                    {usersWithoutAccess.map(user => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                            <span className="text-slate-600 font-medium text-sm">
                              {user.first_name.charAt(0)}{user.last_name.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{user.first_name} {user.last_name}</p>
                            <p className="text-xs text-slate-500">{user.email}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleAccess(user.id, selectedModule, false)}
                          disabled={accessLoading === user.id}
                          className="flex items-center gap-2 px-3 py-1.5 text-green-600 hover:bg-green-100 rounded-lg transition disabled:opacity-50"
                        >
                          {accessLoading === user.id ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <ToggleLeft className="w-5 h-5" />
                          )}
                          <span className="text-sm hidden sm:inline">Nadaj dostęp</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 py-2">Wszyscy użytkownicy mają dostęp</p>
                )}
              </div>
            </div>
          )}

          {/* Info Banner when no module selected */}
          {!selectedModule && myModules.filter(m => m.is_active).length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-blue-900 font-medium">Wybierz moduł</p>
                <p className="text-blue-700 text-sm">
                  Kliknij na moduł powyżej, aby zarządzać dostępem użytkowników.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">Historia płatności</h3>
          </div>

          {paymentHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Data</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Faktura</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Kwota</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Akcje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paymentHistory.map(payment => (
                    <tr key={payment.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4 text-sm text-slate-900">
                        {payment.paid_at
                          ? new Date(payment.paid_at).toLocaleDateString('pl-PL')
                          : new Date(payment.created_at).toLocaleDateString('pl-PL')}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600 font-mono">
                        {payment.invoice_number || '-'}
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                        {Number(payment.amount).toFixed(2)} {payment.currency || 'PLN'}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          payment.status === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : payment.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : payment.status === 'refunded'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {payment.status === 'paid' ? 'Opłacona'
                            : payment.status === 'failed' ? 'Niepowodzenie'
                            : payment.status === 'refunded' ? 'Zwrócona'
                            : 'Oczekująca'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        {payment.invoice_pdf_url ? (
                          <a
                            href={payment.invoice_pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm"
                          >
                            <Download className="w-4 h-4" />
                            Pobierz
                          </a>
                        ) : (
                          <span className="text-slate-400 text-sm">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Brak historii płatności</p>
            </div>
          )}
        </div>
      )}

      {/* Subscription Management Tab */}
      {activeTab === 'subscription' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Zarządzanie płatnościami</h3>
            {currentCompany.stripe_customer_id && (
              <button
                onClick={handleOpenPortal}
                disabled={loading === 'portal'}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
              >
                {loading === 'portal' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Settings className="w-4 h-4" />
                )}
                Panel Stripe
                <ExternalLink className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Info box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-blue-900 font-medium">Panel Stripe</p>
                <p className="text-blue-700 text-sm mt-1">
                  Tutaj możesz anulować subskrypcję lub zmienić metodę płatności. Kliknij przycisk "Panel Stripe" aby przejść do zarządzania.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
            <div className="w-12 h-8 bg-gradient-to-r from-blue-600 to-blue-400 rounded flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              {currentCompany.stripe_customer_id ? (
                <>
                  <p className="font-medium text-slate-900">Konto Stripe aktywne</p>
                  <p className="text-sm text-slate-500">Zarządzaj metodami płatności i subskrypcjami w panelu Stripe</p>
                </>
              ) : (
                <>
                  <p className="font-medium text-slate-900">Karta nie została dodana</p>
                  <p className="text-sm text-slate-500">Aktywuj moduł, aby utworzyć konto płatności</p>
                </>
              )}
            </div>
            {!currentCompany.stripe_customer_id && stripeEnabled && (
              <button
                onClick={() => {
                  const firstInactiveModule = modules.find(m => m.is_active && !myModules.find(cm => cm.module_code === m.code && cm.is_active));
                  if (firstInactiveModule) {
                    handleActivateModule(firstInactiveModule.code);
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Rozpocznij
              </button>
            )}
          </div>

          {stripeEnabled && (
            <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
              <Check className="w-3 h-3 text-green-500" />
              Bezpieczne płatności obsługiwane przez Stripe
            </p>
          )}
        </div>
      )}
    </div>
  );
};
