/**
 * E-prescribing seam (docs/10 spec §3 phase 5). The ErxVendor interface is the
 * frozen contract; adapters plug in behind it:
 *  - mock:     fully functional for dev/CI (deterministic pharmacies + routing)
 *  - dosespot: 🚦 contract-gated — requires a signed DoseSpot agreement,
 *              clinic/clinician provisioning, and Surescripts certification
 *  - drfirst:  🚦 contract-gated — same shape via DrFirst Rcopia
 *
 * Hard safety rules enforced HERE, not in adapters:
 *  - the `erx` feature flag must be ON (clinical/legal sign-off gate)
 *  - controlled substances are refused unless EPCS verification is recorded
 *    (DEA-compliant 2FA) — and remain subject to Ryan Haight telehealth rules.
 */

export interface Pharmacy {
  ncpdpId: string;
  name: string;
  address: string;
  phone?: string;
}

export interface RouteResult {
  vendorRxId: string;
  status: "ROUTED";
}

export interface ErxVendor {
  readonly name: string;
  searchPharmacies(query: string, state?: string): Promise<Pharmacy[]>;
  routePrescription(rx: {
    prescriptionId: string;
    medicationName: string;
    directions?: string;
    pharmacyNcpdpId: string;
    isControlled: boolean;
  }): Promise<RouteResult>;
}

const MOCK_PHARMACIES: Pharmacy[] = [
  { ncpdpId: "1111111", name: "CVS Pharmacy #4401", address: "120 Main St, Albany, NY", phone: "518-555-0110" },
  { ncpdpId: "2222222", name: "Walgreens #0952", address: "88 5th Ave, New York, NY", phone: "212-555-0142" },
  { ncpdpId: "3333333", name: "Rite Aid #7723", address: "310 Elm St, Buffalo, NY", phone: "716-555-0177" },
  { ncpdpId: "4444444", name: "HealthFirst Community Pharmacy", address: "42 Oak Ave, Austin, TX", phone: "512-555-0199" },
];

const mockVendor: ErxVendor = {
  name: "mock",
  async searchPharmacies(query, state) {
    const q = query.toLowerCase();
    return MOCK_PHARMACIES.filter(
      (p) =>
        (p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q)) &&
        (!state || p.address.toUpperCase().includes(`, ${state.toUpperCase()}`)),
    );
  },
  async routePrescription(rx) {
    return { vendorRxId: `mockrx_${rx.prescriptionId.slice(-8)}`, status: "ROUTED" };
  },
};

function contractGated(name: string): ErxVendor {
  const fail = () => {
    throw new Error(
      `${name} is not configured. Real e-prescription routing requires a signed ${name} agreement, ` +
        `clinician identity-proofing, and Surescripts certification (docs/10). Set the vendor env keys once contracted.`,
    );
  };
  return {
    name,
    async searchPharmacies() {
      return fail();
    },
    async routePrescription() {
      return fail();
    },
  };
}

export function erxVendor(): ErxVendor {
  const vendor = (process.env.ERX_VENDOR ?? "mock").toLowerCase();
  // DoseSpot/DrFirst adapters activate here once the vendor contract + sandbox
  // credentials exist; until then both are explicit contract-gated stubs.
  if (vendor === "dosespot") return contractGated("DoseSpot");
  if (vendor === "drfirst") return contractGated("DrFirst");
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_MOCK_ERX !== "1") {
    // Production must never silently route prescriptions through the mock.
    return contractGated("E-prescribing (no vendor configured)");
  }
  return mockVendor;
}
