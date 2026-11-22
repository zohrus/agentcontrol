import Foundation

enum Server {
    static let home = URL(string: "http://127.0.0.1:4747")!
    static let sessions = URL(string: "http://127.0.0.1:4747/api/sessions")!
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
        guard let (data, response) = try? await URLSession.shared.data(for: request),
              (response as? HTTPURLResponse)?.statusCode == 200,
              let list = try? JSONDecoder().decode(SessionList.self, from: data)
        else { return nil }
        return list.sessions.filter { $0.status == "waiting" }.count
    }
}
