import { prisma } from "@/lib/db";
import type { Locale } from "@/i18n/direction";

// Location category taxonomy (scope §3). English is the only sourced
// language today; Arabic/French names are filled in as translations land
// and fall back to English meanwhile (see `localizedName`).

export interface CategorySeed {
  nameEn: string;
  children?: string[];
}

// 16 parent categories, ~80 subcategories. Source of truth for the seed.
export const CATEGORY_SEED: CategorySeed[] = [
  {
    nameEn: "Food & Drink",
    children: [
      "Restaurants",
      "Cafés & Coffee Shops",
      "Bars & Pubs",
      "Bakeries & Patisseries",
      "Fast Food",
      "Fine Dining",
      "Food Trucks",
      "Dessert & Ice Cream Shops",
      "Catering Services",
    ],
  },
  {
    nameEn: "Health & Wellness",
    children: [
      "Gyms & Fitness Centers",
      "Yoga & Pilates Studios",
      "Spas & Wellness Centers",
      "Medical Clinics",
      "Dentists",
      "Pharmacies",
      "Mental Health & Therapy",
      "Nutritionists & Dietitians",
      "Physiotherapy Centers",
    ],
  },
  {
    nameEn: "Beauty & Personal Care",
    children: [
      "Hair Salons & Barbershops",
      "Nail Salons",
      "Skincare & Aesthetics Clinics",
      "Makeup Studios",
      "Tattoo & Piercing Studios",
    ],
  },
  {
    nameEn: "Shopping & Retail",
    children: [
      "Supermarkets & Grocery Stores",
      "Clothing & Fashion Boutiques",
      "Electronics Stores",
      "Bookstores",
      "Furniture & Home Decor",
      "Gift Shops",
      "Convenience Stores",
      "Specialty & Artisan Shops",
    ],
  },
  {
    nameEn: "Travel & Accommodation",
    children: [
      "Hotels & Resorts",
      "Guesthouses & B&Bs",
      "Travel Agencies",
      "Car Rental Services",
      "Tour Operators",
    ],
  },
  {
    nameEn: "Outdoor & Nature",
    children: [
      "Hiking Trails",
      "Parks & Nature Reserves",
      "Beaches",
      "Campgrounds",
      "Adventure Sports",
    ],
  },
  {
    nameEn: "Entertainment & Leisure",
    children: [
      "Cinemas",
      "Theaters & Performing Arts",
      "Museums & Galleries",
      "Amusement & Theme Parks",
      "Bowling Alleys & Arcades",
      "Live Music Venues",
    ],
  },
  {
    nameEn: "Nightlife",
    children: [
      "Nightclubs",
      "Lounges & Rooftop Bars",
      "Karaoke Bars",
      "Live DJ/Music Bars",
    ],
  },
  {
    nameEn: "Events & Venues",
    children: [
      "Wedding & Banquet Halls",
      "Conference & Business Event Venues",
      "Festival & Pop-up Spaces",
      "Private Party Venues",
    ],
  },
  {
    nameEn: "Kids & Family",
    children: [
      "Playgrounds & Indoor Play Areas",
      "Daycare & Nurseries",
      "Kids' Entertainment Centers",
      "Family-Friendly Activity Spots",
    ],
  },
  {
    nameEn: "Pets",
    children: [
      "Veterinary Clinics",
      "Pet Grooming",
      "Pet Stores & Supplies",
      "Pet Boarding & Daycare",
    ],
  },
  {
    nameEn: "Professional & Home Services",
    children: [
      "Cleaning Services",
      "Home Repair & Maintenance",
      "Interior Design",
      "Moving Services",
      "Legal Services",
      "Accounting & Financial Services",
      "Real Estate Agencies",
    ],
  },
  {
    nameEn: "Automotive",
    children: [
      "Car Dealerships",
      "Auto Repair & Maintenance",
      "Car Wash",
      "Auto Parts Stores",
    ],
  },
  {
    nameEn: "Education & Learning",
    children: [
      "Schools",
      "Universities & Colleges",
      "Tutoring Centers",
      "Language Schools",
      "Vocational & Skill Training Centers",
    ],
  },
  {
    nameEn: "Religious & Community",
    children: [
      "Places of Worship",
      "Community Centers",
      "NGOs & Charity Organizations",
    ],
  },
  {
    nameEn: "Finance & Essential Services",
    children: [
      "Banks & ATMs",
      "Insurance Agencies",
      "Currency Exchange",
      "Notary & Government Service Centers",
    ],
  },
];

/** Stable, locale-independent slug: lowercase, accents stripped, non-alphanumerics → hyphens. */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface Localizable {
  nameEn: string;
  nameAr: string | null;
  nameFr: string | null;
}

/** Resolve a category's display name for a locale, falling back to English. */
export function localizedName(cat: Localizable, locale: Locale): string {
  const byLocale: Record<Locale, string | null> = {
    en: cat.nameEn,
    ar: cat.nameAr,
    fr: cat.nameFr,
  };
  return byLocale[locale] ?? cat.nameEn;
}

/** Idempotently upsert the full taxonomy. Safe to run repeatedly. */
export async function seedCategories(): Promise<void> {
  for (let p = 0; p < CATEGORY_SEED.length; p++) {
    const parentDef = CATEGORY_SEED[p];
    const parentSlug = slugify(parentDef.nameEn);
    const parent = await prisma.category.upsert({
      where: { slug: parentSlug },
      create: { slug: parentSlug, nameEn: parentDef.nameEn, sortOrder: p },
      update: { nameEn: parentDef.nameEn, sortOrder: p },
    });

    const children = parentDef.children ?? [];
    for (let c = 0; c < children.length; c++) {
      const childSlug = slugify(children[c]);
      await prisma.category.upsert({
        where: { slug: childSlug },
        create: {
          slug: childSlug,
          nameEn: children[c],
          parentId: parent.id,
          sortOrder: c,
        },
        update: { nameEn: children[c], parentId: parent.id, sortOrder: c },
      });
    }
  }
}

export interface CategoryNode {
  id: string;
  slug: string;
  name: string;
  children: { id: string; slug: string; name: string }[];
}

/** Return the taxonomy as a localized, ordered tree of parents with children. */
export async function listTree(locale: Locale): Promise<CategoryNode[]> {
  const parents = await prisma.category.findMany({
    where: { parentId: null },
    orderBy: { sortOrder: "asc" },
    include: { children: { orderBy: { sortOrder: "asc" } } },
  });

  return parents.map((parent) => ({
    id: parent.id,
    slug: parent.slug,
    name: localizedName(parent, locale),
    children: parent.children.map((child) => ({
      id: child.id,
      slug: child.slug,
      name: localizedName(child, locale),
    })),
  }));
}
