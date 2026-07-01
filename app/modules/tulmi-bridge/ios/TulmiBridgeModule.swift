import ExpoModulesCore
import AVFoundation
import UIKit

/// Bridges the main app and the Tulmi keyboard extension via the shared App
/// Group `group.com.tulmi.app`. Two responsibilities:
///
///  1. Publish backend URL / user token / dictionary into shared UserDefaults so
///     the extension can read them.
///  2. Run the "keep the mic warm" background audio session. iOS won't let a
///     keyboard extension record on demand from a cold state — Apple's own
///     dictation is exempt, third parties aren't. The workaround every serious
///     voice keyboard uses: the containing app declares Background Modes: audio
///     and holds a silent AVAudioSession alive. As long as that session lives,
///     the extension can call `AVAudioRecorder` instantly, in any host app,
///     with no app switch. When iOS eventually kills the session (24-48h idle,
///     force-quit, memory pressure), the keyboard shows a "Turn on instant
///     voice" chip that deep-links back to `tulmi://prime`, which re-primes.
public class TulmiBridgeModule: Module {
  // Must match the App Group declared in the app + keyboard entitlements.
  private static let appGroup = "group.com.tulmi.app"

  // Shared audio session used for the keep-alive. Held statically so a second
  // start() call is idempotent.
  private static var keepAlivePlayer: AVAudioPlayer?
  // Serial queue used to keep the session start/stop atomic across JS calls.
  private static let audioQueue = DispatchQueue(label: "tulmi.bridge.audio")

  public func definition() -> ModuleDefinition {
    Name("TulmiBridge")

    Function("setKeyboardCredentials") { (baseUrl: String, token: String) in
      let defaults = UserDefaults(suiteName: TulmiBridgeModule.appGroup)
      defaults?.set(baseUrl, forKey: "tulmi.baseUrl")
      defaults?.set(token, forKey: "tulmi.token")
    }

    // Text-expansion dictionary (JSON array of { word, replacement }). The
    // keyboard reads this from the App Group and expands typed triggers.
    Function("setDictionary") { (json: String) in
      let defaults = UserDefaults(suiteName: TulmiBridgeModule.appGroup)
      defaults?.set(json, forKey: "tulmi.dictionary")
    }

    // Read the keyboard's published state from the shared App Group. The
    // keyboard writes these whenever it runs (see KeyboardViewController), so a
    // non-zero lastActive means it's enabled, and fullAccess reflects whether
    // the user granted "Allow Full Access".
    Function("getKeyboardStatus") { () -> [String: Any] in
      let d = UserDefaults(suiteName: TulmiBridgeModule.appGroup)
      let fullAccess = d?.bool(forKey: "tulmi.kb.fullAccess") ?? false
      let lastActive = d?.double(forKey: "tulmi.kb.lastActive") ?? 0
      return [
        "enabled": lastActive > 0,
        "fullAccess": fullAccess,
        "lastActiveMs": lastActive,
      ]
    }

    // ------------------------------------------------------------------------
    // Audio keep-alive — the "instant voice" primer used by PrimeScreen.
    // ------------------------------------------------------------------------

    /// Start (or refresh) the silent background audio session. Idempotent: a
    /// second call while already running just refreshes the App Group timestamp.
    Function("startAudioKeepAlive") { () -> [String: Any] in
      let ok = TulmiBridgeModule.startKeepAlive()
      return [
        "ok": ok,
        "readyAtMs": Date().timeIntervalSince1970 * 1000,
      ]
    }

    /// Stop the keep-alive session (used by the settings "Turn instant voice
    /// off" switch). Idempotent.
    Function("stopAudioKeepAlive") { () -> Bool in
      TulmiBridgeModule.stopKeepAlive()
      return true
    }

    /// Read the current keep-alive state — driven by the App Group flag so the
    /// keyboard extension and the app agree.
    Function("getAudioKeepAliveState") { () -> [String: Any] in
      let d = UserDefaults(suiteName: TulmiBridgeModule.appGroup)
      let ready = d?.bool(forKey: "tulmi.audioReady") ?? false
      let readyAt = d?.double(forKey: "tulmi.audioReadyAt") ?? 0
      return [
        "ready": ready,
        "readyAtMs": readyAt,
      ]
    }
  }

  // MARK: - Keep-alive internals

  /// Bundled 1-second silent audio, base64-decoded on first use. Playing this on
  /// loop with playAndRecord + mixWithOthers holds the AVAudioSession active
  /// without interrupting Spotify / phone calls (they still take priority).
  private static let silentAudioBase64 =
    "UklGRj4AAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YRoAAAA" +
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="

  @discardableResult
  private static func startKeepAlive() -> Bool {
    var ok = false
    audioQueue.sync {
      do {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(
          .playAndRecord,
          mode: .default,
          options: [.mixWithOthers, .defaultToSpeaker, .allowBluetooth]
        )
        try session.setActive(true, options: [.notifyOthersOnDeactivation])

        // Build (or reuse) the silent AVAudioPlayer.
        if keepAlivePlayer == nil {
          guard let data = Data(base64Encoded: silentAudioBase64) else { return }
          let player = try AVAudioPlayer(data: data)
          player.numberOfLoops = -1        // loop forever
          player.volume = 0                 // truly silent to the user
          keepAlivePlayer = player
        }
        keepAlivePlayer?.play()

        // Publish the App Group flags the keyboard reads before allowing an
        // instant-record path.
        let now = Date().timeIntervalSince1970 * 1000
        let d = UserDefaults(suiteName: TulmiBridgeModule.appGroup)
        d?.set(true, forKey: "tulmi.audioReady")
        d?.set(now, forKey: "tulmi.audioReadyAt")
        ok = true
      } catch {
        // Fall through — leave audioReady=false so the keyboard shows the
        // "turn on" chip instead of trying a mic call that will fail.
        NSLog("[TulmiBridge] startKeepAlive failed: \(error.localizedDescription)")
      }
    }
    return ok
  }

  private static func stopKeepAlive() {
    audioQueue.sync {
      keepAlivePlayer?.stop()
      keepAlivePlayer = nil
      try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
      let d = UserDefaults(suiteName: TulmiBridgeModule.appGroup)
      d?.set(false, forKey: "tulmi.audioReady")
      d?.set(0.0, forKey: "tulmi.audioReadyAt")
    }
  }
}
