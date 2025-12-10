import { useEffect, useState } from 'react';
import { MessageSquare, X, Loader2 } from 'lucide-react';

type Product = {
  id: string;
  cat: string;
  lin: string;
  nombre: string;
  menudeo: number;
  may1: number;
  c1: number | null;
  may2: number;
  c2: number | null;
  may3: number;
  c3: number | null;
};

async function callGeminiProxy(prompt: string): Promise<string> {
  const resp = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body?.error || 'Proxy request failed');
  }
  const data = await resp.json();
  return data.text || 'No response';
}

type Props = {
  product: Product;
  onClose: () => void;
};

  
export default function SalesPitchModal({ product, onClose }: Props) {
  const [pitch, setPitch] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;

    const gen = async () => {
      setLoading(true);
      const minPurchaseLabel = product.c3 ? `${product.c3} unidades` : 'sin mínimo';
      const discountPercent = (100 - (product.may3 / product.menudeo) * 100).toFixed(1);
      const prompt = `Actúa como un experto vendedor: escribe un pitch (máx 40 palabras) para ${product.nombre}. Precio: ${product.menudeo}. Mayoreo: ${product.may3} (${minPurchaseLabel}). Ahorro: ${discountPercent}%`;
      try {
        const text = await callGeminiProxy(prompt);
        if (mounted) setPitch(text);
      } catch (err) {
        console.error(err);
        if (mounted) setPitch('No se pudo generar el argumento.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    gen();

    return () => {
      mounted = false;
    };
  }, [product]);

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 flex justify-between items-center text-white">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            <h3 className="font-bold">Asistente de Ventas AI</h3>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4">
            <h4 className="text-sm text-slate-500 uppercase tracking-wider font-bold text-xs mb-1">Producto</h4>
            <p className="font-bold text-slate-800">{product.nombre}</p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
              <p className="text-sm text-slate-500 animate-pulse">Redactando el mejor argumento...</p>
            </div>
          ) : (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <p className="text-slate-700 text-lg font-medium leading-relaxed">"{pitch}"</p>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button onClick={onClose} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium text-sm transition-colors">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
