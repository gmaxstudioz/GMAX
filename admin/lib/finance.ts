export function getRevenueCategory(serviceName: string, serviceCategory: string) {
    if (serviceName.toLowerCase().includes("wedding")) return "Wedding";
    if (serviceCategory === "PHOTOGRAPHY") return "Photography";
    if (serviceCategory === "VIDEOGRAPHY") return "Videography";
    return "Others";
}
