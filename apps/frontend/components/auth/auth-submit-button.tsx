export function AuthSubmitButton({
  idleLabel,
}: Readonly<{
  idleLabel: string;
  pendingLabel: string;
}>) {
  return (
    <button type="submit" className="auth-button mt-2 w-full">
      {idleLabel}
    </button>
  );
}
