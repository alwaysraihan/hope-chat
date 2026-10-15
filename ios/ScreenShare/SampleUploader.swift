//
//  SampleUploader.swift
//  ScreenShare
//
//  Encodes ReplayKit video frames as JPEG and writes them to the app over
//  SocketConnection, framed as an HTTP message with the headers that
//  @livekit/react-native-webrtc's ScreenCapturer parses
//  (Content-Length, Buffer-Width, Buffer-Height, Buffer-Orientation).
//  Based on the react-native-webrtc / LiveKit iOS screen-share guide.
//

import Foundation
import ReplayKit

private enum Constants {
    static let bufferMaxLength = 10240
}

class SampleUploader {
    private static var imageContext = CIContext(options: nil)

    private let lock = NSLock()
    private var _isReady = false
    private var isReady: Bool {
        get { lock.lock(); defer { lock.unlock() }; return _isReady }
        set { lock.lock(); _isReady = newValue; lock.unlock() }
    }

    private var connection: SocketConnection

    private var dataToSend: Data?
    private var byteIndex = 0

    private let serialQueue: DispatchQueue

    init(connection: SocketConnection) {
        self.connection = connection
        serialQueue = DispatchQueue(label: "com.hopechat.ScreenShare.sampleUploader")

        setupConnection()
    }

    /// Returns false while the previous frame is still being written, so the
    /// caller drops this frame instead of queueing it.
    @discardableResult func send(sample buffer: CMSampleBuffer) -> Bool {
        guard isReady else {
            return false
        }

        isReady = false

        dataToSend = prepare(sample: buffer)
        byteIndex = 0

        serialQueue.async { [weak self] in
            self?.sendDataChunk()
        }

        return true
    }
}

private extension SampleUploader {
    func setupConnection() {
        connection.didOpen = { [weak self] in
            self?.isReady = true
        }
        connection.streamHasSpaceAvailable = { [weak self] in
            self?.serialQueue.async {
                if let success = self?.sendDataChunk() {
                    self?.isReady = !success
                }
            }
        }
    }

    /// Returns true while there is still data left to write for this frame.
    @discardableResult func sendDataChunk() -> Bool {
        guard let dataToSend = dataToSend else {
            return false
        }

        var bytesLeft = dataToSend.count - byteIndex
        var length = bytesLeft > Constants.bufferMaxLength ? Constants.bufferMaxLength : bytesLeft

        length = dataToSend[byteIndex..<(byteIndex + length)].withUnsafeBytes {
            guard let ptr = $0.bindMemory(to: UInt8.self).baseAddress else {
                return 0
            }

            return connection.writeToStream(buffer: ptr, maxLength: length)
        }

        if length > 0 {
            byteIndex += length
            bytesLeft -= length

            if bytesLeft == 0 {
                self.dataToSend = nil
                byteIndex = 0
            }
        } else {
            debugPrint("writeBufferToStream failure")
        }

        return true
    }

    func prepare(sample buffer: CMSampleBuffer) -> Data? {
        guard let imageBuffer = CMSampleBufferGetImageBuffer(buffer) else {
            debugPrint("image buffer not available")
            return nil
        }

        CVPixelBufferLockBaseAddress(imageBuffer, .readOnly)

        let scaleFactor = 2.0
        let width = CVPixelBufferGetWidth(imageBuffer) / Int(scaleFactor)
        let height = CVPixelBufferGetHeight(imageBuffer) / Int(scaleFactor)
        let orientation = CMGetAttachment(buffer, key: RPVideoSampleOrientationKey as CFString, attachmentModeOut: nil)?.uintValue ?? 0

        let scaleTransform = CGAffineTransform(scaleX: CGFloat(1.0 / scaleFactor), y: CGFloat(1.0 / scaleFactor))
        let bufferData = jpegData(from: imageBuffer, scale: scaleTransform)

        CVPixelBufferUnlockBaseAddress(imageBuffer, .readOnly)

        guard let messageData = bufferData else {
            debugPrint("corrupted image buffer")
            return nil
        }

        let httpResponse = CFHTTPMessageCreateResponse(nil, 200, nil, kCFHTTPVersion1_1).takeRetainedValue()
        CFHTTPMessageSetHeaderFieldValue(httpResponse, "Content-Length" as CFString, String(messageData.count) as CFString)
        CFHTTPMessageSetHeaderFieldValue(httpResponse, "Buffer-Width" as CFString, String(width) as CFString)
        CFHTTPMessageSetHeaderFieldValue(httpResponse, "Buffer-Height" as CFString, String(height) as CFString)
        CFHTTPMessageSetHeaderFieldValue(httpResponse, "Buffer-Orientation" as CFString, String(orientation) as CFString)

        CFHTTPMessageSetBody(httpResponse, messageData as CFData)

        let serializedMessage = CFHTTPMessageCopySerializedMessage(httpResponse)?.takeRetainedValue() as Data?

        return serializedMessage
    }

    func jpegData(from buffer: CVPixelBuffer, scale scaleTransform: CGAffineTransform) -> Data? {
        let image = CIImage(cvPixelBuffer: buffer).transformed(by: scaleTransform)

        guard let colorSpace = image.colorSpace else {
            return nil
        }

        let options: [CIImageRepresentationOption: Float] = [
            kCGImageDestinationLossyCompressionQuality as CIImageRepresentationOption: 1.0,
        ]

        return SampleUploader.imageContext.jpegRepresentation(of: image, colorSpace: colorSpace, options: options)
    }
}
