"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { verifyAccessToken, requestDownload } from "@/lib/api";
import type { VerifyAccessTokenOutput } from "@/lib/types/product";
import { Loader2, Download, PackageOpen, ArrowLeft, Clock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function TokenAccessPage() {
  const { token } = useParams<{ token: string }>();

  const [data, setData] = useState<VerifyAccessTokenOutput | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    async function verify() {
      try {
        setLoading(true);
        const res = await verifyAccessToken(token);
        setData(res);
        setSessionToken(res.sessionToken);
      } catch (err: any) {
        // Distinguish between server errors and actual invalid tokens
        const message = err?.message || "";
        if (message.includes("500") || message.includes("fetch") || message.includes("network") || message.includes("EAI_AGAIN")) {
          setError("Could not reach the server. Please check your connection and try again.");
        } else {
          setError(message || "Invalid or expired access link.");
        }
      } finally {
        setLoading(false);
      }
    }
    if (token) verify();
  }, [token]);

  const handleDownload = async (productId: string) => {
    if (!sessionToken) {
      toast.error("Session expired. Please request a new access link.");
      return;
    }
    try {
      setDownloadingId(productId);
      const res = await requestDownload({ productId, token: sessionToken });
      
      // Open download in new tab / trigger download
      const link = document.createElement("a");
      link.href = res.downloadUrl;
      link.download = res.fileName || "download";
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Download started!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to download file");
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground text-sm">Verifying your access...</p>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-2">
          <ShieldCheck className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-gray-400 text-lg max-w-md text-center">{error || "Invalid link"}</p>
        <Link
          href="/shop/access"
          className="mt-4 px-6 py-2 bg-primary text-primary-foreground font-semibold rounded-full hover:bg-primary/90 transition-colors"
        >
          Request New Link
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen pt-32 pb-24 px-4 sm:px-6 max-w-5xl mx-auto">
      <Link
        href="/shop"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-10 group"
      >
        <ArrowLeft size={20} className="transform group-hover:-translate-x-1 transition-transform" />
        Back to Shop
      </Link>

      <div className="mb-12">
        <h1 className="text-4xl md:text-5xl font-heading font-bold mb-4">Your Library</h1>
        <p className="text-gray-400 text-lg">
          Access and download your purchased digital products below.
        </p>
      </div>

      {data.purchases.length === 0 ? (
        <div className="bg-[#1f1f1f] rounded-[2rem] p-12 text-center flex flex-col items-center border border-white/5">
          <PackageOpen className="w-16 h-16 text-gray-500 mb-4" />
          <h2 className="text-2xl font-bold mb-2">No purchases found</h2>
          <p className="text-gray-400 mb-6">You haven&apos;t purchased any digital products yet.</p>
          <Link
            href="/shop"
            className="px-6 py-2 bg-primary text-primary-foreground font-semibold rounded-full hover:bg-primary/90 transition-colors"
          >
            Browse Shop
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data.purchases.map((purchase) => {
            const isExpired = !!purchase.expiresAt && new Date(purchase.expiresAt).getTime() < Date.now();
            return (
              <div key={purchase.productId} className="bg-[#1f1f1f] rounded-[2rem] p-6 border border-white/5 flex flex-col gap-6 shadow-xl">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <PackageOpen className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold line-clamp-2">{purchase.productTitle}</h3>
                      <p className="text-sm text-gray-400 mt-1 flex items-center gap-1.5">
                        <Clock size={14} />
                        Purchased on {new Date(purchase.grantedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/10">
                  <div className="text-sm text-gray-400">
                    {purchase.downloadCount} download{purchase.downloadCount !== 1 ? "s" : ""}
                  </div>
                  <Button
                    onClick={() => handleDownload(purchase.productId)}
                    disabled={downloadingId === purchase.productId || isExpired}
                    className="rounded-full px-6 flex items-center gap-2"
                  >
                    {downloadingId === purchase.productId ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    {isExpired ? "Expired" : "Download"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
