import { createHash, createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from "node:crypto";
import { rmSync, readFileSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { HDKey } from "@scure/bip32";
import { p2tr, p2wpkh } from "@scure/btc-signer";
import { compressPrivateKey, getAddressFromPrivateKey } from "@stacks/transactions";
import { getTransactionVersion, NETWORK } from "../config/networks.js";

const AIBTC_DIR = join(homedir(), ".aibtc");
const WALLETS_DIR = join(AIBTC_DIR, "wallets");
const WALLETS_INDEX = join(AIBTC_DIR, "wallets.json");
const CONFIG_PATH = join(AIBTC_DIR, "config.json");
const SESSION_PATH = join(AIBTC_DIR, "session.json");
const DEFAULT_TIMEOUT_MINUTES = 30;

function deriveKey(password, saltHex) {
  return pbkdf2Sync(password, Buffer.from(saltHex, "hex"), 210000, 32, "sha256");
}

function encryptText(value, password) {
  const salt = randomBytes(16).toString("hex");
  const iv = randomBytes(12).toString("hex");
  const cipher = createCipheriv("aes-256-gcm", deriveKey(password, salt), Buffer.from(iv, "hex"));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    salt,
    iv,
    tag: cipher.getAuthTag().toString("hex"),
    ciphertext: ciphertext.toString("hex"),
  };
}

function decryptText(bundle, password) {
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      deriveKey(password, bundle.salt),
      Buffer.from(bundle.iv, "hex")
    );
    decipher.setAuthTag(Buffer.from(bundle.tag, "hex"));
    return Buffer.concat([
      decipher.update(Buffer.from(bundle.ciphertext, "hex")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Invalid password");
  }
}

async function ensureStore() {
  await mkdir(WALLETS_DIR, { recursive: true, mode: 0o700 });
  try {
    await readFile(WALLETS_INDEX, "utf8");
  } catch {
    await writeFile(WALLETS_INDEX, JSON.stringify({ version: 1, wallets: [] }, null, 2), {
      mode: 0o600,
    });
  }
  try {
    await readFile(CONFIG_PATH, "utf8");
  } catch {
    await writeFile(
      CONFIG_PATH,
      JSON.stringify(
        { version: 1, activeWalletId: null, autoLockMinutes: DEFAULT_TIMEOUT_MINUTES },
        null,
        2
      ),
      { mode: 0o600 }
    );
  }
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await mkdir(join(filePath, ".."), { recursive: true }).catch(() => {});
  await writeFile(filePath, JSON.stringify(value, null, 2), { mode: 0o600 });
}

function walletPath(walletId) {
  return join(WALLETS_DIR, `${walletId}.json`);
}

function deriveAccountFromMnemonicInternal(mnemonic, network) {
  const seed = mnemonicToSeedSync(mnemonic);
  const root = HDKey.fromMasterSeed(seed);
  const coinType = network === "mainnet" ? 0 : 1;
  const stacksNode = root.derive("m/44'/5757'/0'/0/0");
  const btcNode = root.derive(`m/84'/${coinType}'/0'/0/0`);
  const taprootNode = root.derive(`m/86'/${coinType}'/0'/0/0`);

  if (!stacksNode.privateKey || !btcNode.publicKey || !taprootNode.publicKey) {
    throw new Error("Failed to derive wallet keys");
  }

  const privateKey = compressPrivateKey(Buffer.from(stacksNode.privateKey).toString("hex"));

  return {
    address: getAddressFromPrivateKey(privateKey, getTransactionVersion(network)),
    btcAddress: p2wpkh(btcNode.publicKey, network === "mainnet" ? undefined : { bech32: "tb" })
      .address,
    taprootAddress: p2tr(
      taprootNode.publicKey.slice(1),
      network === "mainnet" ? undefined : { bech32: "tb" }
    ).address,
    privateKey,
  };
}

function makeWalletId(name, mnemonic) {
  return createHash("sha256")
    .update(`${name}:${mnemonic}:${Date.now()}:${randomBytes(8).toString("hex")}`)
    .digest("hex")
    .slice(0, 16);
}

class WalletManager {
  async listWallets() {
    await ensureStore();
    const index = await readJson(WALLETS_INDEX, { version: 1, wallets: [] });
    return index.wallets;
  }

  async hasWallets() {
    return (await this.listWallets()).length > 0;
  }

  async getActiveWalletId() {
    await ensureStore();
    const config = await readJson(CONFIG_PATH, {
      version: 1,
      activeWalletId: null,
      autoLockMinutes: DEFAULT_TIMEOUT_MINUTES,
    });
    return config.activeWalletId ?? null;
  }

  async setActiveWalletId(walletId) {
    await ensureStore();
    const config = await readJson(CONFIG_PATH, {
      version: 1,
      activeWalletId: null,
      autoLockMinutes: DEFAULT_TIMEOUT_MINUTES,
    });
    config.activeWalletId = walletId;
    await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
  }

  async setAutoLockTimeout(minutes) {
    await ensureStore();
    const config = await readJson(CONFIG_PATH, {
      version: 1,
      activeWalletId: null,
      autoLockMinutes: DEFAULT_TIMEOUT_MINUTES,
    });
    config.autoLockMinutes = minutes;
    await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
  }

  async getAutoLockTimeout() {
    await ensureStore();
    const config = await readJson(CONFIG_PATH, {
      version: 1,
      activeWalletId: null,
      autoLockMinutes: DEFAULT_TIMEOUT_MINUTES,
    });
    return typeof config.autoLockMinutes === "number"
      ? config.autoLockMinutes
      : DEFAULT_TIMEOUT_MINUTES;
  }

  async createWallet(name, password, network = NETWORK) {
    const mnemonic = generateMnemonic(wordlist, 256);
    return this.importWallet(name, mnemonic, password, network);
  }

  async importWallet(name, mnemonic, password, network = NETWORK) {
    await ensureStore();
    if (!validateMnemonic(mnemonic, wordlist)) {
      throw new Error("Invalid mnemonic");
    }
    if (!password || password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    const trimmedMnemonic = mnemonic.trim();
    const walletId = makeWalletId(name, trimmedMnemonic);
    const createdAt = new Date().toISOString();
    const account = deriveAccountFromMnemonicInternal(trimmedMnemonic, network);

    const index = await readJson(WALLETS_INDEX, { version: 1, wallets: [] });
    index.wallets.push({
      id: walletId,
      name,
      btcAddress: account.btcAddress,
      taprootAddress: account.taprootAddress,
      address: account.address,
      network,
      createdAt,
      lastUsed: createdAt,
    });
    await writeFile(WALLETS_INDEX, JSON.stringify(index, null, 2), { mode: 0o600 });
    await writeFile(
      walletPath(walletId),
      JSON.stringify(
        {
          version: 1,
          id: walletId,
          name,
          network,
          createdAt,
          mnemonic: encryptText(trimmedMnemonic, password),
        },
        null,
        2
      ),
      { mode: 0o600 }
    );
    await this.setActiveWalletId(walletId);

    return {
      walletId,
      mnemonic: trimmedMnemonic,
      address: account.address,
      btcAddress: account.btcAddress,
      taprootAddress: account.taprootAddress,
      network,
    };
  }

  async unlock(walletId, password) {
    await ensureStore();
    const wallet = await readJson(walletPath(walletId), null);
    if (!wallet) {
      throw new Error(`Wallet not found: ${walletId}`);
    }
    const mnemonic = decryptText(wallet.mnemonic, password);
    const account = deriveAccountFromMnemonicInternal(mnemonic, wallet.network);
    const timeout = await this.getAutoLockTimeout();
    const expiresAt = timeout === 0 ? null : new Date(Date.now() + timeout * 60_000).toISOString();

    await writeFile(
      SESSION_PATH,
      JSON.stringify(
        {
          walletId,
          network: wallet.network,
          address: account.address,
          btcAddress: account.btcAddress,
          taprootAddress: account.taprootAddress,
          privateKey: account.privateKey,
          expiresAt,
        },
        null,
        2
      ),
      { mode: 0o600 }
    );

    const index = await readJson(WALLETS_INDEX, { version: 1, wallets: [] });
    index.wallets = index.wallets.map((entry) =>
      entry.id === walletId ? { ...entry, lastUsed: new Date().toISOString() } : entry
    );
    await writeFile(WALLETS_INDEX, JSON.stringify(index, null, 2), { mode: 0o600 });
    await this.setActiveWalletId(walletId);

    return {
      ...account,
      network: wallet.network,
    };
  }

  lock() {
    rmSync(SESSION_PATH, { force: true });
  }

  isUnlocked() {
    return !!this.getSessionInfo();
  }

  getSessionInfo() {
    try {
      const session = JSON.parse(readFileSync(SESSION_PATH, "utf8"));
      if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
        rmSync(SESSION_PATH, { force: true });
        return null;
      }
      return {
        walletId: session.walletId,
        address: session.address,
        btcAddress: session.btcAddress,
        taprootAddress: session.taprootAddress,
        privateKey: session.privateKey,
        network: session.network,
        expiresAt: session.expiresAt ? new Date(session.expiresAt) : null,
      };
    } catch {
      return null;
    }
  }

  async switchWallet(walletId) {
    const wallets = await this.listWallets();
    if (!wallets.some((wallet) => wallet.id === walletId)) {
      throw new Error(`Wallet not found: ${walletId}`);
    }
    await this.setActiveWalletId(walletId);
    this.lock();
  }

  async deleteWallet(walletId, password) {
    await this.exportMnemonic(walletId, password);
    const index = await readJson(WALLETS_INDEX, { version: 1, wallets: [] });
    index.wallets = index.wallets.filter((wallet) => wallet.id !== walletId);
    await writeFile(WALLETS_INDEX, JSON.stringify(index, null, 2), { mode: 0o600 });
    await rm(walletPath(walletId), { force: true });
    if ((await this.getActiveWalletId()) === walletId) {
      await this.setActiveWalletId(index.wallets[0]?.id ?? null);
      this.lock();
    }
  }

  async exportMnemonic(walletId, password) {
    const wallet = await readJson(walletPath(walletId), null);
    if (!wallet) {
      throw new Error(`Wallet not found: ${walletId}`);
    }
    return decryptText(wallet.mnemonic, password);
  }

  async rotatePassword(walletId, oldPassword, newPassword) {
    const wallet = await readJson(walletPath(walletId), null);
    if (!wallet) {
      throw new Error(`Wallet not found: ${walletId}`);
    }
    const mnemonic = decryptText(wallet.mnemonic, oldPassword);
    wallet.mnemonic = encryptText(mnemonic, newPassword);
    await writeFile(walletPath(walletId), JSON.stringify(wallet, null, 2), { mode: 0o600 });
    this.lock();
  }
}

let singleton;

export function getWalletManager() {
  if (!singleton) {
    singleton = new WalletManager();
  }
  return singleton;
}

export function deriveAccountFromMnemonic(mnemonic, network = NETWORK) {
  return deriveAccountFromMnemonicInternal(mnemonic.trim(), network);
}
