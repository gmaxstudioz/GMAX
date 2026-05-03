import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Store",
  description: "Explore merchandise, equipment, and resources available for purchase.",
};

export default function Page() {
  return (
    <div className="flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6 md:px-6">
      <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed rounded-lg bg-muted/10 h-64 mt-8">
        <h1 className="text-2xl font-bold text-muted-foreground mb-4 opacity-70">GMAX Store</h1>
        <p className="font-semibold text-xl">Coming Soon</p>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">
          We are currently setting up the store. Check back later to browse and purchase items!
        </p>
      </div>
    </div>
  )
}
