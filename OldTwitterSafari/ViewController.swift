import Cocoa
import SafariServices

class ViewController: NSViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        let label = NSTextField(labelWithString: "Enable OldTwitter Safari in Safari → Settings → Extensions.")
        label.translatesAutoresizingMaskIntoConstraints = false
        label.alignment = .center
        label.font = NSFont.systemFont(ofSize: 14)
        view.addSubview(label)
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            label.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 20),
            label.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -20)
        ])
    }
    override var representedObject: Any? {
        didSet {}
    }
}
