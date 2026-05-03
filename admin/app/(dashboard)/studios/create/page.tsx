import type { Metadata } from "next";
import CreateStudios from "../_components/CreateStudios";
import { BackButton } from "@/components/web/back-button";

export const metadata: Metadata = {
  title: "Create Studio",
  description:
    "Set up a new studio with custom details, categories, and session configurations.",
};


export default function CreateStudio() {
    return (
        <div className="flex flex-col gap-4 items-start py-4 px-4 md:gap-6 md:py-6 md:px-6">
            <BackButton href="/studios" />
            <div className="flex flex-col items-center gap-4 py-4 px-4 md:gap-6 md:py-6 md:px-6 w-full">
                <CreateStudios className="max-w-4xl w-full" />
            </div>
        </div>
    )
}