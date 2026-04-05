type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-teal">
        {eyebrow}
      </p>
      <h1 className="font-display text-4xl leading-[0.98] text-ink md:text-5xl">{title}</h1>
      <p className="max-w-3xl text-[1.02rem] leading-8 text-slate-700">{description}</p>
    </div>
  );
}
