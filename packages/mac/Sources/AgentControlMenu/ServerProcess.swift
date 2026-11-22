import Foundation

/// Runs the bundled `agentcontrol` server as a child process and stops it on quit.
/// The relay daemon is not a child of this process, so it keeps running after Quit.
final class ServerProcess {
    private var child: Process?
    private let resources = Bundle.main.resourceURL ?? URL(fileURLWithPath: ".")

    func start() {
        guard child == nil else { return }
        let process = Process()
        process.executableURL = resources.appendingPathComponent("agentcontrol")
        process.environment = environment()
        if let log = openLog() {
            process.standardOutput = log
            process.standardError = log
        }
        do {
            try process.run()
            child = process
        } catch {
            NSLog("AgentControl: could not start the server: \(error)")
        }
    }

    /// Asks the server to shut down (SIGTERM) and kills it if it has not stopped after 5 seconds.
    func stop() {
        guard let process = child else { return }
        child = nil
        process.terminate()
        let deadline = Date().addingTimeInterval(5)
        while process.isRunning && Date() < deadline {
            Thread.sleep(forTimeInterval: 0.05)
        }
        if process.isRunning { kill(process.processIdentifier, SIGKILL) }
    }

    /// The server finds its relay through AGENTCONTROL_RELAY_CMD, a JSON array of strings.
    private func environment() -> [String: String] {
        var env = ProcessInfo.processInfo.environment
        let relay = resources.appendingPathComponent("agentcontrol-relay").path
        if let data = try? JSONSerialization.data(withJSONObject: [relay]),
           let json = String(data: data, encoding: .utf8) {
            env["AGENTCONTROL_RELAY_CMD"] = json
        }
        return env
    }

    private func openLog() -> FileHandle? {
        let manager = FileManager.default
        let dir = manager.homeDirectoryForCurrentUser.appendingPathComponent("Library/Logs/AgentControl")
        try? manager.createDirectory(at: dir, withIntermediateDirectories: true)
        let file = dir.appendingPathComponent("app.log")
        if !manager.fileExists(atPath: file.path) {
            manager.createFile(atPath: file.path, contents: nil)
        }
        let handle = try? FileHandle(forWritingTo: file)
        _ = try? handle?.seekToEnd()
        return handle
    }
}
