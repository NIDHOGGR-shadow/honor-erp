export interface BusinessProfile {
  name: string;
  rcNumber: string;
  tin: string;
  address: string;
  receiptHeader: string;
  receiptFooter: string;
  warrantyNotice: string;
}
export const BUSINESS_KEY = "honor_preview_empty_v1_business";
const defaults: BusinessProfile = {
  name: "Honor",
  rcNumber: "",
  tin: "",
  address: "",
  receiptHeader: "HONOR",
  receiptFooter: "Thank you for your purchase.",
  warrantyNotice: "Warranty terms are shown on your product receipt.",
};
export function loadBusinessProfile(): BusinessProfile {
  try {
    const value = JSON.parse(localStorage.getItem(BUSINESS_KEY) || "{}");
    return Object.fromEntries(
      Object.entries(defaults).map(([key, fallback]) => [
        key,
        typeof value[key] === "string" ? value[key] : fallback,
      ]),
    ) as unknown as BusinessProfile;
  } catch {
    return { ...defaults };
  }
}
export function saveBusinessProfile(profile: BusinessProfile): void {
  localStorage.setItem(BUSINESS_KEY, JSON.stringify(profile));
}
