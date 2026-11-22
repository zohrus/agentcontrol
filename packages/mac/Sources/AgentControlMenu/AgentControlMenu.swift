import AppKit

/// Entry point: a menu bar app with no Dock icon (also set by LSUIElement in Info.plist).
@main
@MainActor
struct AgentControlMenu {
    static func main() {
        let app = NSApplication.shared
        let delegate = AppDelegate()
        app.delegate = delegate
        app.setActivationPolicy(.accessory)
        app.run()
    }
}
