export type Product = {
  id: string;
  title: string;
  category: string;
  price: string;
  src: string;
  desc: string;
  features: string[];
};

export const products: Product[] = [
  { 
    id: "cinematic-wedding-luts", 
    title: "Cinematic Wedding LUTs", 
    category: "LUTs", 
    price: "$49.99", 
    src: "/works/image-1.jpg", 
    desc: "A premium pack of 10 cinematic LUTs designed specifically for wedding videographers. Achieve perfect skin tones and rich cinematic contrast in seconds.",
    features: ["10 Custom .CUBE Files", "Rec.709 Optimized", "Works with Premiere, FCPX, DaVinci", "Installation Guide Included"]
  },
  { 
    id: "dark-moody-presets", 
    title: "Dark Moody Presets", 
    category: "Presets", 
    price: "$29.99", 
    src: "/works/image-3.jpg", 
    desc: "Instantly transform your raw photos into dark, moody masterpieces. Perfect for portraits, lifestyle, and editorial shoots.",
    features: ["15 Lightroom Presets (.XMP)", "Mobile & Desktop Compatible", "1-Click Transformation", "Free Future Updates"]
  },
  { 
    id: "studio-light-masterclass", 
    title: "Studio Light Masterclass", 
    category: "Course", 
    price: "$99.00", 
    src: "/works/image-5.jpg", 
    desc: "Learn the secrets of Hollywood-style lighting in this comprehensive 4-hour masterclass. From single-light setups to complex cinematic scenes.",
    features: ["4 Hours of Video Content", "Lighting Diagrams PDF", "Behind-The-Scenes Footage", "Lifetime Access"]
  },
  { 
    id: "minimalist-fine-art-print", 
    title: "Minimalist Fine Art Print", 
    category: "Prints", 
    price: "$120.00", 
    src: "/works/image-8.jpg", 
    desc: "Limited edition signed print captured by our lead photographer. Printed on 300gsm Hahnemühle Photo Rag archival paper.",
    features: ["18x24 Inches", "Museum Quality Paper", "Signed & Numbered", "Certificate of Authenticity"]
  },
  { 
    id: "film-grain-overlays", 
    title: "Film Grain Overlays", 
    category: "Assets", 
    price: "$19.99", 
    src: "/works/image-12.jpg", 
    desc: "Real 35mm, 16mm, and 8mm film grain scans in 4K resolution. Add authentic analog texture to your digital footage seamlessly.",
    features: ["10 High-Quality 4K ProRes Files", "Dirt, Dust, and Scratches", "Drag & Drop Simplicity", "Commercial License"]
  },
  { 
    id: "vintage-film-presets", 
    title: "Vintage Film Presets", 
    category: "Presets", 
    price: "$34.99", 
    src: "/works/image-15.jpg", 
    desc: "Achieve the classic Kodachrome, Portra, and Cinestill looks effortlessly with this meticulously crafted preset collection.",
    features: ["12 Vintage Emulations", "Grain Profiles Included", "Desktop & Mobile", "Before/After Examples"]
  },
];
