// src/services/gaService.js
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:7000";

export async function runGa(payload) {
  const res = await fetch(`${API_BASE_URL}/api/run-ga`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed: ${res.status} - ${text}`);
  }

  return res.json(); // MSTResult
}
