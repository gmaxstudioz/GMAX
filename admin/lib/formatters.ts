/**
 * Formats a number as a USD currency string.
 * @param price The number to format.
 * @returns Formatted currency string.
 */
export const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
};

/**
 * Checks whether a given booking date is more than 3 days in the past.
 * @param bookingDate The date of the booking.
 * @returns true if the date is over 3 days ago.
 */
export function isBookingOverdue(bookingDate: Date) {
    const now = new Date();
    const date = new Date(bookingDate);
    const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;
    return now.getTime() - date.getTime() > threeDaysInMs;
}
