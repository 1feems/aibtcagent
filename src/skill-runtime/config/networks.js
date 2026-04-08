import {
  STACKS_MAINNET,
  STACKS_TESTNET,
  TransactionVersion,
} from "@stacks/network";

export const NETWORK = process.env.NETWORK === "mainnet" ? "mainnet" : "testnet";
export const API_URL = process.env.API_URL ?? "https://x402.biwas.xyz";

export function getApiBaseUrl(network = NETWORK) {
  return network === "mainnet" ? "https://api.hiro.so" : "https://api.testnet.hiro.so";
}

export function getStacksNetwork(network = NETWORK) {
  return network === "mainnet" ? STACKS_MAINNET : STACKS_TESTNET;
}

export function getExplorerTxUrl(txid, network = NETWORK) {
  const suffix = network === "mainnet" ? "?chain=mainnet" : "?chain=testnet";
  return `https://explorer.hiro.so/txid/${txid}${suffix}`;
}

export function getExplorerAddressUrl(address, network = NETWORK) {
  const suffix = network === "mainnet" ? "?chain=mainnet" : "?chain=testnet";
  return `https://explorer.hiro.so/address/${address}${suffix}`;
}

export function getTransactionVersion(network = NETWORK) {
  return network === "mainnet" ? TransactionVersion.Mainnet : TransactionVersion.Testnet;
}
