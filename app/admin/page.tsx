import Navbar from "@/components/Navbar";
import AdminPanel from "@/components/AdminPanel";

export default function AdminPage() {
  return (
    <main className="min-h-screen flex flex-col bg-slate-950">
      <Navbar />
      <AdminPanel />
    </main>
  );
}
