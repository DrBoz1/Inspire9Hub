import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen w-full">
      <div className="fixed right-5 top-5 z-50">
        <ThemeToggle />
      </div>
      {children}
    </div>
  );
}
