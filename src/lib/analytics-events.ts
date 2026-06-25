// InteractionEvent.type is a free string column (no DB enum) — this
// constant map is the single source of truth so emitters (search,
// locations, favorites, reviews, boosts, password-auth) and the reader
// (services/analytics.ts) can't drift apart on a typo'd string.
export const ANALYTICS_EVENTS = {
  LOGIN: "LOGIN",
  SEARCH_PERFORMED: "SEARCH_PERFORMED",
  LOCATION_VIEWED: "LOCATION_VIEWED",
  FAVORITE_ADDED: "FAVORITE_ADDED",
  REVIEW_SUBMITTED: "REVIEW_SUBMITTED",
  BOOST_PURCHASED: "BOOST_PURCHASED",
} as const;
