"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createHistoricalBookings, grantBookingBackfillAccess, revokeBookingBackfillAccess } from "@/lib/actions/booking-backfill";

type Studio = { id: string; name: string };
type Service = { id: string; name: string; studioId: string; isActive: boolean };
type Member = { studioId: string; userId: string; role: string; name: string; email: string };
type Grant = { studioId: string; userId: string; expiresAt: string; name: string; email: string };
type BookingEntry = {
    bookingDate: string;
    clientName: string;
    clientPhone: string;
    clientEmail: string;
    serviceId: string;
    totalAmount: string;
    bookingStatus: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
    paymentStatus: "PENDING" | "CANCELLED" | "PAID" | "PARTIALLY_PAID";
    notes: string;
};

const csvHeaders = ["bookingDate", "clientName", "clientPhone", "clientEmail", "serviceName", "totalAmount", "bookingStatus", "paymentStatus", "notes"];

function emptyEntry(): BookingEntry {
    return {
        bookingDate: "",
        clientName: "",
        clientPhone: "",
        clientEmail: "",
        serviceId: "",
        totalAmount: "",
        bookingStatus: "COMPLETED",
        paymentStatus: "PENDING",
        notes: "",
    };
}

function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let quoted = false;

    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        if (quoted) {
            if (char === '"' && text[index + 1] === '"') {
                field += '"';
                index += 1;
            } else if (char === '"') {
                quoted = false;
            } else {
                field += char;
            }
        } else if (char === '"' && field.length === 0) {
            quoted = true;
        } else if (char === ",") {
            row.push(field.trim());
            field = "";
        } else if (char === "\n" || char === "\r") {
            if (char === "\r" && text[index + 1] === "\n") index += 1;
            row.push(field.trim());
            if (row.some(Boolean)) rows.push(row);
            row = [];
            field = "";
        } else {
            field += char;
        }
    }

    if (quoted) throw new Error("CSV contains an unclosed quoted field.");
    row.push(field.trim());
    if (row.some(Boolean)) rows.push(row);
    return rows;
}

function normalizeBookingDate(value: string) {
    const trimmed = value.trim();
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (dateOnlyMatch) {
        const [, year, month, day] = dateOnlyMatch;
        const parsedDate = new Date(`${trimmed}T12:00:00`);
        if (
            parsedDate.getFullYear() !== Number(year) ||
            parsedDate.getMonth() + 1 !== Number(month) ||
            parsedDate.getDate() !== Number(day) ||
            parsedDate.getTime() >= Date.now()
        ) return "";
        return `${trimmed}T12:00`;
    }

    const normalized = trimmed.replace(" ", "T");
    const dateTimeWithOffset = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/i;
    if (dateTimeWithOffset.test(normalized)) {
        const parsedDate = new Date(normalized);
        return Number.isFinite(parsedDate.getTime()) && parsedDate.getTime() < Date.now()
            ? parsedDate.toISOString()
            : "";
    }

    const localDateTimeMatch = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(normalized);
    if (!localDateTimeMatch) return "";
    const [, year, month, day, hour, minute] = localDateTimeMatch;
    const parsedDate = new Date(`${normalized}:00`);
    if (
        parsedDate.getFullYear() !== Number(year) ||
        parsedDate.getMonth() + 1 !== Number(month) ||
        parsedDate.getDate() !== Number(day) ||
        parsedDate.getHours() !== Number(hour) ||
        parsedDate.getMinutes() !== Number(minute) ||
        parsedDate.getTime() >= Date.now()
    ) return "";
    return normalized;
}

export function BookingBackfillClient({
    now,
    studios,
    services,
    ownerStudioIds,
    currentUserId,
    members,
    grants,
}: {
    now: string;
    studios: Studio[];
    services: Service[];
    ownerStudioIds: string[];
    currentUserId: string;
    members: Member[];
    grants: Grant[];
}) {
    const [studioId, setStudioId] = useState(studios[0]?.id ?? "");
    const [manualEntries, setManualEntries] = useState<BookingEntry[]>([emptyEntry()]);
    const [csvText, setCsvText] = useState("");
    const [csvEntries, setCsvEntries] = useState<BookingEntry[]>([]);
    const [csvErrors, setCsvErrors] = useState<string[]>([]);
    const [mode, setMode] = useState<"manual" | "csv">("manual");
    const [selectedUserId, setSelectedUserId] = useState("");
    const [duration, setDuration] = useState("1");
    const [durationUnit, setDurationUnit] = useState<"hours" | "days">("days");
    const [isPending, startTransition] = useTransition();
    const nowMs = new Date(now).getTime();

    const studioServices = useMemo(
        () => services.filter((service) => service.studioId === studioId),
        [services, studioId],
    );
    const isOwner = ownerStudioIds.includes(studioId);
    const studioMembers = members.filter((member) => member.studioId === studioId && member.userId !== currentUserId);
    const studioGrants = grants.filter((grant) => grant.studioId === studioId);
    const entriesToSubmit = mode === "manual" ? manualEntries : csvEntries;
    const entriesReady = entriesToSubmit.length > 0 &&
        entriesToSubmit.every((entry) =>
            entry.bookingDate && entry.clientName.trim().length >= 2 &&
            entry.clientPhone.trim().length >= 3 && entry.serviceId &&
            /^\d{1,10}(?:\.\d{1,2})?$/.test(entry.totalAmount) &&
            new Date(entry.bookingDate).getTime() < nowMs,
        );

    function updateManualEntry(index: number, patch: Partial<BookingEntry>) {
        setManualEntries((current) => current.map((entry, entryIndex) =>
            entryIndex === index ? { ...entry, ...patch } : entry,
        ));
    }

    function prepareCsv() {
        setCsvEntries([]);
        setCsvErrors([]);
        try {
            if (csvText.length > 2_000_000) throw new Error("CSV must be smaller than 2 MB.");
            const rows = parseCsv(csvText);
            if (rows.length < 2) throw new Error("Add a CSV header and at least one booking row.");
            if (rows.length > 101) throw new Error("Import up to 100 bookings at a time.");
            const headers = rows[0].map((header, index) =>
                (index === 0 ? header.replace(/^\uFEFF/, "") : header).trim(),
            );
            if (new Set(headers).size !== headers.length) throw new Error("CSV contains duplicate column names.");
            const required = ["bookingDate", "clientName", "clientPhone", "serviceName", "totalAmount"];
            const missing = required.filter((header) => !headers.includes(header));
            if (missing.length) throw new Error(`CSV is missing required columns: ${missing.join(", ")}.`);
            const indexByHeader = new Map(headers.map((header, index) => [header, index]));
            const issues: string[] = [];
            const prepared: BookingEntry[] = [];

            rows.slice(1).forEach((row, index) => {
                const lineNumber = index + 2;
                const value = (header: string) => row[indexByHeader.get(header) ?? -1] ?? "";
                const bookingDate = normalizeBookingDate(value("bookingDate"));
                const serviceName = value("serviceName").trim().toLowerCase();
                const matchingServices = studioServices.filter((service) => service.name.trim().toLowerCase() === serviceName);
                const service = matchingServices.length === 1 ? matchingServices[0] : undefined;
                const totalAmount = value("totalAmount");
                if (!bookingDate) issues.push(`Line ${lineNumber}: bookingDate must be a valid past date/time.`);
                if (!value("clientName").trim()) issues.push(`Line ${lineNumber}: clientName is required.`);
                if (!value("clientPhone").trim()) issues.push(`Line ${lineNumber}: clientPhone is required.`);
                if (!service) issues.push(`Line ${lineNumber}: serviceName must match one studio service exactly.`);
                if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(totalAmount) || Number(totalAmount) <= 0) {
                    issues.push(`Line ${lineNumber}: totalAmount must be greater than zero with up to 2 decimals.`);
                }

                const bookingStatus = value("bookingStatus").toUpperCase() || "COMPLETED";
                const paymentStatus = value("paymentStatus").toUpperCase() || "PENDING";
                if (!["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"].includes(bookingStatus)) {
                    issues.push(`Line ${lineNumber}: invalid bookingStatus.`);
                }
                if (!["PENDING", "CANCELLED", "PAID", "PARTIALLY_PAID"].includes(paymentStatus)) {
                    issues.push(`Line ${lineNumber}: invalid paymentStatus.`);
                }
                if (bookingDate && service && value("clientName").trim() && value("clientPhone").trim() &&
                    /^\d{1,10}(?:\.\d{1,2})?$/.test(totalAmount) && Number(totalAmount) > 0 &&
                    ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"].includes(bookingStatus) &&
                    ["PENDING", "CANCELLED", "PAID", "PARTIALLY_PAID"].includes(paymentStatus)) {
                    prepared.push({
                        bookingDate,
                        clientName: value("clientName").trim(),
                        clientPhone: value("clientPhone").trim(),
                        clientEmail: value("clientEmail").trim(),
                        serviceId: service.id,
                        totalAmount,
                        bookingStatus: bookingStatus as BookingEntry["bookingStatus"],
                        paymentStatus: paymentStatus as BookingEntry["paymentStatus"],
                        notes: value("notes"),
                    });
                }
            });

            setCsvErrors(issues);
            setCsvEntries(issues.length === 0 ? prepared : []);
            if (issues.length === 0) toast.success(`${prepared.length} CSV booking${prepared.length === 1 ? "" : "s"} ready to import.`);
        } catch (error) {
            setCsvErrors([error instanceof Error ? error.message : "Could not read the CSV."]);
        }
    }

    function submitBookings() {
        const serializedEntries = entriesToSubmit.map((entry) => ({
            ...entry,
            bookingDate: new Date(entry.bookingDate).toISOString(),
        }));
        startTransition(async () => {
            const result = await createHistoricalBookings({ studioId, entries: serializedEntries });
            if (result.status === "error") {
                toast.error(result.message);
                return;
            }
            toast.success(result.message);
            if (mode === "manual") setManualEntries([emptyEntry()]);
            else {
                setCsvText("");
                setCsvEntries([]);
                setCsvErrors([]);
            }
        });
    }

    function grantAccess() {
        startTransition(async () => {
            const result = await grantBookingBackfillAccess({
                studioId,
                userId: selectedUserId,
                duration: Number(duration),
                unit: durationUnit,
            });
            if (result.status === "error") toast.error(result.message);
            else {
                toast.success(result.message);
                setSelectedUserId("");
            }
        });
    }

    function revokeAccess(userId: string) {
        startTransition(async () => {
            const result = await revokeBookingBackfillAccess({ studioId, userId });
            if (result.status === "error") toast.error(result.message);
            else toast.success(result.message);
        });
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <header className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Historical booking backfill</h1>
                <p className="max-w-3xl text-sm text-muted-foreground">
                    Add bookings using their original dates. Clients are matched by phone or email, so repeat bookings stay on the same client record.
                </p>
            </header>

            <section className="space-y-4 rounded-xl border p-4 sm:p-6">
                <div className="grid gap-2 sm:max-w-sm">
                    <label htmlFor="backfill-studio" className="text-sm font-medium">Studio</label>
                    <select
                        id="backfill-studio"
                        value={studioId}
                        onChange={(event) => {
                            setStudioId(event.target.value);
                            setCsvEntries([]);
                            setCsvErrors([]);
                            setManualEntries([emptyEntry()]);
                        }}
                        className="h-10 rounded-md border bg-background px-3 text-sm"
                    >
                        {studios.map((studio) => <option key={studio.id} value={studio.id}>{studio.name}</option>)}
                    </select>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button type="button" variant={mode === "manual" ? "default" : "outline"} onClick={() => setMode("manual")}>
                        Enter multiple bookings
                    </Button>
                    <Button type="button" variant={mode === "csv" ? "default" : "outline"} onClick={() => setMode("csv")}>
                        Import CSV
                    </Button>
                </div>

                {mode === "manual" ? (
                    <div className="space-y-4">
                        {manualEntries.map((entry, index) => (
                            <fieldset key={index} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-3">
                                <legend className="px-1 text-sm font-medium">Booking {index + 1}</legend>
                                <label className="grid gap-1 text-sm">Booking date and time
                                    <input type="datetime-local" value={entry.bookingDate} onChange={(event) => updateManualEntry(index, { bookingDate: event.target.value })} className="h-10 rounded-md border bg-background px-3" />
                                </label>
                                <label className="grid gap-1 text-sm">Client name
                                    <input value={entry.clientName} maxLength={120} onChange={(event) => updateManualEntry(index, { clientName: event.target.value })} className="h-10 rounded-md border bg-background px-3" />
                                </label>
                                <label className="grid gap-1 text-sm">Client phone
                                    <input value={entry.clientPhone} maxLength={40} onChange={(event) => updateManualEntry(index, { clientPhone: event.target.value })} className="h-10 rounded-md border bg-background px-3" />
                                </label>
                                <label className="grid gap-1 text-sm">Client email (optional)
                                    <input type="email" value={entry.clientEmail} onChange={(event) => updateManualEntry(index, { clientEmail: event.target.value })} className="h-10 rounded-md border bg-background px-3" />
                                </label>
                                <label className="grid gap-1 text-sm">Service
                                    <select value={entry.serviceId} onChange={(event) => updateManualEntry(index, { serviceId: event.target.value })} className="h-10 rounded-md border bg-background px-3">
                                        <option value="">Select a service</option>
                                        {studioServices.map((service) => <option key={service.id} value={service.id}>{service.name}{service.isActive ? "" : " (inactive)"}</option>)}
                                    </select>
                                </label>
                                <label className="grid gap-1 text-sm">Booking total
                                    <input type="number" min="0.01" step="0.01" value={entry.totalAmount} onChange={(event) => updateManualEntry(index, { totalAmount: event.target.value })} className="h-10 rounded-md border bg-background px-3" />
                                </label>
                                <label className="grid gap-1 text-sm">Booking status
                                    <select value={entry.bookingStatus} onChange={(event) => updateManualEntry(index, { bookingStatus: event.target.value as BookingEntry["bookingStatus"] })} className="h-10 rounded-md border bg-background px-3">
                                        {["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"].map((status) => <option key={status}>{status}</option>)}
                                    </select>
                                </label>
                                <label className="grid gap-1 text-sm">Payment status
                                    <select value={entry.paymentStatus} onChange={(event) => updateManualEntry(index, { paymentStatus: event.target.value as BookingEntry["paymentStatus"] })} className="h-10 rounded-md border bg-background px-3">
                                        {["PENDING", "PARTIALLY_PAID", "PAID", "CANCELLED"].map((status) => <option key={status}>{status}</option>)}
                                    </select>
                                </label>
                                <label className="grid gap-1 text-sm sm:col-span-2 lg:col-span-1">Notes (optional)
                                    <input value={entry.notes} maxLength={2000} onChange={(event) => updateManualEntry(index, { notes: event.target.value })} className="h-10 rounded-md border bg-background px-3" />
                                </label>
                                {manualEntries.length > 1 && (
                                    <div className="sm:col-span-2 lg:col-span-3">
                                        <Button type="button" variant="ghost" size="sm" onClick={() => setManualEntries((current) => current.filter((_, row) => row !== index))}>
                                            <Trash2 className="mr-2 size-4" />Remove row
                                        </Button>
                                    </div>
                                )}
                            </fieldset>
                        ))}
                        <div className="flex flex-wrap gap-2">
                            <Button type="button" variant="outline" onClick={() => setManualEntries((current) => [...current, emptyEntry()])} disabled={manualEntries.length >= 100}>
                                <Plus className="mr-2 size-4" />Add another booking
                            </Button>
                            <Button type="button" onClick={submitBookings} disabled={!entriesReady || isPending}>
                                {isPending ? "Adding..." : `Add ${manualEntries.length} booking${manualEntries.length === 1 ? "" : "s"}`}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            CSV columns: <code>{csvHeaders.join(",")}</code>. Use the exact service name shown in the studio. Dates may be YYYY-MM-DD or YYYY-MM-DD HH:mm. Status columns are optional; booking status defaults to COMPLETED and payment status to PENDING.
                        </p>
                        <a
                            href={`data:text/csv;charset=utf-8,${encodeURIComponent(`${csvHeaders.join(",")}\n2024-06-15 14:30,Jane Doe,+2348000000000,jane@example.com,Portrait Session,50000,COMPLETED,PAID,Historical booking`)}`}
                            download="booking-backfill-template.csv"
                            className="inline-flex items-center gap-2 text-sm text-primary underline"
                        >
                            <Upload className="size-4" />Download CSV template
                        </a>
                        <input
                            type="file"
                            accept=".csv,text/csv"
                            aria-label="Upload booking CSV"
                            onChange={async (event) => {
                                const file = event.target.files?.[0];
                                if (!file) return;
                                if (file.size > 2_000_000) {
                                    setCsvErrors(["CSV must be smaller than 2 MB."]);
                                    return;
                                }
                                try {
                                    setCsvText(await file.text());
                                    setCsvEntries([]);
                                    setCsvErrors([]);
                                } catch {
                                    setCsvErrors(["Could not read the selected CSV file."]);
                                }
                            }}
                            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-2"
                        />
                        <textarea
                            value={csvText}
                            onChange={(event) => {
                                setCsvText(event.target.value);
                                setCsvEntries([]);
                                setCsvErrors([]);
                            }}
                            rows={8}
                            spellCheck={false}
                            placeholder={csvHeaders.join(",")}
                            className="w-full rounded-md border bg-background p-3 font-mono text-xs"
                        />
                        {csvErrors.length > 0 && (
                            <ul className="list-inside list-disc space-y-1 text-sm text-destructive">
                                {csvErrors.slice(0, 20).map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}
                                {csvErrors.length > 20 && <li>And {csvErrors.length - 20} more issues.</li>}
                            </ul>
                        )}
                        <div className="flex flex-wrap gap-2">
                            <Button type="button" variant="outline" onClick={prepareCsv} disabled={!csvText.trim() || isPending}>Validate and preview CSV</Button>
                            {csvEntries.length > 0 && (
                                <Button type="button" onClick={submitBookings} disabled={!entriesReady || isPending}>
                                    {isPending ? "Importing..." : `Import ${csvEntries.length} booking${csvEntries.length === 1 ? "" : "s"}`}
                                </Button>
                            )}
                        </div>
                        {csvEntries.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-sm text-muted-foreground">
                                    Preview: {csvEntries.length} bookings for {new Set(csvEntries.map((entry) => entry.clientPhone)).size} distinct phone numbers. No bookings have been saved yet.
                                </p>
                                <div className="max-h-72 overflow-auto rounded-md border">
                                    <table className="w-full text-left text-sm">
                                        <thead className="sticky top-0 bg-muted">
                                            <tr>
                                                <th className="p-2">Date</th>
                                                <th className="p-2">Client</th>
                                                <th className="p-2">Service</th>
                                                <th className="p-2 text-right">Total</th>
                                                <th className="p-2">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {csvEntries.map((entry, index) => (
                                                <tr key={`${entry.clientPhone}-${index}`}>
                                                    <td className="whitespace-nowrap p-2">{entry.bookingDate.replace("T", " ")}</td>
                                                    <td className="p-2">{entry.clientName}</td>
                                                    <td className="p-2">{studioServices.find((service) => service.id === entry.serviceId)?.name}</td>
                                                    <td className="p-2 text-right tabular-nums">{Number(entry.totalAmount).toLocaleString()}</td>
                                                    <td className="whitespace-nowrap p-2">{entry.bookingStatus} / {entry.paymentStatus}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                <p className="text-xs text-muted-foreground">
                    Historical bookings update booking analytics, but this page does not create payment ledger transactions. Record actual payments separately in the booking’s payment flow.
                </p>
            </section>

            {isOwner && (
                <section className="space-y-4 rounded-xl border p-4 sm:p-6">
                    <div>
                        <h2 className="text-lg font-semibold">Temporary backfill access</h2>
                        <p className="text-sm text-muted-foreground">Grant a current member of this studio access for a set number of hours or days.</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_8rem_auto]">
                        <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
                            <option value="">Select a studio member</option>
                            {studioMembers.map((member) => <option key={member.userId} value={member.userId}>{member.name} ({member.email}) · {member.role}</option>)}
                        </select>
                        <input type="number" min="1" max="365" value={duration} onChange={(event) => setDuration(event.target.value)} aria-label="Access duration" className="h-10 rounded-md border bg-background px-3 text-sm" />
                        <select value={durationUnit} onChange={(event) => setDurationUnit(event.target.value as "hours" | "days")} aria-label="Access duration unit" className="h-10 rounded-md border bg-background px-3 text-sm">
                            <option value="hours">Hours</option>
                            <option value="days">Days</option>
                        </select>
                        <Button type="button" onClick={grantAccess} disabled={!selectedUserId || isPending}>Grant access</Button>
                    </div>
                    {studioGrants.length > 0 ? (
                        <div className="divide-y rounded-md border">
                            {studioGrants.map((grant) => {
                                const active = new Date(grant.expiresAt).getTime() > nowMs;
                                return (
                                    <div key={grant.userId} className="flex flex-wrap items-center justify-between gap-3 p-3">
                                        <div>
                                            <p className="text-sm font-medium">{grant.name} <span className="font-normal text-muted-foreground">{grant.email}</span></p>
                                            <p className="text-xs text-muted-foreground">{active ? "Active until" : "Expired"} {new Date(grant.expiresAt).toLocaleString()}</p>
                                        </div>
                                        <Button type="button" size="sm" variant="outline" onClick={() => revokeAccess(grant.userId)} disabled={isPending}>Revoke</Button>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">No temporary grants for this studio.</p>
                    )}
                </section>
            )}
        </div>
    );
}
