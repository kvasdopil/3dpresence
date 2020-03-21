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
    const globalChannel = 'global-channel';
    let webRtcPhone;
    // An RTCConfiguration dictionary from the browser WebRTC API
    // Add STUN and TURN server information here for WebRTC calling
    const rtcConfig = {};
    const username = 'client';

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

    const myAudioVideoStream = await initClientStream();

    // WebRTC phone object event for when the remote peer's video becomes available.
    const onPeerStream = (webRTCTrackEvent) => {
        console.log('Peer audio/video stream now available');
        const peerStream = webRTCTrackEvent.streams[0];
        // window.peerStream = peerStream;
        remoteVideo.srcObject = peerStream;
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
    // Lists the online users in the UI and registers a call method to the click event
    //     When a user clicks a peer's name in the online list, the app calls that user.
    const addToOnlineUserList = (occupant) => {
        if (occupant.state && occupant.state.name === 'server') {
            webRtcPhone.callUser(occupant.uuid, {
                myStream: myAudioVideoStream
            });
        }
    }

    const onInit = (status, response) => {
        response.channels[globalChannel].occupants.forEach(addToOnlineUserList);
    }

    const onPresence = (status, response) => {
        if (status.error) {
            console.error(status.error);
        } else if (status.channel === globalChannel) {
            if (status.action === "join" || status.action === "state-change") {
                addToOnlineUserList(status, response);
            }
        }
    };

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
                        name: username
                    },
                    channels: [globalChannel],
                    uuid: pubnub.getUUID()
                });
                pubnub.hereNow({
                    channels: [globalChannel],
                    includeUUIDs: true,
                    includeState: true
                }, onInit)
            }
        },
        presence: onPresence
    });
    pubnub.subscribe({
        channels: [globalChannel],
        withPresence: true
    });
    window.ismyuuid = pubnub.getUUID();
    window.onbeforeunload = (event) => {
        pubnub.unsubscribe({
            channels: [globalChannel]
        });
    };

    webRtcPhone = new WebRtcPhone({
        rtcConfig,
        ignoreNonTurn: false,
        myStream: myAudioVideoStream,
        onPeerStream,   // is required
        onIncomingCall: () => { }, // is required
        onCallResponse, // is required
        onDisconnect,   // is required
        pubnub          // is required
    });
};

if (window.navigator.platform !== 'MacIntel') {
    client();
}
