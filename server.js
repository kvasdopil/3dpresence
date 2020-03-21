const initPubNub = () => {
    const channel = 'global-channel';
    const pubnub = new PubNub({
        publishKey: 'pub-c-27f55276-cf45-4677-886f-9c30d1c361ff',
        subscribeKey: 'sub-c-96d014b8-6872-11ea-bfec-9ea4064cf66f'
    });
    pubnub.addListener({
        message: () => { },
        status: (statusEvent) => {
            if (statusEvent.category !== "PNConnectedCategory") {
                return;
            }
            pubnub.setState({
                state: { name: 'server' },
                channels: [channel],
                uuid: pubnub.getUUID()
            });
            pubnub.hereNow({
                channels: [channel],
                includeUUIDs: true,
                includeState: true
            }, () => { });
        },
        presence: () => { }
    });
    pubnub.subscribe({
        channels: [channel],
        withPresence: true
    });
    window.ismyuuid = pubnub.getUUID();
    window.onbeforeunload = (event) => {
        pubnub.unsubscribe({
            channels: [globalChannel]
        });
    };
    return pubnub;
}

const server = async () => {
    const remoteVideo = document.getElementById('remote-video');
    let webRtcPhone;

    const rtcConfig = {};

    let noVideoTimeout; // Used to check if a video connection succeeded
    const noVideoTimeoutMS = 5000; // Error alert if the video fails to connect

    function noVideo() {
        const message = 'No peer connection made.<br>' +
            'Try adding a TURN server to the WebRTC configuration.';
        if (remoteVideo.paused) {
            alert(message);
            clearTimeout(noVideoTimeout);
            webRtcPhone.disconnect(); // disconnects the current phone call
        }
    }

    let myAudioVideoStream; // Local audio and video stream
    try {
        myAudioVideoStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: true,
        });
    } catch (e) {
        alert(e.toString());
    }

    // WebRTC phone object event for when the remote peer's video becomes available.
    const onPeerStream = (webRTCTrackEvent) => {
        console.log('Peer audio/video stream now available');
        const peerStream = webRTCTrackEvent.streams[0];
        // window.peerStream = peerStream;
        remoteVideo.srcObject = peerStream;
    };
    // WebRTC phone object event for when a remote peer attempts to call you.
    const onIncomingCall = (fromUuid, callResponseCallback) => {
        webRtcPhone.disconnect();
        noVideoTimeout = setTimeout(noVideo, noVideoTimeoutMS);
        callResponseCallback({ acceptedCall: true });
    };
    // WebRTC phone object event for when the remote peer responds to your call request.
    const onCallResponse = (acceptedCall) => {
        if (acceptedCall) {
            noVideoTimeout = setTimeout(noVideo, noVideoTimeoutMS);
        }
    };
    // WebRTC phone object event for when a call disconnects or timeouts.
    const onDisconnect = () => {
        clearTimeout(noVideoTimeout);
    };

    // WebRTC phone object configuration.
    let config = {
        rtcConfig,
        ignoreNonTurn: false,
        myStream: myAudioVideoStream,
        onPeerStream,   // is required
        onIncomingCall, // is required
        onCallResponse, // is required
        onDisconnect,   // is required
        pubnub: initPubNub() // is required
    };
    webRtcPhone = new WebRtcPhone(config);
};


if (window.navigator.platform === 'MacIntel') {
    server();
}
