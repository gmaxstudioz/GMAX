import type { Metadata } from "next";
import { AcceptInvitationCard } from "./_components/accept-invitation-card";

export const metadata: Metadata = {
  title: "Accept Invitation",
  description: "Accept your studio invitation to get started.",
};

export default async function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  return <AcceptInvitationCard invitationId={resolvedParams.id} />;
}
