import type { Metadata } from "next";
import { AcademyStatsCards } from "./_components/StatsCards";

export const metadata: Metadata = {
  title: "Academy",
  description:
    "Explore courses, learning resources, and training programs to grow your studio skills.",
};


export default function Page() {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed rounded-lg bg-muted/10 h-64 mt-8">
      <h1 className="text-2xl font-bold text-muted-foreground mb-4 opacity-70">Academy Data Hub</h1>
      <p className="font-semibold text-xl">Coming Soon</p>
      <p className="text-sm text-muted-foreground mt-2 max-w-sm">
        We are building the Academy section for courses, resources, and training. Stay tuned!
      </p>
    </div>
  )
}
