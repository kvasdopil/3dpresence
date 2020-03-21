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

const getStream = () => {
  try {
    return navigator.mediaDevices.getUserMedia({
      audio: false,
      video: true,
    });
  } catch (e) {
    alert(e.toString());
  }
}

const server = async () => {
  document.body.innerHTML = 'Waiting for connect';

  let webRtcPhone;
  webRtcPhone = new WebRtcPhone({
    rtcConfig: {},
    ignoreNonTurn: false,
    myStream: await getStream(),
    onPeerStream: () => { document.body.innerHTML = 'Streaming' },
    onIncomingCall: (fromUuid, callResponseCallback) => {
      webRtcPhone.disconnect();
      callResponseCallback({ acceptedCall: true });
      document.body.innerHTML = 'Incoming call';
    },
    onCallResponse: () => { },
    onDisconnect: () => { document.body.innerHTML = 'Disconnect' },
    pubnub: initPubNub(),
  });
};

server();