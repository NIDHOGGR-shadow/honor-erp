export function isStorefrontReviewEnabled(environment: {
  VERCEL_ENV?: string;
  NODE_ENV?: string;
} = { VERCEL_ENV: process.env.VERCEL_ENV, NODE_ENV: process.env.NODE_ENV }) {
  return environment.VERCEL_ENV !== "production" &&
    (environment.VERCEL_ENV === "preview" || environment.NODE_ENV === "development");
}
