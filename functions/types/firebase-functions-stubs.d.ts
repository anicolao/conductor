declare module "firebase-functions/v2/https" {
	export const onRequest: (options: unknown, handler: unknown) => unknown;
}

declare module "firebase-functions/v2/scheduler" {
	export const onSchedule: (
		options: string | unknown,
		handler: unknown,
	) => unknown;
}

declare module "firebase-functions/logger" {
	interface Logger {
		info: (message: string, ...args: unknown[]) => void;
		warn: (message: string, ...args: unknown[]) => void;
		error: (message: string, ...args: unknown[]) => void;
		debug: (message: string, ...args: unknown[]) => void;
	}
	const logger: Logger;
	export = logger;
}

declare module "firebase-functions/params" {
	export const defineSecret: (name: string) => { value: () => string };
}
