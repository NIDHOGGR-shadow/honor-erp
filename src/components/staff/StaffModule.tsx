import React, { useState } from "react";
import { Plus, ShieldCheck, X, Users, Search } from "lucide-react";
import { useApp } from "../../context/AppContext";
import type { Staff, UserRole } from "../../types";

const ROLE_NAMES: Record<UserRole, string> = {
  OWNER: "Company administrator",
  MANAGER: "Branch manager",
  INVENTORY: "Stock operator",
  SALES: "Sales staff",
};
const CAPABILITIES = [
  [
    "View inventory & stock history",
    "All assigned locations",
    "Assigned locations",
    "Assigned locations",
    "Assigned locations",
  ],
  ["Receive stock & move inventory", "Yes", "Yes", "Yes", "No"],
  [
    "Approve stock adjustments",
    "Yes",
    "Within assigned locations",
    "Request only",
    "No",
  ],
  ["Record sales", "Yes", "Yes", "No", "Yes"],
  ["See costs & stock value", "Yes", "Yes", "No", "No"],
  ["Manage people, roles & company settings", "Yes", "No", "No", "No"],
];
export const StaffModule: React.FC = () => {
  const { staffList, activeStaff, locations, addStaff, updateStaff } = useApp();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Staff | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const create = () => {
    setError("");
    setEditing({
      id: "",
      name: "",
      email: "",
      phone: "",
      role: "INVENTORY",
      assignedLocationIds: [locations[0]?.id || ""],
      status: "ACTIVE",
      pin: "",
    });
  };
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing || activeStaff.role !== "OWNER") return;
    if (!editing.assignedLocationIds.length) {
      setError("Assign at least one location.");
      return;
    }
    if (
      staffList.some(
        (s) =>
          s.email.toLowerCase() === editing.email.toLowerCase() &&
          s.id !== editing.id,
      )
    ) {
      setError("That email is already in the staff directory.");
      return;
    }
    const value = {
      ...editing,
      id: editing.id || `staff-${crypto.randomUUID()}`,
    };
    if (
      value.id === activeStaff.id &&
      (value.role !== "OWNER" || value.status !== "ACTIVE")
    ) {
      setError("The active company administrator must remain active.");
      return;
    }
    try {
      editing.id ? updateStaff(value) : addStaff(value);
      setMessage("Demo staff access saved in this browser.");
      setEditing(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const visible = staffList.filter((s) =>
    `${s.name} ${s.email} ${ROLE_NAMES[s.role]}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="honor-eyebrow mb-2">Company administration</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            People & access
          </h1>
          <p className="mt-3 text-sm text-zinc-500">
            The company administrator assigns each person a role and permitted
            locations.
          </p>
        </div>
        <button className="honor-button" onClick={create}>
          <Plus className="h-4 w-4" />
          Add demo staff
        </button>
      </header>
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        <ShieldCheck className="mt-1 h-5 w-5 shrink-0" />
        <p>
          This preview demonstrates access rules. Staff invitations, sign-in and
          enforcement on the server are part of the connected workspace
          implementation. No invitation email is sent here.
        </p>
      </div>
      {message && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          {message}
        </p>
      )}
      <section className="honor-panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 p-6">
          <h2 className="flex items-center gap-2 font-semibold">
            <Users className="h-4 w-4 text-zinc-400" />
            Staff directory{" "}
            <span className="text-sm font-normal text-zinc-400">
              {staffList.length}
            </span>
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
            <input
              aria-label="Search staff"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, role or email"
              className="min-h-10 rounded-lg border border-zinc-200 pl-9 pr-3 text-sm"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-y border-zinc-100 bg-zinc-50 text-xs text-zinc-500">
              <tr>
                {["Team member", "Role", "Locations", "Status", ""].map(
                  (h, i) => (
                    <th key={i} scope="col" className="px-6 py-4 font-medium">
                      {h || <span className="sr-only">Edit access</span>}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {visible.map((s) => (
                <tr key={s.id}>
                  <td className="px-6 py-5">
                    <p className="font-medium">
                      {s.name}
                      {s.id === activeStaff.id && (
                        <span className="ml-2 text-xs text-emerald-700">
                          You
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">{s.email}</p>
                  </td>
                  <td className="px-6 py-5">{ROLE_NAMES[s.role]}</td>
                  <td className="max-w-64 px-6 py-5 text-xs leading-5 text-zinc-500">
                    {s.assignedLocationIds.includes("*")
                      ? "All company locations"
                      : s.assignedLocationIds
                          .map(
                            (id) =>
                              locations.find((l) => l.id === id)?.name || id,
                          )
                          .join(", ")}
                  </td>
                  <td className="px-6 py-5">
                    <span
                      className={`rounded-md px-2 py-1 text-xs ${s.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}
                    >
                      {s.status === "ACTIVE" ? "Active" : "Suspended"}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <button
                      className="honor-text-button whitespace-nowrap"
                      onClick={() => {
                        setError("");
                        setEditing({
                          ...s,
                          assignedLocationIds: [...s.assignedLocationIds],
                        });
                      }}
                      aria-label={`Edit access for ${s.name}`}
                    >
                      Edit access
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 && (
            <p className="p-8 text-sm text-zinc-500">
              {staffList.length ? "No staff match your search." : "No staff assigned yet. Your administrator controls who joins Honor."}
            </p>
          )}
        </div>
      </section>
      <section className="honor-panel overflow-hidden">
        <div className="p-6">
          <h2 className="font-semibold">Role responsibilities</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Location scope applies to every permission. Production rules are
            checked by the API.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-xs">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                {["Capability", ...Object.values(ROLE_NAMES)].map((h) => (
                  <th key={h} className="px-6 py-4 font-medium" scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {CAPABILITIES.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, i) => (
                    <td
                      key={i}
                      className={`px-6 py-4 leading-5 ${i === 0 ? "font-medium" : "text-zinc-500"}`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {editing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="staff-title"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-zinc-950/50 p-4"
        >
          <form
            onSubmit={save}
            className="honor-panel my-auto w-full max-w-lg p-6"
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 id="staff-title" className="text-lg font-semibold">
                {editing.id ? "Edit staff access" : "Add demo staff"}
              </h2>
              <button
                type="button"
                aria-label="Close staff form"
                onClick={() => setEditing(null)}
                className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              {(["name", "email"] as const).map((key) => (
                <label
                  key={key}
                  className="block text-sm font-medium capitalize"
                >
                  {key}
                  <input
                    autoFocus={key === "name"}
                    type={key === "email" ? "email" : "text"}
                    required
                    value={editing[key]}
                    onChange={(e) =>
                      setEditing({ ...editing, [key]: e.target.value })
                    }
                    className="mt-2 min-h-11 w-full rounded-lg border border-zinc-200 px-3 text-sm"
                  />
                </label>
              ))}
              <label className="block text-sm font-medium">
                Role
                <select
                  value={editing.role}
                  onChange={(e) =>
                    setEditing({ ...editing, role: e.target.value as UserRole })
                  }
                  className="mt-2 min-h-11 w-full rounded-lg border border-zinc-200 px-3"
                >
                  {Object.entries(ROLE_NAMES).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset>
                <legend className="mb-2 text-sm font-medium">
                  Permitted locations
                </legend>
                <div className="space-y-3">
                  {[
                    { id: "*", name: "All company locations" },
                    ...locations,
                  ].map((l) => (
                    <label
                      key={l.id}
                      className="flex items-center gap-3 text-sm text-zinc-600"
                    >
                      <input
                        type="checkbox"
                        checked={editing.assignedLocationIds.includes(l.id)}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            assignedLocationIds:
                              l.id === "*"
                                ? e.target.checked
                                  ? ["*"]
                                  : []
                                : e.target.checked
                                  ? [
                                      ...editing.assignedLocationIds.filter(
                                        (id) => id !== "*",
                                      ),
                                      l.id,
                                    ]
                                  : editing.assignedLocationIds.filter(
                                      (id) => id !== l.id,
                                    ),
                          })
                        }
                      />
                      {l.name}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="block text-sm font-medium">
                Status
                <select
                  value={editing.status}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      status: e.target.value as Staff["status"],
                    })
                  }
                  className="mt-2 min-h-11 w-full rounded-lg border border-zinc-200 px-3"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Suspended</option>
                </select>
              </label>
              {error && (
                <p role="alert" className="text-sm text-rose-700">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-3 border-t border-zinc-100 pt-5">
                <button
                  type="button"
                  className="px-4 text-sm text-zinc-500"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </button>
                <button className="honor-button" type="submit">
                  Save demo access
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
