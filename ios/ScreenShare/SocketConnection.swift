//
//  SocketConnection.swift
//  ScreenShare
//
//  Client side of the Unix socket that @livekit/react-native-webrtc's
//  ScreenCapturer listens on inside the shared App Group container.
//  Based on the react-native-webrtc / LiveKit iOS screen-share guide.
//

import Foundation

class SocketConnection: NSObject {
    var didOpen: (() -> Void)?
    var didClose: ((Error?) -> Void)?
    var streamHasSpaceAvailable: (() -> Void)?

    private let filePath: String
    private var socketHandle: Int32 = -1
    private var address: sockaddr_un?

    private var inputStream: InputStream?
    private var outputStream: OutputStream?

    private var networkThread: Thread?
    private var shouldKeepRunning = false

    init?(filePath path: String) {
        filePath = path
        socketHandle = Darwin.socket(AF_UNIX, SOCK_STREAM, 0)

        guard socketHandle != -1 else {
            debugPrint("failure: create socket")
            return nil
        }
    }

    func open() -> Bool {
        debugPrint("open socket connection")

        guard FileManager.default.fileExists(atPath: filePath) else {
            debugPrint("failure: socket file missing")
            return false
        }

        guard setupAddress() == true else {
            return false
        }

        guard connectSocket() == true else {
            return false
        }

        setupStreams()

        inputStream?.open()
        outputStream?.open()

        return true
    }

    func close() {
        unscheduleStreams()

        inputStream?.delegate = nil
        outputStream?.delegate = nil

        inputStream?.close()
        outputStream?.close()

        inputStream = nil
        outputStream = nil
    }

    func writeToStream(buffer: UnsafePointer<UInt8>, maxLength length: Int) -> Int {
        outputStream?.write(buffer, maxLength: length) ?? 0
    }
}

extension SocketConnection: StreamDelegate {
    func stream(_ aStream: Stream, handle eventCode: Stream.Event) {
        switch eventCode {
        case .openCompleted:
            debugPrint("client stream open completed")
            if aStream == outputStream {
                didOpen?()
            }
        case .hasBytesAvailable:
            if aStream == inputStream {
                var buffer: UInt8 = 0
                let numberOfBytesRead = inputStream?.read(&buffer, maxLength: 1)
                // The app closed its end (screen share stopped in the call).
                if numberOfBytesRead == 0 && aStream.streamStatus == .atEnd {
                    debugPrint("server socket closed")
                    close()
                    notifyDidClose(error: nil)
                }
            }
        case .hasSpaceAvailable:
            if aStream == outputStream {
                streamHasSpaceAvailable?()
            }
        case .endEncountered:
            debugPrint("client stream end encountered")
            close()
            notifyDidClose(error: nil)
        case .errorOccurred:
            debugPrint("client stream error occurred: \(String(describing: aStream.streamError))")
            close()
            notifyDidClose(error: aStream.streamError)
        default:
            break
        }
    }
}

private extension SocketConnection {
    func setupAddress() -> Bool {
        var addr = sockaddr_un()
        guard filePath.count < MemoryLayout.size(ofValue: addr.sun_path) else {
            debugPrint("failure: fd path is too long")
            return false
        }

        _ = withUnsafeMutablePointer(to: &addr.sun_path.0) { ptr in
            filePath.withCString {
                strncpy(ptr, $0, filePath.count)
            }
        }

        address = addr
        return true
    }

    func connectSocket() -> Bool {
        guard var addr = address else {
            return false
        }

        let status = withUnsafePointer(to: &addr) { ptr in
            ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                Darwin.connect(socketHandle, $0, socklen_t(MemoryLayout<sockaddr_un>.size))
            }
        }

        guard status == noErr else {
            debugPrint("failure: \(status)")
            return false
        }

        return true
    }

    func setupStreams() {
        var readStream: Unmanaged<CFReadStream>?
        var writeStream: Unmanaged<CFWriteStream>?

        CFStreamCreatePairWithSocket(kCFAllocatorDefault, socketHandle, &readStream, &writeStream)

        inputStream = readStream?.takeRetainedValue()
        inputStream?.delegate = self
        inputStream?.setProperty(kCFBooleanTrue, forKey: Stream.PropertyKey(kCFStreamPropertyShouldCloseNativeSocket as String))

        outputStream = writeStream?.takeRetainedValue()
        outputStream?.delegate = self
        outputStream?.setProperty(kCFBooleanTrue, forKey: Stream.PropertyKey(kCFStreamPropertyShouldCloseNativeSocket as String))

        scheduleStreams()
    }

    func scheduleStreams() {
        shouldKeepRunning = true

        networkThread = Thread { [weak self] in
            self?.inputStream?.schedule(in: .current, forMode: .common)
            self?.outputStream?.schedule(in: .current, forMode: .common)

            while self?.shouldKeepRunning == true,
                  RunLoop.current.run(mode: .default, before: .distantFuture) {}
        }

        networkThread?.start()
    }

    func unscheduleStreams() {
        networkThread?.cancel()
        shouldKeepRunning = false
    }

    func notifyDidClose(error: Error?) {
        didClose?(error)
    }
}
