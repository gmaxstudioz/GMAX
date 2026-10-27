"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  UsersIcon,
  HourglassIcon,
  UserCheckIcon,
  MailIcon,
  SearchIcon,
  UserPlusIcon,
  Building2Icon,
  ShieldCheckIcon,
  MoreHorizontalIcon,
  Trash2Icon,
  Loader2Icon,
  PhoneIcon,
  CalendarIcon,
  CheckCircle2Icon,
  SendIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { UserForManagement, ManagedStudio, PendingInvitation } from "@/lib/actions/user";
import { assignUserToStudio, removeUserMembership } from "@/lib/actions/user";
import { inviteMember, cancelInvitation } from "@/lib/actions/invitation";
import type { MemberRole } from "@/lib/schemas/studio";

interface UserManagementViewProps {
  initialUsers: UserForManagement[];
  managedStudios: ManagedStudio[];
  initialPendingInvitations: PendingInvitation[];
  isPlatformAdmin?: boolean;
}

export function UserManagementView({
  initialUsers,
  managedStudios,
  initialPendingInvitations,
  isPlatformAdmin = false,
}: UserManagementViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"ALL" | "WAITING" | "MEMBERS" | "INVITATIONS">("ALL");
  const [selectedStudioFilter, setSelectedStudioFilter] = useState<string>("ALL");

  // Assign Dialog State
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [userToAssign, setUserToAssign] = useState<UserForManagement | null>(null);
  const [targetStudioId, setTargetStudioId] = useState<string>(managedStudios[0]?.id || "");
  const [targetRole, setTargetRole] = useState<MemberRole>("photographer");
  const [assignMode, setAssignMode] = useState<"DIRECT" | "INVITE">("DIRECT");

  // Remove Member Dialog State
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<{
    memberId: string;
    studioId: string;
    userName: string;
    studioName: string;
  } | null>(null);

  // Quick stats
  const totalUsersCount = initialUsers.length;
  const waitingUsersCount = useMemo(
    () => initialUsers.filter((u) => u.members.length === 0).length,
    [initialUsers]
  );
  const memberUsersCount = useMemo(
    () => initialUsers.filter((u) => u.members.length > 0).length,
    [initialUsers]
  );
  const pendingInvitesCount = initialPendingInvitations.length;

  // Filtered users
  const filteredUsers = useMemo(() => {
    return initialUsers.filter((user) => {
      // Search by name, email, phone
      const query = searchQuery.trim().toLowerCase();
      if (query) {
        const nameMatch = user.name.toLowerCase().includes(query);
        const emailMatch = user.email.toLowerCase().includes(query);
        const phoneMatch = user.phoneNumber?.toLowerCase().includes(query);
        if (!nameMatch && !emailMatch && !phoneMatch) return false;
      }

      // Studio filter
      if (selectedStudioFilter !== "ALL") {
        const belongsToStudio = user.members.some((m) => m.studioId === selectedStudioFilter);
        if (!belongsToStudio) return false;
      }

      // Tab filter
      if (activeTab === "WAITING") {
        return user.members.length === 0;
      }
      if (activeTab === "MEMBERS") {
        return user.members.length > 0;
      }

      return true;
    });
  }, [initialUsers, searchQuery, selectedStudioFilter, activeTab]);

  // Filtered invitations
  const filteredInvitations = useMemo(() => {
    return initialPendingInvitations.filter((inv) => {
      const query = searchQuery.trim().toLowerCase();
      if (query) {
        const emailMatch = inv.email.toLowerCase().includes(query);
        const studioMatch = inv.studio?.name.toLowerCase().includes(query);
        if (!emailMatch && !studioMatch) return false;
      }

      if (selectedStudioFilter !== "ALL") {
        if (inv.studioId !== selectedStudioFilter) return false;
      }

      return true;
    });
  }, [initialPendingInvitations, searchQuery, selectedStudioFilter]);

  // Open assign dialog
  const handleOpenAssign = (user: UserForManagement, mode: "DIRECT" | "INVITE" = "DIRECT") => {
    setUserToAssign(user);
    setAssignMode(mode);
    setTargetRole("photographer");
    // Default to first studio or a studio user is not yet part of
    const availableStudio =
      managedStudios.find((s) => !user.members.some((m) => m.studioId === s.id)) ||
      managedStudios[0];
    if (availableStudio) {
      setTargetStudioId(availableStudio.id);
    }
    setAssignDialogOpen(true);
  };

  // Submit assign or invite
  const handleConfirmAssign = () => {
    if (!userToAssign || !targetStudioId) {
      toast.error("Please select a studio.");
      return;
    }

    startTransition(async () => {
      if (assignMode === "DIRECT") {
        const result = await assignUserToStudio({
          userId: userToAssign.id,
          studioId: targetStudioId,
          role: targetRole,
        });

        if (result.status === "success") {
          toast.success(result.message);
          setAssignDialogOpen(false);
          router.refresh();
        } else {
          toast.error(result.message);
        }
      } else {
        const result = await inviteMember(
          {
            email: userToAssign.email,
            phone: userToAssign.phoneNumber || undefined,
            role: targetRole,
            studio: targetStudioId,
          },
          targetStudioId
        );

        if (result.status === "success") {
          toast.success(result.message || "Invitation sent successfully");
          setAssignDialogOpen(false);
          router.refresh();
        } else {
          toast.error(result.message || "Failed to send invitation");
        }
      }
    });
  };

  // Remove member from studio
  const handleConfirmRemove = () => {
    if (!memberToRemove) return;

    startTransition(async () => {
      const result = await removeUserMembership(
        memberToRemove.memberId,
        memberToRemove.studioId
      );

      if (result.status === "success") {
        toast.success(result.message);
        setRemoveDialogOpen(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  // Cancel pending invitation
  const handleCancelInvite = (invitationId: string) => {
    startTransition(async () => {
      const result = await cancelInvitation(invitationId);
      if (result.status === "success") {
        toast.success(result.message || "Invitation cancelled");
        router.refresh();
      } else {
        toast.error(result.message || "Failed to cancel invitation");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review registered users, manage access requests, and assign staff members to studios.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Users
            </CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsersCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Registered platform accounts</p>
          </CardContent>
        </Card>

        <Card
          className={`hover:border-amber-500/50 transition-colors cursor-pointer ${
            activeTab === "WAITING" ? "border-amber-500 bg-amber-500/5" : ""
          }`}
          onClick={() => setActiveTab("WAITING")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Waiting for Access
            </CardTitle>
            <HourglassIcon className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {waitingUsersCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Signed up with no studio assigned</p>
          </CardContent>
        </Card>

        <Card
          className={`hover:border-primary/50 transition-colors cursor-pointer ${
            activeTab === "MEMBERS" ? "border-primary bg-primary/5" : ""
          }`}
          onClick={() => setActiveTab("MEMBERS")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Active Members
            </CardTitle>
            <UserCheckIcon className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{memberUsersCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Assigned to one or more studios</p>
          </CardContent>
        </Card>

        <Card
          className={`hover:border-blue-500/50 transition-colors cursor-pointer ${
            activeTab === "INVITATIONS" ? "border-blue-500 bg-blue-500/5" : ""
          }`}
          onClick={() => setActiveTab("INVITATIONS")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Pending Invites
            </CardTitle>
            <MailIcon className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {pendingInvitesCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting acceptance by user</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* View Tabs */}
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as typeof activeTab)}
              className="w-full md:w-auto"
            >
              <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full md:w-auto h-auto p-1">
                <TabsTrigger value="ALL">All ({totalUsersCount})</TabsTrigger>
                <TabsTrigger value="WAITING" className="gap-1.5">
                  Waiting
                  {waitingUsersCount > 0 && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                      {waitingUsersCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="MEMBERS">Members ({memberUsersCount})</TabsTrigger>
                <TabsTrigger value="INVITATIONS">Invites ({pendingInvitesCount})</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative w-full sm:w-64">
                <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search name, email, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9 text-xs"
                />
              </div>

              {managedStudios.length > 1 && (
                <Select
                  value={selectedStudioFilter}
                  onValueChange={setSelectedStudioFilter}
                >
                  <SelectTrigger className="h-9 w-full sm:w-44 text-xs">
                    <SelectValue placeholder="All Studios" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Studios</SelectItem>
                    {managedStudios.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {activeTab !== "INVITATIONS" ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-[300px]">User</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead>Studio Access & Role</TableHead>
                    <TableHead className="text-right pr-6">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => {
                      const isWaiting = user.members.length === 0;
                      const userPendingInvites = initialPendingInvitations.filter(
                        (inv) => inv.email.toLowerCase() === user.email.toLowerCase()
                      );

                      return (
                        <TableRow key={user.id} className="hover:bg-muted/40 transition-colors">
                          {/* User info */}
                          <TableCell className="py-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 border">
                                <AvatarImage src={user.image || undefined} alt={user.name} />
                                <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                                  {user.name.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium text-sm truncate">{user.name}</span>
                                  {user.role === "admin" && (
                                    <Badge variant="outline" className="text-[10px] py-0 px-1 border-primary text-primary">
                                      Admin
                                    </Badge>
                                  )}
                                  {user.emailVerified && (
                                    <CheckCircle2Icon className="size-3 text-emerald-500 shrink-0" />
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground truncate">
                                  {user.email}
                                </span>
                                {user.phoneNumber && (
                                  <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                    <PhoneIcon className="size-2.5 opacity-70" />
                                    {user.phoneNumber}
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          {/* Registered date */}
                          <TableCell className="text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <CalendarIcon className="size-3.5 opacity-60" />
                              <span>{format(new Date(user.createdAt), "MMM d, yyyy")}</span>
                            </div>
                          </TableCell>

                          {/* Studio Access & Role */}
                          <TableCell>
                            <div className="flex flex-wrap gap-1.5 items-center">
                              {isWaiting ? (
                                <Badge
                                  variant="outline"
                                  className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 font-medium flex items-center gap-1 text-xs py-0.5"
                                >
                                  <HourglassIcon className="size-3 text-amber-600 animate-pulse" />
                                  Waiting for Access
                                </Badge>
                              ) : (
                                user.members.map((m) => (
                                  <Badge
                                    key={m.id}
                                    variant="secondary"
                                    className="text-xs flex items-center gap-1 py-0.5 bg-accent/60"
                                  >
                                    <Building2Icon className="size-3 text-primary" />
                                    <span className="font-semibold">{m.studio.name}</span>
                                    <span className="text-muted-foreground">·</span>
                                    <span className="capitalize text-muted-foreground font-normal">
                                      {m.role}
                                    </span>
                                  </Badge>
                                ))
                              )}

                              {/* Pending Invites for this user */}
                              {userPendingInvites.map((inv) => (
                                <Badge
                                  key={inv.id}
                                  variant="outline"
                                  className="text-xs py-0.5 bg-blue-500/10 text-blue-600 border-blue-500/30 flex items-center gap-1"
                                >
                                  <MailIcon className="size-3 text-blue-500" />
                                  <span>
                                    Invite: {inv.studio?.name} ({inv.role || "Member"})
                                  </span>
                                </Badge>
                              ))}
                            </div>
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-right pr-6">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant={isWaiting ? "default" : "outline"}
                                className="h-8 gap-1 text-xs shadow-xs"
                                onClick={() => handleOpenAssign(user, "DIRECT")}
                              >
                                <UserPlusIcon className="size-3.5" />
                                <span>Assign to Studio</span>
                              </Button>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontalIcon className="size-4" />
                                    <span className="sr-only">More options</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem
                                    onClick={() => handleOpenAssign(user, "INVITE")}
                                    className="cursor-pointer text-xs"
                                  >
                                    <SendIcon className="size-3.5 mr-2" />
                                    <span>Send Invitation Email</span>
                                  </DropdownMenuItem>

                                  {user.members.length > 0 && (
                                    <>
                                      <DropdownMenuSeparator />
                                      {user.members.map((m) => (
                                        <DropdownMenuItem
                                          key={m.id}
                                          onClick={() => {
                                            setMemberToRemove({
                                              memberId: m.id,
                                              studioId: m.studioId,
                                              userName: user.name,
                                              studioName: m.studio.name,
                                            });
                                            setRemoveDialogOpen(true);
                                          }}
                                          className="cursor-pointer text-xs text-destructive focus:text-destructive"
                                        >
                                          <Trash2Icon className="size-3.5 mr-2" />
                                          <span>Remove from {m.studio.name}</span>
                                        </DropdownMenuItem>
                                      ))}
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-44 text-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <UsersIcon className="size-8 text-muted-foreground/50" />
                          <p className="text-sm font-medium">No users found</p>
                          <p className="text-xs text-muted-foreground">
                            {searchQuery
                              ? "Try adjusting your search criteria"
                              : "No registered users match the active filter"}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            /* Pending Invitations Table */
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Invited Email</TableHead>
                    <TableHead>Studio</TableHead>
                    <TableHead>Assigned Role</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right pr-6">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvitations.length > 0 ? (
                    filteredInvitations.map((inv) => (
                      <TableRow key={inv.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="font-medium text-sm">
                          <div className="flex items-center gap-2">
                            <MailIcon className="size-4 text-blue-500" />
                            <span>{inv.email}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-1.5">
                            <Building2Icon className="size-3.5 text-muted-foreground" />
                            <span>{inv.studio?.name || "Unknown Studio"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-xs">
                            {inv.role || "Member"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(inv.expiresAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-destructive hover:bg-destructive/10"
                            onClick={() => handleCancelInvite(inv.id)}
                            disabled={isPending}
                          >
                            Cancel Invite
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-44 text-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <MailIcon className="size-8 text-muted-foreground/50" />
                          <p className="text-sm font-medium">No pending invitations</p>
                          <p className="text-xs text-muted-foreground">
                            All invitations have either been accepted or expired.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assign User to Studio Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <UserPlusIcon className="size-5 text-primary" />
              {assignMode === "DIRECT" ? "Assign User to Studio" : "Send Studio Invitation"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {assignMode === "DIRECT"
                ? "Grant this user immediate membership to access their dashboard."
                : "Send an email/SMS invitation link to the user to join the studio."}
            </DialogDescription>
          </DialogHeader>

          {userToAssign && (
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 my-2">
              <Avatar className="h-10 w-10 border">
                <AvatarImage src={userToAssign.image || undefined} />
                <AvatarFallback className="font-semibold text-primary">
                  {userToAssign.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <span className="font-medium text-sm">{userToAssign.name}</span>
                <span className="text-xs text-muted-foreground truncate">
                  {userToAssign.email}
                </span>
                {userToAssign.phoneNumber && (
                  <span className="text-[11px] text-muted-foreground">
                    {userToAssign.phoneNumber}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4 py-2">
            {/* Target Studio */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Studio *
              </Label>
              <Select value={targetStudioId} onValueChange={setTargetStudioId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select studio..." />
                </SelectTrigger>
                <SelectContent>
                  {managedStudios.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Role */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Assigned Role *
              </Label>
              <Select
                value={targetRole}
                onValueChange={(val) => setTargetRole(val as MemberRole)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select role..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">Manager (Management access)</SelectItem>
                  <SelectItem value="photographer">Photographer (Shoots & bookings)</SelectItem>
                  <SelectItem value="videographer">Videographer (Shoots & bookings)</SelectItem>
                  <SelectItem value="receptionist">Receptionist (Bookings & clients)</SelectItem>
                  {(isPlatformAdmin || managedStudios.some((studio) => studio.id === targetStudioId && studio.role === "owner")) && (
                    <SelectItem value="owner">Owner (Full studio control)</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Assignment Mode Toggle */}
            <div className="flex flex-col gap-1.5 pt-1">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Action Type
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAssignMode("DIRECT")}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-md border text-xs text-center transition-colors cursor-pointer ${
                    assignMode === "DIRECT"
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-input hover:bg-muted text-muted-foreground"
                  }`}
                >
                  <ShieldCheckIcon className="size-4 mb-1" />
                  <span>Direct Assignment</span>
                  <span className="text-[10px] opacity-75">Immediate access</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAssignMode("INVITE")}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-md border text-xs text-center transition-colors cursor-pointer ${
                    assignMode === "INVITE"
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-input hover:bg-muted text-muted-foreground"
                  }`}
                >
                  <SendIcon className="size-4 mb-1" />
                  <span>Send Invitation</span>
                  <span className="text-[10px] opacity-75">Email & SMS invite</span>
                </button>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAssignDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmAssign}
              disabled={isPending}
              className="gap-1.5"
            >
              {isPending ? (
                <>
                  <Loader2Icon className="size-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : assignMode === "DIRECT" ? (
                <>
                  <UserPlusIcon className="size-3.5" />
                  <span>Assign to Studio</span>
                </>
              ) : (
                <>
                  <SendIcon className="size-3.5" />
                  <span>Send Invitation</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Confirmation Dialog */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive text-lg">
              <Trash2Icon className="size-5" />
              Remove Staff Member
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to remove{" "}
              <span className="font-semibold text-foreground">{memberToRemove?.userName}</span> from{" "}
              <span className="font-semibold text-foreground">{memberToRemove?.studioName}</span>?
              They will no longer be able to access this studio.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRemoveDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmRemove}
              disabled={isPending}
              className="gap-1.5"
            >
              {isPending ? (
                <>
                  <Loader2Icon className="size-3.5 animate-spin" />
                  <span>Removing...</span>
                </>
              ) : (
                <span>Confirm Removal</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
