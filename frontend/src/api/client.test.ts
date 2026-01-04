import { describe, it, expect } from "vitest";
import { ApiError, getErrorMessage } from "./client";

describe("ApiError", () => {
  it("should create an ApiError with all properties", () => {
    const error = new ApiError(
      "Test error message",
      "TEST_ERROR",
      400,
      { field: "value" }
    );

    expect(error.message).toBe("Test error message");
    expect(error.code).toBe("TEST_ERROR");
    expect(error.status).toBe(400);
    expect(error.details).toEqual({ field: "value" });
    expect(error.name).toBe("ApiError");
  });

  describe("isExternalServiceError", () => {
    it("should return true for EXTERNAL_SERVICE_ERROR code", () => {
      const error = new ApiError(
        "External service error",
        "EXTERNAL_SERVICE_ERROR",
        500
      );
      expect(error.isExternalServiceError()).toBe(true);
    });

    it("should return false for other error codes", () => {
      const error = new ApiError("Not found", "NOT_FOUND", 404);
      expect(error.isExternalServiceError()).toBe(false);
    });
  });

  describe("isNotFoundError", () => {
    it("should return true for NOT_FOUND code", () => {
      const error = new ApiError("Not found", "NOT_FOUND", 404);
      expect(error.isNotFoundError()).toBe(true);
    });

    it("should return false for other error codes", () => {
      const error = new ApiError("Validation error", "VALIDATION_ERROR", 400);
      expect(error.isNotFoundError()).toBe(false);
    });
  });

  describe("isValidationError", () => {
    it("should return true for VALIDATION_ERROR code", () => {
      const error = new ApiError(
        "Validation error",
        "VALIDATION_ERROR",
        400
      );
      expect(error.isValidationError()).toBe(true);
    });

    it("should return false for other error codes", () => {
      const error = new ApiError("Not found", "NOT_FOUND", 404);
      expect(error.isValidationError()).toBe(false);
    });
  });
});

// Note: Interceptor tests are omitted as they are difficult to test in isolation
// without extensive mocking. These are better covered by integration tests.

describe("getErrorMessage", () => {
  it("should extract message from ApiError", () => {
    const error = new ApiError("API error message", "TEST_ERROR", 400);
    expect(getErrorMessage(error)).toBe("API error message");
  });

  it("should extract message from standard Error", () => {
    const error = new Error("Standard error message");
    expect(getErrorMessage(error)).toBe("Standard error message");
  });

  it("should return default message for unknown error types", () => {
    const error = "string error";
    expect(getErrorMessage(error)).toBe("予期しないエラーが発生しました");
  });

  it("should return default message for null/undefined", () => {
    expect(getErrorMessage(null)).toBe("予期しないエラーが発生しました");
    expect(getErrorMessage(undefined)).toBe("予期しないエラーが発生しました");
  });

  it("should return default message for number", () => {
    expect(getErrorMessage(123)).toBe("予期しないエラーが発生しました");
  });

  it("should return default message for object without message", () => {
    expect(getErrorMessage({ foo: "bar" })).toBe(
      "予期しないエラーが発生しました"
    );
  });
});
