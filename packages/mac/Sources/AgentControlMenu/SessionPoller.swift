import Foundation

enum Server {
    static let home = URL(string: "http://127.0.0.1:4747")!
    static let sessions = URL(string: "http://127.0.0.1:4747/api/sessions")!
}

/// The secret the server writes to `<data folder>/api-token` at every start (owner-only file).
enum ApiToken {
    static func read(environment: [String: String] = ProcessInfo.processInfo.environment) -> String? {
        let home = environment["AGENTCONTROL_HOME"].map { URL(fileURLWithPath: $0) }
            ?? FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".agentcontrol")
        let file = home.appendingPathComponent("api-token")
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
