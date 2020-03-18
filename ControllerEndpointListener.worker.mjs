import usb from 'usb';
import { parentPort, workerData } from 'worker_threads';
import './modules/json/cycle.mjs';

parentPort.on('message', ({ type /*, payload*/ }) => {
  switch (type) {
    default:
      break;
    case 'TERMINATE':
      running = false;
      break;
  }
});

const { idVendor, idProduct, deviceAddress } = JSON.parse(workerData);
let running = true;
let controller = undefined;

for (let potentialController of usb.getDeviceList()) {
  potentialController.deviceDescriptor.idVendor === idVendor &&
    potentialController.deviceDescriptor.idProduct === idProduct &&
    potentialController.deviceAddress === deviceAddress &&
    (controller = potentialController);
}

if (controller) {
  controller.open();
  controller.interface(0).claim();
  let endpoint = undefined;
  for (let entry of controller.interface(0).endpoints) {
    if (entry.constructor.name === 'InEndpoint') {
      endpoint = controller.interface(0).endpoint(entry.address);
    }
  }
  if (!endpoint) {
    parentPort.postMessage({
      error: true,
      type: 'MISSING_ENDPOINT_ERROR',
      payload: null
    });
  }
  if (endpoint) {
    endpoint.timeout = controller.timeout;

    let timeout = undefined;

    const loop = () => {
      console.log(endpoint);
      return setTimeout(async () => {
        const command = await transfer(endpoint);
        console.log(command);
        try {
          parentPort.postMessage({
            type: 'COMMAND',
            payload: command
          });
        } catch (err) {
          parentPort.postMessage({
            error: true,
            type: 'UNKNOWN_ERROR',
            payload: err
          });
        }
        clearTimeout(timeout);
        if (running) {
          timeout = loop();
        }
      });
    };

    timeout = loop();
    function transfer(endpoint) {
      return new Promise((resolve, reject) =>
        eval(`(${endpoint.transfer})`)(
          endpoint.descriptor.wMaxPacketSize,
          (err, data) => {
            err ? reject(err) : resolve(data.toString('hex'));
          }
        )
      );
    }
  }
}
