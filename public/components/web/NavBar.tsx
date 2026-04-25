import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "../ui/button";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function NavBar() {
    return (
        <header className="flex justify-between items-center py-2 px-10">
            <div className="flex items-center">
                <Image
                    src="/gmax-logo.png"
                    alt="Gmax Logo"
                    width={40}
                    height={40}
                />
                <span className="text-xl font-bold text-black-400 font-heading">GMAX <br />Studioz</span>
            </div>
            <nav className="flex gap-10">
                <Link href="/" className={buttonVariants({variant: "link", size: "lg"})}>Home</Link>
                <Link href="/about" className={buttonVariants({variant: "link", size: "lg"})}>About</Link>
                <Link href="/services" className={buttonVariants({variant: "link", size: "lg"})}>Services</Link>
                <Link href="/contact" className={buttonVariants({variant: "link", size: "lg"})}>Contact</Link>
            </nav>
            <Link 
                href="/contact" 
                className={cn(
                    "inline-flex items-center gap-2",
                )}
            >
                <span className={buttonVariants({ variant: "default", size: "lg" })}>Book Us</span>
                <span className={buttonVariants({ variant: "default", size: "icon-lg" })}>
                    <ArrowUpRight size={20} />
                </span>
            </Link>
        </header>
    )
}