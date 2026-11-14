export type Vendor = { id: string; name: string; contactPerson: string | null; phone: string | null; email: string | null; gstin: string | null; address: string | null; isActive: boolean };
export type VendorInput = { name: string; contactPerson?: string; phone?: string; email?: string; gstin?: string; address?: string };
