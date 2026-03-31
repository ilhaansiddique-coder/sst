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
      <h1 className="text-3xl font-semibold text-ink md:text-4xl">{title}</h1>
      <p className="max-w-3xl text-base text-slate-600">{description}</p>
    </div>
  );
}
