export type VendorBank = { accountName: string | null; bankName: string | null; ifsc: string | null; accountNumber: string | null; masked: boolean };
export type Vendor = {
  id: string; code: string | null; name: string; contactPerson: string | null; phone: string | null; email: string | null; gstin: string | null; pan: string | null;
  address: string | null; city: string | null; state: string | null; paymentTerms: string | null; category: string | null; materials: string[]; bank: VendorBank | null; isActive: boolean;
};
export type VendorInput = {
  name: string; contactPerson?: string; phone?: string; email?: string; gstin?: string; pan?: string; address?: string; city?: string; state?: string;
  paymentTerms?: string; category?: string; materials?: string[]; bank?: { accountName?: string; bankName?: string; ifsc?: string; accountNumber?: string };
};
