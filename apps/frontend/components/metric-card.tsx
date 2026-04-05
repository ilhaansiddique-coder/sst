type MetricCardProps = {
  label: string;
  value: string;
  detail?: string;
};

export function MetricCard({ label, value, detail }: MetricCardProps) {
  return (
    <div className="panel rounded-[30px] p-6">
      <p className="text-sm uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-4 font-display text-4xl leading-none text-ink">{value}</p>
      {detail && <p className="mt-3 text-sm leading-7 text-slate-700">{detail}</p>}
    </div>
  );
}
