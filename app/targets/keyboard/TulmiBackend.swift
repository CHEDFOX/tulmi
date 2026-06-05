import Foundation

/// Tiny backend client for the iOS keyboard. Mirrors Android's Net.kt.
///
/// NOTE: until we bridge the app's saved backend URL into the keyboard (via a
/// shared App Group), set baseUrl here. iOS Simulator → your PC = localhost; a
/// physical iPhone → your PC's LAN IP, or your VPS URL.
enum TulmiBackend {
  static var baseUrl = "http://localhost:8770"
  private static let token = "dev" // backend runs with DEV_SKIP_AUTH for now

  enum BackendError: LocalizedError {
    case http(Int, String)
    case badResponse
    case noAudio
    var errorDescription: String? {
      switch self {
      case .http(let code, let body): return "\(code): \(body)"
      case .badResponse: return "Unexpected response"
      case .noAudio: return "Could not read recording"
      }
    }
  }

  static func refine(
    text: String,
    targetApp: String,
    completion: @escaping (Result<String, Error>) -> Void
  ) {
    guard let url = URL(string: "\(baseUrl)/v1/refine") else {
      completion(.failure(BackendError.badResponse))
      return
    }
    var req = URLRequest(url: url)
    req.httpMethod = "POST"
    req.timeoutInterval = 60
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    req.httpBody = try? JSONSerialization.data(withJSONObject: [
      "text": text,
      "targetApp": targetApp,
      "language": "auto",
    ])

    URLSession.shared.dataTask(with: req) { data, response, error in
      if let error = error {
        completion(.failure(error))
        return
      }
      let body = data.flatMap { String(data: $0, encoding: .utf8) } ?? ""
      if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
        completion(.failure(BackendError.http(http.statusCode, body)))
        return
      }
      guard
        let data = data,
        let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
        let refined = json["refinedText"] as? String
      else {
        completion(.failure(BackendError.badResponse))
        return
      }
      completion(.success(refined))
    }.resume()
  }

  /// Upload a recording for transcription + cleanup. Mirrors Android's
  /// Net.transcribeClean (multipart POST /v1/transcribe-clean).
  static func transcribeClean(
    fileURL: URL,
    targetApp: String,
    completion: @escaping (Result<String, Error>) -> Void
  ) {
    guard let url = URL(string: "\(baseUrl)/v1/transcribe-clean") else {
      completion(.failure(BackendError.badResponse))
      return
    }
    guard let audio = try? Data(contentsOf: fileURL) else {
      completion(.failure(BackendError.noAudio))
      return
    }

    let boundary = "Boundary-\(UUID().uuidString)"
    var body = Data()
    func append(_ s: String) { body.append(s.data(using: .utf8)!) }

    append("--\(boundary)\r\n")
    append("Content-Disposition: form-data; name=\"audio\"; filename=\"audio.m4a\"\r\n")
    append("Content-Type: audio/m4a\r\n\r\n")
    body.append(audio)
    append("\r\n")
    for (key, value) in ["targetApp": targetApp, "language": "auto"] {
      append("--\(boundary)\r\n")
      append("Content-Disposition: form-data; name=\"\(key)\"\r\n\r\n")
      append("\(value)\r\n")
    }
    append("--\(boundary)--\r\n")

    var req = URLRequest(url: url)
    req.httpMethod = "POST"
    req.timeoutInterval = 60
    req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
    req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    req.httpBody = body

    URLSession.shared.dataTask(with: req) { data, response, error in
      if let error = error {
        completion(.failure(error))
        return
      }
      let bodyStr = data.flatMap { String(data: $0, encoding: .utf8) } ?? ""
      if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
        completion(.failure(BackendError.http(http.statusCode, bodyStr)))
        return
      }
      guard
        let data = data,
        let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
        let cleaned = json["cleanedText"] as? String
      else {
        completion(.failure(BackendError.badResponse))
        return
      }
      completion(.success(cleaned))
    }.resume()
  }
}
