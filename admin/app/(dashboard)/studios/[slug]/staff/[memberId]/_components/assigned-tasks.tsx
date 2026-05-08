"use client";

import { useState, useEffect, useRef } from "react";
import { getMemberTasks } from "@/lib/actions/task";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { SearchIcon, Loader2, FilterIcon } from "lucide-react";
import { bookingProps } from "@/components/web/booking-status-variants";
import { isBookingOverdue } from "@/lib/formatters";


export function AssignedTasksList({ 
    initialTasks, 
    memberId, 
    slug 
}: { 
    initialTasks: any[]; 
    memberId: string; 
    slug: string;
}) {
    const [tasks, setTasks] = useState<any[]>(initialTasks);
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState("");
    
    // Filter State
    const [filters, setFilters] = useState({
        booking: "ALL",
        payment: "ALL",
        delivery: "ALL"
    });
    // Temporary state to hold choices inside dialog before applying
    const [draftFilters, setDraftFilters] = useState(filters);
    const [dialogOpen, setDialogOpen] = useState(false);

    const [hasMore, setHasMore] = useState(initialTasks.length === 12);
    const [loading, setLoading] = useState(false);
    
    const observerRef = useRef<IntersectionObserver | null>(null);
    const lastElementRef = useRef<HTMLDivElement>(null);

    // Initial search and filter loading effect
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            const fetchFilterOrSearch = async () => {
                setLoading(true);
                const filterJson = JSON.stringify(filters);
                const data = await getMemberTasks(memberId, 0, search, filterJson);
                setTasks(data);
                setPage(0);
                setHasMore(data.length === 12);
                setLoading(false);
            };
            fetchFilterOrSearch();
        }, 500); 
        
        return () => clearTimeout(timeoutId);
    }, [search, filters, memberId]);

    // Setup intersection observer for infinite scroll
    useEffect(() => {
        if (loading || !hasMore) return;
        
        const loadMore = async () => {
            setLoading(true);
            const nextPage = page + 1;
            const filterJson = JSON.stringify(filters);
            const moreTasks = await getMemberTasks(memberId, nextPage, search, filterJson);
            setTasks((prev) => {
                const existingIds = new Set(prev.map(t => t.id));
                const newTasks = moreTasks.filter(t => !existingIds.has(t.id));
                return [...prev, ...newTasks];
            });
            setPage(nextPage);
            setHasMore(moreTasks.length === 12);
            setLoading(false);
        };

        if (observerRef.current) observerRef.current.disconnect();
        
        observerRef.current = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !loading) {
                loadMore();
            }
        });

        if (lastElementRef.current) {
            observerRef.current.observe(lastElementRef.current);
        }

        return () => {
            if (observerRef.current) observerRef.current.disconnect();
        };
    }, [loading, hasMore, page, memberId, search, filters]);

    const handleApplyFilters = () => {
        setFilters(draftFilters);
        setDialogOpen(false);
    };

    const handleResetFilters = () => {
        const resetState = { booking: "ALL", payment: "ALL", delivery: "ALL" };
        setDraftFilters(resetState);
        setFilters(resetState);
        setDialogOpen(false);
    };

    const activeFilterCount = Object.values(filters).filter(v => v !== "ALL").length;

    return (
        <Card className="w-full">
            <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
                <CardTitle className="font-bold text-xl whitespace-nowrap">Assigned Tasks</CardTitle>
                <div className="flex flex-row items-center gap-2 w-full md:w-auto">
                    <div className="relative w-full md:w-[250px]">
                        <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            type="search" 
                            placeholder="Search client or service..." 
                            className="pl-8 !bg-card" 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <Dialog open={dialogOpen} onOpenChange={(open) => {
                        setDialogOpen(open);
                        // reset drafts to strict applied state when opening without saving
                        if (open) setDraftFilters(filters);
                    }}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="gap-2 relative">
                                <FilterIcon className="h-4 w-4" />
                                <span>Filter</span>
                                {activeFilterCount > 0 && (
                                    <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                                        {activeFilterCount}
                                    </span>
                                )}
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader className="flex flex-row items-center justify-between">
                                <div className="flex flex-col space-y-1.5">
                                    <DialogTitle>Filter Tasks</DialogTitle>
                                    <DialogDescription className="hidden">Filter tasks based on various statuses</DialogDescription>
                                </div>
                                <Button variant="ghost" size="sm" onClick={handleResetFilters} className="text-muted-foreground h-auto -mt-2">
                                    Reset filters
                                </Button>
                            </DialogHeader>
                            <div className="flex flex-col gap-6 py-4">
                                <div className="flex flex-col gap-3">
                                    <h4 className="text-sm font-medium leading-none">Booking Status</h4>
                                    <div className="w-full overflow-x-auto pb-1">
                                        <ToggleGroup type="single" value={draftFilters.booking} onValueChange={(v) => v && setDraftFilters(p => ({ ...p, booking: v }))} className="justify-start gap-0 border rounded-full bg-card overflow-hidden *:rounded-none *:border-r last:*:border-r-0">
                                            <ToggleGroupItem value="ALL" className="px-4 border-r">All</ToggleGroupItem>
                                            <ToggleGroupItem value="PENDING" className="px-4 border-r">Pending</ToggleGroupItem>
                                            <ToggleGroupItem value="COMPLETED" className="px-4 border-r">Completed</ToggleGroupItem>
                                            <ToggleGroupItem value="CANCELLED" className="px-4">Cancelled</ToggleGroupItem>
                                        </ToggleGroup>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <h4 className="text-sm font-medium leading-none">Payment Status</h4>
                                    <div className="w-full overflow-x-auto pb-1">
                                        <ToggleGroup type="single" value={draftFilters.payment} onValueChange={(v) => v && setDraftFilters(p => ({ ...p, payment: v }))} className="justify-start gap-0 border rounded-full bg-card overflow-hidden *:rounded-none *:border-r last:*:border-r-0">
                                            <ToggleGroupItem value="ALL" className="px-4 border-r">All</ToggleGroupItem>
                                            <ToggleGroupItem value="PENDING" className="px-4 border-r">Pending</ToggleGroupItem>
                                            <ToggleGroupItem value="PAID" className="px-4 border-r">Paid</ToggleGroupItem>
                                            <ToggleGroupItem value="PARTIALLY_PAID" className="px-4">Partially Paid</ToggleGroupItem>
                                        </ToggleGroup>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <h4 className="text-sm font-medium leading-none">Delivery Status</h4>
                                    <div className="w-full overflow-x-auto pb-1">
                                        <ToggleGroup type="single" value={draftFilters.delivery} onValueChange={(v) => v && setDraftFilters(p => ({ ...p, delivery: v }))} className="justify-start gap-0 border rounded-full bg-card overflow-hidden *:rounded-none *:border-r last:*:border-r-0">
                                            <ToggleGroupItem value="ALL" className="px-4 border-r">All</ToggleGroupItem>
                                            <ToggleGroupItem value="PENDING" className="px-4 border-r">Pending</ToggleGroupItem>
                                            <ToggleGroupItem value="DELIVERED" className="px-4">Delivered</ToggleGroupItem>
                                        </ToggleGroup>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col w-full">
                                <Button className="w-full font-semibold" onClick={handleApplyFilters}>Show Results</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardHeader>
            <CardContent className="pt-4">
                <ScrollArea className="h-[430px] rounded-md border-0 bg-transparent w-full">
                    {tasks.length === 0 && !loading ? (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            No tasks found
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-4">
                            {tasks.map((bookingItem) => {
                                const isOverdue = bookingItem.deliveryStatus === 'PENDING' && isBookingOverdue(bookingItem.bookingDate);
                                return (
                                    <Link 
                                        href={`/studios/${slug}/bookings/detail/${bookingItem.id}`} 
                                        key={bookingItem.id} 
                                        className={bookingProps({ status: bookingItem.bookingStatus.toLowerCase() as any, overdue: isOverdue })}
                                    >
                                        <div className="flex justify-between w-full items-center gap-2">
                                            <h1 className="font-semibold text-lg max-w-[65%] truncate">{bookingItem.service?.name || "Unknown"}</h1>
                                            <Badge variant="outline">{bookingItem.bookingStatus.toUpperCase()}</Badge>
                                        </div>
                                        <p className="text-xs opacity-80 mt-2 truncate">{bookingItem.client?.name || "Unknown"}</p>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                    {loading && (
                        <div className="flex justify-center p-4">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    )}
                    <div ref={lastElementRef} className="h-4 w-full opacity-0" />
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
