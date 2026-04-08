import { Pc } from "@stacks/transactions";

export function createFungiblePostCondition(principal, contractId, assetName, code, amount) {
  const builder = Pc.principal(principal);
  const normalizedCode = String(code).toLowerCase();

  switch (normalizedCode) {
    case "eq":
    case "equal":
      return builder.willSendEq(amount).ft(contractId, assetName);
    case "lt":
    case "less":
      return builder.willSendLt(amount).ft(contractId, assetName);
    case "lte":
    case "lessequal":
      return builder.willSendLte(amount).ft(contractId, assetName);
    case "gt":
    case "greater":
      return builder.willSendGt(amount).ft(contractId, assetName);
    case "gte":
    case "greaterequal":
      return builder.willSendGte(amount).ft(contractId, assetName);
    default:
      throw new Error(`Unsupported fungible post-condition code: ${code}`);
  }
}
