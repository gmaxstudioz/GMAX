import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { products } from "@/lib/shop-data";
import { ArrowLeft, CheckCircle2, ShoppingCart, ShoppingBag } from "lucide-react";
import Magnetic from "@/components/ui/magnetic";
import { buttonVariants } from "@/components/ui/button";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = products.find((p) => p.id === id);

  if (!product) {
    notFound();
  }

  const recommendations = products.filter((p) => p.id !== id).slice(0, 3);

  return (
    <main className="min-h-screen pt-32 pb-24 px-4 sm:px-6 max-w-7xl mx-auto">
      <Link href="/shop" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-10 group">
        <ArrowLeft size={20} className="transform group-hover:-translate-x-1 transition-transform" /> Back to Shop
      </Link>

      <div className="flex flex-col md:flex-row gap-12 lg:gap-20 items-center">
        {/* Left: Image */}
        <div className="w-full md:w-1/2 relative aspect-[4/5] rounded-[2rem] overflow-hidden bg-[#1f1f1f] shadow-2xl">
          <Image
            src={product.src}
            alt={product.title}
            fill
            className="object-cover"
            priority
          />
        </div>

        {/* Right: Details */}
        <div className="w-full md:w-1/2 flex flex-col justify-center">
          <div className="inline-block bg-primary/10 border border-primary/20 px-4 py-2 rounded-full text-xs font-bold text-primary uppercase tracking-widest mb-8 w-max">
            {product.category}
          </div>
          
          <h1 className="text-4xl md:text-6xl font-heading font-extrabold mb-6 leading-tight">{product.title}</h1>
          <p className="text-3xl text-gray-300 font-medium mb-10">{product.price}</p>
          
          <p className="text-gray-400 text-lg md:text-xl leading-relaxed mb-12">
            {product.desc}
          </p>

          <div className="mb-12 bg-white/5 p-8 rounded-3xl border border-white/10">
            <h3 className="text-xl font-heading font-semibold mb-6 text-white tracking-wide">What's Included:</h3>
            <ul className="flex flex-col gap-4">
              {product.features.map((feature, i) => (
                <li key={i} className="flex items-center gap-4 text-gray-300 font-medium">
                  <CheckCircle2 size={24} className="text-primary flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-4">
            <Magnetic>
              <button className={buttonVariants({ variant: "default", size: "lg", className: "w-full md:w-auto px-12 h-16 text-xl rounded-full" })}>
                <ShoppingCart size={22} className="mr-3" /> Add to Cart
              </button>
            </Magnetic>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="mt-32 pt-16 border-t border-white/10">
          <div className="flex items-center gap-2 mb-10">
            <div className="w-2 h-2 rounded-full bg-primary"></div>
            <h2 className="text-3xl font-heading font-bold">You might also like</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {recommendations.map((prod) => (
              <Link href={`/shop/${prod.id}`} key={prod.id} className="group flex flex-col gap-4 cursor-pointer">
                <div className="relative aspect-[4/5] w-full rounded-[2rem] overflow-hidden bg-[#1f1f1f]">
                  <Image
                    src={prod.src}
                    alt={prod.title}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute top-5 left-5 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-bold text-white uppercase tracking-wider">
                    {prod.category}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
                    <Magnetic>
                      <span className="flex items-center gap-3 bg-white text-black px-6 py-3 rounded-full font-semibold hover:bg-gray-200 transition-colors shadow-2xl">
                        <ShoppingBag size={18} /> View Details
                      </span>
                    </Magnetic>
                  </div>
                </div>
                <div className="flex flex-col gap-1 px-2 mt-2">
                  <h3 className="text-xl font-heading font-semibold text-white group-hover:text-primary transition-colors">
                    {prod.title}
                  </h3>
                  <p className="text-gray-400 font-medium">{prod.price}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
