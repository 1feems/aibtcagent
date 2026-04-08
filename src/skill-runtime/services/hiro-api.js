import { getApiBaseUrl } from "../config/networks.js";

async function getJson(url) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Hiro API request failed (${response.status}): ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

export function getHiroApi(network) {
  const baseUrl = getApiBaseUrl(network);
  return {
    async getAccountInfo(address) {
      return getJson(`${baseUrl}/v2/accounts/${address}?proof=0`);
    },
  };
}

export async function getStxBalance(address, network) {
  const baseUrl = getApiBaseUrl(network);
  const data = await getJson(`${baseUrl}/extended/v1/address/${address}/balances`);
  return {
    stx: data.stx?.balance ?? "0",
    stxLocked: data.stx?.locked ?? "0",
  };
}
