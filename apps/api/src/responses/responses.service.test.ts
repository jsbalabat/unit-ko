import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { CreateTenantResponseInput } from "@unitko/shared";
import {
  ResponsesRepository,
  type TenantResponseView,
} from "./responses.repository";
import { ResponsesService } from "./responses.service";

const stub = <T extends object>(impl: Partial<T>): T => impl as T;

const view = (over: Partial<TenantResponseView> = {}): TenantResponseView => ({
  id: "resp1",
  billing_entry_id: "entry1",
  response_type_code: "acknowledged",
  response_type_label: "Acknowledged",
  note: null,
  created_at: "2026-07-15T09:00:00.000Z",
  confirmed_at: null,
  due_date: "2026-07-01",
  tenant_name: "Ana Cruz",
  property_name: "Unit 1",
  landlord_id: "landlord1",
  ...over,
});

describe("ResponsesService.createForTenant", () => {
  const input: CreateTenantResponseInput = {
    billingEntryId: "entry1",
    responseType: "acknowledged",
    note: "noted",
  };

  it("creates a response and returns it when the tenant owns the bill", async () => {
    const create = vi
      .fn<ResponsesRepository["create"]>()
      .mockResolvedValue("resp1");
    const findById = vi
      .fn<ResponsesRepository["findById"]>()
      .mockResolvedValue(view());
    const service = new ResponsesService(
      stub<ResponsesRepository>({
        findEntryTenant: vi
          .fn<ResponsesRepository["findEntryTenant"]>()
          .mockResolvedValue("tenant1"),
        create,
        findById,
      }),
    );

    const result = await service.createForTenant("tenant1", input);

    expect(create).toHaveBeenCalledWith({
      billingEntryId: "entry1",
      tenantId: "tenant1",
      responseType: "acknowledged",
      note: "noted",
    });
    expect(findById).toHaveBeenCalledWith("resp1");
    expect(result).toMatchObject({
      id: "resp1",
      billingEntryId: "entry1",
      responseType: "acknowledged",
      responseTypeLabel: "Acknowledged",
    });
  });

  it("rejects with 404 when the bill belongs to another tenant, without creating", async () => {
    const create = vi.fn<ResponsesRepository["create"]>();
    const service = new ResponsesService(
      stub<ResponsesRepository>({
        findEntryTenant: vi
          .fn<ResponsesRepository["findEntryTenant"]>()
          .mockResolvedValue("otherTenant"),
        create,
      }),
    );

    await expect(
      service.createForTenant("tenant1", input),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects with 404 when the bill doesn't exist", async () => {
    const service = new ResponsesService(
      stub<ResponsesRepository>({
        findEntryTenant: vi
          .fn<ResponsesRepository["findEntryTenant"]>()
          .mockResolvedValue(null),
      }),
    );

    await expect(
      service.createForTenant("tenant1", input),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("ResponsesService.listForTenant", () => {
  it("maps rows to DTOs, dropping null-id rows, and clamps the limit", async () => {
    const findByTenant = vi
      .fn<ResponsesRepository["findByTenant"]>()
      .mockResolvedValue([view({ id: "resp1" }), view({ id: null })]);
    const service = new ResponsesService(
      stub<ResponsesRepository>({ findByTenant }),
    );

    const result = await service.listForTenant("tenant1", 100);

    expect(findByTenant).toHaveBeenCalledWith("tenant1", 50);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("resp1");
  });

  it("defaults the limit to 10 when unspecified", async () => {
    const findByTenant = vi
      .fn<ResponsesRepository["findByTenant"]>()
      .mockResolvedValue([]);
    const service = new ResponsesService(
      stub<ResponsesRepository>({ findByTenant }),
    );

    await service.listForTenant("tenant1");

    expect(findByTenant).toHaveBeenCalledWith("tenant1", 10);
  });
});

describe("ResponsesService.listForLandlord", () => {
  it("falls back to 'acknowledged' for an unrecognized response type", async () => {
    const service = new ResponsesService(
      stub<ResponsesRepository>({
        findByLandlord: vi
          .fn<ResponsesRepository["findByLandlord"]>()
          .mockResolvedValue([
            view({ response_type_code: "bogus", response_type_label: null }),
          ]),
      }),
    );

    const result = await service.listForLandlord("landlord1");

    expect(result[0]?.responseType).toBe("acknowledged");
    expect(result[0]?.responseTypeLabel).toBe("");
  });
});

describe("ResponsesService.confirmForLandlord", () => {
  it("confirms and returns the updated response when the landlord owns it", async () => {
    const confirm = vi
      .fn<ResponsesRepository["confirm"]>()
      .mockResolvedValue(undefined);
    const findById = vi
      .fn<ResponsesRepository["findById"]>()
      .mockResolvedValueOnce(view({ confirmed_at: null }))
      .mockResolvedValueOnce(view({ confirmed_at: "2026-07-15T10:00:00.000Z" }));
    const service = new ResponsesService(
      stub<ResponsesRepository>({ confirm, findById }),
    );

    const result = await service.confirmForLandlord("landlord1", "resp1");

    expect(confirm).toHaveBeenCalledWith(
      "resp1",
      "landlord1",
      expect.any(String),
    );
    expect(result.confirmedAt).toBe("2026-07-15T10:00:00.000Z");
  });

  it("rejects with 404 when the response isn't the landlord's, without confirming", async () => {
    const confirm = vi.fn<ResponsesRepository["confirm"]>();
    const service = new ResponsesService(
      stub<ResponsesRepository>({
        findById: vi
          .fn<ResponsesRepository["findById"]>()
          .mockResolvedValue(view({ landlord_id: "otherLandlord" })),
        confirm,
      }),
    );

    await expect(
      service.confirmForLandlord("landlord1", "resp1"),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("rejects with 404 when the response doesn't exist", async () => {
    const service = new ResponsesService(
      stub<ResponsesRepository>({
        findById: vi
          .fn<ResponsesRepository["findById"]>()
          .mockResolvedValue(null),
      }),
    );

    await expect(
      service.confirmForLandlord("landlord1", "missing"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
