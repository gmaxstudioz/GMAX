import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";

export default function Home() {
  return (
    <main>
        <section>
            <div className="w-[50%]">
                <h1 className="">We bring your imagination to life</h1>
                <p className="">Let's create something magical together.</p>
                <div className="flex flex-wrap items-center gap-2 md:flex-row">
                    <Button variant="default" size="lg">Book Us</Button>
                    <Button variant="default" size="icon-lg" aria-label="Submit">
                        <ArrowUpRight size={24} />
                    </Button>
                </div>
            </div>
            <div></div>
        </section>
    </main>
  );
}
