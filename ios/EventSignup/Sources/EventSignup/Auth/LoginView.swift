import SwiftUI

public struct LoginView: View {
    @EnvironmentObject var app: AppModel
    @State private var email = ""
    @State private var password = ""
    @State private var error: String?
    public init() {}

    public var body: some View {
        Form {
            TextField("email", text: $email).textContentType(.emailAddress)
            SecureField("密碼", text: $password)
            Button("登入") { Task { await login() } }.disabled(email.isEmpty || password.count < 8)
            if let error { Text(error).foregroundStyle(.red).font(.footnote) }
        }
        .navigationTitle("登入")
    }

    func login() async {
        do {
            switch try await app.client.login(body: .json(.init(email: email, password: password))) {
            case .ok(let ok): app.didLogin(try ok.body.json)
            case .unauthorized: error = "unauthorized"
            case .badRequest: error = "invalid_input"
            case .undocumented(let code, _): error = "http_\(code)"
            }
        } catch { self.error = "\(error)" }
    }
}
