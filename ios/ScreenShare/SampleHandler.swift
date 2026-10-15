//
//  SampleHandler.swift
//  ScreenShare
//
//  ReplayKit Broadcast Upload Extension for HopeChat call screen sharing.
//  Started from the system broadcast picker shown by VideoCallScreen; forwards
//  screen frames to the app through the socket in the shared App Group, where
//  @livekit/react-native-webrtc publishes them as the screen-share track.
//  Based on the react-native-webrtc / LiveKit iOS screen-share guide.
//

import ReplayKit

private enum Constants {
    // Must match RTCAppGroupIdentifier in this target's and the app's Info.plist.
    static let appGroupIdentifier = "group.com.hopenity.shared"
    // File name ScreenCaptureController in @livekit/react-native-webrtc listens on.
    static let socketFileName = "rtc_SSFD"
}

class SampleHandler: RPBroadcastSampleHandler {
    private var clientConnection: SocketConnection?
    private var uploader: SampleUploader?
    private var didFinish = false

    private var frameCount = 0

    var socketFilePath: String {
        let sharedContainer = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: Constants.appGroupIdentifier)
        return sharedContainer?.appendingPathComponent(Constants.socketFileName).path ?? ""
    }

    override init() {
        super.init()
        if let connection = SocketConnection(filePath: socketFilePath) {
            clientConnection = connection
            setupConnection()

            uploader = SampleUploader(connection: connection)
        }
    }

    override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
        frameCount = 0
        openConnection()
    }

    override func broadcastPaused() {}

    override func broadcastResumed() {}

    override func broadcastFinished() {
        clientConnection?.close()
    }

    override func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType) {
        switch sampleBufferType {
        case RPSampleBufferType.video:
            // Very simple frame-rate cap: send every 3rd frame.
            frameCount += 1
            if frameCount % 3 == 0 {
                uploader?.send(sample: sampleBuffer)
            }
        default:
            break
        }
    }
}

private extension SampleHandler {
    func setupConnection() {
        clientConnection?.didClose = { [weak self] error in
            DispatchQueue.main.async {
                self?.finish(error: error)
            }
        }
    }

    /// Ends the broadcast with a message ReplayKit shows to the user.
    func finish(error: Error?) {
        guard !didFinish else { return }
        didFinish = true

        if let error = error {
            finishBroadcastWithError(error)
        } else {
            // ReplayKit needs an error to stop; this one reads as a normal stop.
            let stopped = NSError(
                domain: RPRecordingErrorDomain,
                code: 0,
                userInfo: [NSLocalizedFailureReasonErrorKey: "Screen sharing stopped."]
            )
            finishBroadcastWithError(stopped)
        }
    }

    func openConnection() {
        let queue = DispatchQueue(label: "com.hopechat.ScreenShare.connectTimer")
        let timer = DispatchSource.makeTimerSource(queue: queue)
        timer.schedule(deadline: .now(), repeating: .milliseconds(100), leeway: .milliseconds(500))
        // The app only listens while a call is sharing; give up if it never does
        // (e.g. the broadcast was started from Control Center outside a call).
        var attempts = 0
        timer.setEventHandler { [weak self] in
            guard self?.clientConnection?.open() == true else {
                attempts += 1
                if attempts >= 150 {
                    timer.cancel()
                    let error = NSError(
                        domain: RPRecordingErrorDomain,
                        code: 0,
                        userInfo: [NSLocalizedFailureReasonErrorKey: "Start screen sharing from a Hopechat video call."]
                    )
                    DispatchQueue.main.async { self?.finish(error: error) }
                }
                return
            }

            timer.cancel()
        }

        timer.resume()
    }
}
