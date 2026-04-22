/**
 * Removes null bytes from a string to prevent errors when passing as command line arguments.
 * Node.js child_process functions (like spawn, spawnSync, exec) will throw an error
 * if any argument contains a null byte (\u0000).
 */
export function sanitize(str: string): string {
	return str.replace(/\0/g, "");
}
