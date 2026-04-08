const CONTRACTS = {
  mainnet: {
    SBTC_TOKEN: "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token",
  },
  testnet: {
    SBTC_TOKEN: "ST000000000000000000002AMW42H.sbtc-token",
  },
};

export function getContracts(network = "mainnet") {
  return CONTRACTS[network] ?? CONTRACTS.testnet;
}

export function parseContractId(contractId) {
  const dotIndex = contractId.indexOf(".");
  if (dotIndex === -1) {
    throw new Error(`Invalid contract id: ${contractId}`);
  }
  return {
    address: contractId.slice(0, dotIndex),
    name: contractId.slice(dotIndex + 1),
  };
}
