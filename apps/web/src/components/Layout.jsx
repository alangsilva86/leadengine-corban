import { useEffect, useState } from 'react';
import {
  Menu,
  X,
  Home,
  Briefcase,
  QrCode,
  MessageSquare,
  BarChart3,
  Settings,
  Ticket,
  Bell,
  Search,
  User,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import './Layout.css';
import HealthIndicator from './HealthIndicator.jsx';
import TenantSelector from './TenantSelector.jsx';
import DemoAuthDialog from './DemoAuthDialog.jsx';

const Layout = ({ children, currentPage = 'dashboard', onNavigate, onboarding }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [inboxCount, setInboxCount] = useState(
    typeof onboarding?.metrics?.inboxCount === 'number' ? onboarding.metrics.inboxCount : null
  );

  useEffect(() => {
    if (typeof onboarding?.metrics?.inboxCount === 'number') {
      setInboxCount(onboarding.metrics.inboxCount);
    }
  }, [onboarding?.metrics?.inboxCount]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const handler = (event) => {
      if (typeof event?.detail === 'number') {
        setInboxCount(event.detail);
      }
    };
    window.addEventListener('leadengine:inbox-count', handler);
    return () => window.removeEventListener('leadengine:inbox-count', handler);
  }, []);

  const inboxLabel = typeof inboxCount === 'number' ? `Inbox (${inboxCount})` : 'Inbox';

  const navigation = [
    { id: 'dashboard', name: 'Visão Geral', icon: Home },
    { id: 'agreements', name: 'Convênios', icon: Briefcase },
    { id: 'whatsapp', name: 'WhatsApp', icon: QrCode },
    {
      id: 'inbox',
      name: inboxLabel,
      icon: MessageSquare,
    },
    { id: 'reports', name: 'Relatórios', icon: BarChart3 },
    { id: 'settings', name: 'Configurações', icon: Settings },
  ];

  const handleNavigate = (page) => (event) => {
    event.preventDefault();
    onNavigate?.(page);
    setSidebarOpen(false);
  };

  const stageList = onboarding?.stages ?? [];

  useEffect(() => {
    if (!sidebarOpen) {
      return;
    }

    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarCollapsed(false);
    }
  }, [sidebarOpen]);

  const shouldShowOnboardingTrack = stageList.length > 0 && currentPage !== 'inbox';

  return (
    <div className="layout-container">
      <aside
        className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
      >
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="logo-icon">
              <Ticket className="h-5 w-5" />
            </div>
            <div className="logo-text">
              <h1>Lead Engine</h1>
              <p>Maquina de Vendas</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="sidebar-close"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="sidebar-nav">
          <ul className="nav-list">
            {navigation.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={handleNavigate(item.id)}
                  className={`nav-item ${currentPage === item.id ? 'nav-item-active' : ''}`}
                  aria-label={item.name}
                >
                  <item.icon className="nav-icon" />
                  <span className="nav-text">{item.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">
              <User className="h-5 w-5" />
            </div>
            <div className="user-info">
              <p className="user-name">João Silva</p>
              <p className="user-role">Agente</p>
            </div>
            <Button variant="ghost" size="sm">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <div className="main-content">
        <header className="main-header">
          <div className="header-left">
            <Button
              variant="ghost"
              size="sm"
              className="sidebar-toggle"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="sidebar-collapse-toggle"
              onClick={() => setSidebarCollapsed((previous) => !previous)}
              aria-label={sidebarCollapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
              title={sidebarCollapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
            >
              {sidebarCollapsed ? (
                <ChevronsRight className="h-5 w-5" />
              ) : (
                <ChevronsLeft className="h-5 w-5" />
              )}
            </Button>

            <div className="search-container">
              <Search className="search-icon" />
              <Input type="search" placeholder="Buscar tickets, contatos..." className="search-input" />
            </div>
          </div>

          <div className="header-right" style={{ gap: 12 }}>
            <DemoAuthDialog />
            <TenantSelector />
            <Button variant="ghost" size="sm" className="notification-btn">
              <Bell className="h-5 w-5" />
              <span className="notification-badge">5</span>
            </Button>
            <HealthIndicator />
          </div>
        </header>

        <main className="page-content">
          <div className="page-content-inner">
            {shouldShowOnboardingTrack ? (
              <div className="onboarding-track" aria-label="Progresso do onboarding">
                {stageList.map((stage, index) => {
                  const status =
                    index < onboarding.activeStep
                      ? 'done'
                      : index === onboarding.activeStep
                      ? 'current'
                      : 'todo';
                  return (
                    <div key={stage.id} className={`onboarding-pill onboarding-pill--${status}`}>
                      <span className="onboarding-pill__index">{index + 1}</span>
                      <span className="onboarding-pill__label">{stage.label}</span>
                    </div>
                  );
                })}
              </div>
            ) : null}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
