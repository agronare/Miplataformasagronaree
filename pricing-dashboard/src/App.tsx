import { useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Search, Package, TrendingDown, DollarSign, Filter, LayoutGrid, List, Sparkles } from 'lucide-react';
import AIInsightWidget from './components/AIInsightWidget';

// Tipos compartidos
type SummaryItem = {
  categoria: string;
  linea: string;
  num_prod: number;
  prom_menudeo: number;
  prom_may3: number;
  desc_max: number;
  min_cant_may3?: number | null;
};

type Product = {
  id: string;
  cat: string;
  lin: string;
  nombre: string;
  menudeo: number;
  may1: number;
  c1?: number | null;
  may2: number;
  c2?: number | null;
  may3: number;
  c3?: number | null;
};

// Datos de ejemplo reducidos para mantener el archivo pequeño y estable
const SUMMARY_DATA: SummaryItem[] = [
  { categoria: 'Fertilizantes', linea: 'Granulado', num_prod: 24, prom_menudeo: 420, prom_may3: 360, desc_max: 14.3, min_cant_may3: 12 },
  { categoria: 'Herbicidas', linea: 'Post-emergencia', num_prod: 18, prom_menudeo: 820, prom_may3: 700, desc_max: 17.1, min_cant_may3: 6 },
  { categoria: 'Insecticidas', linea: 'Sistémico', num_prod: 30, prom_menudeo: 515, prom_may3: 430, desc_max: 16.5, min_cant_may3: 8 },
];

const PRODUCTS_DATA: Product[] = [
  { id: 'prod-001', cat: 'Fertilizantes', lin: 'Granulado', nombre: 'Fert. Multi 25kg', menudeo: 750, may1: 700, c1: 2, may2: 680, c2: 6, may3: 650, c3: 12 },
  { id: 'prod-002', cat: 'Herbicidas', lin: 'Post-emergencia', nombre: 'Herbi Max 1L', menudeo: 820, may1: 770, c1: 3, may2: 740, c2: 6, may3: 680, c3: 6 },
  { id: 'prod-003', cat: 'Insecticidas', lin: 'Sistémico', nombre: 'Insecta Pro 1L', menudeo: 520, may1: 490, c1: 2, may2: 470, c2: 4, may3: 430, c3: 8 },
];

// Nota: el proxy para Gemini se encuentra en el servidor (ruta /api/gemini). Los componentes usan ese proxy.

// Modal interno simple (evita dependencia temporal en el componente separado)
const SimpleSalesPitchModal = ({ product, onClose }: { product: Product; onClose: () => void }) => {
  const [pitch, setPitch] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useState(() => {
    let mounted = true;
    (async () => {
      try {
        const minPurchaseLabel = product.c3 ? `${product.c3} unidades` : 'sin mínimo';
        const discountPercent = (100 - (product.may3 / product.menudeo) * 100).toFixed(1);
        const prompt = `Actúa como un experto vendedor: escribe un pitch (máx 40 palabras) para ${product.nombre}. Precio: ${product.menudeo}. Mayoreo: ${product.may3} (${minPurchaseLabel}). Ahorro: ${discountPercent}%`;
        const resp = await fetch('/api/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
        const data = await resp.json().catch(() => ({}));
        if (mounted) setPitch(data?.text || 'No response');
      } catch (err) {
        console.error(err);
        if (mounted) setPitch('No se pudo generar el argumento.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  });

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 flex justify-between items-center text-white">
          <div className="flex items-center gap-2">
            <span className="font-bold">Asistente de Ventas AI</span>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full transition-colors">Cerrar</button>
        </div>
        <div className="p-6">
          <div className="mb-4">
            <p className="font-bold text-slate-800">{product.nombre}</p>
          </div>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <div className="h-8 w-8 border-4 border-blue-200 rounded-full animate-spin" />
              <p className="text-sm text-slate-500 animate-pulse">Redactando el mejor argumento...</p>
            </div>
          ) : (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <p className="text-slate-700 text-lg font-medium leading-relaxed">"{pitch}"</p>
            </div>
          )}
          <div className="mt-6 flex justify-end">
            <button onClick={onClose} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium text-sm transition-colors">Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
};

 

type DashboardTab = 'dashboard' | 'catalog';

const PricingDashboard = () => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [selectedLine, setSelectedLine] = useState('Todas');
  const [selectedProductForPitch, setSelectedProductForPitch] = useState<Product | null>(null);

  // Helpers
  const formatCurrency = (value: number = 0) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
  const getCategories = () => ['Todas', ...Array.from(new Set(PRODUCTS_DATA.map(p => p.cat)))];
  const getLines = () => ['Todas', ...Array.from(new Set(PRODUCTS_DATA.map(p => p.lin)))];

  // Filtro de productos
  const filteredProducts = PRODUCTS_DATA.filter(product => {
    const matchesSearch = product.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          product.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Todas' || product.cat === selectedCategory;
    const matchesLine = selectedLine === 'Todas' || product.lin === selectedLine;
    return matchesSearch && matchesCategory && matchesLine;
  });

  // KPI calculations
  const avgDiscount = SUMMARY_DATA.reduce((acc, curr) => acc + curr.desc_max, 0) / SUMMARY_DATA.length;
  const maxMarginCategory = SUMMARY_DATA.reduce((prev, current) => (prev.desc_max > current.desc_max) ? prev : current);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 relative">
      
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-2 rounded-lg">
                <LayoutGrid className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Estrategia de Precios</h1>
                <p className="text-xs text-slate-500">Powered by Gemini AI ✨</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                Dashboard Estratégico
              </button>
              <button
                onClick={() => setActiveTab('catalog')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'catalog' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                Catálogo Detallado
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            
            {/* AI Insight Widget */}
            <AIInsightWidget summaryData={SUMMARY_DATA} />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
                    <Package className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 font-medium">Líneas Analizadas</p>
                    <h3 className="text-2xl font-bold">{SUMMARY_DATA.length}</h3>
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-100 text-green-600 rounded-full">
                    <TrendingDown className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 font-medium">Promedio Descuento Máx</p>
                    <h3 className="text-2xl font-bold">{avgDiscount.toFixed(2)}%</h3>
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-100 text-purple-600 rounded-full">
                    <DollarSign className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 font-medium">Mejor Margen (Cat)</p>
                    <h3 className="text-xl font-bold truncate">{maxMarginCategory.linea}</h3>
                    <p className="text-xs text-slate-400">{maxMarginCategory.categoria}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold mb-4 text-slate-800">Descuento Promedio por Línea (%)</h3>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
                    <BarChart data={SUMMARY_DATA.slice(0, 10)} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                      <XAxis type="number" domain={[0, 25]} hide />
                      <YAxis dataKey="linea" type="category" width={100} tick={{fontSize: 10}} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        cursor={{fill: '#f1f5f9'}}
                      />
                      <Bar dataKey="desc_max" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Desc. Máximo %">
                        {SUMMARY_DATA.slice(0, 10).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.desc_max > 15 ? '#22c55e' : '#3b82f6'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-slate-400 mt-2 text-center">*Top 10 categorías mostradas. Verde indica descuento superior al 15%.</p>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold mb-4 text-slate-800">Dispersión de Precios (Menudeo vs Mayoreo 3)</h3>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
                    <LineChart data={SUMMARY_DATA.slice(0, 15)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="linea" tick={false} />
                      <YAxis />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Legend />
                      <Line type="monotone" dataKey="prom_menudeo" stroke="#3b82f6" name="Prom. Menudeo" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="prom_may3" stroke="#22c55e" name="Prom. Mayoreo 3" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-slate-400 mt-2 text-center">Comparativa de brecha entre precio de lista y mejor precio mayorista.</p>
              </div>
            </div>

            {/* Strategic Table Summary */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-slate-800">Resumen Estratégico Detallado</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                    <tr>
                      <th className="px-6 py-3">Categoría</th>
                      <th className="px-6 py-3">Línea</th>
                      <th className="px-6 py-3 text-right">Precio Menudeo Prom.</th>
                      <th className="px-6 py-3 text-center">Desc. Max %</th>
                      <th className="px-6 py-3 text-center">Vol. Min (May 3)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {SUMMARY_DATA.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-medium text-slate-900">{item.categoria}</td>
                        <td className="px-6 py-4 text-slate-600">{item.linea}</td>
                        <td className="px-6 py-4 text-right font-mono">{formatCurrency(item.prom_menudeo)}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${item.desc_max > 15 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {item.desc_max.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center text-slate-500">{item.min_cant_may3 || '-'} u.</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'catalog' && (
          <div className="space-y-6">
            {/* Filters Header */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between sticky top-20 z-40">
              <div className="relative w-full md:w-96">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Buscar producto o clave..."
                  className="pl-10 block w-full rounded-lg border-slate-200 bg-slate-50 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                <div className="relative">
                  <select 
                    className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 py-2 px-4 pr-8 rounded-lg leading-tight focus:outline-none focus:bg-white focus:border-blue-500 text-sm"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    {getCategories().map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700">
                    <Filter className="h-4 w-4" />
                  </div>
                </div>

                <div className="relative">
                  <select 
                    className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 py-2 px-4 pr-8 rounded-lg leading-tight focus:outline-none focus:bg-white focus:border-blue-500 text-sm"
                    value={selectedLine}
                    onChange={(e) => setSelectedLine(e.target.value)}
                  >
                    {getLines().map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700">
                    <List className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-1 gap-4">
              {filteredProducts.map((product) => (
                <div key={product.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-shadow group relative">
                  <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    
                    {/* Header Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 tracking-wide uppercase">{product.cat}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-600 tracking-wide uppercase">{product.lin}</span>
                      </div>
                      <h4 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{product.nombre}</h4>
                      <div className="flex items-center gap-3 mt-1">
                         <p className="text-xs text-slate-400 font-mono">ID: {product.id}</p>
                         
                         {/* AI PITCH BUTTON */}
                         <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProductForPitch(product);
                            }}
                            className="hidden md:flex items-center gap-1 text-[10px] font-bold bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-2 py-1 rounded-full shadow-sm hover:shadow-md hover:scale-105 transition-all"
                            title="Generar argumento de venta con IA"
                         >
                           <Sparkles className="w-3 h-3" />
                           Argumento de Venta
                         </button>
                      </div>
                    </div>

                    {/* Pricing Tiers Visualization */}
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
                      {/* Menudeo */}
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col items-center justify-center">
                        <span className="text-xs text-slate-500 font-medium mb-1">Menudeo</span>
                        <span className="text-lg font-bold text-slate-800">{formatCurrency(product.menudeo)}</span>
                        <span className="text-[10px] text-slate-400">1 unidad</span>
                      </div>

                      {/* Mayoreo 1 */}
                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex flex-col items-center justify-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 bg-blue-200 px-1.5 py-0.5 rounded-bl-md text-[9px] font-bold text-blue-800">
                          -{(100 - (product.may1/product.menudeo)*100).toFixed(1)}%
                        </div>
                        <span className="text-xs text-blue-600 font-medium mb-1">Mayoreo 1</span>
                        <span className="text-lg font-bold text-blue-700">{formatCurrency(product.may1)}</span>
                        <span className="text-[10px] text-blue-500">Min: {product.c1 || '-'} u.</span>
                      </div>

                      {/* Mayoreo 2 */}
                      <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 flex flex-col items-center justify-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 bg-indigo-200 px-1.5 py-0.5 rounded-bl-md text-[9px] font-bold text-indigo-800">
                          -{(100 - (product.may2/product.menudeo)*100).toFixed(1)}%
                        </div>
                        <span className="text-xs text-indigo-600 font-medium mb-1">Mayoreo 2</span>
                        <span className="text-lg font-bold text-indigo-700">{formatCurrency(product.may2)}</span>
                        <span className="text-[10px] text-indigo-500">Min: {product.c2 || '-'} u.</span>
                      </div>

                       {/* Mayoreo 3 (Best Price) */}
                       <div className="bg-green-50 p-3 rounded-lg border border-green-100 flex flex-col items-center justify-center relative overflow-hidden ring-1 ring-green-200">
                        <div className="absolute top-0 right-0 bg-green-200 px-1.5 py-0.5 rounded-bl-md text-[9px] font-bold text-green-800">
                          -{(100 - (product.may3/product.menudeo)*100).toFixed(1)}%
                        </div>
                        <span className="text-xs text-green-600 font-medium mb-1">Mayoreo 3</span>
                        <span className="text-lg font-bold text-green-700">{formatCurrency(product.may3)}</span>
                        <span className="text-[10px] text-green-600 font-bold">Min: {product.c3 || '-'} u.</span>
                      </div>
                    </div>
                  </div>

                  {/* Mobile AI Button */}
                  <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProductForPitch(product);
                      }}
                      className="md:hidden w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white py-2 text-xs font-bold uppercase tracking-wider"
                    >
                    <Sparkles className="w-3 h-3" />
                    Generar Argumento de Venta
                  </button>
                </div>
              ))}
              
              {filteredProducts.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-slate-400">No se encontraron productos con esos filtros.</p>
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* AI Modal */}
      {selectedProductForPitch && (
        <SimpleSalesPitchModal
          product={selectedProductForPitch}
          onClose={() => setSelectedProductForPitch(null)}
        />
      )}

    </div>
  );
};

export default PricingDashboard;