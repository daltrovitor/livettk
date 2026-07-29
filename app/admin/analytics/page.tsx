import Navbar from "@/components/Navbar";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";

export default function AnalyticsPage() {
  return (
    <main className="min-h-screen flex flex-col bg-slate-950">
      <Navbar />
      <AnalyticsDashboard />
    </main>
  );
}
