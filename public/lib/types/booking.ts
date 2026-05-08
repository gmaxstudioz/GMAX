export interface PublicBookingOutput {
    bookingId: string;
    paymentUrl: string | null;
    reference: string;
    amount: number;
    warning?: string;
}

export type CheckClientOutput =
    | { exists: false }
    | {
          exists: true;
          client: {
              id: string;
              name: string;
              maskedPhone: string | null;
          };
      };