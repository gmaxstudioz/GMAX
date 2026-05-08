import { cva } from "class-variance-authority";

export const bookingProps = cva(
    "border border-border rounded-lg p-4 transition-colors hover:bg-muted/50",
    {
        variants: {
            status: {
                pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/50",
                completed: "bg-green-500/10 text-green-500 border-green-500/50",
                cancelled: "bg-muted text-muted-foreground border-border grayscale",
            },
            overdue: {
                true: "bg-red-500/10 text-red-500 border-red-500/50",
                false: ""
            }
        }
    }
);
