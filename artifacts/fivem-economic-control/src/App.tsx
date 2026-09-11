import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, Anchor, ArrowDownRight, ArrowUpRight, BarChart3, Bell, Boxes,
  BriefcaseBusiness, Building2, CalendarClock, ChevronDown, CircleDollarSign,
  CircleGauge, ClipboardList, Clock3, Container, Download, Gauge, Landmark,
  Layers3, MapPin, Menu, Minus, Package, PanelLeft, Plus, RefreshCw,
  Route as RouteIcon, Search, Settings2, Ship, ShipWheel, SlidersHorizontal,
  Sparkles, TrendingDown, TrendingUp, WalletCards, Warehouse, Waves, X, Zap,
} from 'lucide-react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();

type Tone = 'teal' | 'amber' | 'blue' | 'red' | 'slate';
type Tab = 'overview' | 'economy' | 'traffic' | 'warehouse' | 'activity';
type Scenario = 'stable' | 'growth' | 'shock';

type CargoDefinition = {
  name: string;
  category: string;
  unit: string;
  tone: Tone;
  location: string;
  reorder: number;
  basePrice: number;
  volatility: number;
};

type Cargo = {
  id: string;
  name: string;
  qty: number;
  unit: string;
  tone: Tone;
  status: string;
};

type Stock = {
  id: string;
  name: string;
  category: string;
  qty: number;
  capacity: number;
  unit: string;
  location: string;
  reorder: number;
};

type Ship = {
  id: string;
  name: string;
  route: string;
  eta: string;
  status: string;
  progress: number;
  cargo: string;
  tone: Tone;
  lat?: number;
  lng?: number;
};

type Treasury = {
  balance: number;
  changeToday: number;
  incomeToday: number;
  expenseToday: number;
  trend: number[];
};

type EconomyState = {
  marketIndex: number;
  tradeVolumeToday: number;
  importsToday: number;
  exportsToday: number;
  taxRevenueToday: number;
  prices: Record<string, number>;
  demand: Record<string, number>;
  trend: number[];
  lastScenario: Scenario;
  updatedAt?: number;
};

type ActivityItem = {
  id: string;
  type: string;
  title: string;
  detail: string;
  timestamp: number;
};

type ServerState = {
  treasury?: Treasury;
  economy?: Partial<EconomyState>;
  inventory?: Record<string, { quantity: number; capacity: number; reserved?: number }>;
  ships?: Array<{
    id: string;
    name: string;
    status: string;
    cargoLabel: string;
    from: string;
    to: string;
    progress: number;
    etaMinutes: number;
    lat: number;
    lng: number;
  }>;
  activity?: ActivityItem[];
  updatedAt?: number;
};

const cargoProfiles: CargoDefinition[] = [
  { name: 'Elektronikmodule', category: 'Technik', unit: 'Kisten', tone: 'teal', location: 'Pier A', reorder: 48, basePrice: 4800, volatility: 0.14 },
  { name: 'Treibstoff', category: 'Energie', unit: 'Fässer', tone: 'blue', location: 'Gefahrgut', reorder: 72, basePrice: 2100, volatility: 0.18 },
  { name: 'Baustahl', category: 'Baustoffe', unit: 'Paletten', tone: 'slate', location: 'Pier C', reorder: 36, basePrice: 3200, volatility: 0.09 },
  { name: 'Frischware', category: 'Versorgung', unit: 'Kisten', tone: 'amber', location: 'Kühlhaus', reorder: 84, basePrice: 950, volatility: 0.22 },
  { name: 'Textilien', category: 'Handel', unit: 'Ballen', tone: 'red', location: 'Sicherheitslager', reorder: 24, basePrice: 1750, volatility: 0.13 },
  { name: 'Maschinenteile', category: 'Industrie', unit: 'Kisten', tone: 'teal', location: 'Pier B', reorder: 42, basePrice: 5600, volatility: 0.11 },
  { name: 'Medizinbedarf', category: 'Gesundheit', unit: 'Kisten', tone: 'blue', location: 'Kühlhaus', reorder: 30, basePrice: 3900, volatility: 0.08 },
  { name: 'Zement', category: 'Baustoffe', unit: 'Säcke', tone: 'slate', location: 'Pier C', reorder: 60, basePrice: 680, volatility: 0.12 },
  { name: 'Kaffee', category: 'Versorgung', unit: 'Säcke', tone: 'amber', location: 'Trockenlager', reorder: 45, basePrice: 1250, volatility: 0.19 },
  { name: 'Ersatzteile', category: 'Industrie', unit: 'Kisten', tone: 'red', location: 'Pier B', reorder: 28, basePrice: 2900, volatility: 0.16 },
];

const generatedCargoCatalog = Object.fromEntries(
  Array.from({ length: 200 }, (_, index) => {
    const profile = cargoProfiles[index % cargoProfiles.length];
    const number = String(index + 1).padStart(3, '0');
    const zone = String.fromCharCode(65 + Math.floor(index / 25));
    const bay = String((index % 25) + 1).padStart(2, '0');
    return [`cargo-${number}`, {
      ...profile,
      name: `${profile.name} ${number}`,
      location: `${profile.location} · ${zone}-${bay}`,
      reorder: profile.reorder + (index % 4) * 6,
      basePrice: profile.basePrice + (index % 5) * 120,
    }];
  }),
) as Record<string, CargoDefinition>;

const cargoCatalog: Record<string, CargoDefinition> = {
  electronics: { ...cargoProfiles[0], name: 'Elektronikmodule', location: 'Pier A–02' },
  fuel: { ...cargoProfiles[1], name: 'Treibstoff', location: 'Gefahrgut 04' },
  steel: { ...cargoProfiles[2], name: 'Baustahl', location: 'Pier C–01' },
  food: { ...cargoProfiles[3], name: 'Frischware', location: 'Kühlhaus 01' },
  textiles: { ...cargoProfiles[4], name: 'Textilien', location: 'Sicherheitslager 02' },
  ...generatedCargoCatalog,
};

const demoCargoIds = Object.keys(generatedCargoCatalog);
const portNames: Record<string, string> = {
  lsia: 'LSIA',
  terminal: 'Terminal Island',
  paleto: 'Paleto Cove',
  eastsandy: 'Sandy Shores',
};

const demoShips: Ship[] = [
  { id: 'mistral', name: 'Mistral Runner', route: 'Terminal Island → LSIA', eta: '08:42', status: 'Unterwegs', progress: 68, cargo: 'Maschinenteile', tone: 'teal' },
  { id: 'cormorant', name: 'Cormorant III', route: 'Paleto Cove → Terminal Island', eta: '11:16', status: 'Anlegen', progress: 92, cargo: 'Frischware', tone: 'amber' },
  { id: 'calypso', name: 'Calypso Haul', route: 'Sandy Shores → Paleto Cove', eta: '13:05', status: 'Beladung', progress: 23, cargo: 'Treibstoff', tone: 'blue' },
];

const defaultTreasury: Treasury = {
  balance: 4782640.18,
  changeToday: 176420,
  incomeToday: 284600,
  expenseToday: 108180,
  trend: [3920000, 4050000, 3990000, 4210000, 4320000, 4490000, 4782640],
};

const defaultEconomy: EconomyState = {
  marketIndex: 104.8,
  tradeVolumeToday: 1840000,
  importsToday: 1290000,
  exportsToday: 550000,
  taxRevenueToday: 18400,
  prices: {},
  demand: {},
  trend: [96, 98, 97, 100, 101, 103, 104.8],
  lastScenario: 'stable',
  updatedAt: Date.now(),
};

const demoActivity: ActivityItem[] = [
  { id: 'demo-1', type: 'system', title: 'Harbor Ledger gestartet', detail: 'Wirtschaftssimulation ist aktiv', timestamp: Date.now() - 180000 },
  { id: 'demo-2', type: 'cargo', title: 'Frachtbestand synchronisiert', detail: '200 Positionen aus dem Hafenlager geladen', timestamp: Date.now() - 540000 },
  { id: 'demo-3', type: 'treasury', title: 'Hafengebühr verbucht', detail: '+$18.400 auf dem Staatskonto', timestamp: Date.now() - 1120000 },
  { id: 'demo-4', type: 'ship', title: 'Atlas Meridian ausgelaufen', detail: 'Route Terminal Island → LSIA', timestamp: Date.now() - 1880000 },
];

const initialCargo: Cargo[] = demoCargoIds.map((id, index) => {
  const definition = cargoCatalog[id];
  const qty = 22 + ((index * 17) % 180);
  return { id, name: definition.name, qty, unit: definition.unit, tone: definition.tone, status: qty <= definition.reorder ? 'Nachbestellen' : 'Freigegeben' };
});

const initialStock: Stock[] = demoCargoIds.map((id, index) => {
  const definition = cargoCatalog[id];
  const capacity = 100 + ((index * 31) % 180);
  const qty = 22 + ((index * 17) % 180);
  return { id, name: definition.name, category: definition.category, qty: Math.min(qty, capacity), capacity, unit: definition.unit, location: definition.location, reorder: definition.reorder };
});

const formatMoney = (value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1).replace('.', ',')}%`;
const formatTime = (timestamp?: number) => {
  if (!timestamp) return 'gerade eben';
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'gerade eben';
  if (seconds < 3600) return `vor ${Math.floor(seconds / 60)} Min.`;
  return `vor ${Math.floor(seconds / 3600)} Std.`;
};

const isFiveM = () => typeof window !== 'undefined' && typeof (window as unknown as { GetParentResourceName?: unknown }).GetParentResourceName === 'function';

function nuiPost(endpoint: string, payload: unknown) {
  if (!isFiveM()) return;
  const getResourceName = (window as unknown as { GetParentResourceName: () => string }).GetParentResourceName;
  void fetch(`https://${getResourceName()}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(payload),
  });
}

function getDefinition(id: string): CargoDefinition {
  return cargoCatalog[id] ?? {
    name: id,
    category: 'Sonstiges',
    unit: 'Einheiten',
    tone: 'slate',
    location: 'Hauptlager',
    reorder: 0,
    basePrice: 1000,
    volatility: 0.1,
  };
}

function createEconomyState(next?: Partial<EconomyState>): EconomyState {
  return {
    ...defaultEconomy,
    ...next,
    prices: { ...defaultEconomy.prices, ...(next?.prices ?? {}) },
    demand: { ...defaultEconomy.demand, ...(next?.demand ?? {}) },
    trend: next?.trend?.length ? next.trend : defaultEconomy.trend,
  };
}

function mapShipState(serverShip: NonNullable<ServerState['ships']>[number]): Ship {
  const status = serverShip.status === 'underway' ? 'Unterwegs' : serverShip.status === 'docked' ? 'Im Hafen' : 'Vor Anker';
  return {
    id: serverShip.id,
    name: serverShip.name,
    route: `${portNames[serverShip.from] ?? serverShip.from} → ${portNames[serverShip.to] ?? serverShip.to}`,
    eta: serverShip.etaMinutes > 0 ? `${String(Math.floor(serverShip.etaMinutes / 60)).padStart(2, '0')}:${String(serverShip.etaMinutes % 60).padStart(2, '0')}` : '00:00',
    status,
    progress: Math.round(serverShip.progress * 100),
    cargo: serverShip.cargoLabel,
    tone: serverShip.status === 'anchored' ? 'amber' : serverShip.status === 'docked' ? 'blue' : 'teal',
    lat: serverShip.lat,
    lng: serverShip.lng,
  };
}

function applyServerState(serverState: ServerState) {
  const inventory = serverState.inventory ?? {};
  const nextCargo = Object.entries(inventory).map(([id, stock]) => {
    const definition = getDefinition(id);
    const available = stock.quantity - (stock.reserved ?? 0);
    return { id, name: definition.name, qty: stock.quantity, unit: definition.unit, tone: definition.tone, status: available <= definition.reorder ? 'Nachbestellen' : 'Freigegeben' };
  });
  const nextStock = Object.entries(inventory).map(([id, stock]) => {
    const definition = getDefinition(id);
    return { id, name: definition.name, category: definition.category, qty: stock.quantity, capacity: stock.capacity, unit: definition.unit, location: definition.location, reorder: definition.reorder };
  });
  return {
    cargo: nextCargo,
    stock: nextStock,
    ships: serverState.ships?.map(mapShipState) ?? demoShips,
    treasury: serverState.treasury ?? defaultTreasury,
    economy: createEconomyState(serverState.economy),
    activity: serverState.activity?.length ? serverState.activity : demoActivity,
  };
}

function applyScenario(treasury: Treasury, economy: EconomyState, scenario: Scenario) {
  const modifiers: Record<Scenario, { income: number; expense: number; volume: number; index: number; label: string }> = {
    stable: { income: 12000, expense: 5400, volume: 46000, index: 0.8, label: 'Stabile Nachfrage' },
    growth: { income: 42000, expense: 12800, volume: 128000, index: 3.4, label: 'Handelsboom' },
    shock: { income: -18000, expense: 36000, volume: -84000, index: -4.8, label: 'Versorgungsengpass' },
  };
  const modifier = modifiers[scenario];
  const balanceDelta = modifier.income - modifier.expense;
  return {
    treasury: {
      ...treasury,
      balance: Math.max(0, treasury.balance + balanceDelta),
      changeToday: treasury.changeToday + balanceDelta,
      incomeToday: Math.max(0, treasury.incomeToday + modifier.income),
      expenseToday: Math.max(0, treasury.expenseToday + modifier.expense),
      trend: [...treasury.trend.slice(-6), Math.max(0, treasury.balance + balanceDelta)],
    },
    economy: {
      ...economy,
      marketIndex: Math.max(40, economy.marketIndex + modifier.index),
      tradeVolumeToday: Math.max(0, economy.tradeVolumeToday + modifier.volume),
      taxRevenueToday: Math.max(0, economy.taxRevenueToday + Math.round(modifier.income * 0.08)),
      trend: [...economy.trend.slice(-6), Math.max(40, economy.marketIndex + modifier.index)],
      lastScenario: scenario,
      updatedAt: Date.now(),
    },
    label: modifier.label,
  };
}

function IconButton({ label, children, onClick, className = '' }: { label: string; children: ReactNode; onClick?: () => void; className?: string }) {
  return <button type="button" aria-label={label} onClick={onClick} className={`inline-flex items-center justify-center rounded-lg border border-[#253336] bg-[#0d1314] text-[#9bb3b2] transition hover:border-[#3b7770] hover:bg-[#122322] hover:text-[#d8e8e5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#39b9aa] ${className}`}>{children}</button>;
}

function StatusBadge({ children, tone = 'teal' }: { children: ReactNode; tone?: Tone }) {
  const styles: Record<Tone, string> = {
    teal: 'border-[#205d58] bg-[#0e2e2c] text-[#63d8c5]',
    amber: 'border-[#6c4d22] bg-[#322512] text-[#efbd67]',
    blue: 'border-[#24536b] bg-[#102a38] text-[#73b9dc]',
    red: 'border-[#69342d] bg-[#351b19] text-[#e89183]',
    slate: 'border-[#344448] bg-[#182124] text-[#a8bbbd]',
  };
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.12em] ${styles[tone]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{children}</span>;
}

function Panel({ children, className = '', testId }: { children: ReactNode; className?: string; testId?: string }) {
  return <section data-testid={testId} className={`overflow-hidden rounded-xl border border-[#1d2b2d] bg-[#0b1011] shadow-[0_16px_42px_rgba(0,0,0,.2)] ${className}`}>{children}</section>;
}

function PanelHeader({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return <div className="flex items-start justify-between gap-4 border-b border-[#1c292b] px-5 py-4"><div><div className="flex items-center gap-2 text-[#5ad0c0]">{icon}<h2 className="text-[13px] font-bold text-[#dce9e7]">{title}</h2></div>{description && <p className="mt-1 text-[10px] text-[#71888b]">{description}</p>}</div>{action}</div>;
}

function MetricCard({ title, value, caption, change, icon, tone = 'teal' }: { title: string; value: string; caption: string; change?: string; icon: ReactNode; tone?: Tone }) {
  return <Panel className="p-4"><div className="flex items-start justify-between"><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone === 'amber' ? 'bg-[#342515] text-[#e4ad57]' : tone === 'blue' ? 'bg-[#102b39] text-[#70b6d6]' : tone === 'red' ? 'bg-[#351d1b] text-[#e89183]' : 'bg-[#10312e] text-[#50cdbb]'}`}>{icon}</span>{change && <span className={`flex items-center gap-1 text-[10px] font-bold ${tone === 'amber' ? 'text-[#e4ad57]' : tone === 'red' ? 'text-[#e89183]' : 'text-[#5ed2c0]'}`}>{tone === 'red' ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}{change}</span>}</div><div className="mt-4 text-[10px] font-semibold text-[#789194]">{title}</div><div className="display mt-1 text-[22px] font-bold tracking-[-.05em] text-[#e3efec]">{value}</div><div className="mt-1 text-[10px] text-[#60777a]">{caption}</div></Panel>;
}

function Sidebar({ activeTab, onSelect }: { activeTab: Tab; onSelect: (tab: Tab) => void }) {
  const groups: Array<{ label: string; items: Array<{ id: Tab; label: string; note: string; icon: ReactNode }> }> = [
    { label: 'Leitstelle', items: [{ id: 'overview', label: 'Übersicht', note: 'Live', icon: <CircleGauge size={16} /> }, { id: 'economy', label: 'Wirtschaft', note: '24H', icon: <BarChart3 size={16} /> }, { id: 'traffic', label: 'Schiffsverkehr', note: '4 Schiffe', icon: <ShipWheel size={16} /> }] },
    { label: 'Operations', items: [{ id: 'warehouse', label: 'Frachtlager', note: '200 Güter', icon: <Warehouse size={16} /> }, { id: 'activity', label: 'Aktivität', note: 'Audit', icon: <Activity size={16} /> }] },
  ];
  return <aside className="flex w-full shrink-0 flex-col border-b border-[#1c292b] bg-[#070a0b] md:min-h-screen md:w-[252px] md:border-b-0 md:border-r">
    <div className="flex items-center justify-between px-5 py-5"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#3bc2b2] text-[#041211] shadow-[0_0_22px_rgba(59,194,178,.22)]"><Anchor size={19} strokeWidth={2.6} /></div><div><div className="display text-[15px] font-bold tracking-tight text-[#eef8f5]">Harbor Ledger</div><div className="mono mt-1 text-[9px] uppercase tracking-[.18em] text-[#638181]">Economic control</div></div></div><IconButton label="Navigation öffnen" className="h-8 w-8 md:hidden"><Menu size={16} /></IconButton></div>
    <div className="mx-4 mb-5 flex items-center justify-between rounded-lg border border-[#1d3938] bg-[#0c1e1d] px-3 py-2.5"><div className="flex items-center gap-2"><span className="sonar-dot h-1.5 w-1.5 rounded-full bg-[#56d6c3]" /><span className="text-[10px] font-bold text-[#b9d8d3]">FiveM verbunden</span></div><span className="mono text-[9px] text-[#5a8c87]">EAST-01</span></div>
    <nav className="hidden flex-1 px-3 md:block">{groups.map((group) => <div key={group.label} className="mb-7"><p className="mono mb-2 px-3 text-[9px] uppercase tracking-[.18em] text-[#526c6e]">{group.label}</p><div className="space-y-1">{group.items.map((item) => <button key={item.id} type="button" data-testid={`tab-${item.id}`} onClick={() => onSelect(item.id)} className={`group flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition ${activeTab === item.id ? 'bg-[#12312f] text-[#e9f5f2] shadow-[inset_3px_0_0_#40c5b5]' : 'text-[#89a1a1] hover:bg-[#101a1c] hover:text-[#dce9e7]'}`}><span className={activeTab === item.id ? 'text-[#5bd4c2]' : 'text-[#698486]'}>{item.icon}</span><span className="flex-1 text-[12px] font-semibold">{item.label}</span><span className={`mono text-[9px] ${activeTab === item.id ? 'text-[#6ab8ae]' : 'text-[#4e686a]'}`}>{item.note}</span></button>)}</div></div>)}</nav>
    <div className="flex gap-1 overflow-x-auto border-t border-[#1c292b] px-3 py-2 md:hidden">{groups.flatMap((group) => group.items).map((item) => <button key={item.id} type="button" onClick={() => onSelect(item.id)} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[10px] font-bold ${activeTab === item.id ? 'bg-[#12312f] text-[#e9f5f2]' : 'text-[#71898a]'}`}>{item.icon}{item.label}</button>)}</div>
    <div className="hidden border-t border-[#1c292b] px-5 py-4 md:block"><div className="flex items-center justify-between"><div className="flex items-center gap-2 text-[10px] font-bold text-[#a6bdbc]"><Building2 size={14} className="text-[#5ccbbb]" /> Wirtschaftsamt</div><Settings2 size={14} className="text-[#526c6e]" /></div><div className="mt-2 flex items-center justify-between"><span className="mono text-[9px] text-[#526c6e]">ADMIN / 04</span><span className="text-[10px] font-bold text-[#5acdbb]">Berechtigt</span></div></div>
  </aside>;
}

function TopBar({ activeTab, onRefresh, onClose, refreshedAt }: { activeTab: Tab; onRefresh: () => void; onClose: () => void; refreshedAt: string }) {
  const labels: Record<Tab, [string, string]> = { overview: ['Leitstelle', 'Wirtschaftsübersicht'], economy: ['Leitstelle', 'Wirtschaft'], traffic: ['Leitstelle', 'Schiffsverkehr'], warehouse: ['Operations', 'Frachtlager'], activity: ['Operations', 'Aktivitätsprotokoll'] };
  const [group, title] = labels[activeTab];
  return <header className="flex min-h-[78px] items-center justify-between gap-4 border-b border-[#1c292b] bg-[#080b0c] px-5 py-4 md:px-8"><div><div className="mono mb-1 flex items-center gap-2 text-[9px] uppercase tracking-[.16em] text-[#5a7779]"><span>{group}</span><span className="text-[#294345]">/</span><span>East Basin</span></div><h1 data-testid="text-page-title" className="display text-[22px] font-bold tracking-[-.05em] text-[#e7f2ef]">{title}</h1></div><div className="flex items-center gap-2 md:gap-3"><div className="hidden items-center gap-2 text-[10px] text-[#6e8587] sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#42c6b4]" /> Sync {refreshedAt}</div><IconButton label="Daten aktualisieren" onClick={onRefresh} className="h-9 w-9"><RefreshCw size={15} /></IconButton><IconButton label="Benachrichtigungen" className="relative h-9 w-9"><Bell size={15} /><span className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full bg-[#e3a54c]" /></IconButton><div className="hidden h-8 w-px bg-[#1e2c2e] md:block" /><div className="hidden text-right sm:block"><div className="text-[11px] font-bold text-[#c9dcda]">Maritime desk</div><div className="mono text-[9px] text-[#5c7779]">LIVE CONTROL</div></div><button type="button" aria-label="Leitstelle schließen" onClick={onClose} className="ml-1 flex h-9 w-9 items-center justify-center rounded-lg border border-[#253336] text-[#7e9797] transition hover:border-[#7b4640] hover:text-[#ed9d8f]"><X size={16} /></button></div></header>;
}

function TreasuryChart({ treasury }: { treasury: Treasury }) {
  const values = treasury.trend.length ? treasury.trend : defaultTreasury.trend;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const points = values.map((value, index) => `${(index / Math.max(1, values.length - 1)) * 600},${118 - ((value - min) / Math.max(1, max - min)) * 98}`).join(' ');
  return <div className="relative h-[218px] overflow-hidden px-5 pb-4 pt-5"><div className="absolute inset-x-5 top-5 bottom-8 flex flex-col justify-between"><span className="mono text-[9px] text-[#687f81]">{formatMoney(max)}</span><span className="mono text-[9px] text-[#687f81]">{formatMoney((max + min) / 2)}</span><span className="mono text-[9px] text-[#687f81]">{formatMoney(min)}</span></div><svg className="absolute inset-x-5 top-6 h-[158px] w-[calc(100%-40px)]" viewBox="0 0 600 138" preserveAspectRatio="none" aria-label="Staatskonto-Verlauf"><defs><linearGradient id="ledger-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#36b7a8" stopOpacity=".28" /><stop offset="1" stopColor="#36b7a8" stopOpacity="0" /></linearGradient></defs>{[0, 69, 138].map((y) => <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="#1b2b2d" strokeWidth="1" />)}<polygon points={`0,138 ${points} 600,138`} fill="url(#ledger-fill)" /><polyline points={points} fill="none" stroke="#46c6b6" strokeWidth="2.5" vectorEffect="non-scaling-stroke" /></svg><div className="absolute inset-x-5 bottom-1 flex justify-between mono text-[9px] text-[#687f81]"><span>-6 TAGE</span><span>-4 TAGE</span><span>-2 TAGE</span><span>HEUTE</span></div></div>;
}

function LeafletMap({ visibleShips }: { visibleShips: Ship[] }) {
  const mapElement = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mapElement.current) return;
    const map = L.map(mapElement.current, { zoomControl: false, attributionControl: true }).setView([33.87, -118.31], 10);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
    [['LSIA', 33.9416, -118.4085], ['Terminal Island', 33.7396, -118.2620], ['Paleto Cove', 34.0181, -118.4370], ['Sandy Shores', 33.9475, -118.2110]].forEach(([name, lat, lng]) => L.circleMarker([lat as number, lng as number], { radius: 5, color: '#4ac5b5', weight: 2, fillColor: '#0e2e2c', fillOpacity: 1 }).bindTooltip(name as string, { direction: 'top', offset: [0, -4], className: 'port-tooltip' }).addTo(map));
    visibleShips.forEach((ship, index) => {
      const lat = ship.lat ?? 33.82 + index * 0.04;
      const lng = ship.lng ?? -118.36 + index * 0.06;
      const color = ship.tone === 'amber' ? '#dfa64d' : ship.tone === 'blue' ? '#64a9c7' : '#45c4b5';
      L.circleMarker([lat, lng], { radius: 8, color: '#dce9e7', weight: 3, fillColor: color, fillOpacity: 1 }).bindTooltip(`<strong>${ship.name}</strong><br />${ship.status} · ${ship.eta} ETA`, { direction: 'right', offset: [10, 0], className: 'ship-tooltip' }).addTo(map);
    });
    return () => { map.remove(); };
  }, [visibleShips]);
  return <div ref={mapElement} className="leaflet-map h-[300px] md:h-[370px]" aria-label="Karte mit aktuellen Frachtschiffpositionen" />;
}

function ShipRow({ ship, dense = false }: { ship: Ship; dense?: boolean }) {
  const badgeTone = ship.status === 'Anlegen' ? 'amber' : ship.status === 'Beladung' ? 'blue' : ship.status === 'Vor Anker' ? 'slate' : 'teal';
  return <div data-testid={`row-ship-${ship.id}`} className={`flex items-center gap-3 border-b border-[#182528] px-4 ${dense ? 'py-3' : 'py-4'} last:border-0 hover:bg-[#0e1718]`}><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${ship.tone === 'amber' ? 'bg-[#342515] text-[#e4ad57]' : ship.tone === 'blue' ? 'bg-[#102b39] text-[#70b6d6]' : 'bg-[#10312e] text-[#50cdbb]'}`}><Ship size={16} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="truncate text-[11px] font-bold text-[#d8e7e4]">{ship.name}</span><StatusBadge tone={badgeTone}>{ship.status}</StatusBadge></div><div className="mt-1 flex items-center gap-2 text-[10px] text-[#71888b]"><span className="truncate">{ship.route}</span><span className="text-[#345052]">·</span><span>{ship.cargo}</span></div>{!dense && <div className="mt-2 h-1.5 max-w-[230px] overflow-hidden rounded-full bg-[#172628]"><div className={`h-full rounded-full ${ship.tone === 'amber' ? 'bg-[#d99a3c]' : ship.tone === 'blue' ? 'bg-[#4f91b0]' : 'bg-[#35b8aa]'}`} style={{ width: `${ship.progress}%` }} /></div>}</div><div className="text-right"><div className="mono text-[12px] text-[#d8e7e4]">{ship.eta}</div><div className="mt-1 text-[9px] uppercase tracking-[.1em] text-[#60777a]">ETA</div></div></div>;
}

function ActivityFeed({ items }: { items: ActivityItem[] }) {
  const iconFor = (type: string) => type === 'ship' ? <Ship size={14} /> : type === 'cargo' ? <Boxes size={14} /> : type === 'treasury' ? <CircleDollarSign size={14} /> : <Zap size={14} />;
  const toneFor = (type: string): Tone => type === 'ship' ? 'blue' : type === 'cargo' ? 'teal' : type === 'treasury' ? 'amber' : 'slate';
  return <div>{items.slice(0, 6).map((item) => <div key={item.id} className="flex gap-3 border-b border-[#182528] px-5 py-3.5 last:border-0"><span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${toneFor(item.type) === 'amber' ? 'bg-[#342515] text-[#e4ad57]' : toneFor(item.type) === 'blue' ? 'bg-[#102b39] text-[#70b6d6]' : toneFor(item.type) === 'teal' ? 'bg-[#10312e] text-[#50cdbb]' : 'bg-[#182124] text-[#a8bbbd]'}`}>{iconFor(item.type)}</span><div className="min-w-0 flex-1"><div className="text-[11px] font-semibold text-[#d8e7e4]">{item.title}</div><div className="mt-1 text-[10px] text-[#71888b]">{item.detail}</div></div><span className="mono shrink-0 text-[9px] text-[#536a6d]">{formatTime(item.timestamp)}</span></div>)}</div>;
}

function MarketTable({ stocks, economy, limit }: { stocks: Stock[]; economy: EconomyState; limit?: number }) {
  const rows = stocks.slice(0, limit ?? stocks.length);
  return <div className="overflow-x-auto"><div className="min-w-[720px]"><div className="grid grid-cols-[1.5fr_.9fr_.8fr_.8fr_.9fr] border-b border-[#1c292b] bg-[#0c1415] px-5 py-2.5 text-[9px] font-bold uppercase tracking-[.12em] text-[#5f7779]"><span>Fracht</span><span>Marktpreis</span><span>Nachfrage</span><span>Bestand</span><span>Trend</span></div>{rows.map((item, index) => { const definition = getDefinition(item.id); const price = economy.prices[item.id] ?? Math.round(definition.basePrice * (1 + ((index % 7) - 3) * definition.volatility / 3)); const demand = economy.demand[item.id] ?? Math.min(99, 44 + ((index * 13) % 53)); const rising = index % 3 !== 1; return <div key={item.id} className="grid grid-cols-[1.5fr_.9fr_.8fr_.8fr_.9fr] items-center border-b border-[#182528] px-5 py-3.5 text-[10px] last:border-0"><div className="flex items-center gap-3"><span className={`flex h-7 w-7 items-center justify-center rounded-md ${definition.tone === 'amber' ? 'bg-[#342515] text-[#e4ad57]' : definition.tone === 'blue' ? 'bg-[#102b39] text-[#70b6d6]' : definition.tone === 'red' ? 'bg-[#351d1b] text-[#e89183]' : 'bg-[#10312e] text-[#50cdbb]'}`}><Package size={14} /></span><div><div className="font-bold text-[#d8e7e4]">{item.name}</div><div className="mt-0.5 text-[9px] text-[#657d7f]">{item.category} · {item.unit}</div></div></div><span className="mono text-[#d8e7e4]">{formatMoney(price)}</span><div className="flex items-center gap-2"><div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#172628]"><div className={`h-full rounded-full ${demand > 75 ? 'bg-[#d99a3c]' : 'bg-[#35b8aa]'}`} style={{ width: `${demand}%` }} /></div><span className="mono text-[#8ca4a4]">{demand}%</span></div><span className="mono text-[#8ca4a4]">{item.qty.toLocaleString('de-DE')}</span><span className={`flex items-center gap-1 font-bold ${rising ? 'text-[#55ccb9]' : 'text-[#e1a34f]'}`}>{rising ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{rising ? '+' : '-'}{(2.2 + index % 5).toFixed(1).replace('.', ',')}%</span></div>; })}</div></div>;
}

function ScenarioControls({ selected, running, onSelect }: { selected: Scenario; running: boolean; onSelect: (scenario: Scenario) => void }) {
  const options: Array<{ id: Scenario; label: string; detail: string; tone: Tone }> = [{ id: 'stable', label: 'Stabil', detail: 'Normale Nachfrage', tone: 'teal' }, { id: 'growth', label: 'Wachstum', detail: 'Handelsboom', tone: 'blue' }, { id: 'shock', label: 'Schock', detail: 'Versorgungsengpass', tone: 'amber' }];
  return <div className="grid gap-2 sm:grid-cols-3">{options.map((option) => <button key={option.id} type="button" disabled={running} onClick={() => onSelect(option.id)} className={`rounded-lg border p-3 text-left transition ${selected === option.id ? 'border-[#3faaa0] bg-[#102e2c]' : 'border-[#253336] bg-[#0d1314] hover:border-[#3f7772]'} disabled:cursor-wait disabled:opacity-60`}><div className="flex items-center justify-between"><span className={`h-2 w-2 rounded-full ${option.tone === 'amber' ? 'bg-[#e4ad57]' : option.tone === 'blue' ? 'bg-[#70b6d6]' : 'bg-[#50cdbb]'}`} /><span className="mono text-[9px] text-[#5e7779]">{selected === option.id ? 'AKTIV' : 'SETZEN'}</span></div><div className="mt-3 text-[11px] font-bold text-[#d8e7e4]">{option.label}</div><div className="mt-1 text-[10px] text-[#71888b]">{option.detail}</div></button>)}</div>;
}

function Overview({ cargo, stocks, ships, treasury, economy, activity, onScenario }: { cargo: Cargo[]; stocks: Stock[]; ships: Ship[]; treasury: Treasury; economy: EconomyState; activity: ActivityItem[]; onScenario: (scenario: Scenario) => void }) {
  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard title="Staatskonto" value={formatMoney(treasury.balance)} caption="verfügbar · laufender Zyklus" change={formatPercent((treasury.changeToday / Math.max(1, treasury.balance)) * 100)} icon={<Landmark size={16} />} /><MetricCard title="Handelsvolumen" value={formatMoney(economy.tradeVolumeToday)} caption="Importe und Exporte · heute" change="+12,6%" icon={<BarChart3 size={16} />} tone="blue" /><MetricCard title="Fracht im Umlauf" value={String(ships.length).padStart(2, '0')} caption={`${stocks.length} Positionen im Lager`} change="LIVE" icon={<ShipWheel size={16} />} tone="amber" /><MetricCard title="Marktindex" value={economy.marketIndex.toFixed(1).replace('.', ',')} caption="Basis 100 · East Basin" change={formatPercent(economy.marketIndex - 100)} icon={<Gauge size={16} />} tone="slate" /></div>
    <div className="rounded-xl border border-[#245650] bg-[radial-gradient(circle_at_80%_20%,rgba(48,151,137,.18),transparent_35%),#0b1919] p-5 md:p-6"><div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><div className="mono mb-3 flex items-center gap-2 text-[9px] uppercase tracking-[.18em] text-[#54bcae]"><span className="h-1.5 w-1.5 rounded-full bg-current" /> Simulation aktiv · Serverautorität</div><h2 className="display max-w-[620px] text-2xl font-bold tracking-[-.05em] text-[#eff8f5] md:text-3xl">Wirtschaft unter Kontrolle.</h2><p className="mt-2 max-w-[600px] text-[11px] leading-relaxed text-[#8fb0ac]">Steuere Staatskonto, Handelsströme und Hafenlogistik aus einer Leitstelle. Jede Buchung wird in der FiveM-Resource protokolliert und an alle Clients synchronisiert.</p></div><div className="min-w-[270px] rounded-lg border border-[#24524e] bg-[#0a1717] p-4"><div className="flex items-center justify-between"><div className="flex items-center gap-2 text-[10px] font-bold text-[#b8d5d0]"><Sparkles size={14} className="text-[#5bd4c2]" /> Szenario-Impuls</div><span className="mono text-[9px] text-[#5e8b86]">ADMIN</span></div><div className="mt-3"><ScenarioControls selected={economy.lastScenario} running={false} onSelect={onScenario} /></div></div></div></div>
    <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]"><Panel testId="panel-treasury"><PanelHeader icon={<WalletCards size={15} />} title="Staatskonto" description="Liquidität der letzten sieben Tage" action={<div className="text-right"><div className="display text-[16px] font-bold text-[#dce9e7]">{formatMoney(treasury.balance)}</div><div className="mt-1 flex items-center justify-end gap-1 text-[10px] font-bold text-[#56cdbc]"><ArrowUpRight size={12} />{formatMoney(treasury.changeToday)}</div></div>} /><TreasuryChart treasury={treasury} /></Panel><Panel><PanelHeader icon={<Waves size={15} />} title="Handelsströme" description="East Basin · heute" /><div className="space-y-4 p-5"><div className="flex items-center justify-between"><span className="text-[10px] text-[#789194]">Importe</span><span className="mono text-[12px] text-[#dce9e7]">{formatMoney(economy.importsToday)}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#172628]"><div className="h-full w-[70%] rounded-full bg-[#4b9ab6]" /></div><div className="flex items-center justify-between"><span className="text-[10px] text-[#789194]">Exporte</span><span className="mono text-[12px] text-[#dce9e7]">{formatMoney(economy.exportsToday)}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#172628]"><div className="h-full w-[30%] rounded-full bg-[#45c4b5]" /></div><div className="mt-5 grid grid-cols-2 gap-3 border-t border-[#1c292b] pt-4"><div><div className="text-[9px] uppercase tracking-[.12em] text-[#60777a]">Hafengebühren</div><div className="mono mt-1 text-[14px] text-[#dce9e7]">{formatMoney(economy.taxRevenueToday)}</div></div><div><div className="text-[9px] uppercase tracking-[.12em] text-[#60777a]">Saldo</div><div className="mono mt-1 text-[14px] text-[#56cdbc]">{formatMoney(economy.exportsToday - economy.importsToday)}</div></div></div></div></Panel></div>
    <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]"><Panel><PanelHeader icon={<Ship size={15} />} title="Schiffsverkehr" description="Aktive Routen und nächste Ankünfte" action={<button type="button" className="text-[10px] font-bold text-[#53c8b8] hover:underline">Alle Schiffe →</button>} />{ships.slice(0, 3).map((ship) => <ShipRow key={ship.id} ship={ship} dense />)}</Panel><Panel><PanelHeader icon={<Activity size={15} />} title="Letzte Aktivität" description="Serverseitig protokolliert" action={<Clock3 size={14} className="text-[#5e7779]" />} /><ActivityFeed items={activity} /></Panel></div>
    <Panel><PanelHeader icon={<TrendingUp size={15} />} title="Marktbeobachtung" description="Die wichtigsten Waren im aktuellen Zyklus" action={<span className="mono text-[9px] text-[#5e7779]">TOP 05 / 200</span>} /><MarketTable stocks={stocks} economy={economy} limit={5} /></Panel>
  </div>;
}

function EconomyView({ stocks, treasury, economy, running, onScenario }: { stocks: Stock[]; treasury: Treasury; economy: EconomyState; running: boolean; onScenario: (scenario: Scenario) => void }) {
  return <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard title="Einnahmen heute" value={formatMoney(treasury.incomeToday)} caption="Gebühren, Steuern, Exporte" change="+8,4%" icon={<TrendingUp size={16} />} /><MetricCard title="Ausgaben heute" value={formatMoney(treasury.expenseToday)} caption="Logistik und Versorgung" change="-2,1%" icon={<TrendingDown size={16} />} tone="amber" /><MetricCard title="Importe" value={formatMoney(economy.importsToday)} caption="Warenzufluss in den Hafen" change="+6,2%" icon={<ArrowDownRight size={16} />} tone="blue" /><MetricCard title="Exporte" value={formatMoney(economy.exportsToday)} caption="Warenabfluss aus dem Hafen" change="+14,1%" icon={<ArrowUpRight size={16} />} /></div><div className="grid gap-5 xl:grid-cols-[.75fr_1.25fr]"><Panel className="p-5"><div className="flex items-start justify-between"><div><div className="flex items-center gap-2 text-[#5ad0c0]"><Sparkles size={15} /><h2 className="text-[13px] font-bold text-[#dce9e7]">Wirtschaft simulieren</h2></div><p className="mt-2 text-[10px] leading-relaxed text-[#71888b]">Ein Szenario verändert Marktindex, Handelsvolumen und Staatskonto. In FiveM wird der Impuls serverseitig gespeichert.</p></div><StatusBadge tone="teal">{running ? 'Berechnung' : 'Bereit'}</StatusBadge></div><div className="mt-5"><ScenarioControls selected={economy.lastScenario} running={running} onSelect={onScenario} /></div><div className="mt-5 grid grid-cols-2 gap-3 border-t border-[#1c292b] pt-4"><div><div className="text-[9px] uppercase tracking-[.12em] text-[#60777a]">Marktindex</div><div className="display mt-1 text-xl font-bold text-[#dce9e7]">{economy.marketIndex.toFixed(1).replace('.', ',')}</div></div><div><div className="text-[9px] uppercase tracking-[.12em] text-[#60777a]">Letzte Aktion</div><div className="mt-2"><StatusBadge tone={economy.lastScenario === 'shock' ? 'amber' : economy.lastScenario === 'growth' ? 'blue' : 'teal'}>{economy.lastScenario}</StatusBadge></div></div></div></Panel><Panel><PanelHeader icon={<BarChart3 size={15} />} title="Marktpreise & Nachfrage" description="Preise sind serverfähig und werden pro Frachtposition geführt" action={<button type="button" className="flex items-center gap-1.5 rounded-lg border border-[#253336] px-3 py-2 text-[10px] font-bold text-[#9bb3b2]"><Download size={13} /> Export</button>} /><MarketTable stocks={stocks} economy={economy} limit={10} /></Panel></div><Panel><PanelHeader icon={<BriefcaseBusiness size={15} />} title="Alle Marktpositionen" description="Such- und Lagerverwaltung findest du im Frachtlager" action={<span className="mono text-[9px] text-[#5e7779]">INDEX / 200</span>} /><MarketTable stocks={stocks} economy={economy} limit={20} /></Panel></div>;
}

function TrafficView({ ships }: { ships: Ship[] }) {
  return <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-3"><MetricCard title="Aktive Routen" value={String(ships.length).padStart(2, '0')} caption="Positionen werden live aktualisiert" change="LIVE" icon={<RouteIcon size={16} />} /><MetricCard title="Ankünfte heute" value="07" caption="Nächste Ankunft in 02:14" change="+02" icon={<CalendarClock size={16} />} tone="amber" /><MetricCard title="Routenstatus" value="98,4%" caption="Keine kritischen Verzögerungen" change="+1,8%" icon={<Gauge size={16} />} tone="blue" /></div><div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]"><Panel className="overflow-hidden"><PanelHeader icon={<RouteIcon size={15} />} title="Live-Karte" description="East Basin · Schiffspositionen und Hafenpunkte" action={<button type="button" className="flex items-center gap-1.5 rounded-lg border border-[#253336] px-3 py-2 text-[10px] font-bold text-[#9bb3b2]"><Layers3 size={13} /> Ebenen</button>} /><LeafletMap visibleShips={ships} /></Panel><Panel><PanelHeader icon={<Ship size={15} />} title="Schiffsregister" description="Manifest und ETA" /><div>{ships.map((ship) => <ShipRow key={ship.id} ship={ship} />)}</div></Panel></div></div>;
}

function WarehouseView({ stock, onStockChange }: { stock: Stock[]; onStockChange: (id: string, delta: number) => void }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Alle');
  const categories = ['Alle', ...Array.from(new Set(stock.map((item) => item.category)))];
  const filtered = stock.filter((item) => category === 'Alle' || item.category === category).filter((item) => `${item.name} ${item.category} ${item.location}`.toLowerCase().includes(query.toLowerCase()));
  const total = stock.reduce((sum, item) => sum + item.qty, 0);
  const capacity = stock.reduce((sum, item) => sum + item.capacity, 0);
  const reorder = stock.filter((item) => item.qty <= item.reorder).length;
  return <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-3"><MetricCard title="Gesamtbestand" value={total.toLocaleString('de-DE')} caption={`${stock.length} Frachtpositionen verwaltet`} icon={<Boxes size={16} />} /><MetricCard title="Kapazität" value={`${capacity ? Math.round(total / capacity * 100) : 0}%`} caption="Lagerauslastung East Basin" icon={<Warehouse size={16} />} tone="blue" /><MetricCard title="Nachbestellung" value={String(reorder).padStart(2, '0')} caption="Positionen unter Mindestbestand" icon={<ClipboardList size={16} />} tone="amber" /></div><Panel><div className="flex flex-col justify-between gap-4 border-b border-[#1c292b] px-5 py-4 lg:flex-row lg:items-center"><div><div className="flex items-center gap-2 text-[#5ad0c0]"><Warehouse size={15} /><h2 className="text-[13px] font-bold text-[#dce9e7]">Frachtbestand</h2></div><p className="mt-1 text-[10px] text-[#71888b]">200 handelbare Güter · Bestand, Kapazität und Mindestmengen</p></div><div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-2 rounded-lg border border-[#253336] bg-[#0d1314] px-3 py-2 text-[10px] text-[#789194]"><Search size={13} /><span className="sr-only">Fracht suchen</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Fracht suchen" className="w-32 bg-transparent text-[#dce9e7] outline-none placeholder:text-[#60777a] sm:w-44" /></label><label className="flex items-center gap-2 rounded-lg border border-[#253336] bg-[#0d1314] px-3 py-2 text-[10px] text-[#789194]"><SlidersHorizontal size={13} /><select value={category} onChange={(event) => setCategory(event.target.value)} className="bg-transparent text-[#dce9e7] outline-none">{categories.map((item) => <option key={item} value={item} className="bg-[#0d1314]">{item}</option>)}</select></label><button type="button" className="hidden items-center gap-1.5 rounded-lg bg-[#2d9e91] px-3 py-2 text-[10px] font-bold text-[#061412] sm:flex"><Plus size={13} /> Neue Lieferung</button></div></div><div className="hidden grid-cols-[1.35fr_1fr_.8fr_1fr_1.1fr] gap-4 border-b border-[#1c292b] bg-[#0c1415] px-5 py-2.5 text-[9px] font-bold uppercase tracking-[.12em] text-[#5f7779] md:grid"><span>Frachtposition</span><span>Lagerort</span><span>Bestand</span><span>Füllstand</span><span>Anpassen</span></div>{filtered.map((item) => <div key={item.id} data-testid={`row-stock-${item.id}`} className="grid gap-3 border-b border-[#182528] px-5 py-4 last:border-0 md:grid-cols-[1.35fr_1fr_.8fr_1fr_1.1fr] md:items-center md:gap-4"><div className="flex items-center gap-3"><div className={`flex h-8 w-8 items-center justify-center rounded-lg ${getDefinition(item.id).tone === 'amber' ? 'bg-[#342515] text-[#e4ad57]' : getDefinition(item.id).tone === 'blue' ? 'bg-[#102b39] text-[#70b6d6]' : 'bg-[#10312e] text-[#50cdbb]'}`}><Package size={14} /></div><div><div className="text-[11px] font-bold text-[#d8e7e4]">{item.name}</div><div className="mt-0.5 text-[10px] text-[#71888b]">{item.category}</div></div></div><div className="flex items-center gap-1.5 text-[10px] text-[#8ca4a4]"><MapPin size={12} className="text-[#5e7779]" />{item.location}</div><div><span className="mono text-[12px] text-[#d8e7e4]">{item.qty.toLocaleString('de-DE')}</span> <span className="text-[10px] text-[#71888b]">{item.unit}</span></div><div><div className="mb-1 flex justify-between text-[9px] text-[#71888b]"><span>{Math.round(item.qty / item.capacity * 100)}% belegt</span>{item.qty <= item.reorder && <span className="font-bold text-[#e4ad57]">Nachbestellen</span>}</div><div className="h-1.5 overflow-hidden rounded-full bg-[#172628]"><div className={`h-full rounded-full ${item.qty <= item.reorder ? 'bg-[#d99a3c]' : 'bg-[#35b8aa]'}`} style={{ width: `${Math.min(100, item.qty / item.capacity * 100)}%` }} /></div></div><div className="flex items-center gap-1"><IconButton label={`Bestand von ${item.name} verringern`} onClick={() => onStockChange(item.id, -1)} className="h-7 w-7"><Minus size={13} /></IconButton><span className="mono w-12 text-center text-[10px] text-[#71888b]">1 {item.unit}</span><IconButton label={`Bestand von ${item.name} erhöhen`} onClick={() => onStockChange(item.id, 1)} className="h-7 w-7 text-[#5bd4c2]"><Plus size={13} /></IconButton></div></div>)}{filtered.length === 0 && <div className="px-5 py-16 text-center text-[11px] text-[#71888b]">Keine Frachtpositionen gefunden.</div>}</Panel></div>;
}

function ActivityView({ items }: { items: ActivityItem[] }) {
  return <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-3"><MetricCard title="Ereignisse heute" value={String(items.length + 18).padStart(2, '0')} caption="Alle Buchungen und Systemmeldungen" icon={<Activity size={16} />} /><MetricCard title="Letzte Synchronisierung" value="LIVE" caption="State-Updates vom FiveM-Server" icon={<RefreshCw size={16} />} tone="blue" /><MetricCard title="Auditstatus" value="OK" caption="Keine unbestätigten Änderungen" icon={<ClipboardList size={16} />} tone="amber" /></div><Panel><PanelHeader icon={<Activity size={15} />} title="Aktivitätsprotokoll" description="Serverseitiger Audit-Feed für die Wirtschaftssimulation" action={<button type="button" className="flex items-center gap-1.5 rounded-lg border border-[#253336] px-3 py-2 text-[10px] font-bold text-[#9bb3b2]"><Download size={13} /> Export</button>} /><div>{items.map((item) => <div key={item.id} className="flex items-start gap-4 border-b border-[#182528] px-5 py-4 last:border-0"><div className="mono w-16 shrink-0 pt-1 text-[9px] text-[#536a6d]">{new Date(item.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#10312e] text-[#50cdbb]"><Activity size={15} /></span><div className="flex-1"><div className="text-[11px] font-bold text-[#d8e7e4]">{item.title}</div><div className="mt-1 text-[10px] text-[#71888b]">{item.detail}</div></div><StatusBadge tone={item.type === 'treasury' ? 'amber' : item.type === 'ship' ? 'blue' : 'teal'}>{item.type}</StatusBadge></div>)}</div></Panel></div>;
}

function AppShell() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [visible, setVisible] = useState(!isFiveM());
  const [cargo, setCargo] = useState<Cargo[]>(initialCargo);
  const [stock, setStock] = useState<Stock[]>(initialStock);
  const [liveShips, setLiveShips] = useState<Ship[]>(demoShips);
  const [treasury, setTreasury] = useState<Treasury>(defaultTreasury);
  const [economy, setEconomy] = useState<EconomyState>(defaultEconomy);
  const [activity, setActivity] = useState<ActivityItem[]>(demoActivity);
  const [refreshedAt, setRefreshedAt] = useState('gerade eben');
  const [notice, setNotice] = useState('');
  const [scenarioRunning, setScenarioRunning] = useState(false);

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      const data = event.data;
      if (data?.action === 'open') setVisible(true);
      if (data?.action === 'close') setVisible(false);
      if (data?.action === 'stateUpdate' && data.state) {
        const next = applyServerState(data.state as ServerState);
        setCargo(next.cargo);
        setStock(next.stock);
        setLiveShips(next.ships);
        setTreasury(next.treasury);
        setEconomy(next.economy);
        setActivity(next.activity);
        setRefreshedAt('gerade eben');
        setScenarioRunning(false);
      }
      if (data?.action === 'actionResult') {
        setNotice(data.success ? data.message : `Aktion fehlgeschlagen: ${data.message}`);
        setScenarioRunning(false);
        window.setTimeout(() => setNotice(''), 2600);
      }
    };
    window.addEventListener('message', listener);
    window.parent?.postMessage({ type: 'harbor-ledger:ready', source: 'harbor-ledger-ui' }, '*');
    nuiPost('getState', {});
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && isFiveM()) nuiPost('close', {}); };
    window.addEventListener('keydown', closeOnEscape);
    return () => { window.removeEventListener('message', listener); window.removeEventListener('keydown', closeOnEscape); };
  }, []);

  const sendBridge = (type: string, payload: unknown) => { if (!isFiveM()) window.parent?.postMessage({ type, payload, source: 'harbor-ledger-ui' }, '*'); };
  const updateStock = (id: string, delta: number) => {
    setStock((items) => items.map((item) => item.id === id ? { ...item, qty: Math.max(0, Math.min(item.capacity, item.qty + delta)) } : item));
    setCargo((items) => items.map((item) => item.id === id ? { ...item, qty: Math.max(0, item.qty + delta), status: item.qty + delta <= getDefinition(id).reorder ? 'Nachbestellen' : 'Freigegeben' } : item));
    nuiPost(delta > 0 ? 'addCargo' : 'removeCargo', { itemId: id, amount: Math.abs(delta), note: 'Frachtlager' });
    sendBridge('harbor-ledger:stock-adjust', { id, delta });
    setNotice(delta > 0 ? 'Bestand erhöht' : 'Bestand verringert');
    window.setTimeout(() => setNotice(''), 1600);
  };
  const updateCargo = (id: string, delta: number) => updateStock(id, delta);
  const refresh = () => { setRefreshedAt('gerade eben'); nuiPost('getState', {}); sendBridge('harbor-ledger:request-refresh', {}); setNotice('Serverstatus angefordert'); window.setTimeout(() => setNotice(''), 1800); };
  const close = () => { if (isFiveM()) nuiPost('close', {}); else setVisible(false); };
  const runScenario = (scenario: Scenario) => {
    setScenarioRunning(true);
    nuiPost('simulateEconomy', { scenario });
    if (!isFiveM()) {
      const result = applyScenario(treasury, economy, scenario);
      setTreasury(result.treasury);
      setEconomy(result.economy);
      setActivity((items) => [{ id: `scenario-${Date.now()}`, type: 'treasury', title: `Szenario ausgeführt: ${result.label}`, detail: `Marktindex auf ${result.economy.marketIndex.toFixed(1)} aktualisiert`, timestamp: Date.now() }, ...items]);
      setScenarioRunning(false);
    }
    setNotice(`Szenario wird berechnet: ${scenario}`);
    window.setTimeout(() => setNotice(''), 2200);
  };
  const content = activeTab === 'overview' ? <Overview cargo={cargo} stocks={stock} ships={liveShips} treasury={treasury} economy={economy} activity={activity} onScenario={runScenario} /> : activeTab === 'economy' ? <EconomyView stocks={stock} treasury={treasury} economy={economy} running={scenarioRunning} onScenario={runScenario} /> : activeTab === 'traffic' ? <TrafficView ships={liveShips} /> : activeTab === 'warehouse' ? <WarehouseView stock={stock} onStockChange={updateStock} /> : <ActivityView items={activity} />;
  return <div className={`${isFiveM() && !visible ? 'hidden' : 'flex'} harbor-dark min-h-[100dvh] flex-col bg-[#050708] text-[#dce9e7] md:flex-row`}><Sidebar activeTab={activeTab} onSelect={setActiveTab} /><main className="min-w-0 flex-1"><TopBar activeTab={activeTab} onRefresh={refresh} onClose={close} refreshedAt={refreshedAt} /><div className="mx-auto max-w-[1600px] p-4 md:p-7">{content}</div></main>{notice && <div data-testid="status-notice" className="fixed bottom-5 right-5 z-30 flex max-w-[340px] items-center gap-2 rounded-lg border border-[#28534f] bg-[#0d2524] px-4 py-3 text-[11px] font-semibold text-[#dce9e7] shadow-2xl"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#56d6c3]" />{notice}<button type="button" aria-label="Meldung schließen" onClick={() => setNotice('')} className="ml-2 text-[#82aaa5] hover:text-white"><X size={14} /></button></div>}</div>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch><Route path="/" component={AppShell} /><Route component={NotFound} /></Switch></ErrorBoundary>;
}

export default function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}