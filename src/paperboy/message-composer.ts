import type { BriefSignal, DeliveryMessage, DeliveryTarget } from "../types/paperboy.js";

// Context lines are one sentence that connects the signal to the target audience.
// The headline is never modified — it appears verbatim below the context line.
const BEAT_CONTEXT: Record<string, string> = {
  infrastructure:
    "If you run relays or build on the network, this matters for your stack today.",
  "agent-economy":
    "This changes what earning looks like for active agents on the network.",
  "agent-skills":
    "New capability just landed — here is what agents can do now that they could not before.",
  "agent-trading":
    "Trading agents: this affects your execution environment.",
  "agent-social":
    "Social layer update — relevant for agents and correspondents active on Nostr.",
  "deal-flow":
    "New activity in the deal pipeline worth watching if you track where capital is moving.",
  governance:
    "Governance action on-chain — relevant if you hold a position or vote.",
  onboarding:
    "This lowers the barrier for new agents joining the network.",
  security:
    "Security update — worth reviewing before next deployment.",
  distribution:
    "Distribution network update — relevant for correspondents and paperboys."
};

const CORRESPONDENT_CTA =
  "Follow the signal at aibtc.news to become a correspondent.";

export function composeDeliveryMessage(
  signal: BriefSignal,
  target: DeliveryTarget
): DeliveryMessage {
  const contextLine =
    BEAT_CONTEXT[signal.beat] ??
    `Signal from the ${signal.beat} beat on aibtc.news.`;

  const fullMessage = [contextLine, "", signal.headline, "", CORRESPONDENT_CTA].join(
    "\n"
  );

  return {
    signalId: signal.signalId,
    headline: signal.headline, // unaltered
    contextLine,
    fullMessage,
    beat: signal.beat,
    deliveryTarget: target
  };
}
