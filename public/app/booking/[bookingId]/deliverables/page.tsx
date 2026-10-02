"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { getClientPhotos, downloadPhoto, clientSubmitReview, clientUpdateDates } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, DownloadIcon, Image as ImageIcon, LockIcon, AlertCircle, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

export default function DeliverablesPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    
    const bookingId = params.bookingId as string;
    const initialCode = searchParams.get("code") || "";

    const [accessCode, setAccessCode] = useState(initialCode);
    const [isVerifying, setIsVerifying] = useState(false);
    const [data, setData] = useState<{ clientName: string; serviceName: string; bookingDate: string; deliveredAt: string | null; birthDate?: string | null; weddingDate?: string | null; totalPhotos: number; photos: Array<{ id: string; fileName: string; thumbnailUrl: string; approvalStatus: string; uploadedAt: string; downloadCount: number }> } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [reviewText, setReviewText] = useState("");
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);

    const [isDatesModalOpen, setIsDatesModalOpen] = useState(false);
    const [eventType, setEventType] = useState<"birthday" | "wedding">("birthday");
    const [eventDate, setEventDate] = useState("");
    const [isSubmittingDates, setIsSubmittingDates] = useState(false);

    // If code is in URL, verify automatically
    useEffect(() => {
        if (initialCode) {
            verifyCode(initialCode);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialCode]);

    async function verifyCode(codeToVerify: string) {
        if (!codeToVerify) {
            setError("Please enter your access code.");
            return;
        }
        
        setIsVerifying(true);
        setError(null);
        
        try {
            const res = await getClientPhotos({ bookingId, accessCode: codeToVerify });
            setData(res);
            
            // Update URL if it was submitted manually
            if (!initialCode) {
                router.replace(`/booking/${bookingId}/deliverables?code=${codeToVerify}`);
            }

            if (res.birthDate === null && res.weddingDate === null) {
                setTimeout(() => setIsDatesModalOpen(true), 1500);
            }
        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : "Invalid access code or booking not found.";
            setError(errorMessage);
            setData(null);
        } finally {
            setIsVerifying(false);
        }
    }

    async function handleReviewSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!reviewText.trim()) return;
        
        setIsSubmittingReview(true);
        try {
            await clientSubmitReview({ bookingId, accessCode, description: reviewText });
            toast.success("Review submitted successfully! Our team has been notified.");
            setIsReviewModalOpen(false);
            setReviewText("");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to submit review.");
        } finally {
            setIsSubmittingReview(false);
        }
    }

    async function handleDatesSubmit(e: React.FormEvent) {
        e.preventDefault();
        setIsSubmittingDates(true);
        try {
            await clientUpdateDates({ 
                bookingId, 
                accessCode, 
                eventType,
                eventDate: eventDate || undefined
            });
            toast.success("Dates saved successfully!");
            setIsDatesModalOpen(false);
            if (data) {
                setData({ 
                    ...data, 
                    birthDate: eventType === "birthday" && eventDate ? eventDate : data.birthDate, 
                    weddingDate: eventType === "wedding" && eventDate ? eventDate : data.weddingDate 
                });
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to save dates.");
        } finally {
            setIsSubmittingDates(false);
        }
    }

    async function handleDownload(photoId: string) {
        let toastId: string | number | undefined;
        try {
            toastId = toast.loading("Preparing download...");
            const res = await downloadPhoto({ bookingId, photoId, accessCode });
            
            // Create a temporary link to download the file
            const a = document.createElement('a');
            a.href = res.downloadUrl;
            a.download = res.fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            toast.success("Download started!", { id: toastId });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to download photo.";
            toast.error(errorMessage, { id: toastId });
        }
    }

    if (!data) {
        return (
            <div className="min-h-[80vh] flex items-center justify-center p-4">
                <Card className="w-full max-w-md shadow-xl border-zinc-200 dark:border-zinc-800">
                    <CardHeader className="text-center pb-2">
                        <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                            <LockIcon className="w-6 h-6 text-primary" />
                        </div>
                        <CardTitle className="text-2xl font-bold">Access Your Photos</CardTitle>
                        <CardDescription>
                            Enter the 6-character access code sent to your phone or email.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form 
                            onSubmit={(e) => { e.preventDefault(); verifyCode(accessCode); }}
                            className="flex flex-col gap-4 mt-4"
                        >
                            <Input
                                type="text"
                                placeholder="e.g. A1B2C3"
                                value={accessCode}
                                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                                maxLength={6}
                                className="text-center tracking-widest text-lg font-mono uppercase h-12"
                                required
                            />
                            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
                            <Button type="submit" size="lg" disabled={isVerifying || !accessCode}>
                                {isVerifying ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                                View Gallery
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold mb-1">Hi, {data.clientName}!</h1>
                        <p className="text-muted-foreground">
                            Here are your photos for the <span className="font-semibold text-foreground">{data.serviceName}</span> session on {new Date(data.bookingDate).toLocaleDateString()}.
                        </p>
                        <Button 
                            variant="link" 
                            className="p-0 h-auto text-primary mt-2"
                            onClick={() => setIsDatesModalOpen(true)}
                        >
                            Update Event Date
                        </Button>
                    </div>
                    <div className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full font-medium">
                        <ImageIcon className="w-4 h-4" />
                        {data.totalPhotos} Photos
                    </div>
                </div>

                {/* Expiration Warning */}
                {data.photos.length > 0 && (
                    <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        <div className="text-sm">
                            <strong>Notice:</strong> Your photos will be permanently deleted 5 days after delivery. Please download all your photos before they expire.
                        </div>
                    </div>
                )}

                {/* Gallery Grid */}
                {data.photos.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                        <ImageIcon className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
                        <h3 className="text-lg font-medium">No photos yet</h3>
                        <p className="text-muted-foreground">Your photos are still being processed.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {data.photos.map((photo: { id: string; fileName: string; thumbnailUrl: string }) => (
                            <div key={photo.id} className="group relative bg-white dark:bg-zinc-900 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all border border-zinc-200 dark:border-zinc-800 flex flex-col">
                                <div className="aspect-square relative overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                                    <Image
                                        src={photo.thumbnailUrl}
                                        alt={photo.fileName}
                                        fill
                                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                                        unoptimized // Since URLs are presigned S3 URLs
                                    />
                                    {/* Overlay for quick actions */}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Button 
                                            size="sm" 
                                            variant="secondary"
                                            className="rounded-full shadow-lg gap-2"
                                            onClick={() => handleDownload(photo.id)}
                                        >
                                            <DownloadIcon className="w-4 h-4" /> Download
                                        </Button>
                                    </div>
                                </div>
                                <div className="p-3 flex items-center justify-between">
                                    <p className="text-xs text-muted-foreground truncate flex-1 pr-2" title={photo.fileName}>
                                        {photo.fileName}
                                    </p>
                                    <Button 
                                        size="icon" 
                                        variant="ghost" 
                                        className="h-8 w-8 text-muted-foreground hover:text-foreground md:hidden"
                                        onClick={() => handleDownload(photo.id)}
                                    >
                                        <DownloadIcon className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Delivery Errors Warning */}
                {data.photos.length > 0 && (
                    <div className="mt-12 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/50 rounded-2xl p-6">
                        <h4 className="font-semibold text-orange-800 dark:text-orange-300 flex items-center gap-2 mb-2">
                            <AlertCircle className="w-5 h-5" /> Any Correction?
                        </h4>
                        <p className="text-orange-700 dark:text-orange-400 text-sm">
                            Promptly notify us of any corrections needed on delivered images within 12 hours timeframe after delivery, so we can address and rectify them promptly.
                        </p>
                        {(() => {
                            const deliveredAt = data.deliveredAt ? new Date(data.deliveredAt) : new Date(data.photos[0]?.uploadedAt || Date.now());
                            const hoursSinceDelivery = (Date.now() - deliveredAt.getTime()) / (1000 * 60 * 60);
                            const canReportIssue = hoursSinceDelivery <= 24;
                            
                            return (
                                <Button 
                                    variant="outline" 
                                    className="mt-4 border-orange-200 hover:bg-orange-100 text-orange-800 dark:border-orange-800 dark:hover:bg-orange-900 dark:text-orange-300"
                                    onClick={() => setIsReviewModalOpen(true)}
                                    disabled={!canReportIssue}
                                    title={!canReportIssue ? "The 24-hour reporting window has expired." : ""}
                                >
                                    Report an Issue
                                </Button>
                            );
                        })()}
                    </div>
                )}
            </div>

            {/* Floating WhatsApp Button */}
            <a 
                href="https://wa.me/2349122223353" 
                target="_blank" 
                rel="noopener noreferrer"
                className="fixed bottom-6 right-6 bg-[#25D366] text-white p-4 rounded-full shadow-lg hover:scale-105 transition-transform z-40 flex items-center justify-center group"
            >
                <MessageCircle className="w-6 h-6" />
                <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-[120px] group-hover:ml-2 transition-all duration-300 font-medium text-sm">
                    Chat with us
                </span>
            </a>

            {/* Review Modal */}
            {isReviewModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <Card className="w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200 border-0">
                        <CardHeader>
                            <CardTitle>Request a Revision</CardTitle>
                            <CardDescription>Describe the errors or changes you need in the delivered photos.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleReviewSubmit} className="space-y-4">
                                <Textarea 
                                    placeholder="E.g., Please fix the lighting on photo IMG_001..." 
                                    value={reviewText}
                                    onChange={(e) => setReviewText(e.target.value)}
                                    className="min-h-[120px] resize-none"
                                    required
                                />
                                <div className="flex justify-end gap-2">
                                    <Button type="button" variant="ghost" onClick={() => setIsReviewModalOpen(false)}>Cancel</Button>
                                    <Button type="submit" disabled={isSubmittingReview || !reviewText.trim()}>
                                        {isSubmittingReview ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                        Submit Request
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Dates Collection Modal */}
            {isDatesModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <Card className="w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200 border-0">
                        <CardHeader>
                            <CardTitle>Let&apos;s Celebrate You!</CardTitle>
                            <CardDescription>Add your special dates so we can celebrate with you and send you special offers.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleDatesSubmit} className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium mb-3 block">What are we celebrating?</label>
                                    <div className="flex items-center gap-4 mb-4">
                                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                                            <input 
                                                type="radio" 
                                                name="eventType" 
                                                value="birthday"
                                                checked={eventType === "birthday"}
                                                onChange={() => setEventType("birthday")}
                                                className="w-4 h-4 text-primary"
                                            />
                                            Birthday
                                        </label>
                                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                                            <input 
                                                type="radio" 
                                                name="eventType" 
                                                value="wedding"
                                                checked={eventType === "wedding"}
                                                onChange={() => setEventType("wedding")}
                                                className="w-4 h-4 text-primary"
                                            />
                                            Wedding / Anniversary
                                        </label>
                                    </div>
                                    <label className="text-sm font-medium mb-1 block">Date</label>
                                    <Input 
                                        type="date" 
                                        value={eventDate}
                                        onChange={(e) => setEventDate(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                    <Button type="button" variant="ghost" onClick={() => setIsDatesModalOpen(false)}>Skip for now</Button>
                                    <Button type="submit" disabled={isSubmittingDates}>
                                        {isSubmittingDates ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                        Save Dates
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
