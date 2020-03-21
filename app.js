const chatInterface = document.getElementById('chat-interface');
const remoteVideo = document.getElementById('remote-video');
const videoModal = document.getElementById('video-modal');
const closeVideoButton = document.getElementById('close-video');
const brokenMyVideo = document.getElementById('broken-my-video');
const usernameModal = document.getElementById('username-input-modal');
const joinButton = document.getElementById('join-button');
const onlineList = document.getElementById('online-list');

const hide = 'hide';
const globalChannel = 'global-channel';
let webRtcPhone;
let pubnub;
// An RTCConfiguration dictionary from the browser WebRTC API
// Add STUN and TURN server information here for WebRTC calling
const rtcConfig = {};
let username; // User's name in the app
let myAudioVideoStream; // Local audio and video stream
let noVideoTimeout; // Used to check if a video connection succeeded
const noVideoTimeoutMS = 5000; // Error alert if the video fails to connect

const init = async () => {
    try {
        const localMediaStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true
        });
        console.log('media okay');
        // Init the audio and video stream on this client
        myAudioVideoStream = localMediaStream;
    } catch (e) {
        alert(e.toString());
    }
}
init();

// Prompt the user for a username input
new Promise((resolve) => {
    joinButton.addEventListener('click', (event) => {
        resolve(window.navigator.platform);
    });
}).then((myUsername) => {
    username = myUsername;
    usernameModal.classList.add(hide);
    initWebRtcApp();
});

const closeVideoEventHandler = (event) => {
    videoModal.classList.add(hide);
    chatInterface.classList.remove(hide);
    clearTimeout(noVideoTimeout);
    webRtcPhone.disconnect(); // disconnects the current phone call
}
// Register a disconnect event handler when the close video button is clicked
closeVideoButton.addEventListener('click', closeVideoEventHandler);

const initWebRtcApp = () => {
    // WebRTC phone object event for when the remote peer's video becomes available.
    const onPeerStream = (webRTCTrackEvent) => {
        console.log('Peer audio/video stream now available');
        const peerStream = webRTCTrackEvent.streams[0];
        window.peerStream = peerStream;
        remoteVideo.srcObject = peerStream;
    };
    // WebRTC phone object event for when a remote peer attempts to call you.
    const onIncomingCall = (fromUuid, callResponseCallback) => {
        webRtcPhone.disconnect();
        videoModal.classList.remove(hide);
        chatInterface.classList.add(hide);
        noVideoTimeout = setTimeout(noVideo, noVideoTimeoutMS);
        callResponseCallback({ acceptedCall: true });
    };
    // WebRTC phone object event for when the remote peer responds to your call request.
    const onCallResponse = (acceptedCall) => {
        console.log('Call response: ', acceptedCall ? 'accepted' : 'rejected');
        if (acceptedCall) {
            videoModal.classList.remove(hide);
            chatInterface.classList.add(hide);
            noVideoTimeout = setTimeout(noVideo, noVideoTimeoutMS);
        }
    };
    // WebRTC phone object event for when a call disconnects or timeouts.
    const onDisconnect = () => {
        console.log('Call disconnected');
        videoModal.classList.add(hide);
        chatInterface.classList.remove(hide);
        clearTimeout(noVideoTimeout);
    };
    // Lists the online users in the UI and registers a call method to the click event
    //     When a user clicks a peer's name in the online list, the app calls that user.
    const addToOnlineUserList = (occupant) => {
        const userId = occupant.uuid;
        const name = occupant.state ? occupant.state.name : null;
        if (!name) return;


        const userListDomElement = document.createElement('div');
        userListDomElement.id = userId;
        userListDomElement.innerHTML = name;
        const alreadyInList = document.getElementById(userId);
        const isMe = pubnub.getUUID() === userId;
        if (alreadyInList) {
            removeFromOnlineUserList(occupant.uuid);
        }
        if (isMe) {
            return;
        }
        onlineList.appendChild(userListDomElement);
        userListDomElement.addEventListener('click', (event) => {
            const userToCall = userId;
            webRtcPhone.callUser(userToCall, {
                myStream: myAudioVideoStream
            });
        });
    }
    const removeFromOnlineUserList = (uuid) => {
        const div = document.getElementById(uuid);
        if (div) div.remove();
    };
    pubnub = new PubNub({
        publishKey: 'pub-c-27f55276-cf45-4677-886f-9c30d1c361ff',
        subscribeKey: 'sub-c-96d014b8-6872-11ea-bfec-9ea4064cf66f'
    });
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
                if (status.action === "join") {
                    addToOnlineUserList(status, response);
                } else if (status.action === "state-change") {
                    addToOnlineUserList(status, response);
                } else if (status.action === "leave") {
                    removeFromOnlineUserList(status.uuid);
                } else if (status.action === "timeout") {
                    removeFromOnlineUserList(response.uuid);
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
        onIncomingCall, // is required
        onCallResponse, // is required
        onDisconnect,   // is required
        pubnub          // is required
    };
    webRtcPhone = new WebRtcPhone(config);
};

function createMessageHTML(messageEvent) {
    const text = messageEvent.message.text;
    const jsTime = parseInt(messageEvent.timetoken.substring(0, 13));
    const dateString = new Date(jsTime).toLocaleString();
    const senderUuid = messageEvent.publisher;
    const senderName = senderUuid === pubnub.getUUID()
        ? username
        : document.getElementById(senderUuid).children[1].innerText;
    const div = document.createElement('div');
    const b = document.createElement('b');
    div.id = messageEvent.timetoken;
    b.innerHTML = `${senderName} (${dateString}): `;
    div.appendChild(b);
    div.innerHTML += text;
    return div;
}

function sortNodeChildren(parent, attribute) {
    const length = parent.children.length;
    for (let i = 0; i < length - 1; i++) {
        if (parent.children[i + 1][attribute] < parent.children[i][attribute]) {
            parent.children[i + 1].parentNode
                .insertBefore(parent.children[i + 1], parent.children[i]);
            i = -1;
        }
    }
}
function noVideo() {
    const message = 'No peer connection made.<br>' +
        'Try adding a TURN server to the WebRTC configuration.';
    if (remoteVideo.paused) {
        alert(message);
        closeVideoEventHandler();
    }
}