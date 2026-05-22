import { describe, expect, it } from "vitest";
import {
  buildReservationPayload,
  resolveNoTourPackageLabel,
  type ReservationFormState,
} from "@/lib/reservations/admin-reservations";

function makeBaseForm(overrides: Partial<ReservationFormState> = {}): ReservationFormState {
  return {
    id: null,
    reservationNo: "RSV-2026-00010",
    reservationDate: "2026-05-22",
    status: "DRAFT",
    ownerType: "AGENCY",
    agencyId: "5",
    customerId: "",
    bookingMode: "WITH_TOUR_PACKAGE",
    tourPackageId: "12",
    currencyId: "2",
    ...overrides,
  };
}

describe("admin reservation payload builder", () => {
  it("creates reservation without tour package for NORMAL customer", () => {
    const payload = buildReservationPayload(
      makeBaseForm({
        ownerType: "NORMAL",
        customerId: "42",
        agencyId: "",
        bookingMode: "STANDALONE_SERVICES",
        tourPackageId: "",
      })
    );

    expect(payload.tour_package).toBeNull();
    expect(payload.customer).toBe(42);
    expect(payload.user).toBe(42);
    expect(payload.agency).toBeNull();
  });

  it("creates reservation without tour package for AGENCY customer", () => {
    const payload = buildReservationPayload(
      makeBaseForm({
        ownerType: "AGENCY",
        agencyId: "11",
        bookingMode: "STANDALONE_SERVICES",
        tourPackageId: "",
      })
    );

    expect(payload.tour_package).toBeNull();
    expect(payload.agency).toBe(11);
    expect(payload.customer).toBeNull();
  });

  it("shows no tour package label when reservation has none", () => {
    expect(resolveNoTourPackageLabel("")).toBe("No tour package");
    expect(resolveNoTourPackageLabel(null)).toBe("No tour package");
  });

  it("supports hotel-only standalone reservation payload", () => {
    const payload = buildReservationPayload(
      makeBaseForm({
        ownerType: "AGENCY",
        agencyId: "7",
        bookingMode: "STANDALONE_SERVICES",
        tourPackageId: "",
      })
    );

    expect(payload.tour_package).toBeNull();
    expect(payload.agency).toBe(7);
  });

  it("supports transfer-only standalone reservation payload", () => {
    const payload = buildReservationPayload(
      makeBaseForm({
        ownerType: "NORMAL",
        customerId: "9",
        bookingMode: "STANDALONE_SERVICES",
        tourPackageId: "",
      })
    );

    expect(payload.tour_package).toBeNull();
    expect(payload.customer).toBe(9);
  });

  it("keeps reservation with tour package working", () => {
    const payload = buildReservationPayload(
      makeBaseForm({
        bookingMode: "WITH_TOUR_PACKAGE",
        tourPackageId: "18",
      })
    );

    expect(payload.tour_package).toBe(18);
    expect(payload.agency).toBe(5);
  });
});
