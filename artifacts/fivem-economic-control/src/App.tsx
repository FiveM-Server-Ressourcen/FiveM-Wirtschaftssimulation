import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  Anchor, ArrowUpRight, Bell, Box, CircleGauge,
  BarChart3, ClipboardList, Container, Download, Layers3, MapPin, Menu,
  Minus, Package, Plus, RefreshCw, Route as RouteIcon, Search, ShipWheel,
  SlidersHorizontal, TrendingDown, TrendingUp, WalletCards, Warehouse, X,
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

type Tab = 'overview' | 'fleet' | 'warehouse';
type Cargo = { id: string; name: string; qty: number; unit: string; tone: string; status: string };
type Ship = { id: string; name: string; route: string; eta: string; status: string; progress: number; cargo: string; pos: string; tone: string; lat?: number; lng?: number };
type Stock = { id: string; name: string; category: string; qty: number; capacity: number; unit: string; location: string; reorder: number };
type ServerState = {
  treasury?: { balance: number; changeToday: number; incomeToday: number; expenseToday: number; trend: number[] };
  inventory?: Record<string, { quantity: number; capacity: number; reserved: number }>;
  ships?: Array<{ id: string; name: string; status: string; cargoLabel: string; from: string; to: string; progress: number; etaMinutes: number; lat: number; lng: number }>;
};

type CargoDefinition = { name: string; category: string; unit: string; tone: string; location: string; reorder: number };

const cargoProfiles: CargoDefinition[] = [
  { name: 'Elektronikmodule', category: 'Technik', unit: 'Kisten', tone: 'teal', location: 'Pier A', reorder: 48 },
  { name: 'Treibstoff', category: 'Energie', unit: 'Fässer', tone: 'blue', location: 'Gefahrgut', reorder: 72 },
  { name: 'Baustahl', category: 'Baustoffe', unit: 'Paletten', tone: 'slate', location: 'Pier C', reorder: 36 },
  { name: 'Frischware', category: 'Versorgung', unit: 'Kisten', tone: 'amber', location: 'Kühlhaus', reorder: 84 },
  { name: 'Textilien', category: 'Handel', unit: 'Ballen', tone: 'red', location: 'Sicherheitslager', reorder: 24 },
  { name: 'Maschinenteile', category: 'Industrie', unit: 'Kisten', tone: 'teal', location: 'Pier B', reorder: 42 },
  { name: 'Medizinbedarf', category: 'Gesundheit', unit: 'Kisten', tone: 'blue', location: 'Kühlhaus', reorder: 30 },
  { name: 'Zement', category: 'Baustoffe', unit: 'Säcke', tone: 'slate', location: 'Pier C', reorder: 60 },
  { name: 'Kaffee', category: 'Versorgung', unit: 'Säcke', tone: 'amber', location: 'Trockenlager', reorder: 45 },
  { name: 'Ersatzteile', category: 'Industrie', unit: 'Kisten', tone: 'red', location: 'Pier B', reorder: 28 },
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
    }];
  }),
) as Record<string, CargoDefinition>;

const cargoCatalog: Record<string, CargoDefinition> = {
  electronics: { name: 'Elektronikmodule', category: 'Technik', unit: 'Kisten', tone: 'teal', location: 'Pier A–02', reorder: 48 },
  fuel: { name: 'Treibstoff', category: 'Energie', unit: 'Fässer', tone: 'blue', location: 'Gefahrgut 04', reorder: 72 },
  steel: { name: 'Baustahl', category: 'Baustoffe', unit: 'Paletten', tone: 'slate', location: 'Pier C–01', reorder: 36 },
  food: { name: 'Frischware', category: 'Versorgung', unit: 'Kisten', tone: 'amber', location: 'Kühlhaus 01', reorder: 84 },
  textiles: { name: 'Textilien', category: 'Handel', unit: 'Ballen', tone: 'red', location: 'Sicherheitslager 02', reorder: 24 },
  ...generatedCargoCatalog,
};

const demoCargoIds = Object.keys(generatedCargoCatalog);

const portNames: Record<string, string> = {
  lsia: 'LSIA',
  terminal: 'Terminal Island',
  paleto: 'Paleto Cove',
  eastsandy: 'Sandy Shores',
};

const ships: Ship[] = [
  { id: 'mistral', name: 'Mistral Runner', route: 'Port Royale → Davis', eta: '08:42', status: 'Unterwegs', progress: 68, cargo: 'Maschinenteile', pos: '52% 39%', tone: 'teal' },
  { id: 'cormorant', name: 'Cormorant III', route: 'Paleto → Port Royale', eta: '11:16', status: 'Anlegen', progress: 92, cargo: 'Frischware', pos: '74% 64%', tone: 'amber' },
  { id: 'calypso', name: 'Calypso Haul', route: 'Elysian → Grapeseed', eta: '13:05', status: 'Beladung', progress: 23, cargo: 'Treibstoff', pos: '28% 73%', tone: 'blue' },
];

const initialCargo: Cargo[] = [
  ...demoCargoIds.map((id, index) => {
    const definition = cargoCatalog[id];
    const qty = 22 + ((index * 17) % 180);
    return { id, name: definition.name, qty, unit: definition.unit, tone: definition.tone, status: qty <= definition.reorder ? 'Nachbestellen' : 'Freigegeben' };
  }),
];

const initialStock: Stock[] = [
  ...demoCargoIds.map((id, index) => {
    const definition = cargoCatalog[id];
    const capacity = 100 + ((index * 31) % 180);
    const qty = 22 + ((index * 17) % 180);
    return { id, name: definition.name, category: definition.category, qty: Math.min(qty, capacity), capacity, unit: definition.unit, location: definition.location, reorder: definition.reorder };
  }),
];

const formatMoney = (value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

function mapShipState(serverShip: NonNullable<ServerState['ships']>[number]): Ship {
  const x = Math.min(92, Math.max(8, ((serverShip.lng + 118.45) / 0.25) * 100));
  const y = Math.min(88, Math.max(12, (1 - (serverShip.lat - 33.7) / 0.35) * 100));
  const status = serverShip.status === 'underway' ? 'Unterwegs' : serverShip.status === 'docked' ? 'Im Hafen' : 'Vor Anker';
  const tone = serverShip.status === 'anchored' ? 'amber' : serverShip.status === 'docked' ? 'blue' : 'teal';
  const eta = serverShip.etaMinutes > 0
    ? `${String(Math.floor(serverShip.etaMinutes / 60)).padStart(2, '0')}:${String(serverShip.etaMinutes % 60).padStart(2, '0')}`
    : '00:00';
  return {
    id: serverShip.id,
    name: serverShip.name,
    route: `${portNames[serverShip.from] ?? serverShip.from} → ${portNames[serverShip.to] ?? serverShip.to}`,
    eta,
    status,
    progress: Math.round(serverShip.progress * 100),
    cargo: serverShip.cargoLabel,
    pos: `${x}% ${y}%`,
    tone,
    lat: serverShip.lat,
    lng: serverShip.lng,
  };
}

function applyServerState(serverState: ServerState) {
  const inventory = serverState.inventory ?? {};
  const nextCargo = Object.entries(inventory).map(([id, stock]) => {
    const definition = cargoCatalog[id] ?? { name: id, category: 'General', unit: 'units', tone: 'slate', location: 'Main storage', reorder: 0 };
    return { id, name: definition.name, qty: stock.quantity, unit: definition.unit, tone: definition.tone, status: (stock.quantity - stock.reserved) <= definition.reorder ? 'Nachbestellen' : 'Freigegeben' };
  });
  const nextStock = Object.entries(inventory).map(([id, stock]) => {
    const definition = cargoCatalog[id] ?? { name: id, category: 'General', unit: 'units', tone: 'slate', location: 'Main storage', reorder: 0 };
    return { id, name: definition.name, category: definition.category, qty: stock.quantity, capacity: stock.capacity, unit: definition.unit, location: definition.location, reorder: definition.reorder };
  });
  return { cargo: nextCargo, stock: nextStock, ships: (serverState.ships ?? []).map(mapShipState) };
}

function IconButton({ label, children, onClick, className = '' }: { label: string; children: ReactNode; onClick?: () => void; className?: string }) {
  return <button type="button" aria-label={label} data-testid={`button-${label.toLowerCase().replaceAll(' ', '-')}`} onClick={onClick} className={`inline-flex items-center justify-center rounded-md transition-colors hover:bg-[hsl(var(--muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] ${className}`}>{children}</button>;
}

function StatusPill({ children, tone = 'teal' }: { children: ReactNode; tone?: 'teal' | 'amber' | 'red' | 'slate' | 'blue' }) {
  const tones = {
    teal: 'bg-[#d7efeb] text-[#17635e]',
    amber: 'bg-[#fff0cf] text-[#8b5b0a]',
    red: 'bg-[#f9dedb] text-[#9f3931]',
    slate: 'bg-[#e4eaee] text-[#536574]',
    blue: 'bg-[#dcebf4] text-[#2f647e]',
  };
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] ${tones[tone]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{children}</span>;
}

function Card({ children, className = '', testId }: { children: ReactNode; className?: string; testId?: string }) {
  return <section data-testid={testId} className={`rounded-lg border border-[#d1e0e2] bg-[hsl(var(--card))] shadow-[0_5px_18px_rgba(29,72,83,.045)] ${className}`}>{children}</section>;
}

function Sidebar({ activeTab, onSelect }: { activeTab: Tab; onSelect: (tab: Tab) => void }) {
  const items: { id: Tab; label: string; icon: ReactNode; note: string }[] = [
    { id: 'overview', label: 'Wirtschaftsübersicht', icon: <CircleGauge size={17} />, note: 'Leitstelle' },
    { id: 'fleet', label: 'Schiffsverkehr', icon: <ShipWheel size={17} />, note: '3 unterwegs' },
    { id: 'warehouse', label: 'Frachtlager', icon: <Warehouse size={17} />, note: '200 Positionen' },
  ];
  return <aside className="flex w-full shrink-0 flex-col bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))] md:w-[238px]">
    <div className="flex items-center justify-between border-b border-[hsl(var(--sidebar-border))] px-5 py-5 md:block">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))]"><Anchor size={20} strokeWidth={2.5} /></div>
        <div><div className="display text-[15px] font-bold tracking-tight text-white">Harbor Ledger</div><div className="mono mt-0.5 text-[9px] uppercase tracking-[.17em] text-[#8faeb2]">Hafenleitstelle</div></div>
      </div>
      <IconButton label="open navigation" onClick={() => window.parent?.postMessage({ type: 'harbor-ledger:open-navigation' }, '*')} className="h-9 w-9 text-[#acc3c6] md:hidden"><Menu size={18} /></IconButton>
    </div>
    <nav className="flex gap-1 overflow-x-auto border-b border-[hsl(var(--sidebar-border))] px-3 py-2 md:hidden">
      {items.map((item) => <button key={item.id} type="button" data-testid={`mobile-tab-${item.id}`} onClick={() => onSelect(item.id)} className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-[11px] font-bold ${activeTab === item.id ? 'bg-[#24434a] text-white' : 'text-[#91adb0]'}`}><span className={activeTab === item.id ? 'text-[#61d0c4]' : 'text-[#75999d]'}>{item.icon}</span>{item.label}</button>)}
    </nav>
    <div className="hidden px-3 pt-7 md:block">
      <p className="mono mb-2 px-3 text-[9px] font-medium uppercase tracking-[.18em] text-[#77979c]">Steuerzentrale</p>
      <nav className="space-y-1">
        {items.map((item) => <button key={item.id} type="button" data-testid={`tab-${item.id}`} onClick={() => onSelect(item.id)} className={`group flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition-colors ${activeTab === item.id ? 'bg-[#24434a] text-white shadow-[inset_3px_0_0_hsl(var(--sidebar-primary))]' : 'text-[#9db6b9] hover:bg-[#1c363d] hover:text-white'}`}>
          <span className={activeTab === item.id ? 'text-[#61d0c4]' : 'text-[#75999d]'}>{item.icon}</span><span className="flex-1 text-[12px] font-semibold">{item.label}</span><span className={`mono text-[9px] ${activeTab === item.id ? 'text-[#9ccbc7]' : 'text-[#607f84]'}`}>{item.note}</span>
        </button>)}
      </nav>
    </div>
    <div className="mt-auto hidden p-4 md:block"><div className="border-t border-[hsl(var(--sidebar-border))] pt-4"><div className="flex items-center justify-between"><span className="mono text-[9px] uppercase tracking-[.16em] text-[#77979c]">System status</span><span className="flex items-center gap-1.5 text-[10px] font-bold text-[#62d0c4]"><span className="sonar-dot h-1.5 w-1.5 rounded-full bg-current" />Live</span></div><p className="mt-2 text-[10px] leading-relaxed text-[#607f84]">Wirtschaftsdaten und Schiffspositionen werden laufend aktualisiert.</p></div></div>
  </aside>;
}

function Header({ activeTab, onRefresh, refreshedAt }: { activeTab: Tab; onRefresh: () => void; refreshedAt: string }) {
  const title = activeTab === 'overview' ? 'Wirtschaftsübersicht' : activeTab === 'fleet' ? 'Schiffsverkehr' : 'Frachtlager';
  return <header className="flex min-h-[76px] items-center justify-between gap-4 border-b border-[#d3e0e2] bg-[#f8fbfb] px-5 py-4 md:px-8">
    <div><div className="mono mb-1 text-[9px] uppercase tracking-[.16em] text-[#709095]">Los Santos / East Basin</div><h1 data-testid="text-page-title" className="display text-[22px] font-bold tracking-[-.04em] text-[#19353d]">{title}</h1></div>
    <div className="flex items-center gap-2 md:gap-4">
      <div className="hidden items-center gap-2 text-[10px] text-[#789296] sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#30a99c]" /> Letzte Aktualisierung {refreshedAt}</div>
      <IconButton label="refresh dashboard" onClick={onRefresh} className="h-9 w-9 border border-[#d1e0e2] bg-white text-[#527077]"><RefreshCw size={15} /></IconButton>
      <IconButton label="notifications" onClick={() => window.parent?.postMessage({ type: 'harbor-ledger:open-notifications' }, '*')} className="relative h-9 w-9 border border-[#d1e0e2] bg-white text-[#527077]"><Bell size={15} /><span className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full bg-[#e09832]" /></IconButton>
       <div className="hidden h-8 w-px bg-[#d8e2e3] md:block" /><div className="hidden text-right sm:block"><div className="text-[11px] font-bold text-[#24444b]">Wirtschaftsamt</div><div className="mono text-[9px] text-[#779095]">ADMIN / 04</div></div>
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e0b261] text-[11px] font-extrabold text-[#29434a]">MD</div>
    </div>
  </header>;
}

function TreasuryChart() {
  return <div className="relative h-[190px] overflow-hidden px-5 pb-4 pt-6">
    <div className="absolute inset-x-5 top-6 bottom-7 flex flex-col justify-between"><span className="mono text-[9px] text-[#91a5a8]">$4.8M</span><span className="mono text-[9px] text-[#91a5a8]">$4.4M</span><span className="mono text-[9px] text-[#91a5a8]">$4.0M</span><span className="mono text-[9px] text-[#91a5a8]">$3.6M</span></div>
    <svg className="absolute inset-x-5 top-7 h-[138px] w-[calc(100%-40px)]" viewBox="0 0 600 138" preserveAspectRatio="none" aria-label="Vermögenstrend-Diagramm">
      <defs><linearGradient id="treasury-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#44b9aa" stopOpacity=".26" /><stop offset="1" stopColor="#44b9aa" stopOpacity="0" /></linearGradient></defs>
      {[0, 46, 92, 138].map((y) => <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="#d9e6e6" strokeWidth="1" />)}
      <path d="M0 108 C35 103, 48 88, 75 92 S115 110, 142 88 S185 74, 210 80 S250 56, 278 67 S320 75, 348 53 S390 52, 418 61 S460 30, 490 38 S535 47, 600 15 V138 H0 Z" fill="url(#treasury-fill)" />
      <path d="M0 108 C35 103, 48 88, 75 92 S115 110, 142 88 S185 74, 210 80 S250 56, 278 67 S320 75, 348 53 S390 52, 418 61 S460 30, 490 38 S535 47, 600 15" fill="none" stroke="#258f87" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      <circle cx="600" cy="15" r="4" fill="#e0a03f" stroke="#f8fbfb" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
    <div className="absolute inset-x-5 bottom-1 flex justify-between mono text-[9px] text-[#91a5a8]"><span>01 MAY</span><span>08 MAY</span><span>15 MAY</span><span>22 MAY</span><span>29 MAY</span></div>
  </div>;
}

function LeafletMap({ visibleShips }: { visibleShips: Ship[] }) {
  const mapElement = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapElement.current) return;
    const map = L.map(mapElement.current, { zoomControl: false, attributionControl: true }).setView([33.87, -118.31], 10);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const ports: Array<[string, number, number]> = [
      ['LSIA', 33.9416, -118.4085],
      ['Terminal Island', 33.7396, -118.2620],
      ['Paleto Cove', 34.0181, -118.4370],
      ['Sandy Shores', 33.9475, -118.2110],
    ];
    ports.forEach(([name, lat, lng]) => {
      L.circleMarker([lat, lng], { radius: 5, color: '#1f7f79', weight: 2, fillColor: '#dff3ef', fillOpacity: 1 })
        .bindTooltip(name, { direction: 'top', offset: [0, -4], className: 'port-tooltip' })
        .addTo(map);
    });

    visibleShips.forEach((ship, index) => {
      const lat = ship.lat ?? 33.82 + index * 0.04;
      const lng = ship.lng ?? -118.36 + index * 0.06;
      const color = ship.tone === 'amber' ? '#d89a3b' : ship.tone === 'blue' ? '#4784a0' : '#238f86';
      L.circleMarker([lat, lng], { radius: 8, color: '#ffffff', weight: 3, fillColor: color, fillOpacity: 1 })
        .bindTooltip(`<strong>${ship.name}</strong><br />${ship.status} · ${ship.eta} ETA`, { direction: 'right', offset: [10, 0], className: 'ship-tooltip' })
        .addTo(map);
    });

    return () => {
      map.remove();
    };
  }, [visibleShips]);

  return <div ref={mapElement} className="leaflet-map h-[300px] md:h-[342px]" aria-label="Leaflet-Karte mit aktuellen Frachtschiffpositionen" />;
}

function MapPanel({ ships: visibleShips }: { ships: Ship[] }) {
  return <Card className="overflow-hidden" testId="map-maritime"><div className="flex items-center justify-between border-b border-[#dbe6e7] px-5 py-4"><div><div className="flex items-center gap-2"><RouteIcon size={16} className="text-[#288f88]" /><h2 className="text-[13px] font-extrabold text-[#203f47]">Schiffsverkehr live</h2></div><p className="mt-1 text-[10px] text-[#789397]">Live-Positionen · East-Basin-Sektor</p></div><button type="button" data-testid="button-map-layers" onClick={() => window.parent?.postMessage({ type: 'harbor-ledger:toggle-layers' }, '*')} className="flex items-center gap-1.5 rounded-md border border-[#d4e1e2] px-2.5 py-1.5 text-[10px] font-bold text-[#59787e] hover:bg-[#eef5f4]"><Layers3 size={13} /> Ebenen</button></div>
    <div className="relative overflow-hidden"><LeafletMap visibleShips={visibleShips} /><div className="pointer-events-none absolute left-4 top-4 rounded-md bg-[#f7fbfa]/90 px-2 py-1.5 shadow-sm"><div className="mono text-[9px] text-[#4e7076]">SECTOR 04 / 14:32:08</div></div></div></Card>;
}

function ShipRow({ ship }: { ship: Ship }) {
  return <div data-testid={`row-ship-${ship.id}`} className="group flex items-center gap-3 border-b border-[#e3ebec] px-4 py-3.5 last:border-0 hover:bg-[#f3f8f7]">
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${ship.tone === 'amber' ? 'bg-[#fff0d5] text-[#a96e18]' : ship.tone === 'blue' ? 'bg-[#e0edf3] text-[#467c94]' : 'bg-[#dcefea] text-[#247f76]'}`}><ShipWheel size={17} /></div>
    <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="truncate text-[11px] font-extrabold text-[#29474e]">{ship.name}</span><StatusPill tone={ship.status === 'Anlegen' ? 'amber' : ship.status === 'Beladung' ? 'blue' : 'teal'}>{ship.status}</StatusPill></div><div className="mt-1 flex items-center gap-2 text-[10px] text-[#82999c]"><span>{ship.route}</span><span className="text-[#c4d0d0]">·</span><span>{ship.cargo}</span></div><div className="mt-2 h-1 w-full max-w-[190px] overflow-hidden rounded-full bg-[#deeaeb]"><div className={`h-full rounded-full ${ship.tone === 'amber' ? 'bg-[#d89a3b]' : ship.tone === 'blue' ? 'bg-[#528ca5]' : 'bg-[#32a99c]'}`} style={{ width: `${ship.progress}%` }} /></div></div>
    <div className="text-right"><div className="mono text-[12px] font-medium text-[#29474e]">{ship.eta}</div><div className="mt-1 text-[9px] uppercase tracking-[.1em] text-[#91a4a6]">ETA</div></div>
  </div>;
}

function CargoRow({ item, onChange }: { item: Cargo; onChange: (delta: number) => void }) {
  return <div data-testid={`row-cargo-${item.id}`} className="flex items-center gap-3 border-b border-[#e3ebec] px-4 py-3.5 last:border-0">
    <div className={`flex h-8 w-8 items-center justify-center rounded-md ${item.tone === 'amber' ? 'bg-[#fff0d5] text-[#a86d18]' : item.tone === 'blue' ? 'bg-[#e0edf3] text-[#467c94]' : item.tone === 'red' ? 'bg-[#f8e0dd] text-[#a84d43]' : 'bg-[#dcefea] text-[#247f76]'}`}><Box size={15} /></div><div className="min-w-0 flex-1"><div className="truncate text-[11px] font-bold text-[#29474e]">{item.name}</div><div className="mt-0.5 text-[10px] text-[#82999c]">{item.unit}</div></div><div className="flex items-center gap-1.5"><IconButton label={`remove ${item.name}`} onClick={() => onChange(-1)} className="h-6 w-6 border border-[#d7e3e4] text-[#668186]"><Minus size={12} /></IconButton><span data-testid={`text-cargo-quantity-${item.id}`} className="mono w-8 text-center text-[11px] font-medium text-[#29474e]">{item.qty}</span><IconButton label={`add ${item.name}`} onClick={() => onChange(1)} className="h-6 w-6 border border-[#d7e3e4] text-[#267f77]"><Plus size={12} /></IconButton></div><StatusPill tone={item.status === 'Nachbestellen' ? 'amber' : 'teal'}>{item.status}</StatusPill>
  </div>;
}

function EconomicPulse({ treasury }: { treasury?: ServerState['treasury'] }) {
  const metrics = [
    { label: 'Einnahmen heute', value: formatMoney(treasury?.incomeToday ?? 284600), change: '+8,4%', icon: <TrendingUp size={15} />, tone: 'teal' },
    { label: 'Ausgaben heute', value: formatMoney(treasury?.expenseToday ?? 108180), change: '-2,1%', icon: <TrendingDown size={15} />, tone: 'amber' },
    { label: 'Handelsvolumen', value: '$1,84 Mio.', change: '+12,6%', icon: <BarChart3 size={15} />, tone: 'blue' },
    { label: 'Handelsbilanz', value: '+$176.420', change: 'positiv', icon: <WalletCards size={15} />, tone: 'slate' },
  ];
  return <Card testId="card-economic-pulse" className="overflow-hidden">
    <div className="flex items-center justify-between border-b border-[#dbe6e7] px-5 py-4">
      <div><div className="flex items-center gap-2"><WalletCards size={16} className="text-[#2b8f87]" /><h2 className="text-[13px] font-extrabold text-[#203f47]">Wirtschaftslage</h2></div><p className="mt-1 text-[10px] text-[#789397]">Öffentliche Finanzen und Handelsströme · laufender Tag</p></div>
      <span className="mono text-[9px] uppercase tracking-[.14em] text-[#789397]">LIVE / 24H</span>
    </div>
    <div className="grid gap-px bg-[#dbe6e7] sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => <div key={metric.label} className="bg-[hsl(var(--card))] px-5 py-4">
        <div className="flex items-center justify-between"><span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#dcefea] text-[#238b82]">{metric.icon}</span><span className={`text-[10px] font-bold ${metric.tone === 'amber' ? 'text-[#d89a3b]' : 'text-[#35b9aa]'}`}>{metric.change}</span></div>
        <div className="mt-3 text-[10px] font-semibold text-[#789397]">{metric.label}</div><div className="display mt-1 text-[18px] font-bold tracking-[-.04em] text-[#20414a]">{metric.value}</div>
      </div>)}
    </div>
    <div className="flex items-center justify-between border-t border-[#dbe6e7] px-5 py-3"><div className="flex items-center gap-2 text-[10px] text-[#789397]"><span className="h-1.5 w-1.5 rounded-full bg-[#35b9aa]" /> Einnahmen übersteigen Ausgaben</div><span className="mono text-[10px] text-[#678187]">Saldo +$176.420</span></div>
  </Card>;
}

function Overview({ cargo, onCargoChange, ships: liveShips, treasury }: { cargo: Cargo[]; onCargoChange: (id: string, delta: number) => void; ships: Ship[]; treasury?: ServerState['treasury'] }) {
  const summary = [{ label: 'Staatskonto', value: formatMoney(treasury?.balance ?? 4782640.18), change: '+3,8%', note: 'gegenüber Vortag', icon: <Anchor size={16} />, tone: 'teal' }, { label: 'Frachtwert im Hafen', value: '$1.296.420', change: '+1,4%', note: 'gegenüber Vortag', icon: <Package size={16} />, tone: 'amber' }, { label: 'Schiffe unterwegs', value: String(liveShips.length).padStart(2, '0'), change: '02', note: 'heute erwartet', icon: <ShipWheel size={16} />, tone: 'blue' }, { label: 'Offene Sendungen', value: '18', change: '04', note: 'Prüfung erforderlich', icon: <ClipboardList size={16} />, tone: 'slate' }];
  return <div className="space-y-5">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{summary.map((item, index) => <Card key={item.label} className={`rise-in delay-${index + 1} p-4`} testId={`card-summary-${index}`}><div className="flex items-start justify-between"><div className={`flex h-8 w-8 items-center justify-center rounded-md ${item.tone === 'teal' ? 'bg-[#dcefea] text-[#238b82]' : item.tone === 'amber' ? 'bg-[#fff0d5] text-[#a96d18]' : item.tone === 'blue' ? 'bg-[#e0edf3] text-[#467c94]' : 'bg-[#e4eaee] text-[#607681]'}`}>{item.icon}</div><span className={`flex items-center gap-0.5 text-[10px] font-bold ${item.tone === 'red' ? 'text-[#a34941]' : 'text-[#238b82]'}`}>{item.tone === 'teal' || item.tone === 'amber' ? <ArrowUpRight size={12} /> : null}{item.change}</span></div><div className="mt-4 text-[10px] font-semibold text-[#789397]">{item.label}</div><div data-testid={`text-summary-${index}`} className="display mt-1 text-[21px] font-bold tracking-[-.04em] text-[#20414a]">{item.value}</div><div className="mt-1 text-[10px] text-[#94a6a8]">{item.note}</div></Card>)}</div>
    <EconomicPulse treasury={treasury} />
    <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]"><Card testId="card-treasury"><div className="flex items-start justify-between border-b border-[#dbe6e7] px-5 py-4"><div><div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-[#258f87]" /><h2 className="text-[13px] font-extrabold text-[#203f47]">Vermögenstrend</h2></div><p className="mt-1 text-[10px] text-[#789397]">Verfügbare Staatsmittel · 30-Tage-Verlauf</p></div><div className="text-right"><div className="display text-[17px] font-bold text-[#20414a]">{formatMoney(treasury?.balance ?? 4782640.18)}</div><div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] font-bold text-[#238b82]"><ArrowUpRight size={12} /> {formatMoney(treasury?.changeToday ?? 176420)}</div></div></div><TreasuryChart /><div className="flex items-center gap-4 border-t border-[#e3ebec] px-5 py-3 text-[9px] text-[#81979a]"><span className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-full bg-[#258f87]" /> Nettostaatskonto</span><span className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-full bg-[#e1a040]" /> Hochrechnung</span><span className="ml-auto mono text-[#678187]">Aktualisiert vor 4 Min.</span></div></Card><MapPanel ships={liveShips} /></div>
    <div className="grid gap-5 xl:grid-cols-[1fr_1fr]"><Card testId="card-freight"><div className="flex items-center justify-between border-b border-[#dbe6e7] px-5 py-4"><div><div className="flex items-center gap-2"><Container size={16} className="text-[#2b8f87]" /><h2 className="text-[13px] font-extrabold text-[#203f47]">Aktiver Frachtverkehr</h2></div><p className="mt-1 text-[10px] text-[#789397]">Schiffe mit laufendem Hafenanlauf</p></div><button type="button" data-testid="button-view-fleet" onClick={() => window.parent?.postMessage({ type: 'harbor-ledger:open-fleet' }, '*')} className="text-[10px] font-bold text-[#24877f] hover:underline">Schiffsverkehr <span aria-hidden="true">→</span></button></div>{liveShips.map((ship) => <ShipRow ship={ship} key={ship.id} />)}</Card><Card testId="card-manifest"><div className="flex items-center justify-between border-b border-[#dbe6e7] px-5 py-4"><div><div className="flex items-center gap-2"><Box size={16} className="text-[#2b8f87]" /><h2 className="text-[13px] font-extrabold text-[#203f47]">Frachtmanifest</h2></div><p className="mt-1 text-[10px] text-[#789397]">Port Royale · eingehende Ladung</p></div><button type="button" data-testid="button-download-manifest" onClick={() => window.parent?.postMessage({ type: 'harbor-ledger:export-manifest', payload: { format: 'csv' } }, '*')} className="flex items-center gap-1.5 text-[10px] font-bold text-[#56757b] hover:text-[#24877f]"><Download size={13} /> Export</button></div>{cargo.slice(0, 5).map((item) => <CargoRow item={item} key={item.id} onChange={(delta) => onCargoChange(item.id, delta)} />)}<div className="border-t border-[#e3ebec] px-5 py-3 text-center text-[10px] text-[#789397]">Weitere {Math.max(0, cargo.length - 5)} Positionen im Frachtlager</div></Card></div>
  </div>;
}

function Fleet({ ships: liveShips }: { ships: Ship[] }) {
  return <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-3"><Card className="p-4"><div className="text-[10px] font-bold uppercase tracking-[.1em] text-[#789397]">Unterwegs</div><div className="display mt-2 text-2xl font-bold text-[#20414a]">{liveShips.length}</div><div className="mt-1 text-[10px] text-[#238b82]">Routentelemetrie aktiv</div></Card><Card className="p-4"><div className="text-[10px] font-bold uppercase tracking-[.1em] text-[#789397]">Ankünfte heute</div><div className="display mt-2 text-2xl font-bold text-[#20414a]">07</div><div className="mt-1 text-[10px] text-[#789397]">Nächstes Anlegen in 02:14</div></Card><Card className="p-4"><div className="text-[10px] font-bold uppercase tracking-[.1em] text-[#789397]">Routenstatus</div><div className="display mt-2 text-2xl font-bold text-[#238b82]">98,4%</div><div className="mt-1 text-[10px] text-[#789397]">Keine kritischen Verzögerungen</div></Card></div><div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]"><MapPanel ships={liveShips} /><Card><div className="border-b border-[#dbe6e7] px-5 py-4"><h2 className="text-[13px] font-extrabold text-[#203f47]">Schiffsregister</h2><p className="mt-1 text-[10px] text-[#789397]">Live-Manifest und Routentelemetrie</p></div>{liveShips.map((ship) => <ShipRow key={ship.id} ship={ship} />)}</Card></div></div>;
}

function WarehouseView({ stock, onStockChange }: { stock: Stock[]; onStockChange: (id: string, delta: number) => void }) {
  const [query, setQuery] = useState('');
  const total = stock.reduce((sum, item) => sum + item.qty, 0);
  const capacity = stock.reduce((sum, item) => sum + item.capacity, 0);
  const filteredStock = stock.filter((item) => `${item.name} ${item.category} ${item.location}`.toLowerCase().includes(query.toLowerCase()));
  const fillPercent = capacity ? Math.round(total / capacity * 100) : 0;
  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-3">
      <Card className="p-4"><div className="flex items-center justify-between"><div className="text-[10px] font-bold uppercase tracking-[.1em] text-[#789397]">Gesamtbestand</div><Package size={15} className="text-[#288f88]" /></div><div className="display mt-2 text-2xl font-bold text-[#20414a]">{total.toLocaleString('de-DE')}</div><div className="mt-1 text-[10px] text-[#789397]">{stock.length} Frachtpositionen verwaltet</div></Card>
      <Card className="p-4"><div className="text-[10px] font-bold uppercase tracking-[.1em] text-[#789397]">Kapazitätsauslastung</div><div className="display mt-2 text-2xl font-bold text-[#20414a]">{fillPercent}%</div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#deeaeb]"><div className="h-full rounded-full bg-[#d79a3d]" style={{ width: `${Math.min(100, fillPercent)}%` }} /></div></Card>
      <Card className="p-4"><div className="text-[10px] font-bold uppercase tracking-[.1em] text-[#789397]">Nachbestellprüfung</div><div className="display mt-2 text-2xl font-bold text-[#a36d1c]">{stock.filter((item) => item.qty <= item.reorder).length}</div><div className="mt-1 text-[10px] text-[#789397]">Positionen unter Mindestbestand</div></Card>
    </div>
    <Card>
      <div className="flex flex-col justify-between gap-3 border-b border-[#dbe6e7] px-5 py-4 sm:flex-row sm:items-center">
        <div><h2 className="text-[13px] font-extrabold text-[#203f47]">Frachtbestand</h2><p className="mt-1 text-[10px] text-[#789397]">200 handelbare Güter · East Basin</p></div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 rounded-md border border-[#d4e1e2] px-3 py-2 text-[10px] text-[#789397]"><Search size={13} /><span className="sr-only">Fracht suchen</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Fracht suchen" className="w-32 bg-transparent outline-none placeholder:text-[#789397] sm:w-44" /></label>
          <button type="button" data-testid="button-filter-stock" onClick={() => window.parent?.postMessage({ type: 'harbor-ledger:filter-stock' }, '*')} className="flex items-center gap-1.5 rounded-md border border-[#d4e1e2] px-3 py-2 text-[10px] font-bold text-[#59787e] hover:bg-[#eef5f4]"><SlidersHorizontal size={13} /> Filter</button>
          <button type="button" data-testid="button-new-receipt" onClick={() => window.parent?.postMessage({ type: 'harbor-ledger:new-receipt' }, '*')} className="hidden items-center gap-1.5 rounded-md bg-[#238f86] px-3 py-2 text-[10px] font-bold text-white hover:bg-[#1b766e] sm:flex"><Plus size={13} /> Neue Lieferung</button>
        </div>
      </div>
      <div className="hidden grid-cols-[1.3fr_1fr_.8fr_1fr_1.1fr] gap-4 border-b border-[#e3ebec] bg-[#f5f9f9] px-5 py-2.5 text-[9px] font-bold uppercase tracking-[.12em] text-[#86a0a3] md:grid"><span>Frachtposition</span><span>Lagerort</span><span>Bestand</span><span>Füllstand</span><span>Anpassen</span></div>
      {filteredStock.map((item) => <div key={item.id} data-testid={`row-stock-${item.id}`} className="grid gap-3 border-b border-[#e3ebec] px-5 py-4 last:border-0 md:grid-cols-[1.3fr_1fr_.8fr_1fr_1.1fr] md:items-center md:gap-4"><div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#e7f0ee] text-[#29847c]"><Box size={15} /></div><div><div className="text-[11px] font-bold text-[#29474e]">{item.name}</div><div className="mt-0.5 text-[10px] text-[#82999c]">{item.category}</div></div></div><div className="flex items-center gap-1.5 text-[10px] text-[#617d82]"><MapPin size={12} className="text-[#8da5a7]" />{item.location}</div><div><span className="mono text-[12px] font-medium text-[#29474e]">{item.qty}</span> <span className="text-[10px] text-[#82999c]">{item.unit}</span></div><div><div className="mb-1 flex justify-between text-[9px] text-[#849a9d]"><span>{Math.round(item.qty / item.capacity * 100)}% belegt</span>{item.qty <= item.reorder && <span className="font-bold text-[#ac731e]">Nachbestellen</span>}</div><div className="h-1.5 overflow-hidden rounded-full bg-[#e0eaeb]"><div className={`h-full rounded-full ${item.qty <= item.reorder ? 'bg-[#d89a3b]' : 'bg-[#3ba79c]'}`} style={{ width: `${item.qty / item.capacity * 100}%` }} /></div></div><div className="flex items-center gap-1"><IconButton label={`remove stock ${item.name}`} onClick={() => onStockChange(item.id, -1)} className="h-7 w-7 border border-[#d7e3e4] text-[#668186]"><Minus size={13} /></IconButton><span className="mono w-12 text-center text-[10px] text-[#789397]">1 {item.unit}</span><IconButton label={`add stock ${item.name}`} onClick={() => onStockChange(item.id, 1)} className="h-7 w-7 border border-[#c6dfdb] text-[#267f77]"><Plus size={13} /></IconButton></div></div>)}
      {filteredStock.length === 0 && <div className="px-5 py-12 text-center text-[11px] text-[#789397]">Keine Frachtpositionen für „{query}“ gefunden.</div>}
    </Card>
  </div>;
}

function AppShell() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [visible, setVisible] = useState(!isFiveM());
  const [cargo, setCargo] = useState<Cargo[]>(initialCargo);
  const [stock, setStock] = useState<Stock[]>(initialStock);
  const [liveShips, setLiveShips] = useState<Ship[]>(ships);
  const [treasury, setTreasury] = useState<ServerState['treasury']>();
  const [refreshedAt, setRefreshedAt] = useState('just now');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      const data = event.data;
      if (data?.action === 'open') setVisible(true);
      if (data?.action === 'close') setVisible(false);
      if (data?.type === 'harbor-ledger:set-state' && data.payload?.cargo) setCargo(data.payload.cargo);
      if (data?.type === 'harbor-ledger:refresh') setRefreshedAt('just now');
      if (data?.action === 'stateUpdate' && data.state) {
        const next = applyServerState(data.state as ServerState);
        setCargo(next.cargo);
        setStock(next.stock);
        setLiveShips(next.ships);
        setTreasury((data.state as ServerState).treasury);
        setRefreshedAt('just now');
      }
      if (data?.action === 'actionResult') {
        setNotice(data.success ? data.message : `Aktion fehlgeschlagen: ${data.message}`);
        window.setTimeout(() => setNotice(''), 2200);
      }
    };
    window.addEventListener('message', listener);
    window.parent?.postMessage({ type: 'harbor-ledger:ready', source: 'harbor-ledger-ui' }, '*');
    nuiPost('getState', {});
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFiveM()) nuiPost('close', {});
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('message', listener);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const sendBridge = (type: string, payload: unknown) => {
    if (!isFiveM()) window.parent?.postMessage({ type, payload, source: 'harbor-ledger-ui' }, '*');
  };
  const updateCargo = (id: string, delta: number) => {
    setCargo((items) => items.map((item) => item.id === id ? { ...item, qty: Math.max(0, item.qty + delta) } : item));
    nuiPost(delta > 0 ? 'addCargo' : 'removeCargo', { itemId: id, amount: Math.abs(delta), note: 'Leitstelle' });
    sendBridge('harbor-ledger:cargo-adjust', { id, delta });
    setNotice(delta > 0 ? 'Frachtmenge erhöht' : 'Frachtmenge verringert');
    window.setTimeout(() => setNotice(''), 1800);
  };
  const updateStock = (id: string, delta: number) => {
    setStock((items) => items.map((item) => item.id === id ? { ...item, qty: Math.max(0, Math.min(item.capacity, item.qty + delta)) } : item));
    nuiPost(delta > 0 ? 'addCargo' : 'removeCargo', { itemId: id, amount: Math.abs(delta), note: 'Lagersteuerung' });
    sendBridge('harbor-ledger:stock-adjust', { id, delta });
  };
  const refresh = () => { setRefreshedAt('gerade eben'); nuiPost('getState', {}); sendBridge('harbor-ledger:request-refresh', {}); setNotice('Serverstatus angefordert'); window.setTimeout(() => setNotice(''), 1800); };
  return <div className={`harbor-dark ${isFiveM() && !visible ? 'hidden' : 'flex'} min-h-[100dvh] flex-col bg-[hsl(var(--background))] md:flex-row`}>
    <Sidebar activeTab={activeTab} onSelect={setActiveTab} />
    <main className="min-w-0 flex-1"><Header activeTab={activeTab} onRefresh={refresh} refreshedAt={refreshedAt} /><div className="mx-auto max-w-[1540px] p-5 md:p-8">{activeTab === 'overview' && <Overview cargo={cargo} onCargoChange={updateCargo} ships={liveShips} treasury={treasury} />}{activeTab === 'fleet' && <Fleet ships={liveShips} />}{activeTab === 'warehouse' && <WarehouseView stock={stock} onStockChange={updateStock} />}</div></main>
    {notice && <div data-testid="status-notice" className="fixed bottom-5 right-5 z-20 flex items-center gap-2 rounded-md bg-[#193f46] px-4 py-3 text-[11px] font-semibold text-white shadow-xl"><span className="h-1.5 w-1.5 rounded-full bg-[#62d0c4]" />{notice}<button type="button" aria-label="dismiss notice" onClick={() => setNotice('')} className="ml-2 text-[#9ac1c2] hover:text-white"><X size={14} /></button></div>}
  </div>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch><Route path="/" component={AppShell} /><Route component={NotFound} /></Switch></ErrorBoundary>;
}

export default function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}