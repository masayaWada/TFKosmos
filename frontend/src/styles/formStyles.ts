import { CSSProperties } from "react";

export const formStyles = {
  container: {
    maxWidth: "800px",
  } as CSSProperties,

  fieldGroup: {
    marginBottom: "1rem",
  } as CSSProperties,

  label: {
    display: "block",
    marginBottom: "0.5rem",
    fontWeight: "bold",
  } as CSSProperties,

  input: {
    width: "100%",
    padding: "0.5rem",
    border: "1px solid #ddd",
    borderRadius: "4px",
  } as CSSProperties,

  select: {
    width: "100%",
    padding: "0.5rem",
    border: "1px solid #ddd",
    borderRadius: "4px",
  } as CSSProperties,

  checkbox: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  } as CSSProperties,

  checkboxGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  } as CSSProperties,

  button: {
    padding: "0.75rem 1.5rem",
    backgroundColor: "#28a745",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  } as CSSProperties,

  buttonDisabled: {
    cursor: "not-allowed",
    opacity: 0.6,
  } as CSSProperties,

  progressBar: {
    width: "100%",
    backgroundColor: "#e0e0e0",
    borderRadius: "4px",
    height: "24px",
    marginBottom: "0.5rem",
    overflow: "hidden",
  } as CSSProperties,

  progressFill: {
    backgroundColor: "#28a745",
    height: "100%",
    transition: "width 0.3s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontSize: "12px",
    fontWeight: "bold",
  } as CSSProperties,

  progressMessage: {
    textAlign: "center",
    color: "#666",
    fontSize: "14px",
    marginTop: "0.5rem",
  } as CSSProperties,

  loading: {
    padding: "0.5rem",
    color: "#666",
  } as CSSProperties,
} as const;
