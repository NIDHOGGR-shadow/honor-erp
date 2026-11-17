import { redirect } from "next/navigation";

/**
 * Convenience entry for the existing authenticated staff workspace.
 * Actual staff/company permissions are enforced by the workspace and API.
 * This route intentionally does not implement a separate admin login.
 */
export default function AdminEntry() {
  redirect("/workspace");
}
