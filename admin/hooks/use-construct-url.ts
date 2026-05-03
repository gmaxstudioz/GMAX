export function useConstructUrl(key: string) {
    return `https://${process.env.R2_PUBLIC_URL}/${key}`
}