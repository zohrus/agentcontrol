import AppKit

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate {
    private static let releasesPage = URL(string: "https://github.com/zohrus/agentcontrol/releases")!
    private let server = ServerProcess()
    private let statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    private let loginItem = NSMenuItem()
    private var polling: Task<Void, Never>?

    func applicationDidFinishLaunching(_ notification: Notification) {
        server.start()
        statusItem.menu = makeMenu()
        statusItem.button?.image = NSImage(
            systemSymbolName: "square.stack.3d.up", accessibilityDescription: "AgentControl")
        statusItem.button?.imagePosition = .imageLeading
        show(waiting: nil)
        polling = Task { [weak self] in
            while !Task.isCancelled {
                let count = await SessionPoller.waitingCount()
                self?.show(waiting: count)
                try? await Task.sleep(nanoseconds: 3_000_000_000)
            }
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        polling?.cancel()
        server.stop()
    }

    /// The title is the number of sessions waiting on the user, or a dash when the server is down.
    private func show(waiting: Int?) {
        statusItem.button?.title = waiting.map { String($0) } ?? "–"
    }

    private func makeMenu() -> NSMenu {
        let menu = NSMenu()
        menu.delegate = self
        menu.addItem(item("Open AgentControl", #selector(openApp)))
        menu.addItem(.separator())
        loginItem.title = "Start at login"
        loginItem.action = #selector(toggleLogin)
        loginItem.target = self
        menu.addItem(loginItem)
        menu.addItem(item("Check for updates…", #selector(checkForUpdates)))
        menu.addItem(.separator())
        menu.addItem(item("Quit", #selector(quit)))
        return menu
    }

    private func item(_ title: String, _ action: Selector) -> NSMenuItem {
        let menuItem = NSMenuItem(title: title, action: action, keyEquivalent: "")
        menuItem.target = self
        return menuItem
    }

    func menuWillOpen(_ menu: NSMenu) {
        loginItem.state = LoginItem.isEnabled ? .on : .off
    }

    @objc private func openApp() { NSWorkspace.shared.open(Server.home) }

    @objc private func checkForUpdates() { NSWorkspace.shared.open(Self.releasesPage) }

    @objc private func toggleLogin() {
        do {
            try LoginItem.toggle()
        } catch {
            NSAlert(error: error).runModal()
        }
    }

    @objc private func quit() { NSApp.terminate(nil) }
}
