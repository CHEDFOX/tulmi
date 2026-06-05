import UIKit

/// Tulmi keyboard (iOS custom keyboard extension).
///
/// A minimal QWERTY with one special key:
///   ✨ Refine → take the whole field → POST /v1/refine → replace with polished text
///
/// Voice (🎙️) is intentionally NOT here: iOS does not give keyboard extensions
/// microphone access. It will be added via an app-handoff flow (open the main
/// Tulmi app to record, then hop back and insert) in a later step — the same
/// approach Wispr Flow uses.
///
/// Refine requires the user to enable "Allow Full Access" for the keyboard
/// (Settings → General → Keyboard → Keyboards), which permits network calls.
class KeyboardViewController: UIInputViewController {

  private var capsOn = false
  private var letterButtons: [UIButton] = []
  private let statusLabel = UILabel()
  private var nextKeyboardButton: UIButton!

  // QWERTY rows (the action row is built separately).
  private let rows: [[String]] = [
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
    ["z", "x", "c", "v", "b", "n", "m"],
  ]

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = UIColor(red: 0.09, green: 0.09, blue: 0.11, alpha: 1) // #15151b-ish
    buildKeyboard()
  }

  // MARK: - Layout

  private func buildKeyboard() {
    let stack = UIStackView()
    stack.axis = .vertical
    stack.alignment = .fill
    stack.distribution = .fillEqually
    stack.spacing = 6
    stack.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(stack)

    NSLayoutConstraint.activate([
      stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 4),
      stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -4),
      stack.topAnchor.constraint(equalTo: view.topAnchor, constant: 6),
      stack.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -6),
    ])

    // Status line (hidden until there's something to say).
    statusLabel.textColor = UIColor(white: 0.7, alpha: 1)
    statusLabel.font = .systemFont(ofSize: 12)
    statusLabel.textAlignment = .center
    statusLabel.text = ""
    statusLabel.isHidden = true
    statusLabel.setContentHuggingPriority(.required, for: .vertical)
    stack.addArrangedSubview(statusLabel)

    // Letter rows.
    for row in rows {
      let rowStack = makeRowStack()
      for key in row {
        let b = makeKeyButton(title: key)
        b.addTarget(self, action: #selector(letterTapped(_:)), for: .touchUpInside)
        letterButtons.append(b)
        rowStack.addArrangedSubview(b)
      }
      stack.addArrangedSubview(rowStack)
    }

    // Row 4: shift, space, delete.
    let utilRow = makeRowStack()
    let shift = makeKeyButton(title: "⇧")
    shift.addTarget(self, action: #selector(shiftTapped), for: .touchUpInside)
    let space = makeKeyButton(title: "space")
    space.addTarget(self, action: #selector(spaceTapped), for: .touchUpInside)
    let del = makeKeyButton(title: "⌫")
    del.addTarget(self, action: #selector(deleteTapped), for: .touchUpInside)
    utilRow.addArrangedSubview(shift)
    utilRow.addArrangedSubview(space)
    space.widthAnchor.constraint(equalTo: shift.widthAnchor, multiplier: 4).isActive = true
    utilRow.addArrangedSubview(del)
    stack.addArrangedSubview(utilRow)

    // Row 5: 🌐 next keyboard, ✨ refine, return.
    let actionRow = makeRowStack()
    nextKeyboardButton = makeKeyButton(title: "🌐")
    nextKeyboardButton.addTarget(self, action: #selector(handleInputModeList(from:with:)), for: .allTouchEvents)
    let refine = makeKeyButton(title: "✨ Refine")
    refine.backgroundColor = UIColor(red: 0.357, green: 0.294, blue: 1, alpha: 1) // #5b4bff
    refine.addTarget(self, action: #selector(refineTapped), for: .touchUpInside)
    let ret = makeKeyButton(title: "return")
    ret.addTarget(self, action: #selector(returnTapped), for: .touchUpInside)
    actionRow.addArrangedSubview(nextKeyboardButton)
    actionRow.addArrangedSubview(refine)
    refine.widthAnchor.constraint(equalTo: nextKeyboardButton.widthAnchor, multiplier: 3).isActive = true
    actionRow.addArrangedSubview(ret)
    stack.addArrangedSubview(actionRow)
  }

  private func makeRowStack() -> UIStackView {
    let s = UIStackView()
    s.axis = .horizontal
    s.alignment = .fill
    s.distribution = .fillProportionally
    s.spacing = 5
    return s
  }

  private func makeKeyButton(title: String) -> UIButton {
    let b = UIButton(type: .system)
    b.setTitle(title, for: .normal)
    b.setTitleColor(.white, for: .normal)
    b.titleLabel?.font = .systemFont(ofSize: 18)
    b.backgroundColor = UIColor(red: 0.11, green: 0.11, blue: 0.15, alpha: 1) // #1c1c25
    b.layer.cornerRadius = 6
    b.translatesAutoresizingMaskIntoConstraints = false
    return b
  }

  // MARK: - Key actions

  @objc private func letterTapped(_ sender: UIButton) {
    guard let t = sender.title(for: .normal) else { return }
    textDocumentProxy.insertText(capsOn ? t.uppercased() : t)
  }

  @objc private func shiftTapped() {
    capsOn.toggle()
    for b in letterButtons {
      let t = b.title(for: .normal) ?? ""
      b.setTitle(capsOn ? t.uppercased() : t.lowercased(), for: .normal)
    }
  }

  @objc private func spaceTapped() { textDocumentProxy.insertText(" ") }

  @objc private func deleteTapped() { textDocumentProxy.deleteBackward() }

  @objc private func returnTapped() { textDocumentProxy.insertText("\n") }

  // MARK: - Refine

  @objc private func refineTapped() {
    let proxy = textDocumentProxy
    let before = proxy.documentContextBeforeInput ?? ""
    let after = proxy.documentContextAfterInput ?? ""
    let full = (before + after).trimmingCharacters(in: .whitespacesAndNewlines)
    guard !full.isEmpty else {
      setStatus("Type something first, then tap ✨")
      return
    }
    setStatus("Refining…")

    TulmiBackend.refine(text: full, targetApp: "Generic") { [weak self] result in
      DispatchQueue.main.async {
        guard let self = self else { return }
        switch result {
        case .success(let refined):
          self.replaceFieldText(before: before, after: after, with: refined)
          self.setStatus("")
        case .failure(let err):
          self.setStatus("Error: \(err.localizedDescription)")
        }
      }
    }
  }

  /// Replace the captured before+after context with new text. iOS only gives us
  /// the context around the cursor (not always the whole field), so this is a
  /// best-effort replacement that matches what the user can see.
  private func replaceFieldText(before: String, after: String, with newText: String) {
    let proxy = textDocumentProxy
    // Move the cursor to the end of the known context.
    proxy.adjustTextPosition(byCharacterOffset: after.count)
    // Delete the whole known context.
    for _ in 0..<(before.count + after.count) { proxy.deleteBackward() }
    proxy.insertText(newText)
  }

  // MARK: - Status

  private func setStatus(_ text: String) {
    statusLabel.text = text
    statusLabel.isHidden = text.isEmpty
  }
}
