"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UpdateStudioSchema, UpdateStudioInput, StudioCategoryEnum, StudioMetadata } from "@/lib/schemas/studio";
import slugify from "slugify";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    COUNTRIES,
    getStatesByCountry,
    getCitiesByState,
} from "@/lib/data/locations";
import { useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Link2, Loader2Icon, SparkleIcon, SaveIcon } from "lucide-react";
import { HugeiconsIcon } from '@hugeicons/react'
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Facebook, InstagramIcon, TiktokIcon, TwitterIcon } from "@hugeicons/core-free-icons";
import Uploader from "@/components/web/file-uploader/Uploader";
import { tryCatch } from "@/hooks/try-catch";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { updateStudio } from "@/lib/actions/organization";
import { createStudioSession, deleteStudioSession } from "@/lib/actions/session";
import { Prisma } from "@/lib/generated/prisma/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PlusIcon, Trash } from "lucide-react";

type StudioWithRelations = Prisma.StudioGetPayload<{
  include: {
    members: {
        include: { user: true }
    },
    invitations: true,
    categories: true,
    studioSessions: true,
    clients: {
        include: {
            bookings: true
        }
    },
    bookings: {
      include: {
        client: true
      }
    },
  }
}>;

interface UpdateStudioProps extends React.ComponentProps<"div"> {
    studioData: StudioWithRelations;
}

export default function UpdateStudio({
    studioData,
    className,
    ...props
}: UpdateStudioProps) {
    const [ isPending, startTransition ] = useTransition();
    const [socialOpen, setSocialOpen] = useState(false);

    const [isSessionPending, startSessionTransition] = useTransition();
    const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false);
    const [newSessionName, setNewSessionName] = useState("");
    const [newSessionDuration, setNewSessionDuration] = useState("");

    const handleCreateSession = () => {
        if (!newSessionName || !newSessionDuration) return;
        startSessionTransition(async () => {
             const result = await createStudioSession({
                name: newSessionName,
                duration: parseInt(newSessionDuration) || 45,
                studioId: studioData.id
             });
             if (result.status === "success") {
                 toast.success("Session added");
                 setNewSessionName("");
                 setNewSessionDuration("");
                 setIsSessionDialogOpen(false);
             } else {
                 toast.error(result.message);
             }
        });
    }

    const handleDeleteSession = (sessionId: string) => {
        startSessionTransition(async () => {
             const result = await deleteStudioSession(sessionId);
             if (result.status === "success") {
                 toast.success("Session removed");
             } else {
                 toast.error(result.message);
             }
        });
    }

    let meta: StudioMetadata = {};
    if (typeof studioData.metadata === "string") {
        try {
            meta = JSON.parse(studioData.metadata);
        } catch (e) {
            console.error("Failed to parse studio metadata", e);
        }
    } else if (typeof studioData.metadata === "object" && studioData.metadata !== null) {
        meta = studioData.metadata as StudioMetadata;
    }

    const socials = meta.socialLinks || {};

    const [selectedCountry, setSelectedCountry] = useState<string>(meta.country || "");
    const [selectedState, setSelectedState] = useState<string>(meta.state || "");

    const router = useRouter();

    const form = useForm<UpdateStudioInput>({
        resolver: zodResolver(UpdateStudioSchema),
        defaultValues: {
            name: studioData.name,
            slug: studioData.slug,
            logo: studioData.logo || "",
            metadata: {
                description: meta.description || "",
                address: meta.address || "",
                state: meta.state || "",
                city: meta.city || "",
                country: meta.country || "",
                phone: meta.phone || "",
                category: meta.category || "recording",
                socialLinks: {
                    instagram: socials.instagram || "",
                    twitter: socials.twitter || "",
                    facebook: socials.facebook || "",
                    tiktok: socials.tiktok || "",
                },
            },
        },
    });

    const stateOptions = selectedCountry ? getStatesByCountry(selectedCountry) : [];
    const cityOptions =
        selectedCountry && selectedState
            ? getCitiesByState(selectedState, selectedCountry)
            : [];

    function onSubmit(values: UpdateStudioInput) {
        startTransition(async () => {
            const { data: result, error } = await tryCatch(updateStudio(studioData.id, values));

            if (error) {
                toast.error("An unexpected error occurred. Please try again.");
                return;
            }

            if (result?.status === "success") {
                toast.success(result?.message);
                
                // If they radically changed the slug, seamlessly transition them to the new url
                if (values.slug && values.slug !== studioData.slug) {
                    router.push(`/studios/${values.slug}`);
                } else {
                    router.refresh();
                }
            } else if (result?.status === "error") {
                toast.error(result?.message);
            }            
        })
    }

    return (
        <div className={cn("flex flex-col gap-6", className)} {...props}>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-2xl font-semibold tracking-tight">
                        Studio Settings
                    </CardTitle>
                    <CardDescription className="text-sm text-muted-foreground">
                        Manage your overall studio profile and configuration settings.
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

                        {/* ── Logo Upload ──────────────────────────────────────── */}
                        <section className="space-y-4">
                            <SectionHeading title="Identity" />
                            <Controller
                                name="logo"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field>
                                        <FieldLabel htmlFor="logo">Studio Logo</FieldLabel>
                                        <Uploader
                                            initialPreview={field.value && process.env.NEXT_PUBLIC_R2_PUBLIC_URL ? `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${field.value}` : ""}
                                            onUploadComplete={(key) => {
                                                field.onChange(key);
                                            }}
                                            onDelete={() => {
                                                field.onChange("");
                                            }}
                                            directory="studio/logo"
                                        />
                                        {fieldState.error && (
                                            <p className="text-xs text-destructive mt-1">
                                                {fieldState.error.message}
                                            </p>
                                        )}
                                        {field.value && (
                                           <div className="mt-2 text-xs text-muted-foreground">Currently loaded an existing logo. Uploading a new one overwrites it.</div>
                                        )}
                                    </Field>
                                )}
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Controller
                                    name="name"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field>
                                            <FieldLabel htmlFor="name">Studio Name</FieldLabel>
                                            <Input
                                                {...field}
                                                id={field.name}
                                                type="text"
                                                placeholder="e.g. Rhythm House Studios"
                                                aria-invalid={fieldState.invalid}
                                            />
                                            {fieldState.error && (
                                                <p className="text-xs text-destructive mt-1">
                                                    {fieldState.error.message}
                                                </p>
                                            )}
                                        </Field>
                                    )}
                                />
                                <div className="flex items-end gap-2">
                                    <Controller
                                        name="slug"
                                        control={form.control}
                                        render={({ field, fieldState }) => (
                                            <Field>
                                                <FieldLabel htmlFor="slug">Studio Slug</FieldLabel>
                                                <Input
                                                    {...field}
                                                    id={field.name}
                                                    type="text"
                                                    placeholder="e.g. rhythm-house-studios"
                                                    aria-invalid={fieldState.invalid}
                                                />
                                                {fieldState.error && (
                                                    <p className="text-xs text-destructive mt-1">
                                                        {fieldState.error.message}
                                                    </p>
                                                )}
                                            </Field>
                                        )}
                                    />

                                    <Button type="button" className="w-fit" onClick={() => {
                                        const titleValue = form.getValues("name")
                                        const slug = slugify(titleValue || "", { lower: true, strict: true, replacement: "-" });

                                        form.setValue("slug", slug, { shouldValidate: true })
                                    }}>
                                        Generate Slug <SparkleIcon />
                                    </Button>
                                </div>
                            </div>

                            <Controller
                                name="metadata.description"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field>
                                        <FieldLabel htmlFor="metadata.description">
                                            Studio Description
                                        </FieldLabel>
                                        <Textarea
                                            {...field}
                                            id={field.name}
                                            placeholder="Tell artists what makes your studio special..."
                                            aria-invalid={fieldState.invalid}
                                            className="min-h-[120px] resize-none"
                                        />
                                        {fieldState.error && (
                                            <p className="text-xs text-destructive mt-1">
                                                {fieldState.error.message}
                                            </p>
                                        )}
                                    </Field>
                                )}
                            />
                        </section>

                        {/* ── Location & Details ───────────────────────────────── */}
                        <section className="space-y-4">
                            <SectionHeading title="Location & Contact" />

                            {/* Category + Phone */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Controller
                                    name="metadata.category"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field>
                                            <FieldLabel htmlFor="metadata.category">
                                                Studio Category
                                            </FieldLabel>
                                            <Select
                                                onValueChange={field.onChange}
                                                defaultValue={field.value}
                                            >
                                                <SelectTrigger
                                                    id="metadata.category"
                                                    aria-invalid={fieldState.invalid}
                                                >
                                                    <SelectValue placeholder="Select a category" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectGroup>
                                                        <SelectLabel>Category</SelectLabel>
                                                        {StudioCategoryEnum.options.map((cat) => (
                                                            <SelectItem key={cat} value={cat}>
                                                                {cat.charAt(0).toUpperCase() + cat.slice(1)}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectGroup>
                                                </SelectContent>
                                            </Select>
                                            {fieldState.error && (
                                                <p className="text-xs text-destructive mt-1">
                                                    {fieldState.error.message}
                                                </p>
                                            )}
                                        </Field>
                                    )}
                                />

                                <Controller
                                    name="metadata.phone"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field>
                                            <FieldLabel htmlFor="metadata.phone">
                                                Phone Number
                                            </FieldLabel>
                                            <Input
                                                {...field}
                                                id={field.name}
                                                type="tel"
                                                placeholder="+234 800 000 0000"
                                                aria-invalid={fieldState.invalid}
                                            />
                                            {fieldState.error && (
                                                <p className="text-xs text-destructive mt-1">
                                                    {fieldState.error.message}
                                                </p>
                                            )}
                                        </Field>
                                    )}
                                />
                            </div>

                            {/* Address */}
                            <Controller
                                name="metadata.address"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field>
                                        <FieldLabel htmlFor="metadata.address">
                                            Street Address
                                        </FieldLabel>
                                        <Input
                                            {...field}
                                            id={field.name}
                                            type="text"
                                            placeholder="e.g. 12 Allen Avenue, Ikeja"
                                            aria-invalid={fieldState.invalid}
                                        />
                                        {fieldState.error && (
                                            <p className="text-xs text-destructive mt-1">
                                                {fieldState.error.message}
                                            </p>
                                        )}
                                    </Field>
                                )}
                            />

                            {/* Country → State → City (cascading dropdowns) */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Country */}
                                <Controller
                                    name="metadata.country"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field>
                                            <FieldLabel htmlFor="metadata.country">
                                                Country
                                            </FieldLabel>
                                            <Select
                                                onValueChange={(value) => {
                                                    field.onChange(value);
                                                    setSelectedCountry(value);
                                                    setSelectedState("");
                                                    form.setValue("metadata.state", "");
                                                    form.setValue("metadata.city", "");
                                                }}
                                                value={field.value}
                                            >
                                                <SelectTrigger
                                                    id="metadata.country"
                                                    aria-invalid={fieldState.invalid}
                                                >
                                                    <SelectValue placeholder="Select country" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectGroup>
                                                        <SelectLabel>Country</SelectLabel>
                                                        {COUNTRIES.map((c) => (
                                                            <SelectItem key={c.code} value={c.code}>
                                                                {c.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectGroup>
                                                </SelectContent>
                                            </Select>
                                            {fieldState.error && (
                                                <p className="text-xs text-destructive mt-1">
                                                    {fieldState.error.message}
                                                </p>
                                            )}
                                        </Field>
                                    )}
                                />

                                {/* State / Region */}
                                <Controller
                                    name="metadata.state"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field>
                                            <FieldLabel htmlFor="metadata.state">
                                                State / Region
                                            </FieldLabel>
                                            <Select
                                                onValueChange={(value) => {
                                                    field.onChange(value);
                                                    setSelectedState(value);
                                                    form.setValue("metadata.city", "");
                                                }}
                                                value={field.value}
                                                disabled={stateOptions.length === 0}
                                            >
                                                <SelectTrigger
                                                    id="metadata.state"
                                                    aria-invalid={fieldState.invalid}
                                                >
                                                    <SelectValue
                                                        placeholder={
                                                            selectedCountry
                                                                ? "Select state"
                                                                : "Select country first"
                                                        }
                                                    />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectGroup>
                                                        <SelectLabel>State / Region</SelectLabel>
                                                        {stateOptions.map((s) => (
                                                            <SelectItem key={s.code} value={s.code}>
                                                                {s.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectGroup>
                                                </SelectContent>
                                            </Select>
                                            {fieldState.error && (
                                                <p className="text-xs text-destructive mt-1">
                                                    {fieldState.error.message}
                                                </p>
                                            )}
                                        </Field>
                                    )}
                                />

                                {/* City */}
                                <Controller
                                    name="metadata.city"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field>
                                            <FieldLabel htmlFor="metadata.city">City</FieldLabel>
                                            <Select
                                                onValueChange={field.onChange}
                                                value={field.value}
                                                disabled={cityOptions.length === 0}
                                            >
                                                <SelectTrigger
                                                    id="metadata.city"
                                                    aria-invalid={fieldState.invalid}
                                                >
                                                    <SelectValue
                                                        placeholder={
                                                            selectedState
                                                                ? cityOptions.length > 0
                                                                    ? "Select city"
                                                                    : "Type your city below"
                                                                : "Select state first"
                                                        }
                                                    />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectGroup>
                                                        <SelectLabel>City</SelectLabel>
                                                        {cityOptions.map((c) => (
                                                            <SelectItem key={c.name} value={c.name}>
                                                                {c.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectGroup>
                                                </SelectContent>
                                            </Select>
                                            {/* fallback text input when no cities listed */}
                                            {selectedState && cityOptions.length === 0 && (
                                                <Input
                                                    {...field}
                                                    id={`${field.name}-text`}
                                                    type="text"
                                                    placeholder="Enter your city"
                                                    aria-invalid={fieldState.invalid}
                                                    className="mt-2"
                                                />
                                            )}
                                            {fieldState.error && (
                                                <p className="text-xs text-destructive mt-1">
                                                    {fieldState.error.message}
                                                </p>
                                            )}
                                        </Field>
                                    )}
                                />
                            </div>
                        </section>

                        <Separator />

                        {/* ── Studio Sessions ──────────────────────────────────── */}
                        <section className="space-y-4">
                            <div className="flex items-center justify-between">
                                <SectionHeading title="Studio Sessions" />
                                <Dialog open={isSessionDialogOpen} onOpenChange={setIsSessionDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button type="button" variant="outline" size="sm" className="h-8 gap-1">
                                            <PlusIcon className="size-3.5" />
                                            <span>Add Session</span>
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Create Studio Session</DialogTitle>
                                            <DialogDescription>
                                                Define a core booking session format (e.g. &quot;Indoor&quot;, &quot;Half-Day&quot;).
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4 py-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="sessionName">Session Name</Label>
                                                <Input
                                                    id="sessionName"
                                                    placeholder="e.g. Standard Portrait"
                                                    value={newSessionName}
                                                    onChange={(e) => setNewSessionName(e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="sessionDuration">Duration (Minutes)</Label>
                                                <Input
                                                    id="sessionDuration"
                                                    type="number"
                                                    placeholder="45"
                                                    value={newSessionDuration}
                                                    onChange={(e) => setNewSessionDuration(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button type="button" variant="outline" onClick={() => setIsSessionDialogOpen(false)} disabled={isSessionPending}>
                                                Cancel
                                            </Button>
                                            <Button type="button" onClick={handleCreateSession} disabled={isSessionPending || !newSessionName || !newSessionDuration}>
                                                {isSessionPending ? <Loader2Icon className="animate-spin size-4" /> : "Create Session"}
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>

                            <p className="text-sm text-muted-foreground">
                                Studio sessions define the default temporal boundaries for your services. You can assign services exclusively to these sessions.
                            </p>

                            <div className="flex flex-wrap gap-2">
                                {studioData.studioSessions.length === 0 ? (
                                    <p className="text-sm italic text-muted-foreground">No sessions defined yet.</p>
                                ) : (
                                    studioData.studioSessions.map((session) => (
                                        <Badge key={session.id} variant="secondary" className="pl-3 pr-1.5 py-1.5 flex items-center gap-2 text-sm font-medium">
                                            <span>
                                                {session.name} <span className="opacity-60 text-xs font-normal">({session.duration}m)</span>
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteSession(session.id)}
                                                disabled={isSessionPending}
                                                className="hover:bg-destructive/10 hover:text-destructive rounded-full p-1 opacity-50 hover:opacity-100 transition-opacity disabled:pointer-events-none"
                                            >
                                                <Trash className="size-3" />
                                            </button>
                                        </Badge>
                                    ))
                                )}
                            </div>
                        </section>

                        <Separator />

                        {/* ── Social Links (collapsible) ───────────────────────── */}
                        <section className="space-y-3">
                            <button
                                type="button"
                                onClick={() => setSocialOpen((prev) => !prev)}
                                className="flex w-full items-center justify-between rounded-lg border border-dashed border-border px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                aria-expanded={socialOpen}
                            >
                                <span className="flex items-center gap-2">
                                    <Link2 className="size-4" />
                                    Social Links
                                    <span className="text-xs font-normal opacity-60">
                                        (optional)
                                    </span>
                                </span>
                                {socialOpen ? (
                                    <ChevronUp className="size-4" />
                                ) : (
                                    <ChevronDown className="size-4" />
                                )}
                            </button>

                            {socialOpen && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border border-border bg-muted/20 p-4">
                                    {/* Instagram */}
                                    <Controller
                                        name="metadata.socialLinks.instagram"
                                        control={form.control}
                                        render={({ field, fieldState }) => (
                                            <Field>
                                                <FieldLabel
                                                    htmlFor="metadata.socialLinks.instagram"
                                                    className="flex items-center gap-1.5"
                                                >
                                                    <HugeiconsIcon icon={InstagramIcon} className="size-3.5 text-pink-500" />
                                                    Instagram
                                                </FieldLabel>
                                                <Input
                                                    {...field}
                                                    id={field.name}
                                                    type="url"
                                                    placeholder="https://instagram.com/yourstudio"
                                                    aria-invalid={fieldState.invalid}
                                                />
                                                {fieldState.error && (
                                                    <p className="text-xs text-destructive mt-1">
                                                        {fieldState.error.message}
                                                    </p>
                                                )}
                                            </Field>
                                        )}
                                    />

                                    {/* Twitter / X */}
                                    <Controller
                                        name="metadata.socialLinks.twitter"
                                        control={form.control}
                                        render={({ field, fieldState }) => (
                                            <Field>
                                                <FieldLabel
                                                    htmlFor="metadata.socialLinks.twitter"
                                                    className="flex items-center gap-1.5"
                                                >
                                                    <HugeiconsIcon icon={TwitterIcon} className="size-3.5 text-sky-500" />
                                                    Twitter / X
                                                </FieldLabel>
                                                <Input
                                                    {...field}
                                                    id={field.name}
                                                    type="url"
                                                    placeholder="https://x.com/yourstudio"
                                                    aria-invalid={fieldState.invalid}
                                                />
                                                {fieldState.error && (
                                                    <p className="text-xs text-destructive mt-1">
                                                        {fieldState.error.message}
                                                    </p>
                                                )}
                                            </Field>
                                        )}
                                    />

                                    {/* Facebook */}
                                    <Controller
                                        name="metadata.socialLinks.facebook"
                                        control={form.control}
                                        render={({ field, fieldState }) => (
                                            <Field>
                                                <FieldLabel
                                                    htmlFor="metadata.socialLinks.facebook"
                                                    className="flex items-center gap-1.5"
                                                >
                                                    <HugeiconsIcon icon={Facebook} className="size-3.5 text-blue-600" />
                                                    Facebook
                                                </FieldLabel>
                                                <Input
                                                    {...field}
                                                    id={field.name}
                                                    type="url"
                                                    placeholder="https://facebook.com/yourstudio"
                                                    aria-invalid={fieldState.invalid}
                                                />
                                                {fieldState.error && (
                                                    <p className="text-xs text-destructive mt-1">
                                                        {fieldState.error.message}
                                                    </p>
                                                )}
                                            </Field>
                                        )}
                                    />

                                    {/* TikTok */}
                                    <Controller
                                        name="metadata.socialLinks.tiktok"
                                        control={form.control}
                                        render={({ field, fieldState }) => (
                                            <Field>
                                                <FieldLabel
                                                    htmlFor="metadata.socialLinks.tiktok"
                                                    className="flex items-center gap-1.5"
                                                >
                                                    <HugeiconsIcon icon={TiktokIcon} />
                                                    TikTok
                                                </FieldLabel>
                                                <Input
                                                    {...field}
                                                    id={field.name}
                                                    type="url"
                                                    placeholder="https://tiktok.com/@yourstudio"
                                                    aria-invalid={fieldState.invalid}
                                                />
                                                {fieldState.error && (
                                                    <p className="text-xs text-destructive mt-1">
                                                        {fieldState.error.message}
                                                    </p>
                                                )}
                                            </Field>
                                        )}
                                    />
                                </div>
                            )}
                        </section>

                        {/* ── Submit ───────────────────────────────────────────── */}
                        <div className="flex justify-end gap-4 pb-4">
                            <Button type="button" variant="outline" onClick={() => form.reset()} disabled={isPending}>
                                Discard Changes
                            </Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending
                                    ? (
                                        <>
                                            <Loader2Icon className="animate-spin" />
                                            Saving...
                                        </>
                                    )
                                    : (
                                        <>
                                            <SaveIcon />
                                            Save Settings
                                        </>
                                    )
                                }
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

// Small helper component for section headings
function SectionHeading({ title }: { title: string }) {
    return (
        <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {title}
            </h3>
            <div className="h-px flex-1 bg-border" />
        </div>
    );
}
