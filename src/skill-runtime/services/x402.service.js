import { NETWORK } from "../config/networks.js";
import { deriveAccountFromMnemonic, getWalletManager } from "./wallet-manager.js";

export async function getAccount() {
  if (process.env.CLIENT_MNEMONIC) {
    return {
      ...deriveAccountFromMnemonic(process.env.CLIENT_MNEMONIC, NETWORK),
      network: NETWORK,
    };
  }

  const walletManager = getWalletManager();
  const session = walletManager.getSessionInfo();
  if (!session) {
    throw new Error("Wallet is locked");
  }

  return {
    address: session.address,
    btcAddress: session.btcAddress,
    taprootAddress: session.taprootAddress,
    privateKey: session.privateKey,
    network: session.network,
  };
}

export async function getWalletAddress() {
  return (await getAccount()).address;
}
