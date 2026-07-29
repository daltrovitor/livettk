import Navbar from "@/components/Navbar";
import Scoreboard from "@/components/Scoreboard";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col bg-slate-950">
      <Navbar />
      <Scoreboard />
    </main>
  );
}
