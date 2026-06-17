import { api } from "@/lib/api-client";
import type { PayoutChannel, Profile } from "@unitko/shared";

// The profile page edits payout channels as flat fields; the API models them as
// normalized rows. These two shapes are bridged here so the page stays flat.
export interface ProfileFormValues {
  full_name: string;
  phone: string;
  payment_bank_name: string;
  payment_account_name: string;
  payment_account_number: string;
  payment_gcash_number: string;
  payment_paymaya_number: string;
  payment_other_details: string;
}

export interface LoadedProfile {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  form: ProfileFormValues;
}

export async function fetchProfile(): Promise<LoadedProfile> {
  return toLoaded(await api.profile.get());
}

export async function saveProfile(
  form: ProfileFormValues,
): Promise<LoadedProfile> {
  const updated = await api.profile.update({
    fullName: form.full_name.trim() || null,
    phone: form.phone.trim() || null,
    payoutMethods: toPayoutMethods(form),
  });
  return toLoaded(updated);
}

function toLoaded(p: Profile): LoadedProfile {
  return {
    id: p.id,
    email: p.email,
    role: p.role,
    createdAt: p.createdAt,
    form: toForm(p),
  };
}

// Flatten the normalized channels into the page's form fields. The `bank`
// channel keeps the bank name in `details` (it has no dedicated column).
function toForm(p: Profile): ProfileFormValues {
  const find = (m: PayoutChannel["method"]) =>
    p.payoutMethods.find((c) => c.method === m);
  const bank = find("bank");
  const gcash = find("gcash");
  const paymaya = find("paymaya");
  const other = find("other");
  return {
    full_name: p.fullName ?? "",
    phone: p.phone ?? "",
    payment_bank_name: bank?.details ?? "",
    payment_account_name: bank?.accountName ?? "",
    payment_account_number: bank?.accountNumber ?? "",
    payment_gcash_number: gcash?.accountNumber ?? "",
    payment_paymaya_number: paymaya?.accountNumber ?? "",
    payment_other_details: other?.details ?? "",
  };
}

// Build the channel set from the flat form, dropping methods the landlord left
// blank so they're removed on save.
function toPayoutMethods(form: ProfileFormValues): PayoutChannel[] {
  const methods: PayoutChannel[] = [];
  const bankName = form.payment_bank_name.trim();
  const accountName = form.payment_account_name.trim();
  const accountNumber = form.payment_account_number.trim();
  if (bankName || accountName || accountNumber) {
    methods.push({
      method: "bank",
      accountName: accountName || null,
      accountNumber: accountNumber || null,
      details: bankName || null,
    });
  }
  const gcash = form.payment_gcash_number.trim();
  if (gcash) {
    methods.push({
      method: "gcash",
      accountName: null,
      accountNumber: gcash,
      details: null,
    });
  }
  const paymaya = form.payment_paymaya_number.trim();
  if (paymaya) {
    methods.push({
      method: "paymaya",
      accountName: null,
      accountNumber: paymaya,
      details: null,
    });
  }
  const other = form.payment_other_details.trim();
  if (other) {
    methods.push({
      method: "other",
      accountName: null,
      accountNumber: null,
      details: other,
    });
  }
  return methods;
}
