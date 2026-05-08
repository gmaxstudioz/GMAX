import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ImageUp, Loader2, Trash } from "lucide-react";
import Image from "next/image";

export function RenderEmptyState({isDragActive}: {isDragActive: boolean}) {
    return (
        <div className="text-center">
           <div className="flex items-center mx-auto justify-center size-12 rounded-full bg-muted mb-4">
            <ImageUp className={cn(
                "size-6 text-muted-foreground",
                isDragActive && "text-accent-foreground"
            )} />
           </div>
           <p className="text-base font-semibold text-foreground">Drop your files here or <span className="text-primary font-bold cursor-pointer">Click to upload</span></p>
        </div>
    )
}
export function RenderErrorState() {
    return (
        <div className="text-center">
           <div className="flex items-center mx-auto justify-center size-12 rounded-full bg-destructive/30 mb-4">
            <ImageUp className={cn(
                "size-6 text-destructive"
            )} />
           </div>
           <p className="text-base font-semibold">Upload Failed</p>
           <p className="text-xs mt-1 text-muted-foreground">Something went wrong, try again...</p>
        </div>
    )
}

export function RenderSuccessState({ previewUrl, isDeleting, handleDeleteFile }: { previewUrl: string, isDeleting: boolean, handleDeleteFile: () => void }) {
    return (
        <div className="text-center">
           <Image
               src={previewUrl}
               alt="Ubloaded File"
               fill
               className="object-contain p-2"
           />
           <Button variant="destructive" size="icon" className={cn("absolute top-2 right-4")} type="button" onClick={handleDeleteFile} disabled={isDeleting} >
            {isDeleting 
                ? <Loader2 className="size-4 animate-spin" /> 
                : <Trash className="size-4" />
            }
           </Button>
        </div>
    )
}

export function RenderUploadingState({ progress, file }: { progress: number, file: File}) {
    return (
        <div className="text-center flex justify-center items-center flex-col">
            <p>{ progress }</p>
            <p className="mt-2 text-sm font-medium text-foreground">Uploading...</p>   
            <p className="mt-1 text-xs text-muted-foreground truncate max-w-xs">{file.name}</p>         
        </div>
    )
}