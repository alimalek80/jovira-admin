import { describe, expect, it } from "vitest";
import { buildTransferServiceInput } from "@/lib/api/reservation-services";

describe("reservation service payload builders", () => {
  it("creates hotel-only compatible reservation flow by allowing standalone transfer payload with null tour package", () => {
    const payload = buildTransferServiceInput({
      reservationId: 9,
      tourPackageId: "",
      values: {
        service_name: "Airport pickup",
        service_date: "2026-02-01",
        on_arrival: true,
        on_departure: false,
        from_location_type: "AIRPORT",
        from_location_name: "IST",
        to_location_type: "HOTEL",
        to_location_name: "Downtown Hotel",
        price: "40.00",
        currency: "1",
        passengers: [12],
        external_note: "",
        driver_note: "",
      },
    });

    expect(payload.reservation).toBe(9);
    expect(payload.tour_package).toBeNull();
  });

  it("creates transfer-only payload without tour package", () => {
    const payload = buildTransferServiceInput({
      reservationId: 22,
      values: {
        service_name: "Hotel to airport",
        service_date: "2026-03-15",
        on_arrival: false,
        on_departure: true,
        from_location_type: "HOTEL",
        from_location_name: "Beach Hotel",
        to_location_type: "AIRPORT",
        to_location_name: "AYT",
        price: "30.00",
        currency: "2",
        passengers: [100, 101],
        external_note: "night transfer",
        driver_note: "gate B",
      },
    });

    expect(payload.tour_package).toBeNull();
    expect(payload.passengers).toEqual([100, 101]);
  });
});
