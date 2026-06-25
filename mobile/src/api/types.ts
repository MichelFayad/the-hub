// DTOs mirroring src/app/api/mobile/* response shapes on the Next web app
// (../../src/services/*). Kept as a thin, explicit duplicate rather than a
// shared package — Metro (RN bundler) can't resolve outside this project's
// root without extra config, and these are just wire-format DTOs, not
// business logic, so the duplication cost is low.

export type AppRole = "SUPER_ADMIN" | "ADMIN" | "USER" | "AGENCY" | "BUSINESS_OWNER";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: AppRole;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface SearchResult {
  id: string;
  name: string;
  ratingAvg: number | null;
  priceLevel: number | null;
  distanceMeters: number | null;
}

export interface LocationProfile {
  id: string;
  name: string;
  description: string | null;
  status: string;
  primaryCategory: { slug: string; name: string };
  secondaryCategories: { slug: string; name: string }[];
  tags: string[];
  latitude: number | null;
  longitude: number | null;
  hours: unknown;
  googleMapsUrl: string | null;
  website: string | null;
  phoneNumber: string | null;
  phoneVerified: boolean;
  media: { url: string; type: string }[];
}

export interface Favorite {
  id: string;
  userId: string;
  locationId: string;
  createdAt: string;
  location: LocationProfile;
}

export interface PublicReview {
  id: string;
  rating: number;
  text: string | null;
  likesCount: number;
  dislikesCount: number;
  createdAt: string;
  author: { id: string; displayName: string; reviewerScore: number };
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface Preferences {
  userId: string;
  interestCategoryIds: string[];
  budgetMax: number | null;
  companions: string[];
  travelScope: string | null;
  dietary: string[];
  accessibility: string[];
  frequency: string | null;
  preferredLocale: string | null;
}

export interface Recommendation {
  id: string;
  name: string;
  primaryCategoryId: string;
  ratingAvg: number | null;
  priceLevel: number | null;
}
