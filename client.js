const initClientStream = () => {
    try {
        return navigator.mediaDevices.getUserMedia({
            audio: false,
            video: true,
        });
    } catch (e) {
        alert(e.toString());
    }
}

const client = async () => {
    const remoteVideo = document.getElementById('remote-video');
    const channel = 'global-channel';
    let webRtcPhone;

    let noVideoTimeout; // Used to check if a video connection succeeded
    const noVideoTimeoutMS = 5000; // Error alert if the video fails to connect

    function noVideo() {
        const message = 'No peer connection made.<br>' +
            'Try adding a TURN server to the WebRTC configuration.';
        if (remoteVideo.paused) {
            alert(message);
            clearTimeout(noVideoTimeout);
            webRtcPhone.disconnect();
        }
    }

    const myAudioVideoStream = await initClientStream();

    const onInit = (status, response) => {
        response.channels[channel].occupants.forEach((occupant) => {
            if (occupant.state && occupant.state.name === 'server') {
                webRtcPhone.callUser(occupant.uuid, {
                    myStream: myAudioVideoStream
                });
            }
        });
    }

    const pubnub = new PubNub({
        publishKey: 'pub-c-27f55276-cf45-4677-886f-9c30d1c361ff',
        subscribeKey: 'sub-c-96d014b8-6872-11ea-bfec-9ea4064cf66f'
    });
    pubnub.addListener({
        message: () => { },
        status: function (statusEvent) {
            if (statusEvent.category === "PNConnectedCategory") {
                pubnub.setState({
                    state: {
                        name: 'client',
                    },
                    channels: [channel],
                    uuid: pubnub.getUUID()
                });
                pubnub.hereNow({
                    channels: [channel],
                    includeUUIDs: true,
                    includeState: true
                }, onInit)
            }
        },
        presence: () => { },
    });
    pubnub.subscribe({
        channels: [channel],
        withPresence: true
    });
    window.ismyuuid = pubnub.getUUID();
    window.onbeforeunload = (event) => {
        pubnub.unsubscribe({
            channels: [channel]
        });
    };

    webRtcPhone = new WebRtcPhone({
        rtcConfig: {},
        ignoreNonTurn: false,
        myStream: myAudioVideoStream,
        onPeerStream: (webRTCTrackEvent) => {
            remoteVideo.srcObject = webRTCTrackEvent.streams[0];
        },
        onIncomingCall: () => { },
        onCallResponse: (acceptedCall) => {
            if (acceptedCall) {
                noVideoTimeout = setTimeout(noVideo, noVideoTimeoutMS);
            }
        },
        onDisconnect: () => {
            clearTimeout(noVideoTimeout);
        },
        pubnub
    });
};

if (window.navigator.platform !== 'MacIntel') {
    client();
}
