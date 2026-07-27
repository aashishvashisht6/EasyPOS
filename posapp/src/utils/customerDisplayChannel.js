// Same-origin, same-browser channel between the Terminal (Cart) and the
// customer-facing second-screen window (CustomerDisplayPage), opened via
// window.open onto a second monitor. BroadcastChannel is scoped per
// POS Profile so two profiles open on the same machine don't cross-talk.
// Kept behind this module so a future "separate device" mode (Frappe
// realtime/socketio instead of BroadcastChannel) only needs to change this
// file, not the Cart/CustomerDisplayPage code that uses it.
const CHANNEL_PREFIX = "easy-pos-customer-display";

export const getCustomerDisplayChannel = (posProfile) =>
  new BroadcastChannel(`${CHANNEL_PREFIX}-${posProfile || "default"}`);

export const sendCustomerDisplayMessage = (channel, type, payload) => {
  channel.postMessage({ type, payload, ts: Date.now() });
};

export const subscribeCustomerDisplayChannel = (channel, handler) => {
  const listener = (event) => handler(event.data);
  channel.addEventListener("message", listener);
  return () => channel.removeEventListener("message", listener);
};
