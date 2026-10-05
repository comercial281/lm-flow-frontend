import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Numeros } from '@/types/admin/overview';
import { rotuloDoBalde } from './formatoNumeros';

// Leads e conversas por dia (ou por hora, em "Hoje"), somando os clientes da tela.
export default function GraficoDoPeriodo({ series, tipo }: { series: Numeros['series']; tipo: 'hour' | 'day' }) {
  const dados = series.map((s) => ({ ...s, rotulo: rotuloDoBalde(s.bucket, tipo) }));
  return (
    <div className="h-64 w-full rounded-lg border bg-card p-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dados} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="rotulo" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="leads" name="Leads" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="conversations" name="Conversas" stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
