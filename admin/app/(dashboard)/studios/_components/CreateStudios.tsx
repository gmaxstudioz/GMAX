"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateStudioSchema, CreateStudioSchemaType, StudioCategoryEnum } from "@/lib/schemas/studio";
import z from "zod";
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
import { ChevronDown, ChevronUp, CirclePlusIcon, Link2, Loader2Icon, SparkleIcon } from "lucide-react";
import { HugeiconsIcon } from '@hugeicons/react'
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Facebook, InstagramIcon, TiktokIcon, TwitterIcon } from "@hugeicons/core-free-icons";
import Uploader from "@/components/web/file-uploader/Uploader";
import { tryCatch } from "@/hooks/try-catch";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { CreateStudio } from "@/lib/actions/organization";

type FormValues = z.infer<typeof CreateStudioSchema>;

export default function CreateStudios({
    className,
    ...props
}: React.ComponentProps<"div">) {
    const [ isPending, startTransition ] = useTransition();
    const [socialOpen, setSocialOpen] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState<string>("");
    const [selectedState, setSelectedState] = useState<string>("");

    const router = useRouter();

    const form = useForm<FormValues>({
        resolver: zodResolver(CreateStudioSchema),
        defaultValues: {
            name: "",
            slug: "",
            logo: "",
            metadata: {
                description: "",
                address: "",
                state: "",
                city: "",
                country: "",
                phone: "",
                category: "recording",
                socialLinks: {
                    instagram: "",
                    twitter: "",
                    facebook: "",
                    tiktok: "",
                },
            },
        },
    });

    const stateOptions = selectedCountry ? getStatesByCountry(selectedCountry) : [];
    const cityOptions =
        selectedCountry && selectedState
            ? getCitiesByState(selectedState, selectedCountry)
            : [];

    function onSubmit(values: CreateStudioSchemaType) {
        startTransition(async () => {
            const { data: result, error } = await tryCatch(CreateStudio(values));

            if (error) {
                toast.error("An unexpected error occurred. Please try again.");
                return;
            }

            if (result?.status === "success") {
                toast.success(result?.message);
                form.reset();
                router.push("/studios");
            } else if (result?.status === "error") {
                toast.error(result?.message);
            }            
        })
    }

    return (
        <div className={cn("flex flex-col gap-6", className)} {...props}>
            <Card>
                <CardHeader className="text-center pb-2">
                    <CardTitle className="text-2xl font-semibold tracking-tight">
                        Create a Studio
                    </CardTitle>
                    <CardDescription className="text-sm text-muted-foreground">
                        Set up your studio profile so artists can find and book you.
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

                        {/* ── Logo Upload ──────────────────────────────────────── */}
                        <section className="space-y-4">
                            <SectionHeading title="Studio Identity" />
                            <Controller
                                name="logo"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field>
                                        <FieldLabel htmlFor="logo">Studio Logo</FieldLabel>
                                        <Uploader
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
                                        const slug = slugify(titleValue);

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
                            <SectionHeading title="Location & Details" />

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
                                                    // Reset dependent fields
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
                        <Button type="submit" className="w-full" disabled={isPending}>
                            {isPending
                                ? (
                                    <>
                                        <Loader2Icon className="animate-spin" />
                                        Creating...
                                    </>
                                )
                                : (
                                    <>
                                        <CirclePlusIcon />
                                        Create Studio
                                    </>
                                )
                            }
                        </Button>
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