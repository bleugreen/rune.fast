// The identity of an account name: case-blind, with runs of spaces and underscores folded to one
// underscore. "Helper One", "helper_one" and " HELPER  one " are the same account.
export function canonicalAccountName(name: string): string {
    return name.trim().toLowerCase().replace(/[\s_]+/g, "_");
}
