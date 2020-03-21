const client = async () => {
    const remoteVideo = document.getElementById('remote-video');
    const globalChannel = 'global-channel';
    let webRtcPhone;
    const pubnub = new PubNub({
        publishKey: 'pub-c-27f55276-cf45-4677-886f-9c30d1c361ff',
        subscribeKey: 'sub-c-96d014b8-6872-11ea-bfec-9ea4064cf66f'
    });
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

    // This PubNub listener powers the text chat and online user list population.
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
                },
                    (status, response) => {
                        response.channels[globalChannel].occupants
                            .forEach(addToOnlineUserList);
                    });
            }
        },
        presence: (status, response) => {
            if (status.error) {
                console.error(status.error);
            } else if (status.channel === globalChannel) {
                if (status.action === "join" || status.action === "state-change") {
                    addToOnlineUserList(status, response);
                }
            }
        }
    });
    pubnub.subscribe({
        channels: [globalChannel],
        withPresence: true
    });
    window.ismyuuid = pubnub.getUUID();
    // Disconnect PubNub before a user navigates away from the page
    window.onbeforeunload = (event) => {
        pubnub.unsubscribe({
            channels: [globalChannel]
        });
    };
    // WebRTC phone object configuration.
    let config = {
        rtcConfig,
        ignoreNonTurn: false,
        myStream: myAudioVideoStream,
        onPeerStream,   // is required
        onIncomingCall: () => { }, // is required
        onCallResponse, // is required
        onDisconnect,   // is required
        pubnub          // is required
    };
    webRtcPhone = new WebRtcPhone(config);
};

if (window.navigator.platform !== 'MacIntel') {
    client();
}