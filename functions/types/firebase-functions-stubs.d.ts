declare module "firebase-functions/v2/https" {
  export const onRequest: any;
}

declare module "firebase-functions/v2/scheduler" {
  export const onSchedule: any;
}

declare module "firebase-functions/logger" {
  const logger: any;
  export = logger;
}

declare module "firebase-functions/params" {
  export const defineSecret: any;
}
