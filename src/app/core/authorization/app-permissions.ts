export const AppPermissions = {
  customersRead: 'customers.read',
  customersWrite: 'customers.write'
} as const;

export type AppPermission = (typeof AppPermissions)[keyof typeof AppPermissions];
