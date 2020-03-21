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

const initClientPubnub = (onServerDiscovered) => {
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
        state: { name: 'client' },
        channels: [channel],
        uuid: pubnub.getUUID()
      });

      pubnub.hereNow({
        channels: [channel],
        includeUUIDs: true,
        includeState: true
      }, (status, response) => {
        response.channels[channel].occupants.forEach((occupant) => {
          if (occupant.state && occupant.state.name === 'server') {
            onServerDiscovered(occupant.uuid);
          }
        });
      })
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
  return pubnub;
}

const client = async () => {
  let webRtcPhone;
  const myAudioVideoStream = await initClientStream();

  const onServerDiscovered = (id) => {
    webRtcPhone.callUser(id, {
      myStream: myAudioVideoStream
    });
  }

  const pubnub = await initClientPubnub(onServerDiscovered);

  webRtcPhone = new WebRtcPhone({
    rtcConfig: {},
    ignoreNonTurn: false,
    myStream: myAudioVideoStream,
    onPeerStream: (webRTCTrackEvent) => {
      document.getElementById('remote-video').srcObject = webRTCTrackEvent.streams[0];
    },
    onIncomingCall: () => { },
    onCallResponse: () => { },
    onDisconnect: () => { },
    pubnub
  });
};

if (window.navigator.platform !== 'MacIntel') {
  client();
}
