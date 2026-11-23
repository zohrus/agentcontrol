import Foundation

enum Server {
    static let home = URL(string: "http://127.0.0.1:4747")!
    static let sessions = URL(string: "http://127.0.0.1:4747/api/sessions")!
}

/// UNVERIFIED: written without a Swift compiler; build and try a custom AGENTCONTROL_HOME on a Mac.
/// Where the server keeps its data: AGENTCONTROL_HOME when it is set and not empty (with a leading
/// `~` expanded), otherwise `~/.agentcontrol`. The server is started with exactly this folder
/// (`--data-dir`), and the token is read from it, so the two can never disagree.
enum DataFolder {
    static func url(environment: [String: String] = ProcessInfo.processInfo.environment) -> URL {
        if let custom = environment["AGENTCONTROL_HOME"], !custom.isEmpty {
            return URL(fileURLWithPath: (custom as NSString).expandingTildeInPath)
        }
        return FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".agentcontrol")
    }
}

/// The secret the server writes to `<data folder>/api-token` at every start (owner-only file).
enum ApiToken {
    static func read(environment: [String: String] = ProcessInfo.processInfo.environment) -> String? {
        let file = DataFolder.url(environment: environment).appendingPathComponent("api-token")
        guard let text = try? String(contentsOf: file, encoding: .utf8) else { return nil }
        return text.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

private struct SessionList: Decodable {
    struct Item: Decodable { let status: String }
    let sessions: [Item]
}

/// Asks the local server how many sessions are waiting on the user.
enum SessionPoller {
    /// The number of sessions with status "waiting", or nil when the server does not answer.
    static func waitingCount() async -> Int? {
        var request = URLRequest(url: Server.sessions)
        request.timeoutInterval = 2
        // Read on every poll: the token changes each time the server starts.
        guard let token = ApiToken.read() else { return nil }
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        guard let (data, response) = try? await URLSession.shared.data(for: request),
              (response as? HTTPURLResponse)?.statusCode == 200,
              let list = try? JSONDecoder().decode(SessionList.self, from: data)
        else { return nil }
        return list.sessions.filter { $0.status == "waiting" }.count
    }
}
