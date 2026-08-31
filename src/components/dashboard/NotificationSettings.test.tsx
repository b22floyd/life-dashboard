// @vitest-environment jsdom
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { subscribeToPushMock, unsubscribeFromPushMock } = vi.hoisted(() => ({
  subscribeToPushMock: vi.fn(),
  unsubscribeFromPushMock: vi.fn(),
}));

// Server Actions reach a real Supabase client via next/headers — mocked the
// same way DataRestorePanel's test mocks restoreDataSection.
vi.mock("@/app/actions/push", () => ({
  subscribeToPush: subscribeToPushMock,
  unsubscribeFromPush: unsubscribeFromPushMock,
}));

function fakeSubscription() {
  return {
    endpoint: "https://push.example.com/abc123",
    toJSON: () => ({
      endpoint: "https://push.example.com/abc123",
      keys: { p256dh: "p256dh-key", auth: "auth-key" },
    }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  };
}

// The component reads NEXT_PUBLIC_VAPID_PUBLIC_KEY at module scope, so
// varying it per test requires resetting the module registry and
// re-importing fresh rather than just reassigning process.env, which
// wouldn't be re-read by an already-evaluated module.
async function loadComponent(vapidKey: string | undefined) {
  vi.resetModules();
  if (vapidKey === undefined) {
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  } else {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = vapidKey;
  }
  const mod = await import("./NotificationSettings");
  return mod.NotificationSettings;
}

function setupBrowserApis({
  supported = true,
  permission = "default" as NotificationPermission,
  existingSubscription = null as ReturnType<typeof fakeSubscription> | null,
  subscribeImpl = vi.fn().mockResolvedValue(fakeSubscription()),
} = {}) {
  const getSubscription = vi.fn().mockResolvedValue(existingSubscription);
  const registration = { pushManager: { getSubscription, subscribe: subscribeImpl } };

  if (supported) {
    Object.defineProperty(window, "PushManager", { value: function PushManager() {}, configurable: true });
    Object.defineProperty(window, "Notification", {
      value: { permission, requestPermission: vi.fn().mockResolvedValue("granted") },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(navigator, "serviceWorker", {
      value: { ready: Promise.resolve(registration) },
      configurable: true,
    });
  } else {
    Object.defineProperty(window, "PushManager", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "serviceWorker", { value: undefined, configurable: true });
  }

  return { registration, getSubscription };
}

beforeEach(() => {
  subscribeToPushMock.mockReset();
  unsubscribeFromPushMock.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("NotificationSettings", () => {
  it("shows 'not configured' when no VAPID key is set, regardless of browser support", async () => {
    setupBrowserApis();
    const NotificationSettings = await loadComponent(undefined);
    render(<NotificationSettings />);
    expect(await screen.findByText(/aren't configured/i)).toBeInTheDocument();
  });

  it("shows 'unsupported' when the browser lacks the required APIs", async () => {
    setupBrowserApis({ supported: false });
    const NotificationSettings = await loadComponent("test-vapid-key");
    render(<NotificationSettings />);
    expect(await screen.findByText(/doesn't support push notifications/i)).toBeInTheDocument();
  });

  it("shows 'denied' when notification permission was already denied", async () => {
    setupBrowserApis({ permission: "denied" });
    const NotificationSettings = await loadComponent("test-vapid-key");
    render(<NotificationSettings />);
    expect(await screen.findByText(/blocked for this site/i)).toBeInTheDocument();
  });

  it("shows an Enable button when supported with no existing subscription", async () => {
    setupBrowserApis({ existingSubscription: null });
    const NotificationSettings = await loadComponent("test-vapid-key");
    render(<NotificationSettings />);
    expect(await screen.findByRole("button", { name: "Enable Notifications" })).toBeInTheDocument();
  });

  it("shows 'enabled' with a Disable button when a subscription already exists", async () => {
    setupBrowserApis({ existingSubscription: fakeSubscription() });
    const NotificationSettings = await loadComponent("test-vapid-key");
    render(<NotificationSettings />);
    expect(await screen.findByText("Notifications enabled")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disable" })).toBeInTheDocument();
  });

  it("enabling requests permission, subscribes, and saves the subscription server-side", async () => {
    const subscription = fakeSubscription();
    const { registration } = setupBrowserApis({
      subscribeImpl: vi.fn().mockResolvedValue(subscription),
    });
    subscribeToPushMock.mockResolvedValue({ success: true });
    const NotificationSettings = await loadComponent("test-vapid-key");
    const user = userEvent.setup();
    render(<NotificationSettings />);

    await user.click(await screen.findByRole("button", { name: "Enable Notifications" }));

    await waitFor(() => expect(screen.getByText("Notifications enabled")).toBeInTheDocument());
    expect(registration.pushManager.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true }),
    );
    expect(subscribeToPushMock).toHaveBeenCalledWith({
      endpoint: "https://push.example.com/abc123",
      keys: { p256dh: "p256dh-key", auth: "auth-key" },
    });
  });

  it("rolls back the browser subscription if saving it server-side fails", async () => {
    const subscription = fakeSubscription();
    setupBrowserApis({ subscribeImpl: vi.fn().mockResolvedValue(subscription) });
    subscribeToPushMock.mockResolvedValue({ error: "Server rejected the subscription." });
    const NotificationSettings = await loadComponent("test-vapid-key");
    const user = userEvent.setup();
    render(<NotificationSettings />);

    await user.click(await screen.findByRole("button", { name: "Enable Notifications" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Server rejected the subscription."),
    );
    expect(subscription.unsubscribe).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Enable Notifications" })).toBeInTheDocument();
  });

  it("does not attempt to subscribe when the permission prompt is denied", async () => {
    const { registration } = setupBrowserApis();
    Object.defineProperty(window.Notification, "requestPermission", {
      value: vi.fn().mockResolvedValue("denied"),
      configurable: true,
    });
    const NotificationSettings = await loadComponent("test-vapid-key");
    const user = userEvent.setup();
    render(<NotificationSettings />);

    await user.click(await screen.findByRole("button", { name: "Enable Notifications" }));

    await waitFor(() => expect(screen.getByText(/blocked for this site/i)).toBeInTheDocument());
    expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
  });

  it("disabling unsubscribes both server-side and in the browser", async () => {
    const subscription = fakeSubscription();
    setupBrowserApis({ existingSubscription: subscription });
    unsubscribeFromPushMock.mockResolvedValue({ success: true });
    const NotificationSettings = await loadComponent("test-vapid-key");
    const user = userEvent.setup();
    render(<NotificationSettings />);

    await user.click(await screen.findByRole("button", { name: "Disable" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Enable Notifications" })).toBeInTheDocument(),
    );
    expect(unsubscribeFromPushMock).toHaveBeenCalledWith("https://push.example.com/abc123");
    expect(subscription.unsubscribe).toHaveBeenCalled();
  });
});
