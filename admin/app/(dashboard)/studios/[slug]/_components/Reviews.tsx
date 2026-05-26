import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface BookingData {
    id: string;
    client: { name: string };
    service: { name: string };
    revisionRequests?: {
        id: string;
        description: string;
        status: string;
        createdAt: string | Date;
        bookingId: string;
    }[];
}

interface ReviewData {
    id: string;
    description: string;
    status: string;
    createdAt: string | Date;
    bookingId: string;
    booking: BookingData;
}

type StudioWithRelations = {
    slug: string;
    bookings: BookingData[];
};

export function Reviews({ studioData }: { studioData: StudioWithRelations }) {
    const [filterStatus, setFilterStatus] = useState<string>("ALL");

    // Flatten all revision requests from bookings
    const allReviews: ReviewData[] = studioData.bookings.flatMap((booking: BookingData) => 
        (booking.revisionRequests || []).map((request) => ({
            ...request,
            booking
        }))
    ).sort((a: ReviewData, b: ReviewData) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const filteredReviews = allReviews.filter((review: ReviewData) => {
        if (filterStatus === "ALL") return true;
        return review.status === filterStatus;
    });

    const statusColors: Record<string, string> = {
        PENDING: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900 dark:text-orange-300 dark:border-orange-800",
        IN_PROGRESS: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-800",
        COMPLETED: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-300 dark:border-green-800",
        REJECTED: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-300 dark:border-red-800"
    };

    if (allReviews.length === 0) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                    <MessageCircle className="w-12 h-12 mb-4 opacity-30" />
                    <h3 className="text-lg font-semibold text-foreground">No Reviews or Revision Requests</h3>
                    <p className="text-sm">When clients request revisions on their photos, they will appear here.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 pb-4">
                <div>
                    <CardTitle className="text-lg">Client Reviews & Revision Requests</CardTitle>
                    <CardDescription>Manage feedback and photo revision requests from clients.</CardDescription>
                </div>
                <div className="flex gap-2">
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Filter Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Statuses</SelectItem>
                            <SelectItem value="PENDING">Pending</SelectItem>
                            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                            <SelectItem value="COMPLETED">Completed</SelectItem>
                            <SelectItem value="REJECTED">Rejected</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {filteredReviews.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                            <p>No requests found matching the selected status.</p>
                        </div>
                    ) : (
                        filteredReviews.map((review: ReviewData) => (
                            <div key={review.id} className="p-4 border rounded-lg bg-card hover:bg-muted/30 transition-colors">
                                <div className="flex justify-between items-start gap-4">
                                    <div className="flex gap-4">
                                        <Avatar className="h-10 w-10 shrink-0">
                                            <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                                {review.booking.client.name.charAt(0)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <h4 className="font-semibold">{review.booking.client.name}</h4>
                                            <p className="text-sm text-muted-foreground mb-2">
                                                {review.booking.service.name} • {format(new Date(review.createdAt), "MMM d, yyyy h:mm a")}
                                            </p>
                                            <p className="text-sm mt-2 whitespace-pre-wrap">{review.description}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2 shrink-0">
                                        <Badge variant="outline" className={statusColors[review.status] || ""}>
                                            {review.status}
                                        </Badge>
                                        <Link href={`/studios/${studioData.slug}/bookings/detail/${review.bookingId}`} passHref>
                                            <Button variant="ghost" size="sm" className="h-8 text-xs px-2 gap-1 mt-2 text-muted-foreground hover:text-foreground">
                                                <ExternalLink className="w-3 h-3" />
                                                View Booking
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
