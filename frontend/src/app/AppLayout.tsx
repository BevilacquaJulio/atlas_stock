import { Suspense, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../features/auth/useAuth';
import { Spinner } from '../components/feedback';
import { BrandLogo } from '../components/BrandLogo';
import { UserSessionBar } from '../components/UserSessionBar';
import { NotificationBell } from '../components/NotificationBell';
import {
  IconBox,
  IconCar,
  IconCart,
  IconClipboard,
  IconDashboard,
  IconDollar,
  IconMenu,
  IconClose,
  IconSwap,
  IconTag,
  IconTruck,
  IconUsers,
} from '../components/icons';
import type { ComponentType, SVGProps } from 'react';

interface NavItem {
  to: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const principalNav: NavItem[] = [
  { to: '/', label: 'Dashboard', Icon: IconDashboard },
  
];

const operacoesNav: NavItem[] = [
  { to: '/compras', label: 'Compras', Icon: IconCart },
  { to: '/projetos', label: 'Projetos', Icon: IconClipboard },
  { to: '/cadastros/movimentacoes', label: 'Movimentações', Icon: IconSwap },
  { to: '/financeiro', label: 'Financeiro', Icon: IconDollar }
];

const cadastrosNav: NavItem[] = [
  { to: '/cadastros/categorias', label: 'Categorias', Icon: IconTag },
  { to: '/cadastros/produtos', label: 'Produtos', Icon: IconBox },
  { to: '/cadastros/fornecedores', label: 'Fornecedores', Icon: IconTruck },
  { to: '/cadastros/clientes', label: 'Clientes', Icon: IconUsers },
  { to: '/cadastros/veiculos', label: 'Veículos', Icon: IconCar },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="neon-black sticky top-0 z-30 flex items-center justify-between rounded-none px-4 py-3 text-white sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="cursor-pointer rounded-md p-1.5 transition-colors hover:bg-white/10 lg:hidden"
            aria-label="Abrir menu"
            onClick={() => setDrawerOpen(true)}
          >
            <IconMenu />
          </button>
          <BrandLogo variant="on-dark" className="h-10 w-auto max-w-[240px] sm:h-15" />
        </div>
        <div className="flex items-center">
          <NotificationBell />
          {user && (
            <UserSessionBar
              nome={user.nome}
              cargo={user.cargo}
              onLogout={handleLogout}
            />
          )}
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar desktop */}
        <aside className="hidden w-60 shrink-0 overflow-visible border-r border-[#e5e5e5] bg-white lg:block">
          <SidebarContent activePath={location.pathname} scope="desktop" />
        </aside>

        {/* Drawer mobile */}
        <AnimatePresence>
          {drawerOpen && (
            <motion.div
              className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm lg:hidden"
              onClick={() => setDrawerOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <motion.aside
                className="flex h-full w-64 flex-col border-r border-[#e5e5e5] bg-white"
                onClick={(e) => e.stopPropagation()}
                initial={{ x: -260 }}
                animate={{ x: 0 }}
                exit={{ x: -260 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="flex items-center justify-between border-b border-[#e5e5e5] px-4 py-3">
                  <span className="font-bold text-[#0a0a0a]">Menu</span>
                  <button
                    type="button"
                    aria-label="Fechar menu"
                    onClick={() => setDrawerOpen(false)}
                    className="cursor-pointer rounded-md p-1 text-[#0a0a0a]/60 hover:bg-[#0a0a0a] hover:text-white"
                  >
                    <IconClose />
                  </button>
                </div>
                <SidebarContent
                  activePath={location.pathname}
                  scope="mobile"
                  onNavigate={() => setDrawerOpen(false)}
                />
                {user && (
                  <div className="mt-auto border-t border-[#e5e5e5] p-3">
                    <UserSessionBar
                      nome={user.nome}
                      cargo={user.cargo}
                      onLogout={async () => {
                        setDrawerOpen(false);
                        await handleLogout();
                      }}
                      variant="light"
                    />
                  </div>
                )}
              </motion.aside>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            {/* Só animação de entrada. Com AnimatePresence mode="wait", o <Outlet/>
                da página que sai já renderiza a rota nova (lazy); quando ela suspende
                durante a saída, a troca trava e a página nova não aparece. */}
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <Suspense
                fallback={
                  <div className="flex min-h-[40vh] items-center justify-center">
                    <Spinner />
                  </div>
                }
              >
                <Outlet />
              </Suspense>
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}

function NavGroup({
  title,
  items,
  activePath,
  scope,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  activePath: string;
  scope: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <p className="mt-5 px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#0a0a0a]/40 first:mt-0">
        {title}
      </p>
      {items.map(({ to, label, Icon }) => {
        const isActive = to === '/' ? activePath === '/' : activePath.startsWith(to);
        return (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onNavigate}
            className={`group relative my-0.5 flex items-center gap-3 overflow-visible rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'text-white'
                : 'text-[#0a0a0a]/65 hover:bg-[#f0f0f0] hover:text-[#0a0a0a]'
            }`}
          >
            {isActive && (
              <motion.span
                layoutId={`${scope}-nav-active`}
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                className="neon-black absolute inset-0 rounded-lg"
              />
            )}
            <span className="relative z-10 flex items-center gap-3">
              <Icon width={18} height={18} />
              {label}
            </span>
          </NavLink>
        );
      })}
    </>
  );
}

function SidebarContent({
  activePath,
  scope,
  onNavigate,
}: {
  activePath: string;
  scope: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="obsidian-scroll flex flex-1 flex-col gap-1 overflow-y-auto px-3 pt-3 pb-12">
      <NavGroup
        title="Principal"
        items={principalNav}
        activePath={activePath}
        scope={scope}
        onNavigate={onNavigate}
      />
      <NavGroup
        title="Operações"
        items={operacoesNav}
        activePath={activePath}
        scope={scope}
        onNavigate={onNavigate}
      />
      <NavGroup
        title="Cadastros"
        items={cadastrosNav}
        activePath={activePath}
        scope={scope}
        onNavigate={onNavigate}
      />
    </nav>
  );
}
