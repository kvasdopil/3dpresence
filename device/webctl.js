let connectedDevice;

const connect = async () => {
    connectedDevice = await navigator.bluetooth.requestDevice({
        filters: [{
            services: ['3e440001-f5bb-357d-719d-179272e4d4d9']
        }]
    });
};

const set = async (val) => {
    const server = await connectedDevice.gatt.connect();
    const service = await server.getPrimaryService('3e440001-f5bb-357d-719d-179272e4d4d9');
    const char = await service.getCharacteristic('3e440002-f5bb-357d-719d-179272e4d4d9');
    char.writeValue(Uint8Array.from([val]));
}