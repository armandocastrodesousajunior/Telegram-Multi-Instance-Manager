import { Sidebar } from "@/components/Sidebar";

export default function InstanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="page-container">
      <Sidebar />
      {children}
    </div>
  );
}
